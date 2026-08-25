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
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { platform, tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { isDogfoodRepo } from '../../templates/hooks/lib/dogfood.js';
import { recordRetroDebugEvent } from '../../templates/hooks/lib/retro-debug.js';
import {
  draftSpoolPath,
  drainAcknowledgedDrafts,
  readSpooledDrafts,
  recordFiledAck,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { type RetroAgent, windowFor } from '../../templates/hooks/lib/retro-extract.js';
import { captureRetroFilingFault } from '../../templates/hooks/lib/self-report.js';
import { type Provenance, PROVENANCE_SHA } from '../retro/ledger.js';
import { prepareEncounters } from '../retro/pipeline.js';
import {
  deliverSanitizedPublicRetroFinding,
  type PublicRetroDeliveryDependencies,
  type PublicRetroSource,
} from '../retro/public-delivery.js';
import { buildPublicRetroSource } from '../retro/public-source.js';
import { createPublicRetroTransport } from '../retro/public-transport.js';
import { reconcile, type ReconcileTracker } from '../retro/reconcile.js';
import {
  DEFAULT_RELAY_REQUEST_DEADLINE_MS,
  deliverRelayRequests,
  discardRelayRequest,
  listRelayDeadLetters,
  listRelaySpoolEntries,
  normalizeRelayOrigin,
  persistRelayDraftBatch,
  rearmRelayDeadLetter,
  recoverRelayDeadLetter,
  RELAY_OVERALL_HEADROOM_MS,
  type RelayDraftRequest,
  type RelayReportedTerminalReceipt,
  relaySourceKey,
  RelaySpoolCorruptionError,
} from '../retro/relay-delivery.js';
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
  /** Host-approved route to the isolated public quarantine collector. */
  publicRetro?: PublicRetroDeliveryDependencies & { source: PublicRetroSource };
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
    serverReportedTerminalReceipts?: RelayReportedTerminalReceipt[];
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
    filedDestinations: [],
    filedSignatures: [],
  };
}

function relayDraftForEncounter(
  encounter: Encounter,
  source: { session: string; windowStart: number },
  relay: Pick<NonNullable<RetroDependencies['relay']>, 'installationId' | 'repository'>,
) {
  const relayDraft = {
    body: encounter.draft.body,
    canonicalKey: encounter.draft.canonicalSignature,
    installationId: relay.installationId,
    labels: encounter.draft.labels,
    legacySignature: encounter.draft.signature,
    repository: relay.repository,
    title: encounter.draft.title,
  };
  return {
    ...relayDraft,
    sourceKey: relaySourceKey(source.session, source.windowStart, relayDraft),
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
  const relayDrafts = encounters.map(encounter => relayDraftForEncounter(encounter, source, relay));
  const persistence = await persistRelayDraftBatch(spoolDirectory, relayDrafts);
  const spoolFailed = persistence.filter(outcome => outcome.status === 'rejected').length;
  const deadlineMs = relay.deadlineMs ?? DEFAULT_RELAY_REQUEST_DEADLINE_MS;
  let delivery: Awaited<ReturnType<typeof deliverRelayRequests>>;
  try {
    delivery = await deliverRelayRequests(spoolDirectory, {
      credential: relay.credential,
      deadlineMs,
      fetch: relay.fetch ?? fetch,
      now: () => Date.now(),
      overallDeadlineMs: deadlineMs + RELAY_OVERALL_HEADROOM_MS,
      relayUrl: relay.relayUrl,
    });
  } catch (error) {
    return relayDeliveryFailureOutcome(error, drops, persistence, spoolFailed);
  }
  const relayOutcome = { ...delivery, spoolFailed };
  if (spoolFailed > 0) {
    return {
      agentFilingNeeded: true,
      drops,
      errorMessage: relayPersistenceErrorMessage(persistence, spoolFailed),
      ok: false,
      relay: relayOutcome,
      result: emptyTriageResult(),
    };
  }
  const unresolvedTerminal = (delivery.serverReportedTerminalReceipts ?? []).find(
    receipt => receipt.state !== 'tombstone' || receipt.issueNumber === undefined,
  );
  if (unresolvedTerminal !== undefined) {
    return {
      agentFilingNeeded: false,
      drops,
      errorMessage: `retro relay has server-owned ${unresolvedTerminal.state} request ${unresolvedTerminal.requestId}; inspect relay operations and logs`,
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

function relayDeliveryFailureOutcome(
  error: unknown,
  drops: { schema: number; surface: number },
  persistence: PromiseSettledResult<RelayDraftRequest | undefined>[],
  spoolFailed: number,
): RetroOutcome {
  const persistenceError =
    spoolFailed > 0 ? `${relayPersistenceErrorMessage(persistence, spoolFailed)}; ` : '';
  return {
    agentFilingNeeded: true,
    drops,
    errorMessage: `${persistenceError}retro relay delivery failed: ${relayDeliveryErrorMessage(error)}`,
    ok: false,
    result: emptyTriageResult(),
  };
}

function relayDeliveryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function relayPersistenceErrorMessage(
  persistence: PromiseSettledResult<RelayDraftRequest | undefined>[],
  spoolFailed: number,
): string {
  const noun = spoolFailed === 1 ? 'finding' : 'findings';
  const fallback = `retro relay could not durably persist ${spoolFailed} ${noun}; retry the command`;
  const corruption = persistence.find(
    outcome => outcome.status === 'rejected' && outcome.reason instanceof RelaySpoolCorruptionError,
  );
  if (corruption?.status !== 'rejected') return fallback;
  if (!(corruption.reason instanceof RelaySpoolCorruptionError)) return fallback;
  const requestId = corruption.reason.requestIds[0];
  if (requestId === undefined) return fallback;
  return `retro relay could not durably persist ${spoolFailed} ${noun}; request ${requestId} is corrupt. Inspect it with \`safeword retro-relay-retry\`; only if intentionally abandoning it, run \`safeword retro-relay-discard ${requestId} --confirm\`.`;
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
  const publicPreparationDeadline =
    dependencies.publicRetro === undefined ? undefined : dependencies.publicRetro.now() + 1000;
  const { encounters, drops, findings } = await prepareEncounters(rawFindings);
  const publicFinding = findings.length === 1 ? findings[0] : undefined;

  if (
    dependencies.publicRetro !== undefined &&
    publicPreparationDeadline !== undefined &&
    rawFindings.length === 1 &&
    publicFinding !== undefined
  ) {
    await deliverSanitizedPublicRetroFinding(
      {
        finding: publicFinding,
        sessionId: dependencies.sessionId,
        source: dependencies.publicRetro.source,
      },
      dependencies.publicRetro,
      publicPreparationDeadline,
    );
  }

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

  // A tracker result alone cannot authorize a drain: persist a destination-bound
  // ack first, then drain only those signatures whose ack write succeeded. If the
  // local write fails after a successful post, retaining the draft may cause a
  // deduped retry, but it cannot silently destroy the finding (#1805).
  const acknowledgedCount = result.filedDestinations.filter(destination =>
    recordFiledAck(projectDirectory, sessionId, destination),
  ).length;
  drainAcknowledgedDrafts(projectDirectory, sessionId);
  const remainingDrafts = readSpooledDrafts(projectDirectory, sessionId).length;
  const agentFilingNeeded = remainingDrafts > 0;
  recordRetroDebugEvent({
    event: 'retro_cli_filing',
    sessionId,
    filedCount: result.filedSignatures.length,
    acknowledgedCount,
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
  /** Internal lifecycle assertion: the host observed three completed tool pairs. */
  publicRetro?: boolean;
  /** Delta re-arm: digest only the transcript from this char offset onward (ZFGWS1). */
  windowStart?: number;
  /** Stable session id forwarded from the hook, so the ledger isn't keyed to 'unknown'. */
  sessionId?: string;
}

/** Result consumed by the catalog-based CLI handler. */
export interface RetroCommandExecution {
  readonly outcome: RetroOutcome;
  readonly extractionSucceeded: boolean;
  readonly restTransportAvailable: boolean;
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

function spawnCursorExtractor(argv: string[], spawnOptions: Parameters<AutoExtractSpawn>[1]) {
  const result = spawnSync('cursor-agent', argv, {
    cwd: spawnOptions.cwd,
    env: spawnOptions.env,
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return Promise.resolve({ code: result.status, stdout: result.stdout ?? '' });
}

const CURSOR_RETRO_DENY_RULES = [
  'Shell(**)',
  'Read(**)',
  'Write(**)',
  'Mcp(**)',
  'WebFetch(**)',
  'WebSearch(**)',
] as const;

/**
 * Install the most restrictive project-local Cursor CLI policy before the
 * headless child starts. Cursor gives deny rules precedence over user allows;
 * the empty network allowlist and enabled sandbox add a second boundary.
 */
function prepareCursorExtractionDirectory(directory: string): void {
  const gitInit = spawnSync('git', ['init', '--quiet'], { cwd: directory, encoding: 'utf8' });
  if (gitInit.status !== 0)
    throw new Error(gitInit.stderr || 'could not initialize Cursor sandbox');
  const cursorDirectory = nodePath.join(directory, '.cursor');
  mkdirSync(cursorDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(cursorDirectory, 'cli.json'),
    JSON.stringify({
      permissions: { allow: [], deny: CURSOR_RETRO_DENY_RULES },
      approvalMode: 'allowlist',
    }),
  );
  writeFileSync(
    nodePath.join(cursorDirectory, 'sandbox.json'),
    JSON.stringify({
      type: 'workspace_readwrite',
      disableTmpWrite: true,
      networkPolicy: { default: 'deny', allow: [] },
    }),
  );
}

/**
 * Build the host-matched auto extractor in a neutral temporary workspace. Each
 * adapter applies its native containment boundary (Claude read allowlist, Codex
 * read-only sandbox, or Cursor deny rules plus sandbox) and reports checked
 * extraction success separately from a schema-valid empty result. The legacy
 * Stop-hook callers can remain silent, while closeout fails closed on errors.
 */
export async function buildAutoExtractor(
  projectDirectory: string,
  dependencies: AutoExtractDependencies = {},
): Promise<FindingExtractor> {
  const {
    runCodexHeadlessExtractionChecked,
    runCursorHeadlessExtractionChecked,
    runHeadlessExtractionChecked,
    resolveRetroModel,
  } = await import('../../templates/hooks/lib/retro-extract.js');

  const agent = dependencies.agent ?? 'claude';
  const model = dependencies.model ?? resolveRetroModel(projectDirectory, agent);
  const spawnClaude = dependencies.spawn ?? spawnClaudeExtractor;
  const spawnCodex = dependencies.spawn ?? spawnCodexExtractor;
  const spawnCursor = dependencies.spawn ?? spawnCursorExtractor;

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

  if (agent === 'cursor') {
    prepareCursorExtractionDirectory(workDirectory);
    return async (transcript: string) => {
      const result = await runCursorHeadlessExtractionChecked(transcript, {
        spawn: spawnCursor,
        env: process.env,
        cwd: workDirectory,
        model,
      });
      recordRetroDebugEvent({
        event: 'retro_cli_extraction',
        agent: 'cursor',
        ok: result.ok,
        findingsCount: result.findings.length,
        failureReason: result.failureReason,
        exitCode: result.exitCode,
      });
      dependencies.onExtractionResult?.(result);
      return result.findings;
    };
  }

  return async (transcript: string) => {
    const result = await runHeadlessExtractionChecked(transcript, {
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
    recordRetroDebugEvent({
      event: 'retro_cli_extraction',
      agent: 'claude',
      ok: result.ok,
      findingsCount: result.findings.length,
      failureReason: result.failureReason,
      exitCode: result.exitCode,
    });
    dependencies.onExtractionResult?.(result);
    return result.findings;
  };
}

function resolveAutoExtractAgent(env: Record<string, string | undefined>): RetroAgent {
  if (env.SAFEWORD_RETRO_AGENT === 'codex') return 'codex';
  if (env.SAFEWORD_RETRO_AGENT === 'cursor') return 'cursor';
  return 'claude';
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
  return agent === 'claude' ? detectAgent() : agent;
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

interface RetroReadinessComposition {
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
  if (resolved === nodePath.parse(resolved).root) return undefined;
  const physicalProject = physicalProjectPath(projectDirectory);
  if (physicalProject === undefined) return undefined;
  const physicalOutbox = physicalOutboxPath(resolved);
  if (physicalOutbox === undefined) return undefined;
  return isOutsideProject(physicalProject, physicalOutbox) ? physicalOutbox : undefined;
}

const INVALID_RELAY_OUTBOX_ERROR =
  'retro relay configuration is invalid; SAFEWORD_RETRO_RELAY_OUTBOX must be an existing absolute directory outside the project';

export function resolveRelayRecoveryOutboxDirectory(
  projectDirectory: string,
  configuredDirectory: string | undefined,
): { directory: string } | { error: string } {
  const configured = configuredDirectory?.trim();
  if (configured === undefined || configured.length === 0) {
    return { directory: projectDirectory };
  }
  const directory = resolveRelayOutboxDirectory(projectDirectory, configured);
  return directory === undefined ? { error: INVALID_RELAY_OUTBOX_ERROR } : { directory };
}

type RelayConfig = Omit<RelayRoute, 'readiness'>;

function relayConfigAbsent(...values: (string | undefined)[]): boolean {
  return values.every(value => value === undefined || value.length === 0);
}

interface RelayScalarInput {
  credential?: string;
  installation?: string;
  relayUrl?: string;
  repo?: string;
}

function relayScalarFieldsPresent(input: RelayScalarInput): input is Required<RelayScalarInput> {
  return (
    input.credential !== undefined &&
    input.installation !== undefined &&
    input.relayUrl !== undefined &&
    input.repo !== undefined
  );
}

function resolveRelayScalars(
  input: RelayScalarInput,
): Omit<RelayConfig, 'spoolDirectory'> | undefined {
  if (!relayScalarFieldsPresent(input)) return undefined;
  const relayOrigin = normalizeRelayOrigin(input.relayUrl);
  if (
    relayOrigin === undefined ||
    input.credential.length === 0 ||
    input.repo.length === 0 ||
    !/^[\w.-]+\/[\w.-]+$/u.test(input.repo) ||
    !/^[1-9]\d*$/u.test(input.installation)
  ) {
    return undefined;
  }
  const installationId = Number(input.installation);
  if (!Number.isSafeInteger(installationId)) return undefined;
  return {
    credential: input.credential,
    installationId,
    relayUrl: relayOrigin,
    repository: input.repo,
  };
}

export function resolveRelayConfig(
  environment: NodeJS.ProcessEnv,
  projectDirectory: string,
): { config: RelayConfig } | { error: string } | undefined {
  const relayUrl = environment.SAFEWORD_RETRO_RELAY_URL?.trim();
  const credential = environment.SAFEWORD_RETRO_RELAY_CREDENTIAL?.trim();
  const repo = environment.SAFEWORD_RETRO_RELAY_REPOSITORY?.trim().toLowerCase();
  const installation = environment.SAFEWORD_RETRO_RELAY_INSTALLATION_ID?.trim();
  const configuredSpoolDirectory = environment.SAFEWORD_RETRO_RELAY_OUTBOX?.trim();
  if (relayConfigAbsent(relayUrl, credential, repo, installation, configuredSpoolDirectory)) {
    return undefined;
  }
  const scalars = resolveRelayScalars({ credential, installation, relayUrl, repo });
  if (scalars === undefined) {
    return {
      error:
        'retro relay configuration is incomplete or invalid; URL, credential, repository, installation ID, and external outbox are required',
    };
  }
  const spoolDirectory = resolveRelayOutboxDirectory(projectDirectory, configuredSpoolDirectory);
  if (spoolDirectory === undefined) {
    return { error: INVALID_RELAY_OUTBOX_ERROR };
  }
  return {
    config: {
      ...scalars,
      spoolDirectory,
    },
  };
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

// eslint-disable-next-line complexity -- Readiness, injected tests, and production config remain fail-closed branches.
async function resolveRetroRelayRoute(input: {
  composition?: RetroReadinessComposition;
  environment: NodeJS.ProcessEnv;
  projectDirectory: string;
}): Promise<{ error?: string; route?: RelayRoute }> {
  const composition = input.composition ?? {};
  const manifest = composition.manifest ?? CHECKED_IN_RELAY_READINESS;
  const readiness = await resolveRelayReadiness(composition, manifest);
  if (!readiness.enabled) return {};
  if (composition.configuration !== undefined) {
    const config = composition.configuration();
    if (config === undefined) return {};
    return {
      route: {
        ...config,
        ...(composition.fetch && { fetch: composition.fetch }),
        readiness,
      },
    };
  }
  const resolved = resolveRelayConfig(input.environment, input.projectDirectory);
  if (resolved === undefined || 'error' in resolved) return resolved ?? {};
  return {
    route: {
      ...resolved.config,
      ...(composition.fetch && { fetch: composition.fetch }),
      readiness,
    },
  };
}

async function executeRetroWithDependencies(
  options: RetroCliOptions,
  dependencies: {
    captureFilingFault?: (projectDirectory: string, sessionId: string) => void;
    environment: NodeJS.ProcessEnv;
    extract: FindingExtractor;
    extractionSucceeded: () => boolean;
    harness: string;
    output: RetroCommandOutput;
    projectDirectory: string;
    relay?: RetroReadinessComposition;
    publicRetro?: NonNullable<RetroDependencies['publicRetro']>;
    resolveProvenance?: () => Provenance | undefined;
    restTransportAvailable: boolean;
    sessionId: string;
    transport: IssueTracker;
  },
): Promise<RetroOutcome> {
  const relayResolution = await resolveRetroRelayRoute({
    composition: dependencies.relay,
    environment: dependencies.environment,
    projectDirectory: dependencies.projectDirectory,
  });
  if (relayResolution.error !== undefined) {
    const outcome = { errorMessage: relayResolution.error, ok: false };
    reportRetroCommandOutcome(outcome, {
      extractionSucceeded: dependencies.extractionSucceeded(),
      output: dependencies.output,
      restTransportAvailable: dependencies.restTransportAvailable,
    });
    return outcome;
  }
  const relay = relayResolution.route;
  const outcome = await runRetro(options, {
    extract: dependencies.extract,
    harness: dependencies.harness,
    projectDirectory: dependencies.projectDirectory,
    readFile: (path: string) => readFileSync(path, 'utf8'),
    ...(relay !== undefined && { relay }),
    ...(dependencies.publicRetro !== undefined && { publicRetro: dependencies.publicRetro }),
    resolveProvenance: dependencies.resolveProvenance,
    sessionId: dependencies.sessionId,
    transport: dependencies.transport,
  });
  reportRetroCommandOutcome(outcome, {
    extractionSucceeded: dependencies.extractionSucceeded(),
    output: dependencies.output,
    restTransportAvailable: dependencies.restTransportAvailable,
  });
  if (dependencies.restTransportAvailable && (outcome.result?.failed.length ?? 0) > 0) {
    dependencies.captureFilingFault?.(dependencies.projectDirectory, dependencies.sessionId);
  }
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
    error('retro: auto-extraction did not produce schema-valid output.');
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
    `retro relay: ${relay.accepted} durably owned, ${relay.retryable} queued for retry, ${relay.deadLetterBacklog} local dead letter(s), ${relay.spoolFailed ?? 0} spool error(s)`,
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
  reportServerTerminalReceipts(relay, info);
  if ((relay.spoolFailed ?? 0) > 0) {
    info(
      'retro relay: some source identities could not be persisted; inspect the local relay spool.',
    );
  }
  if (complete) success('retro complete');
}

function reportServerTerminalReceipts(
  relay: NonNullable<RetroOutcome['relay']>,
  info: RetroCommandOutput['info'],
): void {
  const terminalReceipts = relay.serverReportedTerminalReceipts ?? [];
  for (const receipt of terminalReceipts) {
    const identity = `request ${receipt.requestId} (receipt ${receipt.receiptId})`;
    if (receipt.state === 'dead-letter') {
      info(
        `retro relay: ${identity} is durably server-side dead-lettered; relay operator recovery is required.`,
      );
    } else if (receipt.state === 'rejected') {
      info(
        `retro relay: ${identity} was permanently rejected by the relay; inspect relay operations and logs.`,
      );
    } else if (receipt.issueNumber === undefined) {
      info(
        `retro relay: ${identity} ended in a tombstone without an issue reference; inspect relay operations and logs.`,
      );
    } else {
      info(`retro relay: ${identity} is resolved by tombstone as issue #${receipt.issueNumber}.`);
    }
  }
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
    faultBeforeRearm?: () => Promise<void>;
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
  await dependencies.faultBeforeRearm?.();
  try {
    rearmed = await rearmRelayDeadLetter(dependencies.projectDirectory, requestId);
  } catch {
    error('retro relay: request identity must be a lowercase UUIDv4.');
    return false;
  }
  if (!rearmed) {
    error(
      `retro relay: dead letter ${requestId} could not be claimed; list current state and retry.`,
    );
    return false;
  }
  success(`retro relay: rearmed ${requestId} with its original durable request identity.`);
  return true;
}

function localPublicHarness(agent: RetroAgent): 'claude-code' | 'codex' | undefined {
  if (agent === 'claude') return 'claude-code';
  if (agent === 'codex') return 'codex';
  return undefined;
}

function resolvePublicRetroRoute(input: {
  agent: RetroAgent;
  enabled: boolean;
  environment: NodeJS.ProcessEnv;
  projectDirectory: string;
}): NonNullable<RetroDependencies['publicRetro']> | undefined {
  if (!input.enabled || input.environment.CLAUDE_CODE_REMOTE_SESSION_ID !== undefined) {
    return undefined;
  }
  const harness = localPublicHarness(input.agent);
  if (harness === undefined) return undefined;
  const source = buildPublicRetroSource(input.projectDirectory, {
    agentVersion:
      harness === 'codex' ? input.environment.CODEX_VERSION : input.environment.CLAUDE_CODE_VERSION,
    cliVersion: VERSION,
    environment: input.environment,
    harness,
    model: harness === 'codex' ? input.environment.CODEX_MODEL : input.environment.ANTHROPIC_MODEL,
    osFamily: platform(),
    pluginVersion: VERSION,
  });
  if (source === undefined) return undefined;
  return {
    attemptsDirectory: nodePath.join(input.projectDirectory, '.safeword', 'retro-attempts'),
    now: () => performance.now(),
    randomUUID,
    source,
    transport: createPublicRetroTransport(),
  };
}

/**
 * CLI wrapper. Supplies the real boundaries: the extractor reads agent-produced
 * raw findings from `--findings <path>` (the agent runs the retro guide, writes
 * findings JSON, then invokes this), and the transport is a REST client. Both
 * are intentionally thin and live outside the tested deterministic core.
 */
async function executeRetroCliCommand(
  options: RetroCliOptions,
  cwd?: string,
): Promise<RetroCommandExecution> {
  const { detectAgent } = await import('../../templates/hooks/lib/self-report.js');
  const { createRestTransport, resolveGitHubToken } = await import('../retro/github-rest.js');

  const projectDirectory = cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
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

  const harness = resolveRetroHarness(autoExtractAgent, detectAgent);
  const publicRetro = resolvePublicRetroRoute({
    agent: autoExtractAgent,
    enabled: options.publicRetro === true,
    environment: process.env,
    projectDirectory,
  });

  const outcome = await executeRetroWithDependencies(options, {
    captureFilingFault: captureRetroFilingFault,
    environment: process.env,
    extract,
    extractionSucceeded: () => extractionSucceeded,
    harness,
    // The catalog handler owns the public CLI result (including JSON output).
    // Keep this legacy wrapper side-effect-free so a machine response is never
    // prefixed with human progress lines.
    output: {
      error: () => process.exitCode,
      info: () => process.exitCode,
      success: () => process.exitCode,
    },
    projectDirectory,
    ...(publicRetro !== undefined && { publicRetro }),
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

  return {
    outcome,
    extractionSucceeded,
    restTransportAvailable: restTransport !== undefined,
  };
}

export function executeRetroCommand(
  options: RetroCliOptions,
  dependencies: Parameters<typeof executeRetroWithDependencies>[1],
): Promise<RetroOutcome>;
export function executeRetroCommand(
  options: RetroCliOptions,
  cwd?: string,
): Promise<RetroCommandExecution>;
export function executeRetroCommand(
  options: RetroCliOptions,
  target?: Parameters<typeof executeRetroWithDependencies>[1] | string,
): Promise<RetroOutcome | RetroCommandExecution> {
  return typeof target === 'object' && target !== null
    ? executeRetroWithDependencies(options, target)
    : executeRetroCliCommand(options, target);
}

/** Compatibility entry point used by the standalone Commander registration tests. */
export async function retroCommand(options: RetroCliOptions): Promise<void> {
  await executeRetroCommand(options);
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

export type RetroReconcileExecution =
  | { readonly ok: true; readonly result: Awaited<ReturnType<typeof reconcile>> }
  | { readonly ok: false; readonly reason: string };

export async function executeRetroReconcile(
  dependencies: ReconcileCliDependencies = {},
): Promise<RetroReconcileExecution> {
  const { createReconcileTransport, resolveGitHubToken } = await import('../retro/github-rest.js');
  const tracker = dependencies.tracker ?? createReconcileTransport(resolveGitHubToken());
  if (!tracker) return { ok: false, reason: 'no GitHub access; nothing swept' };

  const result = await reconcile(tracker);
  const totalFailure =
    result.failed.length > 0 && result.flagged.length === 0 && result.skipped.length === 0;
  if (totalFailure) return { ok: false, reason: 'every evaluated issue failed; nothing swept' };
  return { ok: true, result };
}

/**
 * `safeword retro reconcile` — the flag-only reconcile sweep (G19QG7 SM2). No
 * transcript involved; it reads open retro-labeled issues, normalizes their
 * newest provenance to a code-state date, and marks possibly-resolved ones.
 * Fails loudly (exit 1) without GitHub access — a manual mode should say why it
 * did nothing, unlike the hook-driven filing path which must never block a Stop.
 */
export async function retroReconcileCommand(
  dependencies: ReconcileCliDependencies = {},
): Promise<void> {
  const { error, info, success } = await import('../utils/output.js');
  const execution = await executeRetroReconcile(dependencies);
  if (!execution.ok) {
    error(`retro-reconcile: ${execution.reason}.`);
    process.exitCode = 1;
    return;
  }

  const { result } = execution;
  info(
    `reconcile: ${result.flagged.length} flagged possibly-resolved, ${result.skipped.length} skipped, ${result.deferred.length} deferred to a later run, ${result.failed.length} failed`,
  );

  // Per-issue isolation keeps a PARTIAL failure green (one poisoned issue must
  // not redden every scheduled run), but when every evaluated issue failed the
  // sweep did no work at all (e.g. auth broke after listing) — that must be a
  // red run, not a report indistinguishable from a healthy quiet day (4KP67A).
  // `deferred` needs no check: it only populates once flagged hits the per-run
  // bound, so deferred > 0 implies flagged > 0 and the predicate is false.
  success('reconcile complete');
}
