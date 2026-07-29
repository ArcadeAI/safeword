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
import { mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { isDogfoodRepo } from '../../templates/hooks/lib/dogfood.js';
import { recordRetroDebugEvent } from '../../templates/hooks/lib/retro-debug.js';
import {
  draftSpoolPath,
  markDraftsFiled,
  readSpooledDrafts,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { type RetroAgent, windowFor } from '../../templates/hooks/lib/retro-extract.js';
import { type Provenance, PROVENANCE_SHA } from '../retro/ledger.js';
import { prepareEncounters } from '../retro/pipeline.js';
import { reconcile, type ReconcileTracker } from '../retro/reconcile.js';
import {
  deliverRelayRequests,
  discardRelayRequest,
  listRelayDeadLetters,
  listRelaySpoolEntries,
  normalizeRelayOrigin,
  persistRelayDraft,
  rearmRelayDeadLetter,
  recoverRelayDeadLetter,
  type RelayDraftRequest,
  relaySourceKey,
} from '../retro/relay-delivery.js';

const DEFAULT_RELAY_DEADLINE_MS = 500;
const RELAY_OVERALL_HEADROOM_MS = 10_000;
import {
  CHECKED_IN_RELAY_READINESS,
  type RelayReadinessManifest,
  SAFEWORD_BUILD_COMMIT,
  SAFEWORD_RELAY_BUILD_ATTESTATION,
  validateBuildAttestedRelayReadiness,
  validateRelayReadiness,
} from '../retro/relay-readiness.js';
import { type Encounter, type IssueTracker, triage, type TriageResult } from '../retro/triage.js';
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
  /**
   * Internal wiring seam for the gated relay path. The public CLI does not
   * populate it while CHECKED_IN_RELAY_READINESS is disabled.
   */
  relay?: {
    credential: string;
    deadlineMs?: number;
    fetch?: typeof fetch;
    installationId: number;
    readiness: { enabled: boolean };
    relayUrl: string;
    repository: string;
    spoolDirectory?: string;
  };
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
  /** True when durable work remains after this bounded filing attempt. */
  agentFilingNeeded?: boolean;
  relay?: {
    accepted: number;
    deadLetterBacklog: number;
    deadLetteredThisRun: number;
    retryable: number;
    spoolFailed?: number;
  };
}

function emptyTriageResult(): TriageResult {
  return {
    bumped: [],
    commented: [],
    created: [],
    deferred: [],
    failed: [],
    filedSignatures: [],
  };
}

async function runRelayRetro(
  encounters: Encounter[],
  drops: { schema: number; surface: number },
  source: { session: string; windowStart: number },
  projectDirectory: string,
  relay: NonNullable<RetroDependencies['relay']>,
): Promise<RetroOutcome> {
  const spoolDirectory = relay.spoolDirectory ?? projectDirectory;
  let spoolFailed = 0;
  for (const encounter of encounters) {
    const relayDraft = {
      body: encounter.draft.body,
      canonicalKey: encounter.draft.canonicalSignature,
      installationId: relay.installationId,
      labels: encounter.draft.labels,
      legacySignature: encounter.draft.signature,
      repository: relay.repository,
      title: encounter.draft.title,
    };
    try {
      await persistRelayDraft(spoolDirectory, {
        ...relayDraft,
        sourceKey: relaySourceKey(source.session, source.windowStart, relayDraft),
      });
    } catch {
      spoolFailed += 1;
    }
  }
  const deadlineMs = relay.deadlineMs ?? DEFAULT_RELAY_DEADLINE_MS;
  const delivery = await deliverRelayRequests(spoolDirectory, {
    credential: relay.credential,
    deadlineMs,
    fetch: relay.fetch ?? fetch,
    now: () => Date.now(),
    overallDeadlineMs: deadlineMs + RELAY_OVERALL_HEADROOM_MS,
    relayUrl: relay.relayUrl,
  });
  const relayOutcome = { ...delivery, spoolFailed };
  if (spoolFailed > 0) {
    const noun = spoolFailed === 1 ? 'finding' : 'findings';
    return {
      agentFilingNeeded: true,
      drops,
      errorMessage: `retro relay could not durably persist ${spoolFailed} ${noun}; retry the command`,
      ok: false,
      relay: relayOutcome,
      result: emptyTriageResult(),
    };
  }
  return {
    agentFilingNeeded: delivery.retryable > 0 || delivery.deadLetteredThisRun > 0,
    drops,
    ok: true,
    relay: relayOutcome,
    result: emptyTriageResult(),
  };
}

/**
 * Deterministic retro core. Never guesses the transcript path; fails loudly and
 * files nothing when it is missing or unreadable.
 */
// eslint-disable-next-line complexity -- Native and gated relay paths share one egress pipeline by design.
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
  const relay = dependencies.relay;
  if (relay?.readiness.enabled === true && projectDirectory !== undefined) {
    const sourceSession =
      sessionId.trim().length === 0 || sessionId === 'unknown' ? options.transcript : sessionId;
    return runRelayRetro(
      encounters,
      drops,
      { session: sourceSession, windowStart: options.windowStart ?? 0 },
      projectDirectory,
      relay,
    );
  }
  if (projectDirectory !== undefined) {
    const drafts = encounters.map(encounter => encounter.draft);
    recordRetroDebugEvent({
      event: 'retro_cli_spool',
      sessionId,
      draftsPassed: drafts.length,
      skippedAppend: drafts.length === 0,
      spoolFile: nodePath.relative(projectDirectory, draftSpoolPath(projectDirectory, sessionId)),
    });
    spoolDrafts(projectDirectory, sessionId, drafts);
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
  const remainingDrafts = readSpooledDrafts(projectDirectory, sessionId).length;
  const agentFilingNeeded = remainingDrafts > 0;
  recordRetroDebugEvent({
    event: 'retro_cli_filing',
    sessionId,
    filedCount: result.filedSignatures.length,
    remainingDrafts,
    agentFilingNeeded,
  });
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

const HEADLESS_ENVIRONMENT_KEYS = [
  'ALL_PROXY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_BEDROCK_MANTLE_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'APPDATA',
  'AWS_ACCESS_KEY_ID',
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_PROFILE',
  'AWS_REGION',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CONFIG_DIR',
  'CLOUD_ML_REGION',
  'CODEX_HOME',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'HOME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'LANG',
  'LC_ALL',
  'NODE_EXTRA_CA_CERTS',
  'NO_PROXY',
  'OPENAI_API_KEY',
  'PATH',
  'PATHEXT',
  'SHELL',
  'SystemRoot',
  'TERM',
  'TMPDIR',
  'USER',
  'USERPROFILE',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
] as const;

function headlessEnvironment(environment: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    HEADLESS_ENVIRONMENT_KEYS.flatMap(key => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

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
        env: headlessEnvironment(process.env),
        cwd: workDirectory,
        model,
        schemaPath: nodePath.join(workDirectory, 'schema.json'),
        outputPath: nodePath.join(workDirectory, 'output.json'),
      });
      recordRetroDebugEvent({
        event: 'retro_cli_extraction',
        agent: 'codex',
        ok: result.ok,
        findingsCount: result.findings.length,
        failureReason: result.failureReason,
        exitCode: result.exitCode,
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
      env: headlessEnvironment(process.env),
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
    searchByCanonical: unavailableTransportFailure,
    createIssue: unavailableTransportFailure,
    listComments: unavailableTransportFailure,
    createComment: unavailableTransportFailure,
    updateComment: unavailableTransportFailure,
  };
}

export interface RetroCommandOutput {
  error: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
}

type RelayRoute = NonNullable<RetroDependencies['relay']>;

export interface RetroReadinessComposition {
  buildCommit?: string;
  configuration?: () => Omit<RelayRoute, 'readiness'> | undefined;
  fetch?: typeof fetch;
  isAncestor?: (ancestor: string, descendant: string) => Promise<boolean>;
  manifest?: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS;
  now?: Date;
  readArtifactAtCommit?: (
    commit: string,
    artifactPath: string,
  ) => Promise<{ content: string; sha256: string } | undefined>;
}

function physicalProjectPath(projectDirectory: string): string | undefined {
  try {
    return realpathSync(projectDirectory);
  } catch {
    try {
      return nodePath.join(
        realpathSync(nodePath.dirname(projectDirectory)),
        nodePath.basename(projectDirectory),
      );
    } catch {
      return undefined;
    }
  }
}

function physicalOutboxPath(outboxDirectory: string): string | undefined {
  try {
    const physicalOutbox = realpathSync(outboxDirectory);
    return statSync(physicalOutbox).isDirectory() ? physicalOutbox : undefined;
  } catch {
    return undefined;
  }
}

function isOutsideProject(projectDirectory: string, outboxDirectory: string): boolean {
  const relative = nodePath.relative(projectDirectory, outboxDirectory);
  return relative === '..' || relative.startsWith(`..${nodePath.sep}`);
}

export function resolveRelayOutboxDirectory(
  projectDirectory: string,
  configuredDirectory: string | undefined,
): string | undefined {
  const configured = configuredDirectory?.trim();
  if (configured === undefined || configured.length === 0 || !nodePath.isAbsolute(configured)) {
    return undefined;
  }
  const resolved = nodePath.resolve(configured);
  if (configured !== resolved) return undefined;
  const physicalProject = physicalProjectPath(projectDirectory);
  if (physicalProject === undefined) return undefined;
  const physicalOutbox = physicalOutboxPath(resolved);
  if (physicalOutbox === undefined) return undefined;
  return isOutsideProject(physicalProject, physicalOutbox) ? physicalOutbox : undefined;
}

// eslint-disable-next-line complexity -- Fail-closed runtime parsing keeps every credential field explicit.
function defaultRelayConfig(
  environment: NodeJS.ProcessEnv,
  projectDirectory: string,
): Omit<RelayRoute, 'readiness'> | undefined {
  const relayUrl = environment.SAFEWORD_RETRO_RELAY_URL?.trim();
  const credential = environment.SAFEWORD_RETRO_RELAY_CREDENTIAL?.trim();
  const repo = environment.SAFEWORD_RETRO_RELAY_REPOSITORY?.trim().toLowerCase();
  const installation = environment.SAFEWORD_RETRO_RELAY_INSTALLATION_ID?.trim();
  const configuredSpoolDirectory = environment.SAFEWORD_RETRO_RELAY_OUTBOX?.trim();
  const relayOrigin = relayUrl === undefined ? undefined : normalizeRelayOrigin(relayUrl);
  const spoolDirectory = resolveRelayOutboxDirectory(projectDirectory, configuredSpoolDirectory);
  if (
    relayOrigin === undefined ||
    credential === undefined ||
    credential.length === 0 ||
    repo === undefined ||
    repo.length === 0 ||
    installation === undefined ||
    spoolDirectory === undefined ||
    !/^[\w.-]+\/[\w.-]+$/u.test(repo) ||
    !/^[1-9]\d*$/u.test(installation)
  ) {
    return undefined;
  }
  const installationId = Number(installation);
  if (!Number.isSafeInteger(installationId)) return undefined;
  return { credential, installationId, relayUrl: relayOrigin, repository: repo, spoolDirectory };
}

function usesInjectedReadinessEvidence(composition: RetroReadinessComposition): boolean {
  return (
    composition.buildCommit !== undefined ||
    composition.isAncestor !== undefined ||
    composition.readArtifactAtCommit !== undefined
  );
}

function resolveRelayReadiness(
  composition: RetroReadinessComposition,
  manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
): Promise<{ enabled: boolean }> {
  const now = composition.now ?? new Date();
  if (!usesInjectedReadinessEvidence(composition)) {
    return validateBuildAttestedRelayReadiness(manifest, SAFEWORD_RELAY_BUILD_ATTESTATION, now);
  }
  return validateRelayReadiness(manifest, {
    buildCommit: composition.buildCommit ?? SAFEWORD_BUILD_COMMIT,
    isAncestor: composition.isAncestor ?? (() => Promise.resolve(false)),
    now,
    readArtifactAtCommit: composition.readArtifactAtCommit ?? (() => Promise.resolve(undefined)),
  });
}

async function resolveRetroRelayRoute(input: {
  composition?: RetroReadinessComposition;
  environment: NodeJS.ProcessEnv;
  projectDirectory: string;
}): Promise<RelayRoute | undefined> {
  const composition = input.composition ?? {};
  const manifest = composition.manifest ?? CHECKED_IN_RELAY_READINESS;
  const readiness = await resolveRelayReadiness(composition, manifest);
  if (!readiness.enabled) return undefined;
  const config =
    composition.configuration === undefined
      ? defaultRelayConfig(input.environment, input.projectDirectory)
      : composition.configuration();
  return config === undefined
    ? undefined
    : {
        ...config,
        ...(composition.fetch && { fetch: composition.fetch }),
        readiness,
      };
}

export async function executeRetroCommand(
  options: RetroCliOptions,
  dependencies: {
    environment: NodeJS.ProcessEnv;
    extract: FindingExtractor;
    extractionSucceeded: () => boolean;
    harness: string;
    output: RetroCommandOutput;
    projectDirectory: string;
    relay?: RetroReadinessComposition;
    resolveProvenance?: () => Provenance | undefined;
    restTransportAvailable: boolean;
    sessionId: string;
    transport: IssueTracker;
  },
): Promise<RetroOutcome> {
  const relay = await resolveRetroRelayRoute({
    composition: dependencies.relay,
    environment: dependencies.environment,
    projectDirectory: dependencies.projectDirectory,
  });
  const outcome = await runRetro(options, {
    extract: dependencies.extract,
    harness: dependencies.harness,
    projectDirectory: dependencies.projectDirectory,
    readFile: (path: string) => readFileSync(path, 'utf8'),
    ...(relay !== undefined && { relay }),
    resolveProvenance: dependencies.resolveProvenance,
    sessionId: dependencies.sessionId,
    transport: dependencies.transport,
  });
  reportRetroCommandOutcome(outcome, {
    extractionSucceeded: dependencies.extractionSucceeded(),
    output: dependencies.output,
    restTransportAvailable: dependencies.restTransportAvailable,
  });
  return outcome;
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
  reportRelayOutcome(outcome, options.output, outcome.ok);
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

  if (outcome.relay !== undefined) return;

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

function reportRelayOutcome(
  outcome: RetroOutcome,
  output: RetroCommandOutput,
  complete: boolean,
): void {
  if (outcome.relay === undefined) return;
  const { info, success } = output;
  const relay = outcome.relay;
  info(
    `retro relay: ${relay.accepted} accepted, ${relay.retryable} queued for retry, ${relay.deadLetterBacklog} dead letter(s), ${relay.spoolFailed ?? 0} spool error(s)`,
  );
  const dropLine = renderDropReport(outcome.drops);
  if (dropLine) info(dropLine);
  if (relay.retryable > 0) {
    info('retro relay: delivery remains durably queued under its original request identity.');
  }
  if (relay.deadLetterBacklog > 0) {
    info(
      'retro relay: inspect with `safeword retro-relay-retry`; rearm with `safeword retro-relay-retry <request-id>`.',
    );
  }
  if ((relay.spoolFailed ?? 0) > 0) {
    info(
      'retro relay: some source identities could not be persisted; inspect the local relay spool.',
    );
  }
  if (complete) success('retro complete');
}

async function listRelaySpoolCommand(
  projectDirectory: string,
  output: RetroCommandOutput,
): Promise<boolean> {
  const entries = await listRelaySpoolEntries(projectDirectory);
  if (entries.length === 0) {
    output.info('retro relay: no durable requests.');
    return true;
  }
  output.info(`retro relay: ${entries.length} durable request(s):`);
  for (const entry of entries) output.info(`${entry.requestId} ${entry.state}`);
  return true;
}

export async function discardRelaySpoolCommand(
  requestId: string,
  confirmed: boolean,
  dependencies: {
    output: RetroCommandOutput;
    projectDirectory: string;
  },
): Promise<boolean> {
  if (!confirmed) {
    dependencies.output.error('retro relay: refusing to discard durable state without --confirm.');
    return false;
  }
  let discarded: boolean;
  try {
    discarded = await discardRelayRequest(dependencies.projectDirectory, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown filesystem error';
    dependencies.output.error(
      message === 'invalid relay request identity'
        ? 'retro relay: request identity must be a lowercase UUIDv4.'
        : `retro relay: failed to discard ${requestId}: ${message}`,
    );
    return false;
  }
  if (!discarded) {
    dependencies.output.error(`retro relay: durable request ${requestId} was not found.`);
    return false;
  }
  dependencies.output.success(
    `retro relay: discarded poisoned durable request ${requestId}; this cannot be undone.`,
  );
  return true;
}

export async function retryRelayDeadLetterCommand(
  requestId: string | undefined,
  dependencies: {
    output: RetroCommandOutput;
    projectDirectory: string;
    relay?: {
      credential: string;
      fetch: typeof fetch;
      operatorCredential?: string;
      relayUrl: string;
    };
  },
): Promise<boolean> {
  if (requestId === undefined) {
    return listRelaySpoolCommand(dependencies.projectDirectory, dependencies.output);
  }
  const { error, success } = dependencies.output;
  const deadLetters = await listRelayDeadLetters(dependencies.projectDirectory);
  const deadLetter = deadLetters.find(candidate => candidate.requestId === requestId);
  if (deadLetter === undefined) {
    error(`retro relay: dead letter ${requestId} was not found.`);
    return false;
  }
  let request: RelayDraftRequest;
  try {
    request = JSON.parse(deadLetter.bytes.toString('utf8')) as RelayDraftRequest;
  } catch {
    error(`retro relay: dead letter ${requestId} is corrupt and cannot be replayed.`);
    return false;
  }
  if (Date.parse(request.retryDeadlineAt) <= Date.now()) {
    if (dependencies.relay === undefined) {
      error(
        'retro relay: expired dead letters require SAFEWORD_RETRO_RELAY_URL and SAFEWORD_RETRO_RELAY_CREDENTIAL to recover the existing server receipt.',
      );
      return false;
    }
    const recovered = await recoverRelayDeadLetter(
      dependencies.projectDirectory,
      requestId,
      dependencies.relay,
    );
    if (!recovered) {
      error(`retro relay: the server could not recover expired request ${requestId}.`);
      return false;
    }
    success(`retro relay: recovered ${requestId} with its original durable request identity.`);
    return true;
  }
  let rearmed: boolean;
  try {
    rearmed = await rearmRelayDeadLetter(dependencies.projectDirectory, requestId);
  } catch {
    error('retro relay: request identity must be a lowercase UUIDv4.');
    return false;
  }
  if (!rearmed) return false;
  success(`retro relay: rearmed ${requestId} with its original durable request identity.`);
  return true;
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

  await executeRetroCommand(options, {
    environment: process.env,
    extract,
    extractionSucceeded: () => extractionSucceeded,
    harness: resolveRetroHarness(autoExtractAgent, detectAgent),
    output: { error, info, success },
    projectDirectory,
    // Prefer the session id the hook resolved and forwarded (cloud sets
    // CLAUDE_CODE_REMOTE_SESSION_ID, not CLAUDE_SESSION_ID, so the env fallback
    // alone resolved to 'unknown' and broke ledger session-accounting; ZFGWS1).
    sessionId:
      options.sessionId ?? process.env.CLAUDE_SESSION_ID ?? options.transcript ?? 'unknown',
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
    restTransportAvailable: restTransport !== undefined,
    transport,
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
  // `deferred` needs no check: it only populates once flagged hits the per-run
  // bound, so deferred > 0 implies flagged > 0 and the predicate is false.
  if (result.failed.length > 0 && result.flagged.length === 0 && result.skipped.length === 0) {
    error('retro-reconcile: every evaluated issue failed; nothing swept.');
    process.exitCode = 1;
    return;
  }
  success('reconcile complete');
}
