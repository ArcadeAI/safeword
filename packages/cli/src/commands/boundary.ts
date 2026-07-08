/**
 * `safeword boundary --at commit|push` — reconcile workflow evidence at a git
 * boundary (ticket CDRJTW, #810 slice 1).
 *
 * Warn-and-record, never blocks: exit code is 0 on every path in this slice.
 * Findings print as warnings and append to `.safeword/boundary-audit.jsonl`
 * (gitignored — context for humans and retro, never trusted as evidence; the
 * server-side child of #810 re-derives from committed artifacts instead).
 * Changes touching no ticket artifacts are silent no-ops, keeping the
 * guardrails-never-tax-ordinary-commits promise.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { createLedgerShaResolver } from '../../templates/hooks/lib/ledger-git.js';
import {
  type ChangedArtifact,
  findings,
  type LegalityStep,
  reconcileChange,
  TICKET_ARTIFACTS,
  type TicketChange,
} from '../boundary/engine.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { readFileSafe } from '../utils/fs.js';
import { warn } from '../utils/output.js';

export interface BoundaryOptions {
  at: string;
}

type Boundary = 'commit' | 'push';

const AUDIT_RELATIVE_PATH = nodePath.join('.safeword', 'boundary-audit.jsonl');

/** Run git, returning stdout or undefined on any failure (never throws). */
function tryGit(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return undefined;
  }
}

interface BoundaryRange {
  paths: string[];
  /** Revision whose file contents are "prior"; undefined = no prior (first push of everything). */
  priorRef?: string;
}

function splitLines(listing: string | undefined): string[] | undefined {
  return listing?.split('\n').filter(line => line !== '');
}

/**
 * The outgoing range for a push: the configured upstream when set, else the
 * commits unreachable from every remote ref (a branch pushed for the first
 * time still gets its outgoing work reconciled — SM1.AC2).
 */
function pushRange(cwd: string): BoundaryRange | undefined {
  const upstreamPaths = splitLines(tryGit(cwd, ['diff', '--name-only', '@{u}...HEAD']));
  if (upstreamPaths !== undefined) {
    // Prior content must come from the merge base, not the upstream tip: on a
    // diverged upstream, `@{u}:path` can hold content this branch never had,
    // and endpoint checks would compare against it. The three-dot path list
    // above is already merge-base-relative.
    const base = tryGit(cwd, ['merge-base', '@{u}', 'HEAD'])?.trim();
    return { paths: upstreamPaths, priorRef: base ?? '@{u}' };
  }

  const unpushed = splitLines(tryGit(cwd, ['rev-list', 'HEAD', '--not', '--remotes']));
  if (unpushed === undefined || unpushed.length === 0) return undefined;
  const oldest = unpushed.at(-1) ?? '';
  const base = tryGit(cwd, ['rev-parse', `${oldest}~1`])?.trim();
  const listing = tryGit(
    cwd,
    base === undefined
      ? ['log', '--name-only', '--format=', 'HEAD']
      : ['diff', '--name-only', `${base}..HEAD`],
  );
  const paths = splitLines(listing);
  return paths === undefined ? undefined : { paths: [...new Set(paths)], priorRef: base };
}

/** The change set at the boundary; undefined when git can't say (→ silent no-op). */
function boundaryRange(cwd: string, at: Boundary): BoundaryRange | undefined {
  if (at === 'push') return pushRange(cwd);
  const staged = splitLines(
    tryGit(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMRD']),
  );
  return staged === undefined ? undefined : { paths: staged, priorRef: 'HEAD' };
}

/** Content of a path at a git revision spec (e.g. `HEAD:p`, `:p`), or undefined. */
function contentAt(cwd: string, spec: string): string | undefined {
  return tryGit(cwd, ['show', spec]);
}

/** One changed artifact's prior (range base) and proposed (index/HEAD) content. */
function readArtifact(
  cwd: string,
  path: string,
  basename: string,
  range: BoundaryRange,
  at: Boundary,
): ChangedArtifact {
  const proposedSpec = at === 'commit' ? `:${path}` : `HEAD:${path}`;
  return {
    artifact: basename,
    prior: range.priorRef === undefined ? undefined : contentAt(cwd, `${range.priorRef}:${path}`),
    proposed: contentAt(cwd, proposedSpec),
  };
}

/** Split a repo-relative changed path into ticket folder + artifact basename. */
function parseTicketPath(
  path: string,
  prefix: string,
): { ticketFolder: string; basename: string } | undefined {
  if (!path.startsWith(prefix)) return undefined;
  const segments = path.slice(prefix.length).split('/');
  const ticketFolder = segments[0] ?? '';
  const basename = segments.slice(1).join('/');
  if (ticketFolder === '' || !TICKET_ARTIFACTS.has(basename)) return undefined;
  return { ticketFolder, basename };
}

/** Map changed paths to per-ticket changes with prior/proposed + at-rest context. */
function collectChanges(cwd: string, range: BoundaryRange, at: Boundary): TicketChange[] {
  const ticketsDirectory = nodePath.relative(cwd, resolveTicketsDirectory(cwd));
  const prefix = `${ticketsDirectory}/`;
  const byTicket = new Map<string, TicketChange>();

  for (const path of range.paths) {
    const parsed = parseTicketPath(path, prefix);
    if (parsed === undefined) continue;
    const change = byTicket.get(parsed.ticketFolder) ?? {
      ticketFolder: parsed.ticketFolder,
      artifacts: [],
      hasLedger: false,
    };
    change.artifacts.push(readArtifact(cwd, path, parsed.basename, range, at));
    byTicket.set(parsed.ticketFolder, change);
  }

  // At-rest context per touched ticket: ticket.md as it stands after the
  // change (staged version wins over disk) and whether a ledger exists.
  for (const change of byTicket.values()) {
    const folder = nodePath.join(cwd, ticketsDirectory, change.ticketFolder);
    const staged = change.artifacts.find(a => a.artifact === 'ticket.md')?.proposed;
    change.ticketCurrent = staged ?? readFileSafe(nodePath.join(folder, 'ticket.md'));
    change.hasLedger =
      change.artifacts.some(
        a => a.artifact === 'test-definitions.md' && a.proposed !== undefined,
      ) || existsSync(nodePath.join(folder, 'test-definitions.md'));
    // Push tier: legality is judged per commit in the range, never by its
    // endpoints (N76NQ0 — a range that traversed phases one legal step at a
    // time must not read as a skip).
    if (at === 'push' && change.artifacts.some(a => a.artifact === 'ticket.md')) {
      const path = `${prefix}${change.ticketFolder}/ticket.md`;
      change.legalitySteps = legalityStepsFor(cwd, path, range.priorRef);
    }
  }

  return byTicket.values().toArray();
}

/**
 * Per-commit ticket.md transitions across the outgoing range (oldest first):
 * each commit that touched the path, viewed against its own parent. An
 * unknown prior ref (first push of a whole history) walks every commit.
 */
function legalityStepsFor(cwd: string, path: string, priorReference?: string): LegalityStep[] {
  const range = priorReference === undefined ? 'HEAD' : `${priorReference}..HEAD`;
  const commits = splitLines(tryGit(cwd, ['rev-list', '--reverse', range, '--', path])) ?? [];
  return commits.map(commit => ({
    prior: contentAt(cwd, `${commit}~1:${path}`),
    proposed: contentAt(cwd, `${commit}:${path}`) ?? '',
    commit: commit.slice(0, 7),
  }));
}

function appendAudit(cwd: string, entry: object): void {
  const auditPath = nodePath.join(cwd, AUDIT_RELATIVE_PATH);
  mkdirSync(nodePath.dirname(auditPath), { recursive: true });
  appendFileSync(auditPath, `${JSON.stringify(entry)}\n`);
}

/** The reconciliation body — separated so the entry point stays a trivial guard. */
function reconcileBoundary(cwd: string, at: Boundary): void {
  const range = boundaryRange(cwd, at);
  if (range === undefined || range.paths.length === 0) return;

  const changes = collectChanges(cwd, range, at);
  if (changes.length === 0) return;

  // The push tier verifies LEDGER SHAs against real history; the commit tier
  // stays content-only for SHAs (sub-second budget — no history walks).
  // Anchors are tree-only at both tiers: the reader serves the exact tree the
  // boundary ships — the staged index at commit, HEAD at push — never the
  // worktree and never git history (shallow clones and squashed branches
  // verify identically to full clones).
  const resolveSha = at === 'push' ? createLedgerShaResolver(cwd) : undefined;
  const readTreeArtifact = (relpath: string): string | undefined =>
    contentAt(cwd, at === 'commit' ? `:${relpath}` : `HEAD:${relpath}`);
  const reconciliations = reconcileChange(changes, resolveSha, readTreeArtifact);
  for (const finding of findings(reconciliations)) {
    warn(
      `boundary(${at}) ${finding.ticket}: [${finding.check.check}] ${finding.check.detail ?? finding.check.verdict}`,
    );
  }

  appendAudit(cwd, {
    boundary: at,
    timestamp: new Date().toISOString(),
    head: tryGit(cwd, ['rev-parse', '--short', 'HEAD'])?.trim() ?? 'unknown',
    tickets: reconciliations,
  });
}

/**
 * Reconcile the boundary. Exit 0 on every path — including internal failure:
 * a boundary gate that blocks by accident violates the slice's contract, so
 * errors degrade to a warning, never a throw.
 */
export function boundary(options: BoundaryOptions): Promise<void> {
  try {
    const at: Boundary = options.at === 'push' ? 'push' : 'commit';
    const cwd = process.cwd();
    if (existsSync(nodePath.join(cwd, '.safeword'))) {
      reconcileBoundary(cwd, at);
    }
  } catch (error: unknown) {
    // Exit-0 is absolute in this slice: record the breakage, never block.
    warn(
      `boundary check could not complete: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return Promise.resolve();
}
