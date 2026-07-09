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

import { isDogfoodRepo } from '../../templates/hooks/lib/dogfood.js';
import {
  markDraftsFiled,
  readSpooledDrafts,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { type RetroAgent, windowFor } from '../../templates/hooks/lib/retro-extract.js';
import { type Provenance, PROVENANCE_SHA } from '../retro/ledger.js';
import { prepareEncounters } from '../retro/pipeline.js';
import { reconcile, type ReconcileTracker } from '../retro/reconcile.js';
import { type IssueTracker, triage, type TriageResult } from '../retro/triage.js';
import { VERSION } from '../version.js';

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
  /**
   * Code-state provenance for this session's encounters (G19QG7). Omit (or
   * return undefined) to file without provenance — capture never blocks filing.
   */
  resolveProvenance?: () => Provenance | undefined;
}

export interface ProvenanceResolverOptions {
  projectDirectory: string;
  /** The git subprocess boundary: stdout of `git rev-parse --short HEAD`. */
  runGit: () => string;
  now: () => Date;
  /** The installed safeword version (customer-install provenance). */
  version: string;
}

/**
 * Environment-aware code-state provenance (G19QG7): the dogfood repo records
 * its own short HEAD SHA (development happens between releases, so the version
 * is meaningless there); a customer install records the installed safeword
 * version — never any customer repo identifier. Fail-open: unresolvable git
 * state yields undefined, so filing proceeds without provenance rather than
 * inventing one.
 */
export function buildProvenanceResolver(
  options: ProvenanceResolverOptions,
): () => Provenance | undefined {
  return () => {
    const at = options.now().toISOString();
    if (!isDogfoodRepo(options.projectDirectory)) return { version: options.version, at };
    let sha: string;
    try {
      sha = options.runGit().trim();
    } catch {
      sha = '';
    }
    return PROVENANCE_SHA.test(sha) ? { sha, at } : undefined;
  };
}

export interface RetroOutcome {
  ok: boolean;
  errorMessage?: string;
  result?: TriageResult;
  /** Per-wall egress drop counts (PNZM3B) — silence must mean clean. */
  drops?: { schema: number; surface: number };
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
  const { encounters, drops } = await prepareEncounters(rawFindings);

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

  const provenance = dependencies.resolveProvenance?.();
  const result = await triage(dependencies.transport, encounters, {
    sessionId,
    harness: dependencies.harness,
    ...(provenance && { provenance }),
  });

  if (projectDirectory === undefined) return { ok: true, result, drops };

  // Drain the drafts that reached the tracker; failed/deferred stay spooled for the
  // agent path. agentFilingNeeded = anything still spooled after the drain.
  markDraftsFiled(projectDirectory, sessionId, result.filedSignatures);
  const agentFilingNeeded = readSpooledDrafts(projectDirectory, sessionId).length > 0;
  return { ok: true, result, agentFilingNeeded, drops };
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
  /** Spawn the headless child process; defaults to the real `spawnSync`. */
  spawn?: (
    argv: string[],
    options: { cwd: string; env: Record<string, string | undefined>; stdio?: 'ignore' },
  ) => Promise<{ code: number | null; stdout: string }>;
  /** Extraction model; defaults to the install's `retro.model` or per-agent fallback. */
  model?: string;
  /** Agent whose headless extractor should run. Defaults to Claude for compatibility. */
  agent?: RetroAgent;
  /** Observes whether auto extraction produced schema-valid output. */
  onExtractionResult?: (result: { ok: boolean; findings: unknown[] }) => void;
}

type AutoExtractSpawn = NonNullable<AutoExtractDependencies['spawn']>;

function spawnClaudeExtractor(argv: string[], spawnOptions: Parameters<AutoExtractSpawn>[1]) {
  const result = spawnSync('claude', argv, {
    cwd: spawnOptions.cwd,
    env: spawnOptions.env,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return Promise.resolve({ code: result.status, stdout: result.stdout ?? '' });
}

function spawnCodexExtractor(argv: string[], spawnOptions: Parameters<AutoExtractSpawn>[1]) {
  const result = spawnSync('codex', argv, {
    cwd: spawnOptions.cwd,
    env: spawnOptions.env,
    stdio: spawnOptions.stdio,
    timeout: 600_000,
  });
  return Promise.resolve({ code: result.status, stdout: '' });
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
  const { runCodexHeadlessExtractionChecked, runHeadlessExtraction, resolveRetroModel } =
    await import('../../templates/hooks/lib/retro-extract.js');

  const agent = dependencies.agent ?? 'claude';
  const model = dependencies.model ?? resolveRetroModel(projectDirectory, agent);
  const spawnClaude = dependencies.spawn ?? spawnClaudeExtractor;
  const spawnCodex = dependencies.spawn ?? spawnCodexExtractor;

  const workDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retro-'));
  if (agent === 'codex') {
    return async (transcript: string) => {
      const result = await runCodexHeadlessExtractionChecked(transcript, {
        spawn: spawnCodex,
        writeFile: (path: string, content: string) => {
          writeFileSync(path, content);
        },
        readFile: (path: string) => readFileSync(path, 'utf8'),
        env: process.env,
        cwd: workDirectory,
        model,
        schemaPath: nodePath.join(workDirectory, 'schema.json'),
        outputPath: nodePath.join(workDirectory, 'output.json'),
      });
      dependencies.onExtractionResult?.(result);
      return result.findings;
    };
  }

  return (transcript: string) =>
    runHeadlessExtraction(transcript, {
      spawn: spawnClaude,
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

function resolveAutoExtractAgent(env: Record<string, string | undefined>): RetroAgent {
  return env.SAFEWORD_RETRO_AGENT === 'codex' ? 'codex' : 'claude';
}

async function buildRetroExtractor(
  options: RetroCliOptions,
  projectDirectory: string,
  agent: RetroAgent,
  onExtractionResult?: AutoExtractDependencies['onExtractionResult'],
): Promise<FindingExtractor> {
  if (options.autoExtract)
    return buildAutoExtractor(projectDirectory, { agent, onExtractionResult });
  const findingsPath = options.findings;
  return () => Promise.resolve(findingsPath ? readFindings(findingsPath) : []);
}

function resolveRetroHarness(agent: RetroAgent, detectAgent: () => string): string {
  return agent === 'codex' ? 'codex' : detectAgent();
}

function unavailableTransportFailure(): Promise<never> {
  return Promise.reject(new Error('GitHub transport unavailable'));
}

function unavailableTransport(): IssueTracker {
  return {
    searchBySignature: unavailableTransportFailure,
    createIssue: unavailableTransportFailure,
    listComments: unavailableTransportFailure,
    createComment: unavailableTransportFailure,
    updateComment: unavailableTransportFailure,
  };
}

interface RetroCommandOutput {
  error: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
}

/**
 * Egress drop report (PNZM3B): rendered only when something was dropped, so a
 * clean run's summary stays byte-identical to the pre-feature output.
 */
function renderDropReport(drops: RetroOutcome['drops']): string | undefined {
  if (!drops || (drops.schema === 0 && drops.surface === 0)) return undefined;
  const parts: string[] = [];
  if (drops.schema > 0) parts.push(`${drops.schema} dropped at the schema wall`);
  if (drops.surface > 0) parts.push(`${drops.surface} dropped at the surface wall`);
  return `retro: ${parts.join(', ')} (egress fail-closed)`;
}

export function reportRetroCommandOutcome(
  outcome: RetroOutcome,
  options: {
    extractionSucceeded: boolean;
    restTransportAvailable: boolean;
    output: RetroCommandOutput;
  },
): void {
  const { error, info, success } = options.output;
  if (!outcome.ok) {
    error(outcome.errorMessage ?? 'safeword retro failed');
    process.exitCode = 1;
    return;
  }
  if (!options.extractionSucceeded) {
    error('retro: Codex auto-extraction did not produce schema-valid output.');
    process.exitCode = 1;
    return;
  }

  const r = outcome.result;
  if (!r) return;
  info(
    `retro: ${r.created.length} filed, ${r.bumped.length} recurrence(s) counted, ${r.commented.length} new manifestation(s), ${r.deferred.length} deferred, ${r.failed.length} failed`,
  );
  const dropLine = renderDropReport(outcome.drops);
  if (dropLine) info(dropLine);
  if (outcome.agentFilingNeeded) {
    info(
      options.restTransportAvailable
        ? 'retro: unfiled drafts were spooled for the agent filing path.'
        : 'retro: no GitHub access; unfiled drafts were spooled for the agent filing path.',
    );
  }
  success('retro complete');
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
  const autoExtractAgent = resolveAutoExtractAgent(process.env);
  let extractionSucceeded = true;
  const extract = await buildRetroExtractor(options, projectDirectory, autoExtractAgent, result => {
    extractionSucceeded = result.ok;
  });

  // Use the environment's existing GitHub access (GITHUB_TOKEN or `gh auth token`);
  // no hard token requirement (7D8PJP). With neither, no-op gracefully — the
  // out-of-band hook path must never fail the Stop for lack of GitHub access.
  const restTransport = createRestTransport(resolveGitHubToken());
  const transport = restTransport ?? unavailableTransport();

  const outcome = await runRetro(options, {
    extract,
    transport,
    // Prefer the session id the hook resolved and forwarded (cloud sets
    // CLAUDE_CODE_REMOTE_SESSION_ID, not CLAUDE_SESSION_ID, so the env fallback
    // alone resolved to 'unknown' and broke ledger session-accounting; ZFGWS1).
    sessionId: options.sessionId ?? process.env.CLAUDE_SESSION_ID ?? 'unknown',
    harness: resolveRetroHarness(autoExtractAgent, detectAgent),
    readFile: (path: string) => readFileSync(path, 'utf8'),
    // Enable the cloud-filing spool: on a REST failure the drafts survive on disk
    // for the agent path (BNGK9W) instead of being lost.
    projectDirectory,
    // Environment-aware code-state provenance (G19QG7): dogfood SHA / installed
    // version. Fail-open — capture never blocks filing.
    resolveProvenance: buildProvenanceResolver({
      projectDirectory,
      runGit: () =>
        spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
          cwd: projectDirectory,
          encoding: 'utf8',
          timeout: 10_000,
        }).stdout ?? '',
      now: () => new Date(),
      version: VERSION,
    }),
  });

  reportRetroCommandOutcome(outcome, {
    extractionSucceeded,
    restTransportAvailable: restTransport !== undefined,
    output: { error, info, success },
  });
}

function readFindings(path: string): unknown[] {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface ReconcileCliDependencies {
  /** Injectable sweep transport; defaults to the REST reconcile transport. */
  tracker?: ReconcileTracker;
}

/**
 * `safeword retro-reconcile` — the flag-only reconcile sweep (G19QG7 SM2). No
 * transcript involved; it reads open retro-labeled issues, normalizes their
 * newest provenance to a code-state date, and marks possibly-resolved ones.
 * Fails loudly (exit 1) without GitHub access — a manual mode should say why it
 * did nothing, unlike the hook-driven filing path which must never block a Stop.
 */
export async function retroReconcileCommand(
  dependencies: ReconcileCliDependencies = {},
): Promise<void> {
  const { error, info, success } = await import('../utils/output.js');
  const { createReconcileTransport, resolveGitHubToken } = await import('../retro/github-rest.js');

  const tracker = dependencies.tracker ?? createReconcileTransport(resolveGitHubToken());
  if (!tracker) {
    error('retro-reconcile: no GitHub access; nothing swept.');
    process.exitCode = 1;
    return;
  }

  const result = await reconcile(tracker);
  info(
    `reconcile: ${result.flagged.length} flagged possibly-resolved, ${result.skipped.length} skipped, ${result.deferred.length} deferred to a later run, ${result.failed.length} failed`,
  );

  // Per-issue isolation keeps a PARTIAL failure green (one poisoned issue must
  // not redden every scheduled run), but when every evaluated issue failed the
  // sweep did no work at all (e.g. auth broke after listing) — that must be a
  // red run, not a report indistinguishable from a healthy quiet day (4KP67A).
  if (result.failed.length > 0 && result.flagged.length === 0 && result.skipped.length === 0) {
    error('retro-reconcile: every evaluated issue failed; nothing swept.');
    process.exitCode = 1;
    return;
  }
  success('reconcile complete');
}
