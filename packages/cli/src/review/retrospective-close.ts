import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { frontmatterOf } from '../../templates/hooks/lib/phase-provenance.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  approvedRetrospectiveReview,
  retrospectiveCloseTag,
  validRetrospectiveCloseTag,
} from './job.js';
import { parseRetrospectiveAnnotation } from './retrospective-annotation.js';
import { retrospectiveGate, type RetrospectiveGateRequest } from './retrospective-gate.js';
import {
  checkRetrospectiveHistory,
  RETROSPECTIVE_FEATURE,
  RETROSPECTIVE_LEDGER,
  RETROSPECTIVE_TICKET,
} from './retrospective-history.js';
import type { RetrospectiveProofRequest } from './retrospective-proof.js';

interface CloseRecord {
  readonly schema_version: 1;
  readonly ticket: typeof RETROSPECTIVE_TICKET;
  readonly claimPath: string;
  readonly claims: readonly RetrospectiveGateRequest[];
  readonly inputs: Readonly<Record<string, string>>;
  readonly integrity: string;
}

const RECORD_PATH = '.safeword/state/reviews/retrospective-close.json';
const TICKET_PATH = nodePath.join(nodePath.dirname(RETROSPECTIVE_LEDGER), 'ticket.md');

function result(
  command: 'review attest retrospective-close' | 'review gate retrospective-close',
  status: 'approved' | 'blocked',
  reason: string,
): CliResult {
  const wroteRecord = command === 'review attest retrospective-close' && status === 'approved';
  let state: CliResult['state'] = 'healthy';
  if (status === 'blocked') state = 'action_required';
  else if (wroteRecord) state = 'changed';
  return createResult({
    state,
    effects: wroteRecord
      ? { files: [{ kind: 'review-record', target: RECORD_PATH, operation: 'write' }] }
      : undefined,
    findings: [
      {
        code:
          status === 'approved' ? 'RETROSPECTIVE_CLOSE_APPROVED' : 'RETROSPECTIVE_CLOSE_BLOCKED',
        message: reason,
        severity: status === 'approved' ? 'info' : 'warning',
      },
    ],
    data: {
      command,
      status,
      ticketId: RETROSPECTIVE_TICKET,
      ledger: RETROSPECTIVE_LEDGER,
    },
  });
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function contained(root: string, relative: string): string {
  if (
    relative === '' ||
    nodePath.isAbsolute(relative) ||
    relative.split('/').some(part => ['', '.', '..'].includes(part))
  )
    throw new Error('Retrospective close input escapes the project.');
  const canonicalRoot = realpathSync.native(root);
  const canonical = realpathSync.native(nodePath.join(root, relative));
  const inside = nodePath.relative(canonicalRoot, canonical);
  if (
    inside.startsWith(`..${nodePath.sep}`) ||
    ['..', ''].includes(inside) ||
    nodePath.isAbsolute(inside)
  ) {
    throw new Error('Retrospective close input escapes the project.');
  }
  return canonical;
}

function ticketClaim(root: string): string {
  const ticket = frontmatterOf(readFileSync(contained(root, TICKET_PATH), 'utf8'));
  if (ticket?.id !== RETROSPECTIVE_TICKET || typeof ticket.retrospective_claim !== 'string') {
    throw new Error('CKWE2D has no retrospective opt-in.');
  }
  return ticket.retrospective_claim;
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Ledger claims require distinct headings and receipts.
function claimsFromLedger(root: string): RetrospectiveGateRequest[] {
  const content = readFileSync(contained(root, RETROSPECTIVE_LEDGER), 'utf8');
  const claims: RetrospectiveGateRequest[] = [];
  const seen = new Set<string>();
  const headings = new Set<string>();
  let duplicateHeading = false;
  let scenario: string | undefined;
  for (const line of content.split('\n')) {
    const heading = /^#{2,6} Scenario: (.+)$/u.exec(line);
    if (/^#{1,6}\s+/u.test(line)) {
      scenario = heading?.[1]?.trim();
      if (scenario !== undefined) {
        if (headings.has(scenario)) duplicateHeading = true;
        headings.add(scenario);
      }
    }
    const annotation = parseRetrospectiveAnnotation(line);
    if (annotation?.kind === 'invalid') throw new Error(annotation.reason);
    if (annotation?.kind !== 'claim') continue;
    if (scenario === undefined || seen.has(scenario)) {
      throw new Error('Each VERIFIED row needs one unique scenario heading.');
    }
    seen.add(scenario);
    claims.push({
      ticketId: RETROSPECTIVE_TICKET,
      ledger: RETROSPECTIVE_LEDGER,
      scenario,
      eligibilityId: annotation.eligibilityId,
      proofId: annotation.proofId,
    });
  }
  if (claims.length === 0) throw new Error('No checked VERIFIED rows need closing proof.');
  if (duplicateHeading) throw new Error('VERIFIED requires unique scenario headings.');
  return claims;
}

function reviewedTargets(
  root: string,
  id: string,
  kind: 'retrospective-eligibility' | 'retrospective-proof',
): readonly string[] {
  const targets = approvedRetrospectiveReview(root, id, kind);
  if (targets === undefined) throw new Error('A retrospective review is no longer approved.');
  return targets;
}

function claimInputPaths(root: string, claim: RetrospectiveGateRequest): string[] {
  const eligibilityTargets = reviewedTargets(
    root,
    claim.eligibilityId,
    'retrospective-eligibility',
  );
  const proofTargets = reviewedTargets(root, claim.proofId, 'retrospective-proof');
  if (eligibilityTargets.length !== 1 || proofTargets.length !== 2) {
    throw new Error('Retrospective review targets are incomplete.');
  }
  const eligibility = JSON.parse(
    readFileSync(contained(root, eligibilityTargets[0] ?? ''), 'utf8'),
  ) as { blobs?: readonly { currentPath?: string }[] };
  if (!Array.isArray(eligibility.blobs)) throw new Error('Eligibility paths are missing.');
  const currentPaths = eligibility.blobs.map(blob => {
    if (typeof blob.currentPath !== 'string') throw new Error('Eligibility path is missing.');
    return blob.currentPath;
  });
  const proof = JSON.parse(
    readFileSync(contained(root, proofTargets[0] ?? ''), 'utf8'),
  ) as RetrospectiveProofRequest;
  return [
    `.safeword/state/reviews/${claim.eligibilityId}.json`,
    `.safeword/state/reviews/${claim.proofId}.json`,
    ...eligibilityTargets,
    ...proofTargets,
    ...currentPaths,
    proof.testFile,
    proof.implementationPath,
    ...proof.supportFiles,
  ];
}

function inputPaths(root: string, claims: readonly RetrospectiveGateRequest[]): string[] {
  const paths = new Set([RETROSPECTIVE_LEDGER, RETROSPECTIVE_FEATURE]);
  for (const claim of claims) {
    for (const path of claimInputPaths(root, claim)) paths.add(path);
  }
  return [...paths].toSorted((left, right) => left.localeCompare(right, 'en'));
}

function inputDigests(root: string, paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(paths.map(path => [path, sha256(readFileSync(contained(root, path)))]));
}

function historyStillReachable(root: string, claims: readonly RetrospectiveGateRequest[]): boolean {
  const ids = new Set(claims.map(claim => claim.eligibilityId));
  for (const id of ids) {
    const [target] = reviewedTargets(root, id, 'retrospective-eligibility');
    if (target === undefined) return false;
    const eligibility = JSON.parse(readFileSync(contained(root, target), 'utf8')) as {
      ticketId: string;
      cutoff: string;
      baseline: string;
      rationale: string;
    };
    if (!checkRetrospectiveHistory(root, eligibility).eligibleForReview) return false;
  }
  return true;
}

function unsigned(record: CloseRecord): Omit<CloseRecord, 'integrity'> {
  // eslint-disable-next-line sonarjs/no-unused-vars -- typed omission of the signature
  const { integrity: _integrity, ...body } = record;
  return body;
}

/** Run both isolated executions for every checked CKWE2D row before closing. */
export function attestRetrospectiveClose(
  root: string,
  ticketId: string,
  ledger: string,
): CliResult {
  try {
    if (ticketId !== RETROSPECTIVE_TICKET || ledger !== RETROSPECTIVE_LEDGER) {
      throw new Error('Only the CKWE2D ledger may use retrospective closing proof.');
    }
    const claimPath = ticketClaim(root);
    const claims = claimsFromLedger(root);
    const paths = inputPaths(root, claims);
    const before = inputDigests(root, paths);
    for (const claim of claims) {
      if (retrospectiveGate(root, claim).state !== 'healthy') {
        throw new Error(`Retrospective proof did not reproduce for ${claim.scenario}.`);
      }
    }
    if (
      JSON.stringify(before) !== JSON.stringify(inputDigests(root, paths)) ||
      claimPath !== ticketClaim(root)
    ) {
      throw new Error('Retrospective inputs changed during the closing replay.');
    }
    const body: Omit<CloseRecord, 'integrity'> = {
      schema_version: 1,
      ticket: RETROSPECTIVE_TICKET,
      claimPath,
      claims,
      inputs: before,
    };
    const record: CloseRecord = {
      ...body,
      integrity: retrospectiveCloseTag(root, JSON.stringify(body)),
    };
    const destination = nodePath.join(root, RECORD_PATH);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      renameSync(temporary, destination);
    } finally {
      rmSync(temporary, { force: true });
    }
    return result(
      'review attest retrospective-close',
      'approved',
      `Replayed passing and mutated proofs for ${claims.length} VERIFIED rows.`,
    );
  } catch (error) {
    return result(
      'review attest retrospective-close',
      'blocked',
      error instanceof Error ? error.message : 'Closing proof failed.',
    );
  }
}

/** A cheap, content-bound check for the host's closing edit and Stop hook. */
// eslint-disable-next-line complexity -- Each branch invalidates a distinct closing-proof input.
export function retrospectiveCloseGate(root: string, ticketId: string, ledger: string): CliResult {
  try {
    if (ticketId !== RETROSPECTIVE_TICKET || ledger !== RETROSPECTIVE_LEDGER) {
      throw new Error('Only the CKWE2D ledger may use retrospective closing proof.');
    }
    if (!existsSync(nodePath.join(root, RECORD_PATH))) {
      throw new Error('No retrospective closing record exists.');
    }
    const record = JSON.parse(
      readFileSync(nodePath.join(root, RECORD_PATH), 'utf8'),
    ) as CloseRecord;
    if (
      record.schema_version !== 1 ||
      record.ticket !== RETROSPECTIVE_TICKET ||
      record.claimPath !== ticketClaim(root) ||
      !validRetrospectiveCloseTag(root, JSON.stringify(unsigned(record)), record.integrity)
    ) {
      throw new Error('Retrospective closing record is invalid.');
    }
    const claims = claimsFromLedger(root);
    if (JSON.stringify(record.claims) !== JSON.stringify(claims)) {
      throw new Error('Retrospective ledger changed after closing proof.');
    }
    const paths = inputPaths(root, claims);
    if (JSON.stringify(record.inputs) !== JSON.stringify(inputDigests(root, paths))) {
      throw new Error('Retrospective proof inputs changed after closing proof.');
    }
    if (!historyStillReachable(root, claims)) {
      throw new Error('The fixed historical cutoff or baseline is no longer reachable.');
    }
    return result(
      'review gate retrospective-close',
      'approved',
      `Current closing proof covers ${claims.length} VERIFIED rows.`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Retrospective closing proof is missing.';
    return result(
      'review gate retrospective-close',
      'blocked',
      `${message} Run the installed retrospective close attestation again.`,
    );
  }
}
