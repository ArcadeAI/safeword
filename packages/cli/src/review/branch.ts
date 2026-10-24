import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from '../../templates/hooks/lib/namespace-root.js';
import {
  isSatisfyingSkipStamp,
  parseReviewStamps,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { runReview } from './coordinator.js';
import { branchReviewIntegrity, validBranchReviewIntegrity, withFileLock } from './job.js';

interface ChangedPath {
  readonly path: string;
  readonly status: string;
}

interface OmittedPath {
  readonly path: string;
  readonly reason: string;
}

interface BranchFinding {
  readonly affected_behavior: string;
  readonly related_paths: readonly string[];
  readonly consequence: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
}

// eslint-disable-next-line complexity -- A finding is credited only after all message parts and pass paths are checked.
function branchFinding(
  finding: CliResult['findings'][number],
  paths: readonly string[],
): BranchFinding | undefined {
  const structured = /^Behavior: (.+?); Paths: (.+?); Consequence: (.+)$/u.exec(finding.message);
  const legacy = /^(.+?) across (.+?): (.+)$/u.exec(finding.message);
  const behavior = structured?.[1] ?? legacy?.[1];
  const pathList = structured?.[2] ?? legacy?.[2];
  const consequence = structured?.[3] ?? legacy?.[3];
  if (!behavior?.trim() || !pathList?.trim() || !consequence?.trim()) return undefined;
  const pathText = structured ? pathList : pathList.replaceAll(' and ', ', ');
  const namedPaths = new Set(pathText.split(',').map(item => item.trim()));
  const related = paths.filter(path => namedPaths.has(path));
  if (related.length === 0) return undefined;
  return {
    affected_behavior: behavior.trim(),
    related_paths: related,
    consequence: consequence.trim(),
    priority: ({ error: 'high', warning: 'medium', info: 'low' } as const)[finding.severity],
    severity: finding.severity,
    message: finding.message,
  };
}

class InvalidIntegrationReference extends Error {}
class IntegrationFetchFailure extends Error {}

interface BranchRecord {
  readonly schema_version: 1;
  readonly id: string;
  readonly order: number;
  readonly ticket_id: string;
  readonly review_phase?: 'implement' | 'verify';
  readonly scope_identity?: string;
  readonly integration_ref: string;
  readonly base: string;
  readonly head: string;
  readonly fetched_at: string;
  readonly coverage: 'complete' | 'partial' | 'none';
  readonly reviewed_paths: readonly string[];
  readonly dirty_paths: readonly string[];
  readonly omitted_paths: readonly OmittedPath[];
  readonly review_passes: readonly {
    paths: readonly string[];
    reviewer: string;
    status: 'approved' | 'changes_requested';
    findings: readonly CliResult['findings'][number][];
  }[];
  readonly branch_findings?: readonly BranchFinding[];
  readonly exit_snapshot: string;
  readonly content_snapshot: string;
  readonly unavailable_reason?: string;
  readonly integrity?: string;
}

interface BranchAcknowledgement {
  readonly schema_version: 1;
  readonly review_id: string;
  readonly ticket_id: string;
  readonly omission_digest: string;
  readonly decision: string;
  readonly disclosure: string;
  readonly integrity?: string;
}

function git(cwd: string, args: readonly string[]): Buffer {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'buffer',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    timeout: 20_000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitText(cwd: string, args: readonly string[]): string {
  return git(cwd, args).toString('utf8').trim();
}

function ticketPath(cwd: string, ticketId: string): string | undefined {
  if (!/^[A-Za-z0-9]+$/u.test(ticketId)) return undefined;
  const tickets = resolveTicketsDirectory(cwd);
  if (!existsSync(tickets)) return undefined;
  const folder = readdirSync(tickets).find(
    name => name === ticketId || name.startsWith(`${ticketId}-`),
  );
  return folder === undefined ? undefined : nodePath.join(tickets, folder, 'ticket.md');
}

function recordTicketReview(ticket: string, reviewId: string): void {
  const content = readFileSync(ticket, 'utf8');
  const marker = 'branch_review_exit_id';
  const current = readFrontmatterScalar(content, marker);
  if (current === reviewId) return;
  const updated =
    current === undefined
      ? content.replace(/^---\r?\n/u, opening => `${opening}${marker}: ${reviewId}\n`)
      : content.replace(/^branch_review_exit_id:[^\n]*$/mu, () => `${marker}: ${reviewId}`);
  if (updated === content) throw new Error('Ticket frontmatter cannot record the branch review');
  const temporary = `${ticket}.${process.pid}.branch-review.tmp`;
  writeFileSync(temporary, updated, { mode: 0o600 });
  renameSync(temporary, ticket);
}

function configuredIntegrationReference(cwd: string): unknown {
  const configPath = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(configPath)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    throw new InvalidIntegrationReference('Safeword config.json is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new InvalidIntegrationReference('Safeword config.json must be an object');
  const branchReview = (raw as { branchReview?: unknown }).branchReview;
  if (branchReview === undefined) return undefined;
  if (typeof branchReview !== 'object' || branchReview === null || Array.isArray(branchReview))
    throw new InvalidIntegrationReference('branchReview configuration must be an object');
  return (branchReview as { integrationRef?: unknown }).integrationRef;
}

function currentUpstream(cwd: string): string | undefined {
  try {
    return gitText(cwd, ['rev-parse', '--symbolic-full-name', '@{upstream}']);
  } catch {
    return undefined;
  }
}

// Git and configuration each have independent failure cases; keep the choice in one place.
// eslint-disable-next-line complexity -- Git config and remote discovery have separate failure branches.
function integrationReference(cwd: string): {
  remote: string;
  branch: string;
  ref: string;
  configured: boolean;
} {
  const configured = configuredIntegrationReference(cwd);
  if (configured !== undefined) {
    if (typeof configured !== 'string')
      throw new InvalidIntegrationReference('Invalid branchReview.integrationRef');
    const match = /^refs\/remotes\/([^/]+)\/(.+)$/u.exec(configured);
    if (match?.[1] === undefined || match[2] === undefined)
      throw new InvalidIntegrationReference(
        'branchReview.integrationRef must name a remote-tracking ref',
      );
    const currentBranch = gitText(cwd, ['branch', '--show-current']);
    if (
      (match[2] === currentBranch || configured === currentUpstream(cwd)) &&
      match[2] !== remoteDefaultBranch(cwd, match[1])
    ) {
      throw new InvalidIntegrationReference(
        'The configured integration ref names the current topic branch; choose the remote default integration branch instead.',
      );
    }
    return { remote: match[1], branch: match[2], ref: configured, configured: true };
  }
  const remotes = gitText(cwd, ['remote']).split('\n').filter(Boolean);
  let remote: string | undefined;
  if (remotes.includes('origin')) remote = 'origin';
  else if (remotes.length === 1) remote = remotes[0];
  if (remote === undefined) throw new Error('Cannot choose an integration remote');
  const branch = remoteDefaultBranch(cwd, remote);
  return { remote, branch, ref: `refs/remotes/${remote}/${branch}`, configured: false };
}

function fetchIntegrationReference(
  cwd: string,
  integration: ReturnType<typeof integrationReference>,
): void {
  try {
    git(cwd, ['fetch', integration.remote, `+refs/heads/${integration.branch}:${integration.ref}`]);
  } catch {
    if (integration.configured) {
      let available: string | undefined;
      try {
        available = gitText(cwd, [
          'ls-remote',
          '--heads',
          integration.remote,
          `refs/heads/${integration.branch}`,
        ]);
      } catch {
        available = undefined;
      }
      if (available === '')
        throw new InvalidIntegrationReference(
          'The configured integration ref does not exist on its remote',
        );
    }
    throw new IntegrationFetchFailure('The integration branch could not be fetched');
  }
}

function remoteDefaultBranch(cwd: string, remote: string): string {
  let head: string;
  try {
    head = gitText(cwd, ['ls-remote', '--symref', remote, 'HEAD']);
  } catch {
    throw new IntegrationFetchFailure('The integration remote could not be reached');
  }
  const prefix = 'ref: refs/heads/';
  const suffix = '\tHEAD';
  const line = head
    .split('\n')
    .find(candidate => candidate.startsWith(prefix) && candidate.endsWith(suffix));
  const branch = line?.slice(prefix.length, -suffix.length);
  if (branch === undefined || branch === '')
    throw new Error('Remote default branch is unavailable');
  return branch;
}

// NUL-delimited Git output includes extra path fields for renames.
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- NUL-delimited Git rename and dirty records use distinct shapes.
function changedPaths(cwd: string, base: string): ChangedPath[] {
  const entries = git(cwd, ['diff', '--name-status', '-z', '--find-renames', base, 'HEAD'])
    .toString('utf8')
    .split('\0');
  const changed = new Map<string, ChangedPath>();
  for (let index = 0; index < entries.length - 1;) {
    const status = entries[index++];
    const path = entries[index++];
    if (status === undefined || path === undefined || path === '') break;
    if (status.startsWith('R') || status.startsWith('C')) {
      const destination = entries[index++];
      if (destination !== undefined && destination !== '') {
        changed.set(path, { path, status: `${status}:source` });
        changed.set(destination, { path: destination, status: `${status}:destination` });
      }
    } else {
      changed.set(path, { path, status });
    }
  }
  const dirty = git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    .toString('utf8')
    .split('\0');
  for (let index = 0; index < dirty.length - 1; index += 1) {
    const item = dirty[index];
    if (item === undefined || item.length < 4) continue;
    const status = item.slice(0, 2);
    const path = item.slice(3);
    if (status.includes('R') || status.includes('C')) {
      const source = dirty[++index];
      if (source !== undefined)
        changed.set(source, { path: source, status: `${status}:source+dirty` });
    }
    changed.set(path, { path, status: `${changed.get(path)?.status ?? ''}+dirty:${status}` });
  }
  return changed
    .values()
    .filter(item => !item.path.startsWith('.safeword/state/'))
    .toArray()
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function unavailableReason(cwd: string, item: ChangedPath): string | undefined {
  if (item.status.includes('D') || item.status.includes(':source'))
    return 'deleted or renamed source';
  const sensitive = item.path
    .toLowerCase()
    .split('/')
    .some(
      segment =>
        segment === '.env' ||
        segment.startsWith('.env.') ||
        segment === '.ssh' ||
        segment === 'id_rsa' ||
        segment === 'credentials' ||
        segment.startsWith('credentials.') ||
        segment === 'secret' ||
        segment === 'secrets' ||
        segment.startsWith('secret.'),
    );
  if (sensitive) return 'sensitive path; content withheld from reviewer';
  const attributes = gitText(cwd, [
    'check-attr',
    'generated',
    'linguist-generated',
    '--',
    item.path,
  ]);
  if (
    attributes
      .split('\n')
      .some(line => /: (?:generated|linguist-generated): (?:set|true)$/u.test(line))
  )
    return 'marked as generated';
  try {
    const file = nodePath.join(cwd, item.path);
    if (lstatSync(file).isSymbolicLink()) return 'symbolic link; content withheld from reviewer';
    if (!statSync(file).isFile()) return 'not a regular file';
    if (statSync(file).size > 256 * 1024) return 'file exceeds reviewer packet limit';
    const bytes = readFileSync(file);
    if (bytes.includes(0)) return 'non-text file';
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'file cannot be read as text';
  }
  return undefined;
}

function noCoverage(ticketId: string, reason: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'BRANCH_REVIEW_UNAVAILABLE',
        message: `No branch work was reviewed: ${reason}`,
        severity: 'warning',
      },
    ],
    data: {
      command: 'review branch',
      ticket_id: ticketId,
      coverage: 'none',
      freshness: 'stale',
      reviewed_paths: [],
      dirty_paths: [],
      omitted_paths: [],
      next_action:
        'Retry the branch review after fixing the Git or ticket problem, or record a reasoned skip.',
    },
  });
}

function fetchRequired(ticketId: string, reason: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'BRANCH_REVIEW_FETCH_REQUIRED',
        message: `No branch work was reviewed: ${reason}. Fetch the integration branch and rerun review.`,
        severity: 'warning',
      },
    ],
    data: {
      command: 'review branch',
      ticket_id: ticketId,
      next_action: 'Fetch the integration branch and rerun review.',
    },
  });
}

function unavailableReview(
  cwd: string,
  ticketId: string,
  ticket: string,
  reason: string,
): CliResult {
  try {
    const head = gitText(cwd, ['rev-parse', 'HEAD']);
    const ticketDirectory = nodePath
      .relative(cwd, nodePath.dirname(ticket))
      .split(nodePath.sep)
      .join('/');
    const snapshots = branchSnapshots(cwd, 'HEAD', ticketDirectory);
    const record = saveRecord(cwd, {
      schema_version: 1,
      id: randomUUID(),
      ticket_id: ticketId,
      review_phase:
        readFrontmatterScalar(readFileSync(ticket, 'utf8'), 'phase') === 'verify'
          ? 'verify'
          : 'implement',
      scope_identity: scopeIdentity(cwd, ''),
      integration_ref: '',
      base: '',
      head,
      fetched_at: new Date().toISOString(),
      coverage: 'none',
      reviewed_paths: [],
      dirty_paths: [],
      omitted_paths: [],
      review_passes: [],
      exit_snapshot: snapshots.exit,
      content_snapshot: snapshots.content,
      unavailable_reason: reason,
    });
    recordTicketReview(ticket, record.id);
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'BRANCH_REVIEW_UNAVAILABLE',
          message: `No branch work was reviewed: ${reason}`,
          severity: 'warning',
        },
      ],
      data: {
        command: 'review branch',
        ticket_id: ticketId,
        review_id: record.id,
        coverage: 'none',
        freshness: 'current',
        reviewed_paths: [],
        dirty_paths: [],
        omitted_paths: [],
        next_action:
          'Retry the review when the integration base is available, or record a reasoned skip.',
      },
    });
  } catch {
    return noCoverage(ticketId, reason);
  }
}

function branchRecordsDirectory(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'state', 'reviews', 'branch');
}

// eslint-disable-next-line complexity -- Configuration and local remote HEAD each have independent failure handling.
function scopeIdentity(cwd: string, ref: string): string {
  const path = nodePath.join(cwd, '.safeword', 'config.json');
  let configured: unknown;
  if (existsSync(path)) {
    try {
      const config: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
        configured = (config as { branchReview?: { integrationRef?: unknown } }).branchReview
          ?.integrationRef;
      }
    } catch {
      configured = '<invalid configuration>';
    }
  }
  const remote = /^refs\/remotes\/([^/]+)\//u.exec(ref)?.[1];
  let remoteHead = '';
  if (configured === undefined && remote !== undefined) {
    try {
      remoteHead = gitText(cwd, ['symbolic-ref', `refs/remotes/${remote}/HEAD`]);
    } catch {
      remoteHead = '<unavailable locally>';
    }
  }
  return digest({ configured, remoteHead });
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRoutineRecord(path: string, ticketDirectory: string): boolean {
  return (
    path.startsWith('.safeword/state/') ||
    path.endsWith('/skill-invocations.log') ||
    path === `${ticketDirectory}/verify.md` ||
    path.startsWith(`${ticketDirectory}/evidence/`) ||
    path.startsWith(`${ticketDirectory}/audit/`)
  );
}

function projectLedger(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const match =
        /^([ \t]*- )\[[ xX]\] (RED|GREEN|REFACTOR|cross-scenario|VERIFIED)(?=[ \t]|$)/u.exec(line);
      if (match?.[1] === undefined || match[2] === undefined) return line;
      const annotation = line.slice(match[0].length).trim();
      if (
        annotation !== '' &&
        !/^[a-f\d]{7,40}$/u.test(annotation) &&
        !annotation.startsWith('skip:') &&
        !annotation.startsWith('commit:')
      )
        return line;
      return `${match[1]}[ ] ${match[2]}`;
    })
    .join('\n');
}

function withoutWorkLog(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex(line => /^## Work Log\s*$/u.test(line));
  if (start === -1) return text;
  let end = start + 1;
  while (end < lines.length && !/^##\s+/u.test(lines[end] ?? '')) end += 1;
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}

function projectExecutionPlan(text: string): string {
  let inChecklist = false;
  return text
    .split('\n')
    .map(line => {
      if (/^##\s+/u.test(line)) inChecklist = /^## Delivery checklist\s*$/u.test(line);
      if (!inChecklist || !line.startsWith('|')) return line;
      const columns = line.split('|');
      if (columns.length !== 11 || columns[1]?.trim() === 'ID' || /^\s*---/u.test(columns[1] ?? ''))
        return line;
      for (let index = 6; index <= 9; index += 1) columns[index] = ' ';
      return columns.join('|');
    })
    .join('\n');
}

function withoutTicketMetadata(text: string): string {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/u.exec(text)?.[0];
  if (!frontmatter) return text;
  let inAnchors = false;
  const withoutAnchors = frontmatter
    .split('\n')
    .filter(line => {
      if (/^phase_anchors:\r?$/u.test(line)) {
        inAnchors = true;
        return false;
      }
      if (inAnchors && /^[ \t]/u.test(line)) return false;
      inAnchors = false;
      return true;
    })
    .join('\n');
  return (
    withoutAnchors.replaceAll(
      /^(?:phase|status|last_modified|branch_review_exit_id):[^\n]*\n/gmu,
      '',
    ) + text.slice(frontmatter.length)
  );
}

function projectedBytes(
  path: string,
  bytes: Buffer | undefined,
  ticketDirectory: string,
): string | undefined {
  if (isRoutineRecord(path, ticketDirectory)) return undefined;
  if (bytes === undefined) return '<deleted>';
  const isTicket = path === `${ticketDirectory}/ticket.md`;
  const isLedger = path === `${ticketDirectory}/test-definitions.md`;
  const isExecutionPlan = path === `${ticketDirectory}/execution-plan.md`;
  if (!isTicket && !isLedger && !isExecutionPlan) {
    return createHash('sha256').update(bytes).digest('hex');
  }
  let text = bytes.toString('utf8');
  if (isTicket) {
    text = withoutTicketMetadata(text);
    text = withoutWorkLog(text);
    text = `${text.trimEnd()}\n`;
  }
  if (isLedger) text = projectLedger(text);
  if (isExecutionPlan) text = projectExecutionPlan(text);
  return digest(text);
}

function baseBytes(cwd: string, base: string, path: string): Buffer | undefined {
  try {
    return git(cwd, ['show', `${base}:${path}`]);
  } catch {
    return undefined;
  }
}

function projectedInventory(
  cwd: string,
  base: string,
  ticketDirectory: string,
): (ChangedPath & { projected: string })[] {
  return changedPaths(cwd, base).flatMap(item => {
    const path = item.path;
    let current: Buffer | undefined;
    try {
      current = readFileSync(nodePath.join(cwd, path));
    } catch {
      current = undefined;
    }
    const projected = projectedBytes(path, current, ticketDirectory);
    if (
      projected === undefined ||
      projected === projectedBytes(path, baseBytes(cwd, base, path), ticketDirectory)
    )
      return [];
    const committed = projectedBytes(path, baseBytes(cwd, 'HEAD', path), ticketDirectory);
    const status =
      projected === committed ? item.status.replaceAll(/\+dirty:[^+]+/gu, '') : item.status;
    return [{ path, status, projected }];
  });
}

function branchSnapshots(
  cwd: string,
  base: string,
  ticketDirectory: string,
): { exit: string; content: string } {
  const entries = projectedInventory(cwd, base, ticketDirectory);
  return {
    exit: digest(entries),
    content: digest(entries.map(({ path, projected }) => ({ path, projected }))),
  };
}

function signedRecord(cwd: string, record: Omit<BranchRecord, 'integrity'>): BranchRecord {
  return { ...record, integrity: branchReviewIntegrity(cwd, JSON.stringify(record)) };
}

function validRecord(cwd: string, record: BranchRecord): boolean {
  const { integrity, ...unsigned } = record;
  return (
    record.schema_version === 1 &&
    typeof integrity === 'string' &&
    validBranchReviewIntegrity(cwd, JSON.stringify(unsigned), integrity)
  );
}

function saveRecord(cwd: string, input: Omit<BranchRecord, 'order' | 'integrity'>): BranchRecord {
  const directory = branchRecordsDirectory(cwd);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return withFileLock(nodePath.join(directory, '.write.lock'), () => {
    const orders = readdirSync(directory).map(name =>
      Number(/^(\d+)-[a-f\d-]+\.json$/u.exec(name)?.[1] ?? 0),
    );
    const order = Math.max(0, ...orders) + 1;
    const record = signedRecord(cwd, { ...input, order });
    const destination = nodePath.join(
      directory,
      `${String(order).padStart(12, '0')}-${input.id}.json`,
    );
    const temporary = `${destination}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    renameSync(temporary, destination);
    return record;
  });
}

function latestRecord(cwd: string, ticketId: string): BranchRecord | undefined {
  const directory = branchRecordsDirectory(cwd);
  if (!existsSync(directory)) return undefined;
  const files = readdirSync(directory)
    .filter(name => /^\d+-[a-f\d-]+\.json$/u.test(name))
    .toSorted((left, right) => right.localeCompare(left));
  for (const file of files) {
    let record: BranchRecord;
    try {
      record = JSON.parse(readFileSync(nodePath.join(directory, file), 'utf8')) as BranchRecord;
    } catch {
      return undefined;
    }
    if (typeof record !== 'object' || record === null) return undefined;
    if (typeof record.ticket_id !== 'string') return undefined;
    if (record.ticket_id !== ticketId) continue;
    return validRecord(cwd, record) ? record : undefined;
  }
  return undefined;
}

function hasPotentialTicketRecord(cwd: string, ticketId: string): boolean {
  const directory = branchRecordsDirectory(cwd);
  if (!existsSync(directory)) return false;
  const files = readdirSync(directory).filter(name => /^\d+-[a-f\d-]+\.json$/u.test(name));
  for (const file of files) {
    try {
      const record: unknown = JSON.parse(readFileSync(nodePath.join(directory, file), 'utf8'));
      if (typeof record !== 'object' || record === null) return true;
      const owner = (record as { ticket_id?: unknown }).ticket_id;
      if (typeof owner !== 'string' || owner === ticketId) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function acknowledgementPath(cwd: string, reviewId: string): string {
  return nodePath.join(branchRecordsDirectory(cwd), `${reviewId}.ack.json`);
}

function disclosureFor(record: BranchRecord, decision: string): string {
  const paths = record.omitted_paths.map(item => `${item.path} (${item.reason})`).join(', ');
  return `Branch review ${record.id}: partial coverage; omitted ${paths}. Agent decision: ${decision}.`;
}

function ticketContext(cwd: string, ticket: string, content: string): string[] {
  const directory = nodePath.dirname(ticket);
  const candidates = [
    ticket,
    nodePath.join(directory, 'spec.md'),
    nodePath.join(directory, 'test-definitions.md'),
  ];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const prefix = '- scenario-gate: ';
    if (!trimmed.startsWith(prefix)) continue;
    const feature = trimmed.slice(prefix.length).trim();
    if (feature.endsWith('.feature') && !feature.includes(' '))
      candidates.push(nodePath.join(cwd, feature));
  }
  return [
    ...new Set(
      candidates
        .filter(path => {
          const relative = nodePath.relative(cwd, path);
          return (
            relative !== '..' &&
            !relative.startsWith(`..${nodePath.sep}`) &&
            existsSync(path) &&
            lstatSync(path).isFile()
          );
        })
        .map(path => nodePath.relative(cwd, path)),
    ),
  ];
}

function proofPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === 'string') return [value[0]];
  return value.flatMap(item => proofPaths(item));
}

function mappedProofPaths(cwd: string, manifest: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(nodePath.join(cwd, manifest), 'utf8'));
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const scenarios = (parsed as { scenarios?: unknown }).scenarios;
  if (typeof scenarios !== 'object' || scenarios === null) return [];
  return Object.values(scenarios).flatMap(registration => proofPaths(registration));
}

function isReviewableProofSource(cwd: string, path: string): boolean {
  if (!path.endsWith('.test.ts')) return false;
  const absolute = nodePath.resolve(cwd, path);
  if (nodePath.relative(cwd, absolute).startsWith('..') || !existsSync(absolute)) return false;
  return unavailableReason(cwd, { path, status: '' }) === undefined;
}

function proofSourceContext(cwd: string, pass: readonly string[]): string[] {
  const manifests = pass.filter(path => path.endsWith('.bdd-proof.json'));
  return [
    ...new Set(
      manifests
        .flatMap(manifest => mappedProofPaths(cwd, manifest))
        .filter(path => isReviewableProofSource(cwd, path)),
    ),
  ];
}

function readAcknowledgement(cwd: string, record: BranchRecord): BranchAcknowledgement | undefined {
  try {
    const ack = JSON.parse(
      readFileSync(acknowledgementPath(cwd, record.id), 'utf8'),
    ) as BranchAcknowledgement;
    const { integrity, ...unsigned } = ack;
    if (
      ack.schema_version !== 1 ||
      ack.review_id !== record.id ||
      ack.ticket_id !== record.ticket_id ||
      ack.omission_digest !== digest(record.omitted_paths) ||
      typeof integrity !== 'string' ||
      !validBranchReviewIntegrity(cwd, JSON.stringify(unsigned), integrity) ||
      ack.disclosure !== disclosureFor(record, ack.decision)
    )
      return undefined;
    return ack;
  } catch {
    return undefined;
  }
}

function workLogContains(content: string, disclosure: string): boolean {
  const workLog = content.split(/^## Work Log\s*$/mu, 2)[1];
  return (
    workLog
      ?.split(/^##\s+/mu, 1)[0]
      ?.split('\n')
      .includes(`- ${disclosure}`) ?? false
  );
}

// The acknowledgement is bound to the latest partial result and its exact omissions.
// eslint-disable-next-line complexity -- Receipt validation and idempotent repair share one public operation.
export function acknowledgeBranchReview(
  cwd: string,
  ticketId: string,
  reviewId: string,
  reason: string,
): CliResult {
  const record = latestRecord(cwd, ticketId);
  if (record?.id !== reviewId || record.coverage !== 'partial' || reason.trim() === '') {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'BRANCH_REVIEW_ACK_INVALID',
          message: 'Only the latest partial review can be acknowledged with a reason.',
          severity: 'warning',
        },
      ],
      data: { command: 'review branch-ack', ticket_id: ticketId },
    });
  }
  const ticket = ticketPath(cwd, ticketId);
  if (ticket === undefined) return noCoverage(ticketId, 'Ticket not found');
  const existing = readAcknowledgement(cwd, record);
  if (existing !== undefined && existing.decision !== reason.trim()) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'BRANCH_REVIEW_ACK_CONFLICT',
          message: 'This review already has a different recorded decision.',
          severity: 'warning',
        },
      ],
      data: { command: 'review branch-ack', ticket_id: ticketId },
    });
  }
  const disclosure = disclosureFor(record, reason.trim());
  if (existing === undefined) {
    const unsigned: Omit<BranchAcknowledgement, 'integrity'> = {
      schema_version: 1,
      review_id: record.id,
      ticket_id: ticketId,
      omission_digest: digest(record.omitted_paths),
      decision: reason.trim(),
      disclosure,
    };
    const ack = { ...unsigned, integrity: branchReviewIntegrity(cwd, JSON.stringify(unsigned)) };
    const destination = acknowledgementPath(cwd, record.id);
    const temporary = `${destination}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(ack)}\n`, { mode: 0o600 });
    renameSync(temporary, destination);
  }
  const content = readFileSync(ticket, 'utf8');
  if (!workLogContains(content, disclosure)) {
    const updated = /^## Work Log\s*$/mu.test(content)
      ? content.replace(/^## Work Log\s*$/mu, heading => `${heading}\n\n- ${disclosure}`)
      : `${content.trimEnd()}\n\n## Work Log\n\n- ${disclosure}\n`;
    writeFileSync(ticket, updated);
  }
  return createResult({
    state: 'changed',
    changed: true,
    effects: { files: [{ kind: 'write', target: nodePath.relative(cwd, ticket) }] },
    data: { command: 'review branch-ack', ticket_id: ticketId, review_id: record.id, disclosure },
  });
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Freshness handles three signed baselines with distinct Git rules.
function reviewIsCurrent(cwd: string, record: BranchRecord, phase: string): boolean {
  try {
    const ticket = ticketPath(cwd, record.ticket_id);
    if (ticket === undefined) return false;
    const ticketDirectory = nodePath
      .relative(cwd, nodePath.dirname(ticket))
      .split(nodePath.sep)
      .join('/');
    if (
      record.scope_identity !== undefined &&
      scopeIdentity(cwd, record.integration_ref) !== record.scope_identity
    )
      return false;
    if (record.unavailable_reason !== undefined) {
      if (phase !== 'verify' && gitText(cwd, ['rev-parse', 'HEAD']) !== record.head) return false;
      const snapshots = branchSnapshots(
        cwd,
        phase === 'verify' ? record.head : 'HEAD',
        ticketDirectory,
      );
      return phase === 'verify'
        ? snapshots.content === record.content_snapshot
        : snapshots.exit === record.exit_snapshot;
    }
    const currentBase = gitText(cwd, ['merge-base', record.integration_ref, 'HEAD']);
    if (currentBase !== record.base) {
      if (phase !== 'verify') return false;
      git(cwd, ['merge-base', '--is-ancestor', record.head, record.integration_ref]);
      return branchSnapshots(cwd, record.base, ticketDirectory).content === record.content_snapshot;
    }
    const snapshots = branchSnapshots(cwd, currentBase, ticketDirectory);
    if (phase === 'verify') return snapshots.content === record.content_snapshot;
    return (
      gitText(cwd, ['rev-parse', 'HEAD']) === record.head && snapshots.exit === record.exit_snapshot
    );
  } catch {
    return false;
  }
}

function branchGateProblem(
  record: BranchRecord,
  fresh: boolean,
  findingsResolved: boolean,
  acknowledged: boolean,
): {
  code: string;
  message: string;
  severity: 'warning';
} {
  if (!fresh)
    return {
      code: 'BRANCH_REVIEW_STALE',
      message: 'The saved branch review is stale; review the changed work again.',
      severity: 'warning',
    };
  if (!findingsResolved)
    return {
      code: 'BRANCH_REVIEW_CHANGES_REQUESTED',
      message: 'The reviewer requested changes; address its findings and review the branch again.',
      severity: 'warning',
    };
  if (record.coverage === 'none')
    return {
      code: 'BRANCH_REVIEW_INCOMPLETE',
      message: 'No branch changes were reviewed; retry or record a reasoned skip.',
      severity: 'warning',
    };
  return acknowledged
    ? {
        code: 'BRANCH_REVIEW_DISCLOSURE_MISSING',
        message: 'The branch review disclosure is missing from the ticket Work Log.',
        severity: 'warning',
      }
    : {
        code: 'BRANCH_REVIEW_INCOMPLETE',
        message: 'The branch review is incomplete; acknowledge its exact omissions or retry.',
        severity: 'warning',
      };
}

function reasonedSkipFor(cwd: string, record: BranchRecord): string | undefined {
  const log = nodePath.join(resolveNamespaceRoot(cwd), 'skill-invocations.log');
  if (!existsSync(log)) return undefined;
  const ticket = ticketPath(cwd, record.ticket_id);
  if (ticket === undefined) return undefined;
  const scope = reviewScope(
    nodePath.basename(nodePath.dirname(ticket)),
    'phase',
    record.review_phase ?? 'implement',
  );
  return parseReviewStamps(readFileSync(log, 'utf8')).findLast(
    stamp => stamp.reviewId === record.id && isSatisfyingSkipStamp(scope, stamp),
  )?.skipReason;
}

function supersededRequestedFindings(cwd: string, record: BranchRecord): string[] {
  const directory = branchRecordsDirectory(cwd);
  if (!existsSync(directory)) return [];
  const files = readdirSync(directory)
    .filter(name => /^\d+-[a-f\d-]+\.json$/u.test(name))
    .toSorted((left, right) => right.localeCompare(left));
  const findings: string[] = [];
  let older = false;
  for (const file of files) {
    let prior: BranchRecord;
    try {
      prior = JSON.parse(readFileSync(nodePath.join(directory, file), 'utf8')) as BranchRecord;
    } catch {
      continue;
    }
    if (!validRecord(cwd, prior)) continue;
    if (prior.id === record.id) {
      older = true;
      continue;
    }
    if (!older || prior.ticket_id !== record.ticket_id) continue;
    findings.push(
      ...prior.review_passes
        .filter(pass => pass.status === 'changes_requested')
        .flatMap(pass => pass.findings.map(finding => finding.message)),
    );
  }
  return [...new Set(findings)];
}

function noneDisclosure(cwd: string, record: BranchRecord, reason: string): string {
  const omitted = record.omitted_paths.map(item => `${item.path} (${item.reason})`).join(', ');
  const earlier = supersededRequestedFindings(cwd, record);
  const earlierNote =
    earlier.length > 0 ? `. Earlier requested changes: ${earlier.join('; ')}` : '';
  return `No branch changes were reviewed (coverage none). Omitted: ${omitted || 'none'}. Reasoned skip: ${reason}${earlierNote}`;
}

function legacyUncoveredResult(ticketId: string, phase: string): CliResult {
  return createResult({
    state: 'healthy',
    findings: [
      {
        code: 'BRANCH_REVIEW_LEGACY_UNCOVERED',
        message: 'This ticket entered verification before branch-review tracking was installed.',
        severity: 'info',
      },
    ],
    data: {
      command: 'review branch-check',
      ticket_id: ticketId,
      phase,
      coverage: 'none',
      freshness: 'current',
      legacy_uncovered: true,
      may_advance: true,
    },
  });
}

function mayAdvanceBranchReview(
  record: BranchRecord,
  fresh: boolean,
  findingsResolved: boolean,
  disclosed: boolean,
  skipReason: string | undefined,
): boolean {
  return (
    fresh &&
    findingsResolved &&
    (record.coverage === 'complete' || disclosed || skipReason !== undefined)
  );
}

// eslint-disable-next-line complexity -- The gate separates current, reviewed, acknowledged, and disclosed evidence.
export function checkBranchReview(cwd: string, ticketId: string, phase: string): CliResult {
  if (phase !== 'implement' && phase !== 'verify') {
    return noCoverage(ticketId, 'Branch review can only check implementation exit or completion');
  }
  const ticket = ticketPath(cwd, ticketId);
  const marker =
    ticket === undefined
      ? undefined
      : readFrontmatterScalar(readFileSync(ticket, 'utf8'), 'branch_review_exit_id');
  const record = latestRecord(cwd, ticketId);
  if (
    phase === 'verify' &&
    marker === undefined &&
    record === undefined &&
    !hasPotentialTicketRecord(cwd, ticketId)
  ) {
    return legacyUncoveredResult(ticketId, phase);
  }
  if (record === undefined || marker !== record.id) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'BRANCH_REVIEW_MISSING',
          message: 'No current branch review matches the ticket review marker.',
          severity: 'warning',
        },
      ],
      data: {
        command: 'review branch-check',
        ticket_id: ticketId,
        phase,
        coverage: 'none',
        freshness: 'stale',
        may_advance: false,
      },
    });
  }
  const fresh = reviewIsCurrent(cwd, record, phase);
  const acknowledgement =
    record.coverage === 'partial' ? readAcknowledgement(cwd, record) : undefined;
  const disclosed =
    acknowledgement !== undefined &&
    ticket !== undefined &&
    workLogContains(readFileSync(ticket, 'utf8'), acknowledgement.disclosure);
  const findingsResolved = record.review_passes.every(pass => pass.status === 'approved');
  const skipReason = record.coverage === 'none' ? reasonedSkipFor(cwd, record) : undefined;
  const mayAdvance = mayAdvanceBranchReview(record, fresh, findingsResolved, disclosed, skipReason);
  const skipEligible =
    fresh &&
    findingsResolved &&
    record.coverage === 'none' &&
    (phase === 'implement' ||
      record.review_phase === 'implement' ||
      record.unavailable_reason !== undefined);
  return createResult({
    state: mayAdvance ? 'healthy' : 'action_required',
    findings: mayAdvance
      ? []
      : [
          branchGateProblem(record, fresh, findingsResolved, acknowledgement !== undefined),
          ...record.review_passes.flatMap(pass => pass.findings),
        ],
    data: {
      command: 'review branch-check',
      ticket_id: ticketId,
      phase,
      review_id: record.id,
      coverage: record.coverage,
      freshness: fresh ? 'current' : 'stale',
      may_advance: mayAdvance,
      skip_eligible: skipEligible,
      omitted_paths: record.omitted_paths,
      branch_findings: record.branch_findings ?? [],
      fetched_at: record.fetched_at,
      ...(disclosed && { disclosure: acknowledgement.disclosure }),
      ...(skipReason !== undefined && { disclosure: noneDisclosure(cwd, record, skipReason) }),
    },
  });
}

function coverageFor(
  omitted: readonly OmittedPath[],
  dirty: readonly string[],
  reviewedPaths: number,
): BranchRecord['coverage'] {
  if (reviewedPaths === 0) return 'none';
  return omitted.length === 0 && dirty.length === 0 ? 'complete' : 'partial';
}

function nextActionFor(coverage: BranchRecord['coverage']): string {
  if (coverage === 'partial')
    return 'Review or acknowledge the omitted paths before leaving implementation.';
  if (coverage === 'none') return 'Retry the review or record a reasoned skip.';
  return 'Address findings, then leave implementation.';
}

function reviewPasses(
  cwd: string,
  eligible: readonly string[],
  context: readonly string[],
): string[][] {
  const maxFiles = Math.max(1, 64 - context.length);
  const contextBytes = context.reduce(
    (total, path) => total + statSync(nodePath.join(cwd, path)).size,
    0,
  );
  const byteLimit = Math.max(256 * 1024, 768 * 1024 - contextBytes);
  const passes: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const path of eligible) {
    const size = statSync(nodePath.join(cwd, path)).size;
    if (current.length > 0 && (current.length >= maxFiles || bytes + size > byteLimit)) {
      passes.push(current);
      current = [];
      bytes = 0;
    }
    current.push(path);
    bytes += size;
  }
  if (current.length > 0) passes.push(current);
  return passes;
}

// This operation coordinates ticket, Git, and reviewer failures in one public result.
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- This boundary accounts for each Git and reviewer failure in one result.
export async function reviewBranch(
  cwd: string,
  ticketId: string,
  offline: boolean,
): Promise<CliResult> {
  const ticket = ticketPath(cwd, ticketId);
  if (ticket === undefined || !existsSync(ticket))
    return noCoverage(ticketId, 'Active BDD ticket not found');
  const ticketContent = readFileSync(ticket, 'utf8');
  if (
    readFrontmatterScalar(ticketContent, 'type') !== 'feature' ||
    !['implement', 'verify'].includes(readFrontmatterScalar(ticketContent, 'phase') ?? '')
  ) {
    return noCoverage(
      ticketId,
      'Branch review requires a feature ticket in implementation or verification',
    );
  }
  if (offline)
    return fetchRequired(ticketId, 'Fetching the integration branch requires network access');
  const ticketDirectory = nodePath
    .relative(cwd, nodePath.dirname(ticket))
    .split(nodePath.sep)
    .join('/');
  let base: string;
  let head: string;
  let ref: string;
  let fetchedAt: string;
  let inventory: ChangedPath[];
  try {
    const integration = integrationReference(cwd);
    fetchIntegrationReference(cwd, integration);
    fetchedAt = new Date().toISOString();
    ref = integration.ref;
    base = gitText(cwd, ['merge-base', ref, 'HEAD']);
    head = gitText(cwd, ['rev-parse', 'HEAD']);
    inventory = projectedInventory(cwd, base, ticketDirectory);
  } catch (error) {
    if (error instanceof IntegrationFetchFailure) return fetchRequired(ticketId, error.message);
    if (error instanceof InvalidIntegrationReference) {
      return createResult({
        state: 'action_required',
        findings: [
          { code: 'BRANCH_REVIEW_INVALID_SCOPE', message: error.message, severity: 'error' },
        ],
        data: {
          command: 'review branch',
          ticket_id: ticketId,
          next_action: 'Configure the remote default integration branch, then review again.',
        },
      });
    }
    return unavailableReview(
      cwd,
      ticketId,
      ticket,
      error instanceof Error ? error.message : 'Git inventory failed',
    );
  }
  const omitted: OmittedPath[] = [];
  const eligible: string[] = [];
  for (const item of inventory) {
    const reason = unavailableReason(cwd, item);
    if (reason === undefined) eligible.push(item.path);
    else omitted.push({ path: item.path, reason });
  }
  const reviewed: string[] = [];
  const dirtyPaths = inventory
    .filter(item => {
      if (!item.status.includes('dirty:')) return false;
      let current: Buffer | undefined;
      try {
        current = readFileSync(nodePath.join(cwd, item.path));
      } catch {
        current = undefined;
      }
      return (
        projectedBytes(item.path, current, ticketDirectory) !==
        projectedBytes(item.path, baseBytes(cwd, 'HEAD', item.path), ticketDirectory)
      );
    })
    .map(item => item.path);
  const snapshots = branchSnapshots(cwd, base, ticketDirectory);
  const findings: CliResult['findings'][number][] = [];
  const branchFindings: BranchFinding[] = [];
  const passes: {
    paths: string[];
    reviewer: string;
    status: 'approved' | 'changes_requested';
    findings: CliResult['findings'];
  }[] = [];
  const context = ticketContext(cwd, ticket, ticketContent);
  for (const pass of reviewPasses(cwd, eligible, context)) {
    let result: CliResult;
    try {
      const passContext = [...context, ...proofSourceContext(cwd, pass)];
      result = await runReview({
        cwd,
        kind: 'branch-review',
        targets: pass,
        context: [...new Set(passContext)].filter(path => !pass.includes(path)),
      });
    } catch {
      omitted.push(...pass.map(path => ({ path, reason: 'review packet could not be prepared' })));
      continue;
    }
    const data = result.data as
      | {
          status?: unknown;
          actual_reviewer?: unknown;
          author_agent?: unknown;
          independence?: unknown;
        }
      | undefined;
    if (
      (data?.status === 'approved' || data?.status === 'changes_requested') &&
      typeof data.actual_reviewer === 'string'
    ) {
      if (data.independence !== 'cross-agent' || data.actual_reviewer === data.author_agent) {
        findings.push(...result.findings);
        omitted.push(
          ...pass.map(path => ({
            path,
            reason: 'review was not independently confirmed',
          })),
        );
        passes.push({
          paths: pass,
          reviewer: data.actual_reviewer,
          status: data.status,
          findings: result.findings,
        });
        continue;
      }
      const reviewerFindings = result.findings.filter(
        finding => finding.code === 'REVIEWER_FINDING',
      );
      const typed = reviewerFindings.map(finding => branchFinding(finding, pass));
      if (typed.includes(undefined)) {
        findings.push(...result.findings);
        omitted.push(
          ...pass.map(path => ({
            path,
            reason: 'review finding lacks behavior, related files, or consequence',
          })),
        );
        passes.push({
          paths: pass,
          reviewer: data.actual_reviewer,
          status: data.status,
          findings: result.findings,
        });
        continue;
      }
      branchFindings.push(...(typed as BranchFinding[]));
      reviewed.push(...pass.filter(path => !dirtyPaths.includes(path)));
      findings.push(...result.findings);
      passes.push({
        paths: pass,
        reviewer: data.actual_reviewer,
        status: data.status,
        findings: result.findings,
      });
    } else {
      const reason =
        data?.status === 'pending' ? 'review pass is still pending' : 'review pass failed';
      omitted.push(...pass.map(path => ({ path, reason })));
    }
  }
  for (const path of dirtyPaths) {
    if (omitted.every(item => item.path !== path)) {
      omitted.push({
        path,
        reason: 'uncommitted work; commit and review again for complete coverage',
      });
    }
  }
  const coverage = coverageFor(omitted, dirtyPaths, reviewed.length);
  branchFindings.sort(
    (left, right) =>
      ({ high: 0, medium: 1, low: 2 })[left.priority] -
      { high: 0, medium: 1, low: 2 }[right.priority],
  );
  const freshness =
    gitText(cwd, ['rev-parse', 'HEAD']) === head &&
    branchSnapshots(cwd, base, ticketDirectory).exit === snapshots.exit
      ? 'current'
      : 'stale';
  const record = saveRecord(cwd, {
    schema_version: 1,
    id: randomUUID(),
    ticket_id: ticketId,
    review_phase:
      readFrontmatterScalar(ticketContent, 'phase') === 'verify' ? 'verify' : 'implement',
    scope_identity: scopeIdentity(cwd, ref),
    integration_ref: ref,
    base,
    head,
    fetched_at: fetchedAt,
    coverage,
    reviewed_paths: reviewed,
    dirty_paths: dirtyPaths,
    omitted_paths: omitted,
    review_passes: passes,
    branch_findings: branchFindings,
    exit_snapshot: snapshots.exit,
    content_snapshot: snapshots.content,
  });
  recordTicketReview(ticket, record.id);
  return createResult({
    state:
      freshness === 'current' &&
      coverage === 'complete' &&
      passes.every(pass => pass.status === 'approved')
        ? 'healthy'
        : 'action_required',
    findings,
    data: {
      command: 'review branch',
      ticket_id: ticketId,
      review_id: record.id,
      integration_ref: ref,
      base,
      head,
      fetched_at: fetchedAt,
      coverage,
      freshness,
      reviewed_paths: reviewed,
      dirty_paths: dirtyPaths,
      omitted_paths: omitted,
      review_passes: passes,
      branch_findings: branchFindings,
      next_action: passes.some(pass => pass.status === 'changes_requested')
        ? 'Fix the review findings and review the branch again.'
        : nextActionFor(coverage),
    },
  });
}
