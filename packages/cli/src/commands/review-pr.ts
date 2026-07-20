// `safeword review-pr` — the entry point the shipped workflow invokes
// (ticket 36EEMY, slice 3).
//
// Thin on purpose. It resolves the environment into the facts the pure modules
// need, then hands off to `runPrReview`. Anything resembling a decision lives in
// a tested module; what lives here is I/O and wiring.

import process from 'node:process';

import { resolvePrReviewConfig } from '../pr-review/config.js';
import {
  createGitHubRequest,
  fetchChangedPathsBetween,
  fetchCheckRuns,
  fetchCommitStatuses,
  fetchPullFacts,
  fetchRulesetRequiredChecks,
  findReviewedSha,
} from '../pr-review/github.js';
import { createReviewPoster } from '../pr-review/poster.js';
import { runPrReview } from '../pr-review/run.js';
import { computeCiState, resolveRequiredChecks } from '../pr-review/trigger.js';
import type { Review } from '../pr-review/verdict.js';
import { resolveGitHubToken } from '../retro/github-rest.js';

export interface ReviewPrOptions {
  /** `owner/repo`, as GitHub Actions exposes it. */
  repository?: string;
  pull?: string;
  projectDirectory?: string;
  /** Injected in tests; production builds one from the resolved token. */
  review?: () => Promise<Review>;
}

export interface ReviewPrOutcome {
  ran: boolean;
  posted: boolean;
  reason: string;
}

interface Invocation {
  owner: string;
  repo: string;
  pull: number;
  credential: string;
}

/**
 * Turn the ambient environment into the things a run cannot proceed without.
 * Extracted so the command body reads as a sequence of steps rather than an
 * argument-validation thicket.
 */
function parseSlug(slug: string): { owner: string; repo: string } {
  const [owner, repo] = slug.split('/');
  if (!owner || !repo) {
    throw new Error('pr-review: GITHUB_REPOSITORY is missing or not in owner/repo form');
  }
  return { owner, repo };
}

function parsePullNumber(raw: string): number {
  const pull = Number(raw);
  if (!Number.isSafeInteger(pull) || pull <= 0) {
    throw new Error('pr-review: a pull request number is required (SAFEWORD_PR_NUMBER)');
  }
  return pull;
}

function resolveInvocation(options: ReviewPrOptions): Invocation {
  const { owner, repo } = parseSlug(options.repository ?? process.env.GITHUB_REPOSITORY ?? '');
  const pull = parsePullNumber(options.pull ?? process.env.SAFEWORD_PR_NUMBER ?? '');

  const credential = resolveGitHubToken();
  if (!credential) {
    throw new Error('pr-review: no usable GitHub token (GITHUB_TOKEN)');
  }

  return { owner, repo, pull, credential };
}

/**
 * Resolve, gather, run. Returns an outcome rather than exiting, so the caller
 * decides the process code — a skipped review is a normal outcome and must not
 * redden the job, while a thrown fault propagates and should.
 */
export async function reviewPrCommand(options: ReviewPrOptions = {}): Promise<ReviewPrOutcome> {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const config = resolvePrReviewConfig(projectDirectory);

  // Checked before anything else costs a network call: a project that never
  // opted in should not even be queried.
  if (!config.enabled) {
    return { ran: false, posted: false, reason: 'disabled for this project (prReview.enabled)' };
  }

  const { owner, repo, pull, credential } = resolveInvocation(options);
  const request = createGitHubRequest(credential);
  const context = { owner, repo, pull };

  const facts = await fetchPullFacts(request, context);
  // Both sources, always. A required context may be a check RUN or a legacy
  // commit STATUS, and reading only one leaves the other permanently unmatched.
  const checks = [
    ...(await fetchCheckRuns(request, context, facts.headSha)),
    ...(await fetchCommitStatuses(request, context, facts.headSha)),
  ];
  const rulesetChecks = await fetchRulesetRequiredChecks(request, context, facts.baseRef);
  const required = resolveRequiredChecks({
    rulesetChecks,
    configuredChecks: config.requiredChecks,
  });
  const reviewedSha = await findReviewedSha(request, context, facts.headSha, checks);

  // Only fetched when it can change the answer — a first review has no previous
  // SHA to diff against, so the call would be wasted.
  const changedPathsSinceReview =
    reviewedSha === undefined || reviewedSha === facts.headSha
      ? undefined
      : await fetchChangedPathsBetween(request, context, reviewedSha, facts.headSha);

  process.stdout.write(
    `pr-review: required-check set resolved from ${required.tier} (${required.checks?.join(', ') ?? 'all checks'})\n`,
  );

  const outcome = await runPrReview({
    config,
    trigger: {
      isDraft: facts.isDraft,
      ciState: computeCiState(checks, required.checks),
      headSha: facts.headSha,
      reviewedSha,
      changedPathsSinceReview,
    },
    poster: createReviewPoster(request, { ...context, headSha: facts.headSha }),
    review: options.review ?? undefined,
  });

  process.stdout.write(`pr-review: ${outcome.reason}\n`);
  return outcome;
}
