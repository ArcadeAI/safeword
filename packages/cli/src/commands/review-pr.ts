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

interface InspectionInput {
  artifacts: { content: string; path: string }[];
  headSha: string;
  schemaVersion: 1;
}

interface InspectionConfig {
  enabled: true;
  maxTotalBytes: number;
  model: string;
  provider: 'openai';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted((left, right) => left.localeCompare(right));
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
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
    (config.maxTotalBytes as number) <= 0
  ) {
    throw new Error('review-pr: prReview configuration is incomplete or invalid');
  }
  return config as unknown as InspectionConfig;
}

function parseInput(inputPath: string, maxTotalBytes: number): InspectionInput {
  const raw: unknown = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (
    !isRecord(raw) ||
    !hasExactKeys(raw, ['artifacts', 'headSha', 'schemaVersion']) ||
    raw.schemaVersion !== 1 ||
    typeof raw.headSha !== 'string' ||
    !/^[a-f\d]{40,64}$/u.test(raw.headSha) ||
    !Array.isArray(raw.artifacts)
  ) {
    throw new Error('review-pr: invalid inspection input');
  }

  let totalBytes = 0;
  const artifacts = raw.artifacts.map(artifact => {
    if (
      !isRecord(artifact) ||
      !hasExactKeys(artifact, ['content', 'path']) ||
      typeof artifact.content !== 'string' ||
      typeof artifact.path !== 'string' ||
      artifact.path.length === 0
    ) {
      throw new Error('review-pr: invalid text artifact');
    }
    totalBytes += Buffer.byteLength(artifact.content, 'utf8');
    return { content: artifact.content, path: artifact.path };
  });
  if (totalBytes > maxTotalBytes) throw new Error('review-pr: inspection input exceeds its budget');
  return { artifacts, headSha: raw.headSha, schemaVersion: 1 };
}

function parseReviewedReceipt(value: unknown): PublishedReceipt {
  if (
    !isRecord(value) ||
    (value.route !== 'looks_ready' && value.route !== 'needs_human') ||
    typeof value.reviewedSha !== 'string' ||
    (value.runState !== undefined &&
      (typeof value.runState !== 'string' ||
        !['complete', 'failed', 'incomplete', 'stale'].includes(value.runState)))
  ) {
    throw new Error('review-pr: invalid inspection result');
  }
  return value as unknown as PublishedReceipt;
}

const productionProvider: InspectionProvider = options => {
  if (!options.apiKey) throw new Error('review-pr: OPENAI_API_KEY is required for inspection');
  return reviewWithOpenAI({ ...options, apiKey: options.apiKey });
};

export async function inspectPullRequestCommand(
  options: InspectPullRequestCommandOptions,
): Promise<PublishedReceipt> {
  const config = parseConfig(options.cwd);
  const input = parseInput(options.inputPath, config.maxTotalBytes);
  const findings = await (options.provider ?? productionProvider)({
    apiKey: process.env.OPENAI_API_KEY,
    evidence: input.artifacts,
    model: config.model,
  });
  let published: PublishedReceipt | undefined;

  await reviewPullRequest({
    inspect: () =>
      Promise.resolve({
        artifacts: input.artifacts.map(artifact => ({
          byteLength: Buffer.byteLength(artifact.content, 'utf8'),
          kind: 'text' as const,
          path: artifact.path,
        })),
        consequentialFindings: findings.filter(finding => finding.consequential).length,
        findings: findings.map(finding => ({
          consequence: finding.consequence,
          path: finding.path,
        })),
        maxTotalBytes: config.maxTotalBytes,
        runState: 'complete',
        unknowns: [],
      }),
    publish: receipt => {
      published = receipt;
      return Promise.resolve();
    },
    readPullRequest: () =>
      Promise.resolve({
        headSha: input.headSha,
        prerequisites: 'passed',
        prerequisitesConfigured: true,
        ready: true,
        requiredPrerequisites: [],
      }),
  });

  const result = parseReviewedReceipt(published);
  writeFileSync(options.outputPath, `${JSON.stringify(result)}\n`, { mode: 0o600 });
  return result;
}
