import { readFileSync } from 'node:fs';
import process from 'node:process';

import {
  type IssueComment,
  type IssueCommentPublisher,
  publishReceipt,
  RECEIPT_MARKER,
  renderReceipt,
} from '../pr-review/publish.js';
import type { AdvisoryFinding, PublishedReceipt, ReviewRunState } from '../pr-review/review.js';
import { publishValidatedSplitPrivilegeEvidence } from '../pr-review/split-privilege.js';

interface PullRequestFacts {
  headSha: string;
  state: 'closed' | 'draft' | 'merged' | 'ready';
}

export interface ReviewPrGitHubBoundary {
  publisher: IssueCommentPublisher;
  readPullRequest(): Promise<PullRequestFacts>;
}

export interface ReviewPrStageOutcome {
  changed: boolean;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const REVIEW_RUN_STATES = new Set<unknown>(['complete', 'failed', 'incomplete', 'stale']);

function isReviewRunState(value: unknown): value is ReviewRunState {
  return REVIEW_RUN_STATES.has(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted((left, right) => left.localeCompare(right));
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

interface ParsedHandoff {
  inspectionAudit: unknown;
  receipt?: PublishedReceipt;
}

function isSerializedFinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.consequential === 'boolean' &&
    typeof value.consequence === 'string' &&
    typeof value.evidence === 'string' &&
    (value.line === undefined || typeof value.line === 'number') &&
    typeof value.nextAction === 'string' &&
    typeof value.path === 'string'
  );
}

function hasValidReceiptArrays(receipt: Record<string, unknown>): boolean {
  return (
    Array.isArray(receipt.coverage) &&
    Array.isArray(receipt.findings) &&
    receipt.findings.every(finding => isSerializedFinding(finding)) &&
    Array.isArray(receipt.missingEvidence) &&
    Array.isArray(receipt.unknowns)
  );
}

function hasValidReceiptScalars(receipt: Record<string, unknown>): boolean {
  return (
    typeof receipt.reviewedSha === 'string' &&
    (receipt.route === 'looks_ready' || receipt.route === 'needs_human') &&
    isReviewRunState(receipt.runState) &&
    typeof receipt.reviewableTextArtifacts === 'number'
  );
}

function hasValidReceiptShape(receipt: Record<string, unknown>): boolean {
  return (
    hasExactKeys(receipt, [
      'coverage',
      'findings',
      'missingEvidence',
      'reviewableTextArtifacts',
      'reviewedSha',
      'route',
      'runState',
      'unknowns',
    ]) &&
    hasValidReceiptArrays(receipt) &&
    hasValidReceiptScalars(receipt)
  );
}

const NON_RUN_STATUSES = new Set<unknown>([
  'not_ready',
  'prerequisites_failed',
  'prerequisites_pending',
  'prerequisites_unconfigured',
]);

function hasValidNotReadyShape(receipt: Record<string, unknown>): boolean {
  return (
    hasExactKeys(receipt, ['markerOwned', 'reason', 'reviewedSha', 'status']) &&
    typeof receipt.reason === 'string' &&
    ['closed', 'draft', 'merged'].includes(receipt.reason)
  );
}

function hasValidPendingShape(receipt: Record<string, unknown>): boolean {
  return (
    hasExactKeys(receipt, [
      'markerOwned',
      'missingChecks',
      'nextAction',
      'reviewedSha',
      'status',
    ]) &&
    Array.isArray(receipt.missingChecks) &&
    receipt.missingChecks.every(check => typeof check === 'string') &&
    typeof receipt.nextAction === 'string'
  );
}

function hasValidNonRunShape(receipt: Record<string, unknown>): boolean {
  if (
    receipt.markerOwned !== true ||
    typeof receipt.reviewedSha !== 'string' ||
    !NON_RUN_STATUSES.has(receipt.status)
  ) {
    return false;
  }
  if (receipt.status === 'not_ready') return hasValidNotReadyShape(receipt);
  if (receipt.status === 'prerequisites_unconfigured') {
    return (
      hasExactKeys(receipt, ['markerOwned', 'nextAction', 'reviewedSha', 'status']) &&
      typeof receipt.nextAction === 'string'
    );
  }
  if (receipt.status === 'prerequisites_failed') {
    return hasExactKeys(receipt, ['markerOwned', 'reviewedSha', 'status']);
  }
  return hasValidPendingShape(receipt);
}

function hasConsistentRoute(receipt: Record<string, unknown>): boolean {
  const findings = receipt.findings as unknown[];
  const unknowns = receipt.unknowns as unknown[];
  const missingEvidence = receipt.missingEvidence as unknown[];
  const mayLookReady =
    receipt.runState === 'complete' &&
    unknowns.length === 0 &&
    missingEvidence.length === 0 &&
    Number(receipt.reviewableTextArtifacts) > 0 &&
    findings.every(finding => isRecord(finding) && finding.consequential === false);
  return (receipt.route === 'looks_ready') === mayLookReady;
}

function parseHandoffEnvelope(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    (value.kind !== 'noop' && value.kind !== 'receipt')
  ) {
    throw new Error('review-pr: invalid advisory result artifact');
  }
  return value;
}

function parseReviewedReceipt(path: string): ParsedHandoff {
  const value = parseHandoffEnvelope(path);
  if (value.kind === 'noop') {
    if (!hasExactKeys(value, ['inspectionAudit', 'kind', 'schemaVersion'])) {
      throw new Error('review-pr: invalid no-op artifact');
    }
    return { inspectionAudit: value.inspectionAudit };
  }
  if (
    !hasExactKeys(value, ['inspectionAudit', 'kind', 'receipt', 'schemaVersion']) ||
    !isRecord(value.receipt)
  ) {
    throw new Error('review-pr: invalid advisory result artifact');
  }
  const receipt = value.receipt;
  if (!hasValidReceiptShape(receipt) && !hasValidNonRunShape(receipt)) {
    throw new Error('review-pr: invalid advisory receipt');
  }
  if (receipt.route !== undefined && !hasConsistentRoute(receipt)) {
    throw new Error('review-pr: advisory route conflicts with its evidence');
  }
  return {
    inspectionAudit: value.inspectionAudit,
    receipt: receipt as unknown as PublishedReceipt,
  };
}

function reviewedReceiptBody(
  receipt: Extract<PublishedReceipt, { route: 'looks_ready' | 'needs_human' }>,
  runState: ReviewRunState,
): string {
  const findings = (receipt.findings ?? []).map((finding: AdvisoryFinding) => ({
    consequence: finding.consequence,
    evidence: finding.evidence ?? 'Evidence unavailable.',
    ...(finding.line !== undefined && { line: finding.line }),
    nextAction: finding.nextAction ?? 'Inspect this path and decide whether the change is safe.',
    path: finding.path,
  }));
  return renderReceipt({
    checks: [],
    findingCounts: {
      consequential: receipt.route === 'needs_human' ? findings.length : 0,
      nonConsequential: receipt.route === 'looks_ready' ? findings.length : 0,
    },
    findings,
    reviewedSha: receipt.reviewedSha,
    reviewers: ['OpenAI'],
    route: runState === 'stale' ? 'needs_human' : receipt.route,
    runState,
    skippedChecks: [],
    tokenUsage: {},
    unknowns: receipt.unknowns ?? [],
  });
}

function receiptBody(receipt: PublishedReceipt, current: boolean): string {
  if ('route' in receipt) {
    return reviewedReceiptBody(receipt, current ? (receipt.runState ?? 'incomplete') : 'stale');
  }
  if (!current) {
    return `Reviewed revision: ${receipt.reviewedSha}\nRun state: stale\nRoute: needs a human`;
  }
  const nextAction = 'nextAction' in receipt ? `\nNext action: ${receipt.nextAction}` : '';
  return `Reviewed revision: ${receipt.reviewedSha}\nRun state: ${receipt.status}${nextAction}`;
}

export async function invalidatePullRequestCommand(
  github: ReviewPrGitHubBoundary,
): Promise<ReviewPrStageOutcome> {
  const facts = await github.readPullRequest();
  const comments = await github.publisher.listComments();
  const ownedComments = comments.filter(
    comment =>
      comment.authorType === 'Bot' && comment.body.split(/\r?\n/u).includes(RECEIPT_MARKER),
  );
  if (ownedComments.length === 0) {
    return { changed: false, reason: 'no marker-owned receipt to invalidate' };
  }
  if (
    facts.state === 'ready' &&
    ownedComments.some(comment => comment.body.includes(`Reviewed revision: ${facts.headSha}`))
  ) {
    return { changed: false, reason: 'current head already has a terminal receipt' };
  }
  const state = facts.state === 'ready' ? 'stale' : `not ready (${facts.state})`;
  const priorReviewedSha = ownedComments
    .map(comment => /Reviewed revision: (?<sha>[a-f\d]{40,64})/u.exec(comment.body)?.groups?.sha)
    .find(sha => sha !== undefined);
  const reviewedSha = facts.state === 'ready' ? (priorReviewedSha ?? facts.headSha) : facts.headSha;
  const route = facts.state === 'ready' ? '\nRoute: needs a human' : '';
  await publishReceipt(
    github.publisher,
    `Reviewed revision: ${reviewedSha}\nRun state: ${state}${route}`,
  );
  return { changed: true, reason: state };
}

export async function publishPullRequestCommand(
  github: ReviewPrGitHubBoundary,
  resultPath: string,
): Promise<ReviewPrStageOutcome> {
  const handoff = parseReviewedReceipt(resultPath);
  const { receipt } = handoff;
  if (receipt === undefined) return { changed: false, reason: 'suppressed or not ready' };
  const facts = await github.readPullRequest();
  const current = facts.state === 'ready' && facts.headSha === receipt.reviewedSha;
  const validation = await publishValidatedSplitPrivilegeEvidence({
    inspectionAudit: handoff.inspectionAudit,
    publicationAudit: {
      executableArtifacts: [],
      forkCodeInputs: [],
      soleInput: 'serialized_advisory_evidence',
    },
    publish: async () => {
      await publishReceipt(github.publisher, receiptBody(receipt, current));
    },
  });
  if (validation.publicationBlocked) throw new Error('review-pr: privilege audit rejected');
  let reason = 'stale';
  if (current) reason = 'route' in receipt ? (receipt.runState ?? 'incomplete') : receipt.status;
  return {
    changed: true,
    reason,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`review-pr: ${name} is required`);
  return value;
}

async function githubRequest(path: string, init?: RequestInit): Promise<unknown> {
  const token = requiredEnvironment('GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`review-pr: GitHub request failed (${response.status})`);
  return response.status === 204 ? undefined : response.json();
}

export function createGitHubReviewBoundary(): ReviewPrGitHubBoundary {
  const repoSlug = requiredEnvironment('GITHUB_REPOSITORY');
  const pull = Number(requiredEnvironment('SAFEWORD_PR_NUMBER'));
  if (!Number.isSafeInteger(pull) || pull <= 0) throw new Error('review-pr: invalid pull number');
  const root = `/repos/${repoSlug}`;

  return {
    publisher: {
      createComment: async body => {
        await githubRequest(`${root}/issues/${pull}/comments`, {
          body: JSON.stringify({ body }),
          method: 'POST',
        });
      },
      deleteComment: async id => {
        await githubRequest(`${root}/issues/comments/${id}`, { method: 'DELETE' });
      },
      listComments: async () => {
        const payload = await githubRequest(`${root}/issues/${pull}/comments?per_page=100`);
        if (!Array.isArray(payload)) throw new Error('review-pr: invalid GitHub comments response');
        return payload.map((comment): IssueComment => {
          if (!isRecord(comment) || !isRecord(comment.user)) {
            throw new Error('review-pr: invalid GitHub comment');
          }
          if (
            typeof comment.body !== 'string' ||
            typeof comment.created_at !== 'string' ||
            typeof comment.id !== 'number'
          ) {
            throw new TypeError('review-pr: invalid GitHub comment fields');
          }
          return {
            authorType: comment.user.type === 'Bot' ? 'Bot' : 'User',
            body: comment.body,
            createdAt: comment.created_at,
            id: comment.id,
          };
        });
      },
      updateComment: async (id, body) => {
        await githubRequest(`${root}/issues/comments/${id}`, {
          body: JSON.stringify({ body }),
          method: 'PATCH',
        });
      },
    },
    readPullRequest: async () => {
      const payload = await githubRequest(`${root}/pulls/${pull}`);
      if (!isRecord(payload) || !isRecord(payload.head) || typeof payload.head.sha !== 'string') {
        throw new Error('review-pr: invalid GitHub pull response');
      }
      let state: PullRequestFacts['state'] = 'ready';
      if (payload.merged === true) state = 'merged';
      else if (payload.state === 'closed') state = 'closed';
      else if (payload.draft === true) state = 'draft';
      return { headSha: payload.head.sha, state };
    },
  };
}
