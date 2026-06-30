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

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
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
  /** Extract findings out-of-band via a headless `claude -p` session. */
  autoExtract?: boolean;
}

/**
 * Build the auto-extract `FindingExtractor`: run the retro extraction in a
 * separate, isolated headless `claude -p` session (read-only, no `--bare`) from a
 * neutral temp cwd, with `SAFEWORD_RETRO_CHILD=1` set by the runner. Fail-open:
 * the runner returns `[]` on any error.
 */
async function buildAutoExtractor(): Promise<FindingExtractor> {
  const { runHeadlessExtraction } = await import('../../templates/hooks/lib/retro-extract.js');

  const workDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retro-'));
  return (transcript: string) =>
    runHeadlessExtraction(transcript, {
      spawn: (argv, spawnOptions) => {
        const result = spawnSync('claude', argv, {
          cwd: spawnOptions.cwd,
          env: spawnOptions.env,
          encoding: 'utf8',
          timeout: 240_000,
          maxBuffer: 64 * 1024 * 1024,
        });
        return Promise.resolve({ code: result.status, stdout: result.stdout ?? '' });
      },
      writeDigest: (digest: string) => {
        const path = nodePath.join(workDirectory, 'digest.txt');
        writeFileSync(path, digest);
        return path;
      },
      env: process.env,
      cwd: workDirectory, // neutral cwd — not the user's project
      model: 'haiku',
    });
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
  const { createRestTransport, resolveGitHubToken } = await import('../retro/github-rest.js');

  const findingsPath = options.findings;
  const extract: FindingExtractor = options.autoExtract
    ? await buildAutoExtractor()
    : () => Promise.resolve(findingsPath ? readFindings(findingsPath) : []);

  // Use the environment's existing GitHub access (GITHUB_TOKEN or `gh auth token`);
  // no hard token requirement (7D8PJP). With neither, no-op gracefully — the
  // out-of-band hook path must never fail the Stop for lack of GitHub access.
  const transport = createRestTransport(resolveGitHubToken());
  if (!transport) {
    info(
      'safeword retro: no GitHub access (set GITHUB_TOKEN or run `gh auth login`); nothing filed.',
    );
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
