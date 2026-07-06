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
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import {
  findings,
  reconcileChange,
  TICKET_ARTIFACTS,
  type TicketChange,
} from '../boundary/engine.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
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

/** Paths changed at the boundary, repo-relative; undefined when git can't say. */
function changedPaths(cwd: string, at: Boundary): string[] | undefined {
  // Push tier reads the outgoing range via the configured upstream (`@{u}`).
  // A branch with no upstream yields undefined here; the first-push fallback
  // is a slice-3 scenario and lands with its own RED step.
  const diffArguments =
    at === 'commit'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMRD']
      : ['diff', '--name-only', '@{u}...HEAD'];
  return tryGit(cwd, diffArguments)
    ?.split('\n')
    .filter(line => line !== '');
}

/** Content of a path at a git revision spec (e.g. `HEAD:p`, `:p`), or undefined. */
function contentAt(cwd: string, spec: string): string | undefined {
  return tryGit(cwd, ['show', spec]);
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
function collectChanges(cwd: string, paths: string[], at: Boundary): TicketChange[] {
  const ticketsDirectory = nodePath.relative(cwd, resolveTicketsDirectory(cwd));
  const prefix = `${ticketsDirectory}/`;
  const byTicket = new Map<string, TicketChange>();

  for (const path of paths) {
    const parsed = parseTicketPath(path, prefix);
    if (parsed === undefined) continue;
    // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- `@{u}` is a git refspec (the upstream), not a missed interpolation
    const priorSpec = at === 'commit' ? `HEAD:${path}` : `@{u}:${path}`;
    const proposedSpec = at === 'commit' ? `:${path}` : `HEAD:${path}`;
    const change = byTicket.get(parsed.ticketFolder) ?? {
      ticketFolder: parsed.ticketFolder,
      artifacts: [],
      hasLedger: false,
    };
    change.artifacts.push({
      artifact: parsed.basename,
      prior: contentAt(cwd, priorSpec),
      proposed: contentAt(cwd, proposedSpec),
    });
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
  }

  return byTicket.values().toArray();
}

/** Read a file, or undefined when absent/unreadable — never throws. */
function readFileSafe(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function appendAudit(cwd: string, entry: object): void {
  const auditPath = nodePath.join(cwd, AUDIT_RELATIVE_PATH);
  mkdirSync(nodePath.dirname(auditPath), { recursive: true });
  appendFileSync(auditPath, `${JSON.stringify(entry)}\n`);
}

/** The reconciliation body — separated so the entry point stays a trivial guard. */
function reconcileBoundary(cwd: string, at: Boundary): void {
  const paths = changedPaths(cwd, at);
  if (paths === undefined || paths.length === 0) return;

  const changes = collectChanges(cwd, paths, at);
  if (changes.length === 0) return;

  const reconciliations = reconcileChange(changes);
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
      `boundary check could not complete: ${Error.isError(error) ? error.message : String(error)}`,
    );
  }
  return Promise.resolve();
}
