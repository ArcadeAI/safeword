import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { type ModelFinding, reviewWithOpenAI } from '../pr-review/providers/openai.js';
import { type PublishedReceipt, reviewPullRequest } from '../pr-review/review.js';

interface InspectionProviderOptions {
  apiKey?: string;
  evidence: { content: string; path: string }[];
  model: string;
}

type InspectionProvider = (options: InspectionProviderOptions) => Promise<ModelFinding[]>;

export interface InspectPullRequestCommandOptions {
  cwd: string;
  inputPath: string;
  outputPath: string;
  provider?: InspectionProvider;
}

interface InspectionAudit {
  checkout: false;
  customerCodeExecution: false;
  githubPermissions: { contents: 'read'; issues: 'read'; pullRequests: 'read' };
  githubWriteCredential: false;
}

export type InspectionHandoff =
  | {
      inspectionAudit: InspectionAudit;
      kind: 'noop';
      schemaVersion: 1;
    }
  | {
      inspectionAudit: InspectionAudit;
      kind: 'receipt';
      receipt: PublishedReceipt;
      schemaVersion: 1;
    };

const INSPECTION_AUDIT: InspectionAudit = {
  checkout: false,
  customerCodeExecution: false,
  githubPermissions: { contents: 'read', issues: 'read', pullRequests: 'read' },
  githubWriteCredential: false,
};

interface InspectionInput {
  artifacts: (
    | { content: string; kind: 'text'; path: string }
    | { kind: 'non_text'; path: string }
    | { kind: 'unreadable_text'; path: string }
  )[];
  checks: { conclusion: string | null; name: string; status: string }[];
  headSha: string;
  markerReceiptExists: boolean;
  pullState: 'closed' | 'draft' | 'merged' | 'ready';
  reviewedReceiptSha?: string;
  schemaVersion: 1;
  statuses: { context: string; state: string }[];
}

interface InspectionConfig {
  enabled: true;
  maxTotalBytes: number;
  model: string;
  provider: 'openai';
  requiredChecks?: { context: string }[];
}

type InspectionInputEnvelope = Record<string, unknown> & {
  artifacts: unknown[];
  checks: unknown[];
  headSha: string;
  markerReceiptExists: boolean;
  pullState: InspectionInput['pullState'];
  statuses: unknown[];
};

const PULL_STATES = new Set<InspectionInput['pullState']>(['closed', 'draft', 'merged', 'ready']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPullState(value: unknown): value is InspectionInput['pullState'] {
  return typeof value === 'string' && PULL_STATES.has(value as InspectionInput['pullState']);
}

function validRequiredChecks(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        check => isRecord(check) && typeof check.context === 'string' && check.context.length > 0,
      ))
  );
}

function hasValidInputEnvelope(raw: Record<string, unknown>): raw is InspectionInputEnvelope {
  const validHead = typeof raw.headSha === 'string' && /^[a-f\d]{40,64}$/u.test(raw.headSha);
  const validState = isPullState(raw.pullState);
  return (
    raw.schemaVersion === 1 &&
    validHead &&
    validState &&
    Array.isArray(raw.artifacts) &&
    Array.isArray(raw.checks) &&
    Array.isArray(raw.statuses) &&
    typeof raw.markerReceiptExists === 'boolean'
  );
}

function parseConfig(cwd: string): InspectionConfig {
  const raw: unknown = JSON.parse(
    readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8'),
  );
  if (!isRecord(raw) || !isRecord(raw.prReview)) {
    throw new Error('review-pr: .safeword/config.json must define prReview');
  }
  const config = raw.prReview;
  if (
    config.enabled !== true ||
    config.provider !== 'openai' ||
    typeof config.model !== 'string' ||
    config.model.length === 0 ||
    !Number.isSafeInteger(config.maxTotalBytes) ||
    (config.maxTotalBytes as number) <= 0 ||
    !validRequiredChecks(config.requiredChecks)
  ) {
    throw new Error('review-pr: prReview configuration is incomplete or invalid');
  }
  return config as unknown as InspectionConfig;
}

function parseInput(inputPath: string): InspectionInput {
  const raw: unknown = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!isRecord(raw) || !hasValidInputEnvelope(raw)) {
    throw new Error('review-pr: invalid inspection input');
  }

  const artifacts = raw.artifacts.map(artifact => {
    if (
      isRecord(artifact) &&
      (artifact.kind === 'non_text' || artifact.kind === 'unreadable_text') &&
      typeof artifact.path === 'string'
    ) {
      return { kind: artifact.kind, path: artifact.path } as const;
    }
    if (
      !isRecord(artifact) ||
      artifact.kind !== 'text' ||
      typeof artifact.content !== 'string' ||
      typeof artifact.path !== 'string' ||
      artifact.path.length === 0
    ) {
      throw new Error('review-pr: invalid text artifact');
    }
    return { content: artifact.content, kind: 'text' as const, path: artifact.path };
  });
  const checks = raw.checks.map(check => {
    if (
      !isRecord(check) ||
      typeof check.name !== 'string' ||
      typeof check.status !== 'string' ||
      (check.conclusion !== null && typeof check.conclusion !== 'string')
    ) {
      throw new Error('review-pr: invalid check-run sample');
    }
    return { conclusion: check.conclusion, name: check.name, status: check.status };
  });
  const statuses = raw.statuses.map(status => {
    if (
      !isRecord(status) ||
      typeof status.context !== 'string' ||
      typeof status.state !== 'string'
    ) {
      throw new Error('review-pr: invalid commit-status sample');
    }
    return { context: status.context, state: status.state };
  });
  return {
    artifacts,
    checks,
    headSha: raw.headSha,
    markerReceiptExists: raw.markerReceiptExists,
    pullState: raw.pullState,
    ...(typeof raw.reviewedReceiptSha === 'string' && {
      reviewedReceiptSha: raw.reviewedReceiptSha,
    }),
    schemaVersion: 1,
    statuses,
  };
}

function parseReviewedReceipt(value: unknown): PublishedReceipt {
  if (
    !isRecord(value) ||
    typeof value.reviewedSha !== 'string' ||
    (value.route === undefined && typeof value.status !== 'string') ||
    (value.route !== undefined && value.route !== 'looks_ready' && value.route !== 'needs_human')
  ) {
    throw new Error('review-pr: invalid inspection result');
  }
  return value as unknown as PublishedReceipt;
}

function credentialValues(environment: NodeJS.ProcessEnv): string[] {
  return Object.entries(environment)
    .flatMap(([name, value]) =>
      /(?:^|_)(?:KEY|SECRET|TOKEN|PAT|PASSWORD|CREDENTIAL)(?:_|$)/iu.test(name) &&
      typeof value === 'string' &&
      value.length >= 8
        ? [value]
        : [],
    )
    .toSorted((left, right) => right.length - left.length);
}

function redactCredentials(
  value: string,
  credentials: readonly string[],
): {
  redacted: boolean;
  value: string;
} {
  let redacted = false;
  let sanitized = value;
  for (const credential of credentials) {
    if (!sanitized.includes(credential)) continue;
    redacted = true;
    sanitized = sanitized.split(credential).join('[REDACTED]');
  }
  return { redacted, value: sanitized };
}

const productionProvider: InspectionProvider = options => {
  if (!options.apiKey) throw new Error('review-pr: OPENAI_API_KEY is required for inspection');
  return reviewWithOpenAI({ ...options, apiKey: options.apiKey });
};

const PASSING_CHECK_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);
const FAILING_CHECK_CONCLUSIONS = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'stale',
  'startup_failure',
]);

type PrerequisiteState = 'failed' | 'passed' | 'pending';

function evaluateCheckRun(
  check: InspectionInput['checks'][number] | undefined,
): PrerequisiteState | undefined {
  if (!check) return undefined;
  if (check.status !== 'completed' || check.conclusion === null) return 'pending';
  if (FAILING_CHECK_CONCLUSIONS.has(check.conclusion)) return 'failed';
  return PASSING_CHECK_CONCLUSIONS.has(check.conclusion) ? 'passed' : 'pending';
}

function evaluatePrerequisite(context: string, input: InspectionInput): PrerequisiteState {
  const check = input.checks.find(candidate => candidate.name === context);
  const checkState = evaluateCheckRun(check);
  if (checkState) return checkState;
  const status = input.statuses.find(candidate => candidate.context === context);
  if (status?.state === 'success') return 'passed';
  if (status?.state === 'failure' || status?.state === 'error') return 'failed';
  return 'pending';
}

function resolvePrerequisiteState(
  config: InspectionConfig,
  input: InspectionInput,
): { missing: string[]; state: 'failed' | 'passed' | 'pending' } {
  if (config.requiredChecks === undefined) return { missing: [], state: 'pending' };
  const evaluations = config.requiredChecks.map(required => ({
    context: required.context,
    state: evaluatePrerequisite(required.context, input),
  }));
  const missing = evaluations
    .filter(evaluation => evaluation.state === 'pending')
    .map(evaluation => evaluation.context);
  let state: 'failed' | 'passed' | 'pending' = 'passed';
  if (evaluations.some(evaluation => evaluation.state === 'failed')) state = 'failed';
  else if (missing.length > 0) state = 'pending';
  return { missing, state };
}

function boundedTextEvidence(
  artifacts: InspectionInput['artifacts'],
  maxTotalBytes: number,
): { content: string; path: string }[] {
  let usedBytes = 0;
  return artifacts.flatMap(artifact => {
    if (artifact.kind !== 'text') return [];
    const byteLength = Buffer.byteLength(artifact.content, 'utf8');
    if (usedBytes + byteLength > maxTotalBytes) return [];
    usedBytes += byteLength;
    return [{ content: artifact.content, path: artifact.path }];
  });
}

export async function inspectPullRequestCommand(
  options: InspectPullRequestCommandOptions,
): Promise<InspectionHandoff> {
  const config = parseConfig(options.cwd);
  const input = parseInput(options.inputPath);
  const credentials = credentialValues(process.env);
  let credentialRedacted = false;
  const receiptArtifacts = input.artifacts.map(artifact => {
    const sanitizedPath = redactCredentials(artifact.path, credentials);
    credentialRedacted ||= sanitizedPath.redacted;
    return { ...artifact, path: sanitizedPath.value };
  });
  const prerequisite = resolvePrerequisiteState(config, input);
  let published: PublishedReceipt | undefined;

  await reviewPullRequest({
    inspect: async () => {
      try {
        const textEvidence = boundedTextEvidence(input.artifacts, config.maxTotalBytes);
        const findings =
          textEvidence.length === 0
            ? []
            : await (options.provider ?? productionProvider)({
                apiKey: process.env.OPENAI_API_KEY,
                evidence: textEvidence,
                model: config.model,
              });
        const receiptFindings = findings.map(finding => {
          const path = redactCredentials(finding.path, credentials);
          const consequence = redactCredentials(finding.consequence, credentials);
          const evidence = redactCredentials(finding.evidence, credentials);
          const nextAction = redactCredentials(finding.nextAction, credentials);
          credentialRedacted ||=
            path.redacted || consequence.redacted || evidence.redacted || nextAction.redacted;
          return {
            ...finding,
            consequence: consequence.value,
            evidence: evidence.value,
            nextAction: nextAction.value,
            path: path.value,
          };
        });
        return {
          artifacts: receiptArtifacts.map(artifact =>
            artifact.kind === 'text'
              ? {
                  byteLength: Buffer.byteLength(artifact.content, 'utf8'),
                  kind: 'text' as const,
                  path: artifact.path,
                }
              : { kind: artifact.kind, path: artifact.path },
          ),
          consequentialFindings: receiptFindings.filter(finding => finding.consequential).length,
          findings: receiptFindings,
          maxTotalBytes: config.maxTotalBytes,
          runState: credentialRedacted ? ('incomplete' as const) : ('complete' as const),
          unknowns: credentialRedacted ? ['credential-like value redacted'] : [],
        };
      } catch {
        return {
          artifacts: receiptArtifacts.map(artifact =>
            artifact.kind === 'text'
              ? {
                  byteLength: Buffer.byteLength(artifact.content, 'utf8'),
                  kind: 'text' as const,
                  path: artifact.path,
                }
              : { kind: artifact.kind, path: artifact.path },
          ),
          consequentialFindings: 0,
          maxTotalBytes: config.maxTotalBytes,
          runState: 'failed' as const,
          unknowns: ['review provider failed'],
        };
      }
    },
    publish: receipt => {
      published = receipt;
      return Promise.resolve();
    },
    readPullRequest: () =>
      Promise.resolve({
        headSha: input.headSha,
        markerReceiptExists: input.markerReceiptExists,
        missingPrerequisites: prerequisite.missing,
        prerequisites: prerequisite.state,
        prerequisitesConfigured: config.requiredChecks !== undefined,
        ready: input.pullState === 'ready',
        reviewedReceiptSha: input.reviewedReceiptSha,
        state: input.pullState === 'ready' ? undefined : input.pullState,
      }),
  });

  if (published === undefined) {
    const handoff: InspectionHandoff = {
      inspectionAudit: INSPECTION_AUDIT,
      kind: 'noop',
      schemaVersion: 1,
    };
    writeFileSync(options.outputPath, `${JSON.stringify(handoff)}\n`, { mode: 0o600 });
    return handoff;
  }
  const receipt = parseReviewedReceipt(published);
  const handoff: InspectionHandoff = {
    inspectionAudit: INSPECTION_AUDIT,
    kind: 'receipt',
    receipt,
    schemaVersion: 1,
  };
  writeFileSync(options.outputPath, `${JSON.stringify(handoff)}\n`, { mode: 0o600 });
  return handoff;
}
