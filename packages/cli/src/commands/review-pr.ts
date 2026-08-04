// `safeword review-pr` — the entry point the shipped workflow invokes
// (ticket 36EEMY, slice 3).
//
// Thin on purpose. It resolves the environment into the facts the pure modules
// need, then hands off to `runPrReview`. Anything resembling a decision lives in
// a tested module; what lives here is I/O and wiring.

import process from 'node:process';

import { readReviewBundle } from '../pr-review/bundle.js';
import { type PrReviewConfig, resolvePrReviewConfig } from '../pr-review/config.js';
import { resolveExecutionTier } from '../pr-review/execution.js';
import {
  createGitHubRequest,
  fetchChangedPathsBetween,
  fetchCheckRuns,
  fetchCommitStatuses,
  fetchPullFacts,
  fetchRulesetRequiredChecks,
  findReviewedSha,
} from '../pr-review/github.js';
import { buildReviewInput, createVendorReview, type VendorRunner } from '../pr-review/invoke.js';
import { createReviewPoster } from '../pr-review/poster.js';
import { resolveReviewPrompt } from '../pr-review/prompt.js';
import { runPrReview } from '../pr-review/run.js';
import { createVendorRunner, type RawSpawn } from '../pr-review/spawn.js';
import { computeCiState, resolveRequiredChecks } from '../pr-review/trigger.js';
import { selectReviewVendor } from '../pr-review/vendor.js';
import type { Review } from '../pr-review/verdict.js';
import { resolveGitHubToken } from '../retro/github-rest.js';

export interface ReviewPrOptions {
  /** `owner/repo`, as GitHub Actions exposes it. */
  repository?: string;
  pull?: string;
  projectDirectory?: string;
  /** Injected in tests; production assembles one from the bundle and prompt. */
  review?: () => Promise<Review>;
  /** Where stage 1 left the diff and tree. Defaults to the workflow's path. */
  bundleDirectory?: string;
  /** Override the review prompt's location (the eval swaps judgment here). */
  promptPath?: string;
  /** The headless vendor. Absent means no review can run — a skip, not a fault. */
  vendorRunner?: VendorRunner;
  /** Raw child-process seam for an end-to-end test of the production adapter. */
  spawn?: RawSpawn;
}

/** Where the shipped workflow downloads the stage-1 artifact. */
const DEFAULT_BUNDLE_DIRECTORY = '.safeword-pr-review';

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

/** Credentials used by the parent GitHub transport must never reach the model child. */
function vendorEnvironment(
  environment: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const blocked = new Set([
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
    'ACTIONS_RUNTIME_TOKEN',
  ]);
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !blocked.has(name.toUpperCase())),
  );
}

/**
 * Turn the ambient environment into the things a run cannot proceed without.
 * Extracted so the command body reads as a sequence of steps rather than an
 * argument-validation thicket.
 */
function parseSlug(slug: string): { owner: string; repo: string } {
  const [owner, repo] = slug.split('/', 2);
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
 * Assemble the real vendor thunk, or `undefined` when a prerequisite is missing.
 *
 * Three things must all be present: the stage-1 bundle (the diff and tree), the
 * review prompt (G5337S's skill), and a vendor runner. Any one absent is a SKIP
 * with a reason — never a review of an empty diff, which would come back with an
 * inevitable "no findings" and post as a clean bill of health for a change
 * nobody looked at.
 */
function assembleVendorReview(
  projectDirectory: string,
  options: ReviewPrOptions,
  facts: { isFork: boolean },
  config: PrReviewConfig,
): (() => Promise<Review>) | undefined {
  const prompt = resolveReviewPrompt(projectDirectory, options.promptPath);
  if (prompt === undefined) return undefined;

  const bundle = readReviewBundle(options.bundleDirectory ?? DEFAULT_BUNDLE_DIRECTORY);
  if (bundle === undefined) return undefined;

  // Injected in tests; production builds the real child here. The vendor is
  // whichever one did NOT write the code (R11) — with no author detection yet,
  // that defaults to Codex, which fails toward cross-vendor.
  const run =
    options.vendorRunner ??
    createVendorRunner({
      vendor: config.vendor ?? selectReviewVendor(undefined),
      cwd: projectDirectory,
      // Vendor credentials live in the environment, never in argv. GitHub's
      // write credential stays in this parent process and is withheld from the
      // model child, whose input includes attacker-controlled pull-request text.
      env: vendorEnvironment(process.env),
      // A fork is read-only. This is the one place the tier is decided.
      executionTier: resolveExecutionTier({ isFork: facts.isFork }),
      mcpServers: config.arcadeMcpServers,
      model: config.model,
      spawn: options.spawn,
    });

  return createVendorReview({
    prompt,
    input: buildReviewInput({ diff: bundle.diff, files: bundle.files }),
    run,
  });
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

  return runPrReview({
    config,
    trigger: {
      isDraft: facts.isDraft,
      ciState: computeCiState(checks, required.checks),
      headSha: facts.headSha,
      reviewedSha,
      changedPathsSinceReview,
    },
    poster: createReviewPoster(request, { ...context, headSha: facts.headSha }),
    review: options.review ?? assembleVendorReview(projectDirectory, options, facts, config),
  });
}
