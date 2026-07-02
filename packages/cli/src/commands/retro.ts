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

import {
  markDraftsFiled,
  readSpooledDrafts,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { windowFor } from '../../templates/hooks/lib/retro-extract.js';
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
  /**
   * Project root for the cloud-filing spool (BNGK9W). When provided, the
   * post-egress drafts are spooled BEFORE filing (so a REST 401 doesn't lose them)
   * and the drafts that reached the tracker are drained after. Omit to opt out —
   * existing callers keep their REST-only behavior unchanged.
   */
  projectDirectory?: string;
}

export interface RetroOutcome {
  ok: boolean;
  errorMessage?: string;
  result?: TriageResult;
  /**
   * True when drafts remain spooled after filing (REST failed / was capped) — the
   * signal that the agent filing path (PATH B) is needed. Undefined when the spool
   * is opted out (no `projectDirectory`).
   */
  agentFilingNeeded?: boolean;
}

/**
 * Deterministic retro core. Never guesses the transcript path; fails loudly and
 * files nothing when it is missing or unreadable.
 */
export async function runRetro(
  options: { transcript?: string; windowStart?: number },
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

  // Delta re-arm (ZFGWS1): digest only the window since the last fire's offset
  // (plus a small overlap), so the cap applies to the new activity, not the head.
  // windowStart 0 (or absent) means the whole transcript — the first-fire / legacy
  // behavior. The window flows through the UNCHANGED egress pipeline below.
  const window = windowFor(transcript, options.windowStart ?? 0);
  const rawFindings = await dependencies.extract(window);
  const encounters = await prepareEncounters(rawFindings);

  // Cloud-filing spool (BNGK9W): persist the post-egress drafts BEFORE filing so a
  // REST auth failure (cloud #568) can't lose them. Opt-in via projectDirectory.
  const { projectDirectory, sessionId } = dependencies;
  if (projectDirectory !== undefined) {
    spoolDrafts(
      projectDirectory,
      sessionId,
      encounters.map(encounter => encounter.draft),
    );
  }

  const result = await triage(dependencies.transport, encounters, {
    sessionId,
    harness: dependencies.harness,
  });

  if (projectDirectory === undefined) return { ok: true, result };

  // Drain the drafts that reached the tracker; failed/deferred stay spooled for the
  // agent path. agentFilingNeeded = anything still spooled after the drain.
  markDraftsFiled(projectDirectory, sessionId, result.filedSignatures);
  const agentFilingNeeded = readSpooledDrafts(projectDirectory, sessionId).length > 0;
  return { ok: true, result, agentFilingNeeded };
}

export interface RetroCliOptions {
  transcript?: string;
  findings?: string;
  /** Extract findings out-of-band via a headless `claude -p` session. */
  autoExtract?: boolean;
  /** Delta re-arm: digest only the transcript from this char offset onward (ZFGWS1). */
  windowStart?: number;
  /** Stable session id forwarded from the hook, so the ledger isn't keyed to 'unknown'. */
  sessionId?: string;
}

/** Injectable seam for `buildAutoExtractor` (tests assert the resolved model/argv). */
export interface AutoExtractDependencies {
  /** Spawn the headless `claude` process; defaults to the real `spawnSync`. */
  spawn?: (
    argv: string[],
    options: { cwd: string; env: Record<string, string | undefined> },
  ) => Promise<{ code: number | null; stdout: string }>;
  /** Extraction model; defaults to the install's `retro.model` (sonnet fallback). */
  model?: string;
}

/**
 * Build the auto-extract `FindingExtractor`: run the retro extraction in a
 * separate, isolated headless `claude -p` session (read-only, no `--bare`) from a
 * neutral temp cwd, with `SAFEWORD_RETRO_CHILD=1` set by the runner. The model
 * defaults to the install's `retro.model` config (sonnet fallback — haiku proved
 * too weak; ZFGWS1). Fail-open: the runner returns `[]` on any error.
 */
export async function buildAutoExtractor(
  projectDirectory: string,
  dependencies: AutoExtractDependencies = {},
): Promise<FindingExtractor> {
  const { runHeadlessExtraction, resolveRetroModel } =
    await import('../../templates/hooks/lib/retro-extract.js');

  const model = dependencies.model ?? resolveRetroModel(projectDirectory);
  const spawn =
    dependencies.spawn ??
    ((argv: string[], spawnOptions: { cwd: string; env: Record<string, string | undefined> }) => {
      const result = spawnSync('claude', argv, {
        cwd: spawnOptions.cwd,
        env: spawnOptions.env,
        encoding: 'utf8',
        timeout: 240_000,
        maxBuffer: 64 * 1024 * 1024,
      });
      return Promise.resolve({ code: result.status, stdout: result.stdout ?? '' });
    });

  const workDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retro-'));
  return (transcript: string) =>
    runHeadlessExtraction(transcript, {
      spawn,
      writeDigest: (digest: string) => {
        const path = nodePath.join(workDirectory, 'digest.txt');
        writeFileSync(path, digest);
        return path;
      },
      env: process.env,
      cwd: workDirectory, // neutral cwd — not the user's project
      model,
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

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const findingsPath = options.findings;
  const extract: FindingExtractor = options.autoExtract
    ? await buildAutoExtractor(projectDirectory)
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
    // Prefer the session id the hook resolved and forwarded (cloud sets
    // CLAUDE_CODE_REMOTE_SESSION_ID, not CLAUDE_SESSION_ID, so the env fallback
    // alone resolved to 'unknown' and broke ledger session-accounting; ZFGWS1).
    sessionId: options.sessionId ?? process.env.CLAUDE_SESSION_ID ?? 'unknown',
    harness: detectAgent(),
    readFile: (path: string) => readFileSync(path, 'utf8'),
    // Enable the cloud-filing spool: on a REST failure the drafts survive on disk
    // for the agent path (BNGK9W) instead of being lost.
    projectDirectory,
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
  if (outcome.agentFilingNeeded) {
    // Local diagnostic only — under the async Stop hook this output is not surfaced;
    // the agent nudge comes from the separate boundary hook (BNGK9W PATH B).
    info('retro: unfiled drafts were spooled for the agent filing path.');
  }
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
