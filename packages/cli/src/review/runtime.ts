import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { DELIVERY_CHECKLIST_CATEGORIES } from '../execution-plan/delivery-checklist.js';
import { warn } from '../utils/output.js';
import type {
  PlanContractPair,
  ReviewAgent,
  ReviewFailure,
  ReviewKind,
  ReviewPacket,
  UnverifiedReviewerOutput,
} from './contract.js';
import { reviewerEnvironment, reviewerProbeEnvironment } from './environment.js';
import { validateExecutionPlanOutput } from './execution-plan-output.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC_SHA256 } from './execution-plan-rubric.generated.js';
import { reviewerPromptInstructions } from './review-rubric.js';

export {
  deliveryCompatibilityReviewRubric,
  executionPlanReviewRubric,
  planReviewRubric,
  qualityReviewRubric,
  scenarioReviewRubric,
} from './review-rubric.js';

/**
 * The exact shape `parseReviewerOutput` enforces, expressed as JSON Schema so a
 * reviewer can be told it up front instead of guessing. Every property carries
 * a type and closed enums — Codex's structured-output mode rejects a bare
 * `const`, and its natural vocabulary (high/medium severities, path/title/
 * recommendation fields) is otherwise what comes back and gets refused.
 */
const REVIEW_OUTPUT_SCHEMA_SHAPE = {
  type: 'object',
  properties: {
    schema_version: { type: 'integer', enum: [1] },
    dispatch_id: { type: 'string' },
    reviewer_agent: { type: 'string', enum: ['claude', 'codex', 'opencode'] },
    verdict: { type: 'string', enum: ['approve', 'request_changes'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['info', 'warning', 'error'] },
          message: { type: 'string' },
        },
        required: ['severity', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['schema_version', 'dispatch_id', 'reviewer_agent', 'verdict', 'summary', 'findings'],
  additionalProperties: false,
} as const;

const JSON_NULL = JSON.parse('null') as null;
const REVIEW_OUTPUT_SCHEMA = JSON.stringify(REVIEW_OUTPUT_SCHEMA_SHAPE);

const EXECUTION_PLAN_PROOF_SPECIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    proof_id: { type: 'string' },
    method: { type: 'string', enum: ['command', 'review_receipt'] },
    scope: { type: 'string', enum: ['unit', 'integration', 'E2E', 'eval'] },
    boundary_exercised: { type: 'string' },
    qualifies_as: { type: 'string', enum: ['real_boundary', 'partial_or_structural'] },
    currency: {
      type: 'string',
      enum: ['current_required', 'compatible_earlier_allowed'],
    },
    invocation: {
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['command'] },
            cwd: { type: 'string' },
            argv: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'cwd', 'argv'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['review_receipt'] },
            kind: { type: 'string' },
            targets: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'kind', 'targets'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: [
    'proof_id',
    'method',
    'scope',
    'boundary_exercised',
    'qualifies_as',
    'currency',
    'invocation',
  ],
  additionalProperties: false,
} as const;

const EXECUTION_PLAN_CHECKLIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    category: { type: 'string', enum: DELIVERY_CHECKLIST_CATEGORIES },
    obligation: { type: 'string' },
    owner: { type: 'string', enum: ['contributor', 'human'] },
    required_proof: { type: 'string' },
    reviewed_disposition: {
      type: ['string', 'null'],
      enum: ['not_applicable', 'pending_human', JSON_NULL],
    },
    reviewed_detail: { type: ['string', 'null'] },
  },
  required: [
    'id',
    'category',
    'obligation',
    'owner',
    'required_proof',
    'reviewed_disposition',
    'reviewed_detail',
  ],
  additionalProperties: false,
} as const;

const EXECUTION_PLAN_DELIVERY_DEFINITION_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'integer', enum: [1] },
    design_approval_gate: { type: 'boolean' },
    proof_specifications: {
      type: 'array',
      items: EXECUTION_PLAN_PROOF_SPECIFICATION_SCHEMA,
    },
    checklist_items: { type: 'array', items: EXECUTION_PLAN_CHECKLIST_ITEM_SCHEMA },
  },
  required: ['schema_version', 'design_approval_gate', 'proof_specifications', 'checklist_items'],
  additionalProperties: false,
} as const;

const EXECUTION_PLAN_RECORD_SCHEMA = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      properties: {
        slicing_decision: {
          type: 'string',
          enum: ['one_pull_request', 'multiple_pull_requests'],
        },
        rationale: { type: 'string' },
        slices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              purpose: { type: 'string' },
              boundary: { type: 'string' },
              prerequisites: { type: 'array', items: { type: 'string' } },
              proof: { type: 'string' },
              completion_signal: { type: 'string' },
              relies_on_unmerged_successor: { type: 'boolean' },
            },
            required: [
              'name',
              'purpose',
              'boundary',
              'prerequisites',
              'proof',
              'completion_signal',
              'relies_on_unmerged_successor',
            ],
            additionalProperties: false,
          },
        },
        obligation_owners: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              obligation: { type: 'string' },
              slices: { type: 'array', items: { type: 'string' } },
            },
            required: ['obligation', 'slices'],
            additionalProperties: false,
          },
        },
        decision_statuses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              decision: { type: 'string' },
              status: { type: 'string', enum: ['unchanged'] },
            },
            required: ['decision', 'status'],
            additionalProperties: false,
          },
        },
        accepted_scenarios_covered: { type: 'boolean', enum: [true] },
        accepted_approach_preserved: { type: 'boolean', enum: [true] },
        normalized_plan_digest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        delivery_definition: EXECUTION_PLAN_DELIVERY_DEFINITION_SCHEMA,
      },
      required: [
        'slicing_decision',
        'rationale',
        'slices',
        'obligation_owners',
        'decision_statuses',
        'accepted_scenarios_covered',
        'accepted_approach_preserved',
        'normalized_plan_digest',
        'delivery_definition',
      ],
      additionalProperties: false,
    },
  ],
} as const;

const EXECUTION_PLAN_REVIEW_OUTPUT_SCHEMA_SHAPE = {
  ...REVIEW_OUTPUT_SCHEMA_SHAPE,
  properties: {
    ...REVIEW_OUTPUT_SCHEMA_SHAPE.properties,
    planning_destination: {
      type: 'string',
      enum: ['plan-execution', 'plan-implementation'],
    },
    execution_plan_record: EXECUTION_PLAN_RECORD_SCHEMA,
  },
  required: [
    ...REVIEW_OUTPUT_SCHEMA_SHAPE.required,
    'planning_destination',
    'execution_plan_record',
  ],
} as const;

/** Select the provider contract without changing any existing review-kind bytes. */
export function reviewOutputSchema(kind: ReviewKind): string {
  return kind === 'plan-execution'
    ? JSON.stringify(EXECUTION_PLAN_REVIEW_OUTPUT_SCHEMA_SHAPE)
    : REVIEW_OUTPUT_SCHEMA;
}
const CLAUDE_EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/**
 * An empty value means "unset", so it falls through quietly. A non-empty value
 * off the list is a typo worth reporting: stripping it here also strips the
 * warning Claude itself would print, leaving the user no signal from either
 * layer that their configured effort never applied.
 */
function configuredClaudeEffort(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const effort = environment.SAFEWORD_REVIEW_EFFORT_CLAUDE;
  if (effort === undefined || effort.trim() === '') return undefined;
  if (CLAUDE_EFFORT_LEVELS.has(effort)) return effort;
  warn(
    `Ignoring SAFEWORD_REVIEW_EFFORT_CLAUDE='${effort}' - expected low, medium, high, xhigh, or max.`,
  );
  return undefined;
}

const ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    REVIEW_OUTPUT_SCHEMA,
    '--no-session-persistence',
    '--disable-slash-commands',
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--tools',
    '',
  ],
  codex: [
    'exec',
    '--json',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable',
    'hooks',
    '--config',
    'mcp_servers={}',
    '-',
  ],
  opencode: ['run', '--format', 'json', '--pure'],
};

function baseReviewerArguments(reviewer: ReviewAgent, kind: ReviewKind): string[] {
  const base = [...ARGUMENTS[reviewer]];
  if (reviewer !== 'claude') return base;
  const schemaIndex = base.indexOf('--json-schema') + 1;
  base[schemaIndex] = reviewOutputSchema(kind);
  return base;
}

function reviewerExtraArguments(
  reviewer: ReviewAgent,
  model: string | undefined,
  schemaPath: string | undefined,
  environment: Readonly<Record<string, string | undefined>>,
): string[] {
  const extra: string[] = [];
  if (model !== undefined) extra.push('--model', model);
  const effort = reviewer === 'claude' ? configuredClaudeEffort(environment) : undefined;
  if (effort !== undefined) extra.push('--effort', effort);
  if (reviewer === 'codex' && schemaPath !== undefined) extra.push('--output-schema', schemaPath);
  return extra;
}

/**
 * Codex reads its prompt from stdin via a trailing `-`, so a model flag has to
 * land before it. Claude takes the prompt on stdin with no positional marker,
 * so appending is safe there.
 */
export function reviewerArguments(
  reviewer: ReviewAgent,
  model: string | undefined,
  schemaPath: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  kind: ReviewKind = 'quality-review',
): string[] {
  const base = baseReviewerArguments(reviewer, kind);
  const extra = reviewerExtraArguments(reviewer, model, schemaPath, environment);
  if (extra.length === 0) return base;
  if (reviewer !== 'codex') return [...base, ...extra];
  const stdinMarker = base.length - 1;
  if (base[stdinMarker] !== '-') throw new Error('Codex reviewer arguments lack the stdin marker');
  return [...base.slice(0, stdinMarker), ...extra, '-'];
}

/** One reviewer dispatch: who reviews, what they read, and on which model. */
interface ReviewAttempt {
  readonly reviewer: ReviewAgent;
  readonly packet: ReviewPacket;
  readonly cwd: string;
  readonly model: string | undefined;
  /** Written once per dispatch; owned by the dispatch, never by an attempt. */
  readonly schemaPath: string | undefined;
}

const HELP_ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: ['--help'],
  codex: ['exec', '--help'],
  opencode: ['run', '--help'],
};

/**
 * Host-CLI coupling deliberately checked before dispatch. These flags are
 * exercised end-to-end by tests/smoke/review.live.test.ts against installed
 * Claude and Codex CLIs when SAFEWORD_RUN_CROSS_AGENT_LIVE=1; unit fakes cover
 * deterministic failure modes, but are not the provenance for this list.
 */
const REQUIRED_CAPABILITIES: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    '--output-format',
    '--json-schema',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--setting-sources',
    '--strict-mcp-config',
    '--tools',
  ],
  codex: [
    '--json',
    '--sandbox',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable',
    '--config',
    '--output-schema',
  ],
  opencode: ['--format', '--pure', '--model'],
};

const MAX_OUTPUT_BYTES = 1024 * 1024;
// JSON uses null to distinguish a legible denial from a malformed omitted record.
const NULL_EXECUTION_PLAN_RECORD = JSON_NULL;

export class ReviewRuntimeError extends Error {
  constructor(
    readonly failure: ReviewFailure,
    message: string,
    readonly terminal = false,
  ) {
    super(message);
    this.name = 'ReviewRuntimeError';
  }
}

/**
 * How long one review attempt may take. Flat, not derived from packet size:
 * across 91 real review runs, successful reviews finished in 47 seconds at the
 * median and 75 at the slowest. Two minutes leaves substantial headroom while
 * still reserving time for a fallback and a typed result before a five-minute
 * host shell deadline.
 */
const DEFAULT_ATTEMPT_DEADLINE_MS = 120_000;

/**
 * The ceiling across all reviewer work. Keep thirty seconds inside the common
 * five-minute host shell deadline for packet checks, process cleanup, and JSON
 * presentation so callers receive the coordinator's typed result.
 */
const RUN_BOUND_MS = 270_000;
const BACKGROUND_RUN_BOUND_MS = 1_800_000;
const BACKGROUND_ATTEMPT_DEADLINE_MS = 600_000;

function reviewRunCeiling(env: Readonly<Record<string, string | undefined>>): number {
  return env.SAFEWORD_REVIEW_WORKER === '1' ? BACKGROUND_RUN_BOUND_MS : RUN_BOUND_MS;
}

/**
 * The absolute reviewer-work deadline shared by every route. Packet preparation
 * happens before this clock starts; synchronous integrity checks and the final
 * bounded cleanup may finish after it. The override can shorten this deadline
 * for tests, but cannot extend it beyond the caller-derived ceiling.
 */
export function runBoundMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = Number(env.SAFEWORD_REVIEW_RUN_BOUND_MS);
  const ceiling = reviewRunCeiling(env);
  // Shorter is allowed; longer is not. The ceiling is what makes "the command
  // returns before its caller gives up" a guarantee rather than a default.
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, ceiling) : ceiling;
}

export function reviewWorkerRunBoundMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  return runBoundMs({ ...env, SAFEWORD_REVIEW_WORKER: '1' });
}

/**
 * The least time worth starting a route with. Below this a route cannot produce
 * a real review, so it is honestly reported as not attempted rather than
 * launched to fail. It tracks the attempt deadline so a shortened deadline does
 * not make every later route unfundable.
 */
export function minimumRouteMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  return Math.min(60_000, reviewTimeoutMilliseconds(env));
}

export function reviewTimeoutMilliseconds(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.SAFEWORD_REVIEW_TIMEOUT_MS;
  // `Number('')` and `Number('  ')` are 0, and `Number('90s')` is NaN — both
  // fall through to the default rather than silently shortening a review.
  const configured = raw === undefined ? NaN : Number(raw);
  const ceiling = runBoundMs(env);
  const defaultDeadline =
    env.SAFEWORD_REVIEW_WORKER === '1'
      ? BACKGROUND_ATTEMPT_DEADLINE_MS
      : DEFAULT_ATTEMPT_DEADLINE_MS;
  const maximumAttempt = ceiling > 60_000 ? ceiling - 60_000 : ceiling;
  const requested = Number.isFinite(configured) && configured > 0 ? configured : defaultDeadline;
  return Math.min(requested, maximumAttempt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parseClaudeOutput(stdout: string): unknown {
  const envelope = parseJson(stdout);
  if (isRecord(envelope) && isRecord(envelope.structured_output)) {
    return envelope.structured_output;
  }
  if (isRecord(envelope) && typeof envelope.result === 'string') {
    return parseJson(envelope.result);
  }
  return envelope;
}

/** Parse newline-delimited JSON, discarding lines that are not valid JSON. */
function ndjsonEvents(stdout: string): unknown[] {
  return stdout
    .split('\n')
    .filter(line => line.trim() !== '')
    .flatMap(line => {
      try {
        return [parseJson(line)];
      } catch {
        return [];
      }
    });
}

function parseCodexOutput(stdout: string): unknown {
  const events = ndjsonEvents(stdout);
  const message = events.findLast(
    event =>
      isRecord(event) &&
      event.type === 'item.completed' &&
      isRecord(event.item) &&
      event.item.type === 'agent_message' &&
      typeof event.item.text === 'string',
  );
  if (isRecord(message) && isRecord(message.item) && typeof message.item.text === 'string') {
    return parseJson(message.item.text);
  }
  return parseJson(stdout);
}

function parseOpenCodeOutput(stdout: string): unknown {
  const completed = ndjsonEvents(stdout).filter(
    event =>
      isRecord(event) &&
      event.type === 'text' &&
      isRecord(event.part) &&
      event.part.type === 'text' &&
      isRecord(event.part.time) &&
      typeof event.part.time.end === 'number' &&
      typeof event.part.text === 'string',
  );
  if (completed.length !== 1) throw new Error('invalid reviewer output');
  const [event] = completed;
  if (!isRecord(event) || !isRecord(event.part) || typeof event.part.text !== 'string') {
    throw new Error('invalid reviewer output');
  }
  return parseJson(event.part.text);
}

function reviewerVerdictMatchesFindings(verdict: unknown, findings: readonly unknown[]): boolean {
  return (
    verdict !== 'approve' ||
    findings.every(finding => isRecord(finding) && finding.severity !== 'error')
  );
}

function reviewerOutputKeys(kind: ReviewKind): Set<string> {
  const keys = new Set([
    'schema_version',
    'dispatch_id',
    'reviewer_agent',
    'verdict',
    'summary',
    'findings',
  ]);
  if (kind === 'plan-execution') {
    keys.add('planning_destination');
    keys.add('execution_plan_record');
  }
  return keys;
}

function hasKindSpecificOutput(value: Record<string, unknown>, kind: ReviewKind): boolean {
  return (
    kind !== 'plan-execution' ||
    ((value.planning_destination === 'plan-execution' ||
      value.planning_destination === 'plan-implementation') &&
      Object.hasOwn(value, 'execution_plan_record'))
  );
}

function hasValidReviewerOutputBody(value: unknown, kind: ReviewKind): boolean {
  if (!isRecord(value)) return false;
  const allowedOutputKeys = reviewerOutputKeys(kind);
  if (
    Object.keys(value).some(key => !allowedOutputKeys.has(key)) ||
    value.schema_version !== 1 ||
    (value.verdict !== 'approve' && value.verdict !== 'request_changes') ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.findings) ||
    !hasKindSpecificOutput(value, kind)
  ) {
    return false;
  }
  // Dispatch and reviewer identity are deliberately validated by the
  // coordinator so it can distinguish missing from contradictory provenance.
  const findingsAreValid = value.findings.every(
    finding =>
      isRecord(finding) &&
      Object.keys(finding).length === 2 &&
      Object.hasOwn(finding, 'severity') &&
      Object.hasOwn(finding, 'message') &&
      // Coercing here would let a severity that merely stringifies to a known
      // one validate, and then compare unequal to 'error' in the check below —
      // approving with an error finding, which is what that check forbids.
      typeof finding.severity === 'string' &&
      ['info', 'warning', 'error'].includes(finding.severity) &&
      typeof finding.message === 'string',
  );
  if (!findingsAreValid) return false;
  return reviewerVerdictMatchesFindings(value.verdict, value.findings);
}

export function parseReviewerOutput(
  reviewer: ReviewAgent,
  stdout: string,
  kind: ReviewKind = 'quality-review',
): UnverifiedReviewerOutput {
  let output: unknown;
  if (reviewer === 'claude') output = parseClaudeOutput(stdout);
  else if (reviewer === 'codex') output = parseCodexOutput(stdout);
  else output = parseOpenCodeOutput(stdout);
  if (!hasValidReviewerOutputBody(output, kind)) throw new Error('invalid reviewer output');
  // Identity fields cross a separate trust boundary in coordinator.ts, which
  // reports missing and contradictory provenance as distinct public failures.
  return output as UnverifiedReviewerOutput;
}

function reviewPrompt(reviewer: ReviewAgent, packet: ReviewPacket): string {
  return `${reviewerPromptInstructions(packet.kind, reviewer)}\n${JSON.stringify(packet)}`;
}

function executionPlanIdentityConflicts(contract: PlanContractPair): string[] {
  const authorIsCanonical = contract.author.sha256 === EXECUTION_PLAN_REVIEW_RUBRIC_SHA256;
  if (!authorIsCanonical && contract.author.sha256 === contract.reviewer.sha256) {
    return [
      'Matching author and reviewer copies differ from the packaged canonical contract-byte identity.',
    ];
  }
  const reviewerIsCanonical = contract.reviewer.sha256 === EXECUTION_PLAN_REVIEW_RUBRIC_SHA256;
  return [
    ...(authorIsCanonical
      ? []
      : [
          'The authoring contract copy differs from the packaged canonical contract-byte identity.',
        ]),
    ...(reviewerIsCanonical
      ? []
      : [
          'The stale generated reviewer contract copy differs from the packaged canonical contract-byte identity.',
        ]),
  ];
}

export function reconcilePlanContract(
  packet: ReviewPacket,
  output: UnverifiedReviewerOutput,
): UnverifiedReviewerOutput {
  const contract = packet.plan_contract;
  if (
    (packet.kind !== 'plan-implementation' && packet.kind !== 'plan-execution') ||
    contract === undefined
  )
    return output;

  const author = new Set(contract.author.obligations);
  const reviewer = new Set(contract.reviewer.obligations);
  const conflicts =
    packet.kind === 'plan-execution' ? executionPlanIdentityConflicts(contract) : [];
  conflicts.push(
    ...[...author]
      .filter(obligation => !reviewer.has(obligation))
      .map(
        obligation => `Author contract requires "${obligation}" but reviewer contract does not.`,
      ),
    ...[...reviewer]
      .filter(obligation => !author.has(obligation))
      .map(
        obligation => `Reviewer contract requires "${obligation}" but author contract does not.`,
      ),
  );
  const identitiesMatch = contract.author.sha256 === contract.reviewer.sha256;
  if (identitiesMatch && conflicts.length === 0) return output;
  if (conflicts.length === 0) {
    conflicts.push(
      `Author contract ${contract.author.sha256} conflicts with reviewer contract ${contract.reviewer.sha256}.`,
    );
  }

  return {
    ...output,
    verdict: 'request_changes',
    ...(packet.kind === 'plan-execution' && {
      planning_destination: 'plan-execution' as const,
      execution_plan_record: NULL_EXECUTION_PLAN_RECORD,
    }),
    summary: 'Safeword blocked approval until the author and reviewer contracts are reconciled.',
    findings: [
      ...output.findings,
      ...conflicts.map(message => ({
        severity: 'error' as const,
        message: `Safeword contract reconciliation: ${message}`,
      })),
    ],
  };
}

function inside(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return (
    relative === '' ||
    (!nodePath.isAbsolute(relative) &&
      !relative.startsWith(`..${nodePath.sep}`) &&
      relative !== '..')
  );
}

function outsideUntrustedRoot(root: string, candidate: string): boolean {
  if (inside(root, candidate)) return false;
  try {
    return !inside(root, realpathSync(candidate));
  } catch {
    return false;
  }
}

function pathMetadataIsTrusted(
  mode: number,
  ownerUid: number,
  currentUid: number | undefined,
): boolean {
  const ownedByCurrentUser = currentUid !== undefined && ownerUid === currentUid;
  return (
    (mode & 0o002) === 0 &&
    (mode & 0o020) === 0 &&
    (currentUid === undefined || ownerUid === 0 || ownedByCurrentUser)
  );
}

/** The current user id, or `undefined` where the platform does not report one. */
function currentUserId(): number | undefined {
  return typeof process.getuid === 'function' ? process.getuid() : undefined;
}

function hasTrustedExecutableAncestry(candidate: string): boolean {
  // Windows ACLs do not map reliably to POSIX ownership and mode checks. Keep
  // the portable project-root exclusion, and leave ACL validation to the host.
  if (process.platform === 'win32') return true;
  const currentUid = currentUserId();
  let current = candidate;
  while (true) {
    const metadata = lstatSync(current);
    if (!pathMetadataIsTrusted(metadata.mode, metadata.uid, currentUid)) return false;
    const parent = nodePath.dirname(current);
    if (parent === current) return true;
    current = parent;
  }
}

/** Reads and hashes a file from an already-open descriptor. `undefined` if it isn't a regular file. */
function digestOpenFile(
  fd: number,
): { readonly bytes: Buffer; readonly digest: string } | undefined {
  if (!fstatSync(fd).isFile()) return undefined;
  const bytes = readFileSync(fd);
  return { bytes, digest: createHash('sha256').update(bytes).digest('hex') };
}

/**
 * Whether an existing cache entry's own bytes still hash to the digest its
 * filename claims — a corrupted or in-place-tampered entry must never be
 * spawned on the strength of its name alone.
 */
function cachedCopyMatchesDigest(copyPath: string, expectedDigest: string): boolean {
  let cachedFd: number | undefined;
  try {
    cachedFd = openSync(copyPath, constants.O_RDONLY);
    return digestOpenFile(cachedFd)?.digest === expectedDigest;
  } catch {
    return false;
  } finally {
    if (cachedFd !== undefined) closeSync(cachedFd);
  }
}

/**
 * Creates (if needed) and locks down the private cache directory, refusing a
 * pre-existing symlink there — chmod/mkdir would otherwise follow it and
 * mutate whatever it points at instead of Safeword's own directory. Also
 * refuses a directory the reviewed project controls: `SAFEWORD_REVIEWER_CACHE_DIR`
 * is an override (tests use it for isolation) and must not let the project
 * redirect the trusted cache onto a pathname it controls, the same exclusion
 * PATH candidates already get.
 */
function preparedTrustedCacheDirectory(untrustedRoot: string): string | undefined {
  const cacheDirectory =
    process.env.SAFEWORD_REVIEWER_CACHE_DIR ??
    nodePath.join(homedir(), '.cache', 'safeword-reviewers');
  // Lexical check first, before creating anything at an attacker-named path.
  if (inside(untrustedRoot, cacheDirectory)) return undefined;
  try {
    if (lstatSync(cacheDirectory).isSymbolicLink()) return undefined;
  } catch {
    // Does not exist yet — mkdirSync below creates it fresh.
  }
  mkdirSync(cacheDirectory, { recursive: true, mode: 0o700 });
  if (lstatSync(cacheDirectory).isSymbolicLink()) return undefined;
  // Re-check against the *resolved* path: the lexical test above cannot see a
  // symlinked ancestor pointing back into the project, and every later step
  // (and the caller's ancestry walk) must operate on the canonical location.
  const resolved = realpathSync(cacheDirectory);
  if (!outsideUntrustedRoot(untrustedRoot, resolved)) return undefined;
  chmodSync(resolved, 0o700);
  return resolved;
}

/**
 * A binary found via PATH can fail `hasTrustedExecutableAncestry` purely
 * because a package manager's own directory (e.g. Homebrew's /opt/homebrew/bin)
 * is group-writable by convention, not because anything is actually wrong.
 * Stage a private copy under a directory Safeword owns exclusively so review
 * can proceed without asking the customer to change how they installed their
 * reviewer — but only when the executable file itself is trusted on its own;
 * a writable file could have been tampered with directly and must never be
 * laundered into trust by copying it.
 *
 * Opens the source exactly once and checks/reads/copies from that single
 * descriptor throughout, rather than re-resolving `canonical` by pathname at
 * each step — a writer on the untrusted ancestor could otherwise swap the
 * file between the trust check and the copy. The destination filename is
 * content-addressed by the source's SHA-256 (`<reviewer>.<digest>`), so two
 * different installations on PATH never collide on one mutable path.
 * Published via a uniquely-named temp file plus atomic rename, never by
 * writing through the destination pathname directly — writing straight into a
 * fixed path follows a pre-planted destination symlink and would overwrite
 * whatever it points at.
 *
 * Staging relocates the executable, so a shim resolving siblings relative to
 * its own install directory stops working once copied; the caller's capability
 * probe rejects such a copy like any other incompatible candidate, so that
 * case fails closed rather than reviewing with a broken reviewer.
 */
function stagedTrustedReviewerCopy(
  reviewer: ReviewAgent,
  canonical: string,
  untrustedRoot: string,
): string | undefined {
  let sourceFd: number | undefined;
  try {
    sourceFd = openSync(canonical, constants.O_RDONLY);
    const sourceMetadata = fstatSync(sourceFd);
    const currentUid = currentUserId();
    if (!pathMetadataIsTrusted(sourceMetadata.mode, sourceMetadata.uid, currentUid)) {
      return undefined;
    }
    const source = digestOpenFile(sourceFd);
    if (source === undefined) return undefined;

    const cacheDirectory = preparedTrustedCacheDirectory(untrustedRoot);
    if (cacheDirectory === undefined) return undefined;
    const copyPath = nodePath.join(cacheDirectory, `${reviewer}.${source.digest}`);
    if (cachedCopyMatchesDigest(copyPath, source.digest)) return copyPath;

    const temporaryPath = `${copyPath}.${process.pid.toString(36)}.${Date.now().toString(36)}.tmp`;
    writeFileSync(temporaryPath, source.bytes, { mode: 0o700, flag: 'wx' });
    renameSync(temporaryPath, copyPath);
    return copyPath;
  } catch {
    return undefined;
  } finally {
    if (sourceFd !== undefined) closeSync(sourceFd);
  }
}

function remainingReviewTime(
  deadline: number,
  reviewer: ReviewAgent,
  lastFailure?: ReviewRuntimeError,
): number {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw lastFailure ?? new ReviewRuntimeError('timed_out', `${reviewer} review timed out`);
  }
  return remainingMs;
}

function executableCandidates(
  reviewer: ReviewAgent,
  untrustedRoot: string,
  allowStaging = true,
): { readonly paths: string[]; readonly rejectedForTrust: boolean } {
  const canonicalUntrustedRoot = realpathSync(untrustedRoot);
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
          .split(';')
          .map(extension => extension.toLowerCase())
      : [''];
  const candidates = (process.env.PATH ?? '')
    .split(nodePath.delimiter)
    .filter(directory => directory !== '' && nodePath.isAbsolute(directory))
    .flatMap(directory =>
      extensions.map(extension => nodePath.join(directory, `${reviewer}${extension}`)),
    );
  let rejectedForTrust = false;
  // Candidates whose ancestry is untrusted, kept aside for the staging fallback
  // below. Staging is a LAST RESORT: a directly-trusted installation anywhere on
  // PATH always wins, so a binary planted in a writable PATH directory is never
  // copied-then-run while a legitimate reviewer exists.
  const stageable: string[] = [];
  const canonicalCandidates = candidates.flatMap(candidate => {
    // A project-owned pathname remains untrusted even when it currently points
    // outside the project: the project can replace that symlink after checking.
    if (inside(untrustedRoot, candidate)) return [];
    try {
      const canonical = realpathSync(candidate);
      if (!outsideUntrustedRoot(canonicalUntrustedRoot, canonical)) return [];
      accessSync(canonical, constants.X_OK);
      if (!hasTrustedExecutableAncestry(canonical)) {
        rejectedForTrust = true;
        stageable.push(canonical);
        return [];
      }
      return [canonical];
    } catch {
      return [];
    }
  });
  // Spawn the retained canonical path, not the PATH spelling that was checked.
  // This closes the project-controlled parent/file symlink swap window.
  const trusted = [...new Set(canonicalCandidates)];
  if (trusted.length > 0) return { paths: trusted, rejectedForTrust };
  if (!allowStaging) return { paths: [], rejectedForTrust };
  // Nothing directly trusted: rescue an installation whose only problem is a
  // package manager's group-writable directory (Homebrew's default). Each
  // stagedTrustedReviewerCopy re-checks the file itself from an open descriptor
  // and refuses to stage a writable — potentially tampered — executable.
  const staged = stageable.flatMap(canonical => {
    const copy = stagedTrustedReviewerCopy(reviewer, canonical, canonicalUntrustedRoot);
    return copy !== undefined && hasTrustedExecutableAncestry(copy) ? [copy] : [];
  });
  return { paths: [...new Set(staged)], rejectedForTrust };
}

function unavailableReviewerError(
  reviewer: ReviewAgent,
  rejectedForTrust: boolean,
): ReviewRuntimeError {
  if (rejectedForTrust) {
    return new ReviewRuntimeError(
      'untrusted_install',
      `${reviewer} reviewer installation has an untrusted writable ancestor`,
    );
  }
  return new ReviewRuntimeError('not_installed', `No compatible ${reviewer} reviewer is installed`);
}

type CapabilityAssessment =
  | { readonly kind: 'supported' }
  | {
      readonly kind: 'failed';
      readonly failure: Extract<ReviewFailure, 'unsupported' | 'probe_timed_out' | 'launch_failed'>;
    };

export interface ReviewRouteObservation {
  readonly installed: boolean | 'inspection_unavailable';
  readonly compatibility: 'compatible' | 'not_compatible' | 'inspection_unavailable';
  readonly catalogue: 'catalogued' | 'not_catalogued' | 'not_applicable' | 'unavailable';
}

async function captureCommand(
  reviewer: ReviewAgent,
  executable: string,
  arguments_: readonly string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ readonly kind: 'completed'; readonly stdout: string } | { readonly kind: 'failed' }> {
  const child = spawn(executable, arguments_, {
    cwd,
    env: reviewerProbeEnvironment(),
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: process.platform !== 'win32',
  });
  const result = await new Promise<
    { readonly kind: 'completed'; readonly stdout: string } | { readonly kind: 'failed' }
  >(resolve => {
    let stdout = '';
    let settled = false;
    const finish = (
      value: { readonly kind: 'completed'; readonly stdout: string } | { readonly kind: 'failed' },
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      finish({ kind: 'failed' });
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      if (Buffer.byteLength(stdout) + chunk.byteLength > MAX_OUTPUT_BYTES) {
        finish({ kind: 'failed' });
        return;
      }
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => {
      finish({ kind: 'failed' });
    });
    child.on('close', code => {
      finish(code === 0 ? { kind: 'completed', stdout } : { kind: 'failed' });
    });
  });
  await stopReviewerOrThrow(child, reviewer);
  child.stdout.destroy();
  child.unref();
  return result;
}

async function inspectOpenCodeCatalogue(
  executable: string,
  model: string,
  cwd: string,
  deadline: number,
): Promise<ReviewRouteObservation> {
  const catalogue = await captureCommand(
    'opencode',
    executable,
    ['models', '--pure'],
    cwd,
    Math.max(1, deadline - Date.now()),
  );
  if (catalogue.kind === 'failed') {
    return { installed: true, compatibility: 'compatible', catalogue: 'unavailable' };
  }
  const listedModels = catalogue.stdout
    .split(/\r?\n/u)
    .map(value => value.trim())
    .filter(value => value.length > 0);
  if (listedModels.length === 0) {
    return { installed: true, compatibility: 'compatible', catalogue: 'unavailable' };
  }
  return {
    installed: true,
    compatibility: 'compatible',
    catalogue: listedModels.includes(model) ? 'catalogued' : 'not_catalogued',
  };
}

function compatibleRouteObservation(
  reviewer: ReviewAgent,
  model: string | undefined,
  skipCatalogue: boolean,
):
  | { readonly kind: 'completed'; readonly observation: ReviewRouteObservation }
  | { readonly kind: 'catalogue'; readonly model: string } {
  if (model === undefined) {
    return {
      kind: 'completed',
      observation: {
        installed: true,
        compatibility: 'compatible',
        catalogue: 'not_applicable',
      },
    };
  }
  if (reviewer !== 'opencode' || skipCatalogue) {
    return {
      kind: 'completed',
      observation: { installed: true, compatibility: 'compatible', catalogue: 'unavailable' },
    };
  }
  return { kind: 'catalogue', model };
}

function unavailableCandidateObservation(rejectedForTrust: boolean): ReviewRouteObservation {
  return rejectedForTrust
    ? { installed: true, compatibility: 'inspection_unavailable', catalogue: 'unavailable' }
    : { installed: false, compatibility: 'not_compatible', catalogue: 'unavailable' };
}

/** Read-only local evidence. It never stages executables, authenticates, or performs inference. */
export async function inspectReviewRoute(
  reviewer: ReviewAgent,
  model: string | undefined,
  cwd: string,
  timeoutMs = 5000,
  skipCatalogue = false,
): Promise<ReviewRouteObservation> {
  const candidates = executableCandidates(reviewer, cwd, false);
  if (candidates.paths.length === 0) {
    return unavailableCandidateObservation(candidates.rejectedForTrust);
  }
  const deadline = Date.now() + timeoutMs;
  let inspectionUnavailable = false;
  for (const candidate of candidates.paths) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      inspectionUnavailable = true;
      break;
    }
    const capability = await supportsReviewContract(
      reviewer,
      candidate,
      tmpdir(),
      remaining,
      model,
    );
    if (capability.kind === 'failed') {
      inspectionUnavailable ||= capability.failure !== 'unsupported';
      continue;
    }
    const compatible = compatibleRouteObservation(reviewer, model, skipCatalogue);
    if (compatible.kind === 'completed') return compatible.observation;
    return inspectOpenCodeCatalogue(candidate, compatible.model, tmpdir(), deadline);
  }
  return {
    installed: true,
    compatibility: inspectionUnavailable ? 'inspection_unavailable' : 'not_compatible',
    catalogue: 'unavailable',
  };
}

async function supportsReviewContract(
  reviewer: ReviewAgent,
  executable: string,
  cwd: string,
  timeoutMs: number,
  model: string | undefined,
): Promise<CapabilityAssessment> {
  const child = spawn(executable, HELP_ARGUMENTS[reviewer], {
    cwd,
    env: reviewerProbeEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  const assessment = await new Promise<CapabilityAssessment>(resolve => {
    let help = '';
    let helpBytes = 0;
    let settled = false;
    const finish = (result: CapabilityAssessment): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      finish({ kind: 'failed', failure: 'probe_timed_out' });
    }, timeoutMs);
    const capture = (chunk: Buffer): void => {
      const appended = appendBounded(help, helpBytes, chunk.toString('utf8'));
      help = appended.value;
      helpBytes = appended.bytes;
      if (appended.overflow) finish({ kind: 'failed', failure: 'unsupported' });
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', () => {
      finish({ kind: 'failed', failure: 'launch_failed' });
    });
    child.on('close', code => {
      if (code !== 0) {
        finish({ kind: 'failed', failure: 'launch_failed' });
        return;
      }
      const advertisedFlags = new Set<string>();
      for (const match of help.matchAll(/--[\w-]+/gu)) advertisedFlags.add(match[0]);
      const requiredCapabilities =
        model === undefined
          ? REQUIRED_CAPABILITIES[reviewer]
          : [...REQUIRED_CAPABILITIES[reviewer], '--model'];
      finish(
        requiredCapabilities.every(flag => advertisedFlags.has(flag))
          ? { kind: 'supported' }
          : { kind: 'failed', failure: 'unsupported' },
      );
    });
  });
  await stopReviewerOrThrow(child, reviewer);
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  return assessment;
}

function appendBounded(
  current: string,
  currentBytes: number,
  chunk: string,
): { value: string; bytes: number; overflow: boolean } {
  const bytes = currentBytes + Buffer.byteLength(chunk);
  return {
    value: bytes > MAX_OUTPUT_BYTES ? current : current + chunk,
    bytes,
    overflow: bytes > MAX_OUTPUT_BYTES,
  };
}

/**
 * The time allowed for a reviewer process group to stop politely before it is
 * forced. This remains small because cleanup is part of the candidate's bounded
 * turn, not background work that may overlap the next route.
 */
const CLEANUP_BUDGET_MS = 250;
const PROCESS_GROUP_POLL_INTERVAL_MS = 50;
const WINDOWS_CLEANUP_BUDGET_MS = 1000;

/**
 * A reviewer that could not authenticate may say so on either output stream;
 * anything else keeps the caller's classification. Claude's structured JSON
 * error envelope is written to stdout, while Codex and OpenCode commonly use
 * stderr, so inspecting only one stream turns a recoverable login problem into
 * an opaque process failure.
 */
function classifyExit(stdout: string, stderr: string, otherwise: ReviewFailure): ReviewFailure {
  return /not logged in|sign in|authenticat(?:e|ion)|unauthorized|login required|(?:missing|invalid|provide|set|configure)[^\n]{0,40}api key/iu.test(
    `${stdout}\n${stderr}`,
  )
    ? 'not_authenticated'
    : otherwise;
}

/**
 * Stops a reviewer and everything it started. A reviewer's own children inherit
 * its pipes, so killing only the direct process leaves them running and the
 * output streams open — the run then waits on a corpse. On POSIX the child
 * leads its own process group and the whole group is signalled; on Windows the
 * child tree is terminated instead, since process groups do not exist there.
 */
const reviewerStops = new WeakMap<ReturnType<typeof spawn>, Promise<boolean>>();

function stopWindowsReviewer(child: ReturnType<typeof spawn>, pid: number): Promise<boolean> {
  const streamClosed = (stream: typeof child.stdout): boolean => stream === null || stream.closed;
  const childClosed = (): boolean =>
    child.exitCode !== null && streamClosed(child.stdout) && streamClosed(child.stderr);
  if (childClosed()) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    let taskkillSucceeded = false;
    const finish = (stopped: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill('SIGKILL');
      resolve(stopped);
    };
    const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
    const taskkill = nodePath.join(systemRoot, 'System32', 'taskkill.exe');
    const killer = spawn(taskkill, ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      killer.kill('SIGKILL');
      finish(childClosed());
    }, WINDOWS_CLEANUP_BUDGET_MS);
    child.on('close', () => {
      if (taskkillSucceeded) finish(true);
    });
    killer.on('error', () => {
      finish(childClosed());
    });
    killer.on('close', code => {
      if (code !== 0) {
        finish(childClosed());
        return;
      }
      taskkillSucceeded = true;
      child.kill('SIGKILL');
      if (childClosed()) finish(true);
    });
  });
}

function stopReviewer(child: ReturnType<typeof spawn>): Promise<boolean> {
  const existing = reviewerStops.get(child);
  if (existing !== undefined) return existing;
  const stopping = stopReviewerOnce(child);
  reviewerStops.set(child, stopping);
  return stopping;
}

async function stopReviewerOrThrow(
  child: ReturnType<typeof spawn>,
  reviewer: ReviewAgent,
  terminal = true,
): Promise<void> {
  if (await stopReviewer(child)) return;
  throw new ReviewRuntimeError(
    'process_failed',
    `${reviewer} reviewer processes could not be stopped`,
    terminal,
  );
}

/**
 * Reads the state and process-group id out of one `/proc/<pid>/stat` line.
 *
 * The comm field is parenthesised and may itself contain spaces and
 * parentheses, so the fixed fields are taken after its LAST closing paren:
 * state, ppid, pgrp. Returns undefined for anything that does not parse, so a
 * process that exits mid-scan is skipped rather than miscounted.
 */
export function parseProcessStat(line: string): { state: string; group: number } | undefined {
  const commEnd = line.lastIndexOf(')');
  if (commEnd === -1) return undefined;
  const [state, , group] = line
    .slice(commEnd + 1)
    .trim()
    .split(/\s+/u, 3);
  const groupId = Number(group);
  if (state === undefined || !Number.isSafeInteger(groupId)) return undefined;
  return { state, group: groupId };
}

/**
 * Whether any process in `group` can still run, per `/proc`. Undefined when
 * `/proc` cannot be read, so the caller keeps its conservative answer. That
 * means non-Linux systems cannot distinguish a zombie-only group and retain
 * the historical cleanup-failure result until a portable process-state API is
 * available.
 */
export function procGroupHasRunningMember(group: number): boolean | undefined {
  // The stat layout parsed here is Linux's. Other systems mount a /proc that is
  // readable but shaped differently — Solaris and some BSDs among them — where
  // every entry would fail to parse, the scan would report no live members, and
  // cleanup would call a running group stopped. Reading it anywhere else is a
  // silent false negative, so only Linux answers and everyone else falls back.
  if (process.platform !== 'linux') return undefined;
  let entries: string[];
  try {
    entries = readdirSync('/proc');
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (!/^\d+$/u.test(entry)) continue;
    let line: string;
    try {
      line = readFileSync(`/proc/${entry}/stat`, 'utf8');
    } catch {
      // Exited between the listing and the read; it cannot be running.
      continue;
    }
    const parsed = parseProcessStat(line);
    if (parsed?.group === group && parsed.state !== 'Z') return true;
  }
  return false;
}

async function waitForProcessGroupToStop(
  groupIsRunning: () => boolean,
  deadline: number,
): Promise<void> {
  while (groupIsRunning() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, PROCESS_GROUP_POLL_INTERVAL_MS));
  }
}

async function stopReviewerOnce(child: ReturnType<typeof spawn>): Promise<boolean> {
  const pid = child.pid;
  if (pid === undefined) return true;
  if (process.platform === 'win32') {
    return stopWindowsReviewer(child, pid);
  }
  const signalGroup = (signal: NodeJS.Signals): void => {
    try {
      process.kill(-pid, signal);
    } catch {
      // Already gone, or never became a group leader.
    }
  };
  // The leader may already be reaped, so its numeric pid can theoretically be
  // reused as another group's id. We still signal the group because surviving
  // descendants are the cleanup target; the immediate existence probe and
  // bounded cleanup window keep that unavoidable POSIX race narrow.
  signalGroup('SIGTERM');
  const groupExists = (): boolean => {
    try {
      process.kill(-pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  /**
   * A zombie is already dead — it holds a slot until its parent reaps it, and
   * nothing more. `kill(-pgid, 0)` cannot tell one apart from a live process,
   * so a group holding only zombies still answers "yes" and cleanup reports
   * failure for a tree it already stopped.
   *
   * That misreport is invisible wherever PID 1 reaps promptly, which is why CI
   * never sees it. It bites in a container whose PID 1 is the application or a
   * lazy init: the reviewer's orphaned grandchildren are reparented to PID 1
   * and linger as zombies for seconds, so a review that timed out is reported
   * as `process_failed` and cleanup claims the processes could not be stopped.
   *
   * `/proc` distinguishes the two. Where it is unavailable the kill probe
   * stands, keeping the previous behaviour on platforms without it.
   */
  const groupIsRunning = (): boolean => {
    // The kill probe is one syscall and the scan walks every process, so ask
    // the cheap question first. It is also decisive on its own when the answer
    // is no: an empty group holds nothing, zombie or otherwise. That keeps the
    // common case — a reviewer that exits promptly — from scanning /proc at all.
    if (!groupExists()) return false;
    return procGroupHasRunningMember(pid) ?? true;
  };
  /**
   * Listing `/proc` is not atomic: a member that forks after its slot is read,
   * or one still alive when its own entry was already inspected, is missed. So
   * a negative is confirmed by a second scan before the group is called
   * stopped, and one unlucky snapshot cannot report success over a live tree.
   */
  const groupIsStopped = async (): Promise<boolean> => {
    if (groupIsRunning()) return false;
    await new Promise(resolve => setTimeout(resolve, PROCESS_GROUP_POLL_INTERVAL_MS));
    return !groupIsRunning();
  };
  await waitForProcessGroupToStop(groupIsRunning, Date.now() + CLEANUP_BUDGET_MS);
  // Escalate on ANY remaining member, zombie or not. SIGKILL against a
  // zombie-only group is a no-op, while gating the kill on the scan is how a
  // live member would survive a false negative — a reviewer that traps SIGTERM
  // and keeps forking could force exactly that. The kill probe this replaced
  // always escalated here, and this keeps that unchanged; only the verdict
  // below distinguishes a zombie from a live process.
  if (groupExists()) {
    signalGroup('SIGKILL');
    await waitForProcessGroupToStop(groupIsRunning, Date.now() + CLEANUP_BUDGET_MS);
  }
  return groupIsStopped();
}

async function runCandidate(
  executable: string,
  attempt: ReviewAttempt,
  timeoutMs: number,
): Promise<UnverifiedReviewerOutput> {
  const { reviewer, packet, cwd, model, schemaPath } = attempt;
  const child = spawn(
    executable,
    reviewerArguments(reviewer, model, schemaPath, process.env, packet.kind),
    {
      cwd,
      env: reviewerEnvironment(reviewer),
      stdio: ['pipe', 'pipe', 'pipe'],
      // Its own process group, so cleanup can reach descendants.
      detached: process.platform !== 'win32',
    },
  );
  const terminateReviewer = (): void => {
    void stopReviewer(child).finally(() => process.exit(143));
  };
  process.once('SIGTERM', terminateReviewer);
  try {
    let output: UnverifiedReviewerOutput;
    try {
      output = await new Promise<UnverifiedReviewerOutput>((resolve, reject) => {
        let overflow = false;
        // One outcome per attempt, settled once. A late answer arriving after a
        // deadline never changes a verdict that is already decided.
        let settled = false;
        const settle = (finish: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          finish();
        };
        const timeout = setTimeout(() => {
          settle(() => {
            reject(new ReviewRuntimeError('timed_out', `${reviewer} review timed out`));
          });
        }, timeoutMs);
        let stdout = '';
        let stderr = '';
        let stdoutBytes = 0;
        let stderrBytes = 0;
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          const appended = appendBounded(stdout, stdoutBytes, chunk);
          stdout = appended.value;
          stdoutBytes = appended.bytes;
          overflow ||= appended.overflow;
          if (overflow) {
            void stopReviewer(child);
          }
        });
        child.stderr.on('data', (chunk: string) => {
          const appended = appendBounded(stderr, stderrBytes, chunk);
          stderr = appended.value;
          stderrBytes = appended.bytes;
          overflow ||= appended.overflow;
          if (overflow) {
            void stopReviewer(child);
          }
        });
        // Exit status and stderr own failure classification. EPIPE here commonly
        // means the reviewer exited early before consuming a large packet.
        child.stdin.on('error', () => {
          // The close handler classifies the reviewer exit.
        });
        child.on('error', error => {
          settle(() => {
            reject(new ReviewRuntimeError('process_failed', error.message));
          });
        });
        child.on('close', code => {
          settle(() => {
            if (overflow) {
              reject(
                new ReviewRuntimeError(
                  classifyExit(stdout, stderr, 'invalid_output'),
                  `${reviewer} exceeded its output limit`,
                ),
              );
              return;
            }
            if (code !== 0) {
              reject(
                new ReviewRuntimeError(
                  classifyExit(stdout, stderr, 'process_failed'),
                  `${reviewer} review failed (${code ?? 'signal'}): ${stderr.trim()}`,
                ),
              );
              return;
            }
            try {
              const parsed = parseReviewerOutput(reviewer, stdout, packet.kind);
              if (packet.kind !== 'plan-execution') {
                resolve(parsed);
                return;
              }
              const validation = validateExecutionPlanOutput(
                parsed,
                packet.execution_plan_delivery_definition,
                packet.execution_plan_normalized_digest,
              );
              if (validation.kind === 'invalid_output') {
                throw new ReviewRuntimeError(
                  'invalid_output',
                  `${reviewer} returned invalid review output: ${validation.reason}`,
                );
              }
              resolve(validation.output);
            } catch (error) {
              if (error instanceof ReviewRuntimeError) {
                reject(error);
                return;
              }
              reject(
                new ReviewRuntimeError(
                  'invalid_output',
                  `${reviewer} returned invalid review output`,
                ),
              );
            }
          });
        });
        child.stdin.end(reviewPrompt(reviewer, packet));
      });
    } catch (error) {
      // Do not let a timed-out or failed reviewer overlap integrity checks,
      // packet cleanup, or a later candidate.
      await stopReviewerOrThrow(child, reviewer);
      throw error;
    }
    // Preserve the review, but surface failed cleanup as a retryable candidate
    // failure so another installation or route can still provide coverage.
    await stopReviewerOrThrow(child, reviewer, false);
    return reconcilePlanContract(packet, output);
  } finally {
    process.off('SIGTERM', terminateReviewer);
  }
}

async function runReviewerCandidates(
  attempt: ReviewAttempt,
  candidates: readonly string[],
  deadline: number,
): Promise<UnverifiedReviewerOutput> {
  const reviewer = attempt.reviewer;
  let foundCompatible = false;
  let lastFailure: ReviewRuntimeError | undefined;
  let lastProbeFailure: ReviewRuntimeError | undefined;
  for (const [index, candidate] of candidates.entries()) {
    const remainingMs = remainingReviewTime(deadline, reviewer, lastFailure);
    const untried = candidates.length - index;
    const candidateDeadline = Date.now() + remainingMs / untried;
    const probeBudget = Math.min(5000, remainingReviewTime(candidateDeadline, reviewer));
    const assessment = await supportsReviewContract(
      reviewer,
      candidate,
      attempt.cwd,
      probeBudget,
      attempt.model,
    );
    if (assessment.kind === 'failed') {
      lastProbeFailure = new ReviewRuntimeError(
        assessment.failure,
        `${reviewer} capability probe failed: ${assessment.failure}`,
      );
      continue;
    }
    foundCompatible = true;
    try {
      // The capability probe and review share one candidate deadline. A hanging
      // candidate therefore cannot spend the time reserved for later trusted
      // installations, while a fast rejection returns its unused share.
      return await runCandidate(
        candidate,
        attempt,
        remainingReviewTime(candidateDeadline, reviewer, lastFailure),
      );
    } catch (error) {
      if (!(error instanceof ReviewRuntimeError)) throw error;
      if (error.terminal) throw error;
      lastFailure = error;
    }
  }
  if (!foundCompatible) {
    if (lastProbeFailure !== undefined) throw lastProbeFailure;
    throw new ReviewRuntimeError(
      'not_installed',
      `No trusted compatible ${reviewer} reviewer was found`,
    );
  }
  throw lastFailure ?? new ReviewRuntimeError('process_failed', `${reviewer} review failed`);
}

export async function runHeadlessReviewer(
  reviewer: ReviewAgent,
  packet: ReviewPacket,
  cwd: string,
  untrustedRoot: string = process.cwd(),
  options: { readonly model?: string; readonly runDeadline?: number } = {},
): Promise<UnverifiedReviewerOutput> {
  const { model, runDeadline } = options;
  // A route never outlives the run: whichever bound arrives first wins.
  const deadline = Math.min(Date.now() + reviewTimeoutMilliseconds(), runDeadline ?? Infinity);
  const candidates = executableCandidates(reviewer, untrustedRoot);
  if (candidates.paths.length === 0) {
    throw unavailableReviewerError(reviewer, candidates.rejectedForTrust);
  }
  // The contract file belongs to the dispatch, not to an attempt: several
  // candidates and routes read it, so attempt cleanup must never remove it.
  // A reviewer we cannot hand the contract to is never asked to review, and the
  // underlying filesystem error stays out of the message — it would carry the
  // temporary path.
  let contract: ContractFile | undefined;
  try {
    contract = reviewer === 'codex' ? writeContractFile(packet.kind) : undefined;
  } catch {
    throw new ReviewRuntimeError('process_failed', `The ${reviewer} review could not be prepared`);
  }
  try {
    return await runReviewerCandidates(
      { reviewer, packet, cwd, model, schemaPath: contract?.path },
      candidates.paths,
      deadline,
    );
  } finally {
    contract?.cleanup();
  }
}

interface ContractFile {
  readonly path: string;
  readonly cleanup: () => void;
}

function writeContractFile(kind: ReviewKind): ContractFile {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-contract-'));
  const path = nodePath.join(directory, 'review-result.schema.json');
  writeFileSync(path, reviewOutputSchema(kind), { mode: 0o600 });
  return {
    path,
    cleanup: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
