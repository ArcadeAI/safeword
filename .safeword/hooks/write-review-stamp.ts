#!/usr/bin/env bun
// Safeword: the review-stamp earning step (ticket NMSD94).
//
// Appends a `review:<scope>` line to the skill-invocation-log so the review
// gates in pre-tool-quality.ts read it back and allow the next step. Two callers:
//   - Tier 1 (per-asset): the `/self-review` skill's render-time injection runs
//     this to stamp the just-reviewed artifact at its CURRENT content.
//   - Tier 2 (phase exit): the working agent runs this AFTER a fork review
//     passes, to stamp the phase being exited.
//
// Scope is built with the SAME reviewScope()/hashArtifact() the gate uses (same
// hook lib, same runtime), so the stamp matches by construction — no
// cross-language hash contract to drift. Trust boundary: this writes a stamp on
// invocation, which is the cheap Tier 1 floor; Tier 2's real independence is the
// fork reviewer, not this script.
//
// Usage:
//   bun write-review-stamp.ts [--ticket <folder>] <artifact>       # stamp <artifact>.md as reviewed
//   bun write-review-stamp.ts [--ticket <folder>] --phase <phase>  # stamp a phase exit as reviewed
// Add `--skip "<reason>"` to either form to log a deliberate skip instead of a
// review. Skip is an explicit flag (issue #629): free text after the artifact or
// phase is rejected, never silently reclassified as a skip — a pass carries no
// annotation here; narrative context belongs in the ticket work log.
// Without --ticket, the helper stamps the session-bound active ticket. If no
// session binding exists and more than one ticket is in_progress, pass --ticket
// to disambiguate rather than guessing a ticket the gate may not be checking.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { getInProgressTicketFolders, getTicketInfo } from './lib/active-ticket.ts';
import { resolveScenarioSource } from './lib/artifact-precedence.ts';
import {
  readFreshCodexReviewStampIdentity,
  readFreshCursorReviewStampIdentity,
} from './lib/cursor-run-identity.ts';
import { readSessionState } from './lib/quality-state.ts';
import { formatReviewStamp, hashArtifact, reviewScope } from './lib/review-ledger.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';
import { resolveRunIdentity, type RunIdentity } from './lib/run-identity.ts';

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const ticketsDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');

function fail(message: string): never {
  process.stdout.write(`[skill-invocation-log] FAILED — ${message}\n`);
  process.exit(1);
}

// Codex and Cursor expose the session id only to their pre-shell hooks, not to
// this helper's process env. Those hooks stash it in a short-lived cache right
// before this command runs (mirroring record-skill-invocation.ts). Construct a
// full RunIdentity — not a raw string — so the session-state key
// (`codex-<id>` / `cursor-<id>`) matches the one the runtime's post-tool
// adapter writes the active-ticket binding under.
function readBridgedRunIdentity(): RunIdentity | undefined {
  const codexId = readFreshCodexReviewStampIdentity({ projectDirectory });
  if (codexId !== undefined) {
    return { runtime: 'codex', sessionKey: codexId, turnKey: null, source: 'review-stamp-bridge' };
  }
  const cursorId = readFreshCursorReviewStampIdentity({ projectDirectory });
  if (cursorId !== undefined) {
    return {
      runtime: 'cursor',
      sessionKey: cursorId,
      turnKey: null,
      source: 'review-stamp-bridge',
    };
  }
  return undefined;
}

const environmentIdentity = resolveRunIdentity({}, { env: process.env });
const runIdentity =
  environmentIdentity.sessionKey === null
    ? (readBridgedRunIdentity() ?? environmentIdentity)
    : environmentIdentity;
const sessionId = runIdentity.sessionKey ?? fail('missing run identity for review stamp');

// Collapse all whitespace (incl. newlines) to single spaces. The log is one
// stamp per line, so an un-collapsed reason could inject a second, forged line.
function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// A bare path component — no whitespace, separators, or `..`. The ticket and
// artifact names index into `tickets/<folder>/<artifact>.md`, so a separator
// would let the path escape the tickets dir; reject it at the boundary.
function bareName(value: string, label: string): string {
  if (/[\s/\\]/.test(value) || value.includes('..')) {
    fail(`${label} must be a bare name (no whitespace, slashes, or "..")`);
  }
  return value;
}

interface ParsedArguments {
  positional: string[];
  explicitTicket: string | undefined;
  reviewerModel: string | undefined;
  skipReason: string | undefined;
}

// Optional global flags `--ticket <folder>`, `--model <id>`, and
// `--skip <reason>` may appear before or after the positional command.
// `--model` is the reviewing model, supplied by the orchestrator that assigned
// it (NOT self-reported by the reviewer — Claude Code withholds model identity
// from subagents, ticket MR5M3A). `--skip` is the ONLY way to record a skip:
// pass vs skip is declared intent, never inferred from stray text (issue #629).
// Flags that consume the next argv token as their value.
const VALUE_FLAGS = new Set(['--ticket', '--model', '--skip']);

function parseArguments(argv: string[]): ParsedArguments {
  const positional: string[] = [];
  let explicitTicket: string | undefined;
  let reviewerModel: string | undefined;
  let skipReason: string | undefined;
  const seen = new Set<string>();

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) fail('missing argument');
    if (!VALUE_FLAGS.has(arg)) {
      positional.push(arg);
      continue;
    }

    const flag = arg;
    if (seen.has(flag)) fail(`${flag} given more than once`);
    seen.add(flag);
    const value = argv[index + 1];
    if (value === undefined || value === '') fail(`${flag} requires a value`);
    // A flag-shaped value means the real value was omitted and the NEXT flag got
    // swallowed — e.g. `--model --skip` would otherwise mint a PASS stamp with
    // model "--skip" (clearing the cross-model gate) from a declared skip.
    if (value.startsWith('--')) {
      fail(`${flag} requires a value, got flag-like "${value}"`);
    }
    if (flag === '--ticket') {
      explicitTicket = bareName(value, '--ticket');
    } else if (flag === '--skip') {
      const reason = singleLine(value);
      if (reason === '') fail('--skip reason must not be blank — a real reason is the audit trail');
      skipReason = reason;
    } else {
      if (/\s/.test(value)) fail('--model id must not contain whitespace');
      reviewerModel = value;
    }
    index += 1;
  }

  return { positional, explicitTicket, reviewerModel, skipReason };
}

const { positional, explicitTicket, reviewerModel, skipReason } = parseArguments(process.argv);

function formatTicketList(folders: string[]): string {
  const shown = folders.slice(0, 12).join(', ');
  const remaining = folders.length - 12;
  return remaining > 0 ? `${shown}, ... ${remaining} more` : shown;
}

function resolveSessionTicketFolder(): string | undefined {
  const activeTicket = readSessionState(projectDirectory, runIdentity)?.activeTicket;
  if (!activeTicket) return undefined;

  const ticket = getTicketInfo(projectDirectory, activeTicket);
  if (!ticket.folder) {
    fail(`session-bound ticket "${activeTicket}" not found — pass --ticket <folder>`);
  }
  if (ticket.status !== undefined && ticket.status !== 'in_progress') {
    fail(
      `session-bound ticket "${activeTicket}" is ${ticket.status}, not in_progress — pass --ticket <folder>`,
    );
  }
  return ticket.folder;
}

// Resolve the ticket the same way the gates do: current session binding first,
// then the legacy single-ticket fallback. The fallback exists for tiny repos; a
// mature backlog with many in-progress tickets must not become a guessing game.
function resolveTicketFolder(): string {
  if (explicitTicket !== undefined) {
    if (!existsSync(nodePath.join(ticketsDirectory, explicitTicket, 'ticket.md'))) {
      fail(`--ticket "${explicitTicket}" not found`);
    }
    return explicitTicket;
  }

  const sessionTicketFolder = resolveSessionTicketFolder();
  if (sessionTicketFolder !== undefined) return sessionTicketFolder;

  const inProgress = getInProgressTicketFolders(projectDirectory);
  if (inProgress.length === 0) fail('no in_progress ticket found — nothing to stamp');
  if (inProgress.length > 1) {
    fail(
      `no session-bound active ticket and multiple in_progress tickets (${formatTicketList(inProgress)}) — pass --ticket <folder> to disambiguate`,
    );
  }
  return inProgress[0] ?? fail('no in_progress ticket found — nothing to stamp');
}

const isPhase = positional[0] === '--phase';

// Fail closed on free text: before --skip existed, trailing words were slurped
// into a skip reason, so a pass annotated with commentary was silently
// misrecorded as a skip (and hidden from the cross-model gate) — issue #629.
const trailing = positional.slice(isPhase ? 2 : 1);
if (trailing.length > 0) {
  fail(
    `unexpected trailing arguments: "${trailing.join(' ')}" — a pass takes no free text (notes belong in the ticket work log); to log a deliberate skip, pass --skip "<reason>" (quote a multi-word reason as one argument)`,
  );
}

function resolveScope(ticketFolder: string): { scope: string; label: string } {
  if (isPhase) {
    const value = positional[1];
    if (value === undefined || value === '') fail('--phase requires a phase name');
    const phase = bareName(value, 'phase name');
    return { scope: reviewScope(ticketFolder, 'phase', phase), label: `phase ${phase}` };
  }
  const artifact = bareName(positional[0] ?? 'spec', 'artifact name');
  // The `scenarios` artifact isn't a file — it's the scenario source the
  // implement-entry gate (87Y167) binds to: the `.feature` file the ledger
  // names, else test-definitions.md itself. Resolve it the SAME way the gate
  // does so the stamp matches by construction.
  if (artifact === 'scenarios') {
    return {
      scope: reviewScope(ticketFolder, 'scenarios', hashArtifact(scenarioContent(ticketFolder))),
      label: 'scenarios',
    };
  }
  const artifactFile = nodePath.join(ticketsDirectory, ticketFolder, `${artifact}.md`);
  if (!existsSync(artifactFile)) fail(`artifact not found: ${artifact}.md in ${ticketFolder}`);
  return {
    scope: reviewScope(ticketFolder, artifact, hashArtifact(readFileSync(artifactFile, 'utf8'))),
    label: `${artifact}.md`,
  };
}

/** The scenario content the implement-entry gate reviews: the `.feature` source the ledger names, else the ledger. */
function scenarioContent(ticketFolder: string): string {
  const ledgerFile = nodePath.join(ticketsDirectory, ticketFolder, 'test-definitions.md');
  if (!existsSync(ledgerFile)) fail(`no test-definitions.md in ${ticketFolder} to review`);
  const ledger = readFileSync(ledgerFile, 'utf8');
  const sourcePath = resolveScenarioSource(ledger);
  if (sourcePath === undefined) return ledger;
  // Fall back to the ledger on any read failure (missing, directory, unreadable)
  // so the stamp binds to the same content the gate does — the gate applies the
  // identical fallback, so both stay consistent.
  try {
    const sourceFile = nodePath.join(projectDirectory, sourcePath);
    return existsSync(sourceFile) ? readFileSync(sourceFile, 'utf8') : ledger;
  } catch {
    return ledger;
  }
}

const { scope, label } = resolveScope(resolveTicketFolder());

const logDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory));
const logFile = nodePath.join(logDirectory, 'skill-invocations.log');
mkdirSync(logDirectory, { recursive: true });
appendFileSync(
  logFile,
  `${new Date().toISOString()} ${sessionId} ${formatReviewStamp(scope, skipReason, reviewerModel)}\n`,
);

const kind = skipReason === undefined ? 'review' : `skip (${skipReason})`;
process.stdout.write(`[skill-invocation-log] ${kind} stamped for ${label} ✓\n`);
