/**
 * `safeword retro` — transcript-mining session retrospective (ticket RV9JT4).
 *
 * Mines a session transcript for QUALITATIVE safeword friction (bugs, rough
 * edges, gaps the deterministic self-report spool can't catch) and files issues
 * autonomously. Autonomy is made safe NOT by a human but by an automated egress
 * guard: the agent supplies RAW structured findings, then this command (code)
 * normalizes → fails closed on unresolved surfaces → sanitizes every free-text
 * field → assembles the body → files. Free-text agent output never reaches the
 * wire un-sanitized.
 *
 * The two boundaries — extraction (an LLM reading the transcript) and the GitHub
 * write — are injected (`RetroDependencies`) so the deterministic pipeline is testable;
 * the CLI wrapper supplies the real implementations.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

import { prepareEncounters } from '../retro/pipeline.js';
import { type IssueTracker, triage, type TriageResult } from '../retro/triage.js';

/** Reads a transcript and returns raw, un-sanitized findings (the LLM boundary). */
type FindingExtractor = (transcript: string) => Promise<unknown[]>;

export interface RetroDependencies {
  extract: FindingExtractor;
  transport: IssueTracker;
  sessionId: string;
  harness: string;
  /** File reader (the fs boundary) — injectable for tests. */
  readFile?: (path: string) => string;
}

export interface RetroOutcome {
  ok: boolean;
  errorMessage?: string;
  result?: TriageResult;
}

/**
 * Deterministic retro core. Never guesses the transcript path; fails loudly and
 * files nothing when it is missing or unreadable.
 */
export async function runRetro(
  options: { transcript?: string },
  dependencies: RetroDependencies,
): Promise<RetroOutcome> {
  if (!options.transcript) {
    return {
      ok: false,
      errorMessage:
        'safeword retro requires --transcript <path>; it never guesses the session path.',
    };
  }

  const read = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf8'));
  let transcript: string;
  try {
    transcript = read(options.transcript);
  } catch {
    return { ok: false, errorMessage: `cannot read transcript at ${options.transcript}` };
  }

  const rawFindings = await dependencies.extract(transcript);
  const encounters = await prepareEncounters(rawFindings);
  const result = await triage(dependencies.transport, encounters, {
    sessionId: dependencies.sessionId,
    harness: dependencies.harness,
  });
  return { ok: true, result };
}

export interface RetroCliOptions {
  transcript?: string;
  findings?: string;
}

/**
 * CLI wrapper. Supplies the real boundaries: the extractor reads agent-produced
 * raw findings from `--findings <path>` (the agent runs the retro guide, writes
 * findings JSON, then invokes this), and the transport is a REST client. Both
 * are intentionally thin and live outside the tested deterministic core.
 */
export async function retroCommand(options: RetroCliOptions): Promise<void> {
  const { detectAgent } = await import('../../templates/hooks/lib/self-report.js');
  const { error, info, success } = await import('../utils/output.js');
  const { createRestTransport } = await import('../retro/github-rest.js');

  const findingsPath = options.findings;
  const extract: FindingExtractor = () =>
    Promise.resolve(findingsPath ? readFindings(findingsPath) : []);

  const transport = createRestTransport();
  if (!transport) {
    error(
      'safeword retro needs GitHub access: set GITHUB_TOKEN (target ArcadeAI/safeword), or run it through an agent with GitHub access.',
    );
    process.exitCode = 1;
    return;
  }

  const outcome = await runRetro(options, {
    extract,
    transport,
    sessionId: process.env.CLAUDE_SESSION_ID ?? 'unknown',
    harness: detectAgent(),
    readFile: (path: string) => readFileSync(path, 'utf8'),
  });

  if (!outcome.ok) {
    error(outcome.errorMessage ?? 'safeword retro failed');
    process.exitCode = 1;
    return;
  }

  const r = outcome.result;
  if (!r) return;
  info(
    `retro: ${r.created.length} filed, ${r.bumped.length} recurrence(s) counted, ${r.commented.length} new manifestation(s), ${r.deferred.length} deferred, ${r.failed.length} failed`,
  );
  success('retro complete');
}

function readFindings(path: string): unknown[] {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
