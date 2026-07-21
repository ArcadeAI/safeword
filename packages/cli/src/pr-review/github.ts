// The GitHub network boundary for the reviewer (ticket 36EEMY, slice 3).
//
// Deliberately thin and injected: every decision made from these facts lives in
// `trigger.ts`, which is pure and heavily tested. This file only fetches and
// shapes. Writes do NOT go through here unguarded — they go through
// `createReviewPoster`, whose allow-list withholds review submission and merge.

import type { GitHubRequest } from './poster.js';
import { RECEIPT_CHECK_NAME } from './poster.js';
import type { CheckRun } from './trigger.js';

const API = 'https://api.github.com';

/**
 * Build the request function the poster and the fact-gatherer share.
 *
 * `fetchImplementation` is injected so the boundary is testable without a
 * network; production passes nothing and gets global fetch.
 */
export function createGitHubRequest(
  token: string,
  fetchImplementation: typeof fetch = fetch,
): GitHubRequest {
  return async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const response = await fetchImplementation(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      // Loud, with the endpoint named. A silent failure here would surface as
      // "the reviewer said nothing", which is indistinguishable from a clean PR.
      throw new Error(
        `pr-review: GitHub ${method} ${path} responded ${response.status} ${response.statusText}`,
      );
    }

    return response.status === 204 ? undefined : await response.json();
  };
}

export interface PullFacts {
  isDraft: boolean;
  headSha: string;
  baseRef: string;
  /** Head lives in another repository — its code may be read but not run. */
  isFork: boolean;
}

interface PullResponse {
  draft?: boolean;
  head?: { sha?: string; repo?: { full_name?: string } };
  base?: { ref?: string };
}

interface CheckRunsResponse {
  check_runs?: { name?: string; conclusion?: string | null }[];
  /** Total across all pages — how the paginating loop knows it is done. */
  total_count?: number;
}

interface RulesResponse {
  type?: string;
  parameters?: { required_status_checks?: { context?: string }[] };
}

/**
 * How far back to look for the previous review's receipt.
 *
 * Bounded because each step is an API call. A pull request with more than this
 * many commits since its last review is treated as never-reviewed, so it
 * re-reviews — failing toward a duplicate comment rather than toward silence,
 * which is the safe direction. Fires-once on the CURRENT head stays exact
 * regardless, and that is the guard that actually prevents repeat noise.
 */
const RECEIPT_LOOKBACK_COMMITS = 10;

export async function fetchPullFacts(
  request: GitHubRequest,
  context: { owner: string; repo: string; pull: number },
): Promise<PullFacts> {
  const pull = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/pulls/${context.pull}`,
  )) as PullResponse;

  return {
    isDraft: pull.draft === true,
    headSha: pull.head?.sha ?? '',
    baseRef: pull.base?.ref ?? '',
    // Fork-ness decides whether this pull request's code may be EXECUTED
    // (SM1.R3). Derived from the head repo's identity rather than GitHub's
    // `fork` flag: `fork` is true for any repo that is itself a fork, even when
    // the branch lives in THIS repo — what matters is whether the head is ours.
    //
    // UNKNOWN COUNTS AS FOREIGN. An absent head.repo (a deleted fork) means we
    // could not establish provenance, and the only safe reading of "we don't
    // know whose code this is" is "not ours". Skipping a run gate costs a
    // finding; executing unidentified code is the pwn-request this whole split
    // exists to prevent.
    isFork: pull.head?.repo?.full_name !== `${context.owner}/${context.repo}`,
  };
}

/** GitHub's maximum page size, and the bound on how many pages we will walk. */
const PER_PAGE = 100;
const MAX_CHECK_PAGES = 20; // 2000 check runs; far past any real commit.

/**
 * Every check run on a commit, across pages.
 *
 * Pagination is not a nicety here. A matrix-heavy monorepo routinely exceeds one
 * page on a single commit, and a truncated list is not merely incomplete — in
 * the all-checks tier every RETURNED check passes, so `computeCiState` reports
 * green while CI is red and the reviewer reviews broken code.
 */
export async function fetchCheckRuns(
  request: GitHubRequest,
  context: { owner: string; repo: string },
  sha: string,
): Promise<CheckRun[]> {
  const collected: CheckRun[] = [];

  for (let page = 1; page <= MAX_CHECK_PAGES; page += 1) {
    const response = (await request(
      'GET',
      `/repos/${context.owner}/${context.repo}/commits/${sha}/check-runs?per_page=${PER_PAGE}&page=${page}`,
    )) as CheckRunsResponse;

    const runs = response.check_runs ?? [];
    collected.push(
      ...runs.map(run => ({
        name: run.name ?? '',
        // GitHub reports a null conclusion while a check is still running; the
        // pure layer models that as an absent conclusion.
        conclusion: (run.conclusion ?? undefined) as CheckRun['conclusion'],
      })),
    );

    const total = response.total_count;
    const done = runs.length < PER_PAGE || (total !== undefined && collected.length >= total);
    if (done) break;
  }

  return collected;
}

/** Commit-status states that mean the context did not pass. */
const STATUS_CONCLUSION: Record<string, CheckRun['conclusion']> = {
  success: 'success',
  failure: 'failure',
  error: 'failure',
};

/**
 * Legacy commit statuses on a commit, shaped as check runs.
 *
 * Required-check contexts in a ruleset routinely name STATUSES rather than
 * check runs — CircleCI, Buildkite, Jenkins, Vercel and Codecov all report this
 * way. Those never appear in `/check-runs`, so a runner that reads only check
 * runs leaves such a context permanently unmatched and waits forever for a green
 * that has already happened. Merged with check runs before the required set is
 * evaluated.
 */
export async function fetchCommitStatuses(
  request: GitHubRequest,
  context: { owner: string; repo: string },
  sha: string,
): Promise<CheckRun[]> {
  const response = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/commits/${sha}/status?per_page=${PER_PAGE}`,
  )) as { statuses?: { context?: string; state?: string }[] };

  return (response.statuses ?? []).map(status => ({
    name: status.context ?? '',
    // `pending` maps to an absent conclusion — the pure layer's "still running".
    conclusion: STATUS_CONCLUSION[status.state ?? ''],
  }));
}

/**
 * Required check names from RULESETS — `GET /rules/branches/{branch}` needs only
 * Metadata: read, which an ordinary workflow token has. The classic
 * `/branches/{branch}/protection/required_status_checks` needs Administration:
 * read and would 403 on most customer runners.
 *
 * A repo on classic branch protection legitimately returns nothing here; the
 * caller falls through to configured checks, then to all-checks-must-pass.
 */
export async function fetchRulesetRequiredChecks(
  request: GitHubRequest,
  context: { owner: string; repo: string },
  branch: string,
): Promise<string[]> {
  const rules = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/rules/branches/${encodeURIComponent(branch)}`,
  )) as RulesResponse[];

  return (Array.isArray(rules) ? rules : [])
    .filter(rule => rule.type === 'required_status_checks')
    .flatMap(rule => rule.parameters?.required_status_checks ?? [])
    .map(check => check.context ?? '')
    .filter(name => name.length > 0);
}

function hasReceipt(checks: CheckRun[]): boolean {
  return checks.some(check => check.name === RECEIPT_CHECK_NAME);
}

/**
 * The SHA the reviewer last left a receipt on, if any is within the lookback.
 * `undefined` means "no prior review found", which makes the next run a first
 * review rather than a re-review.
 */
export async function findReviewedSha(
  request: GitHubRequest,
  context: { owner: string; repo: string; pull: number },
  headSha: string,
  headChecks: CheckRun[],
): Promise<string | undefined> {
  if (hasReceipt(headChecks)) return headSha;

  const commits = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/pulls/${context.pull}/commits?per_page=100`,
  )) as { sha?: string }[];

  const earlier = (Array.isArray(commits) ? commits : [])
    .map(commit => commit.sha ?? '')
    .filter(sha => sha.length > 0 && sha !== headSha)
    .toReversed()
    .slice(0, RECEIPT_LOOKBACK_COMMITS);

  for (const sha of earlier) {
    const checks = await fetchCheckRuns(request, context, sha);
    if (hasReceipt(checks)) return sha;
  }

  return undefined;
}

/**
 * Paths changed BETWEEN two commits — the diff since the last review, not the
 * pull request's whole diff.
 *
 * `GET /pulls/{n}/files` is the wrong endpoint here and was the original bug:
 * it returns every file the pull request has ever touched, so a docs-only push
 * onto a branch that earlier changed source still looks "material" and the
 * reviewer re-fires on every push forever (R8's re-review gate never binds).
 */
export async function fetchChangedPathsBetween(
  request: GitHubRequest,
  context: { owner: string; repo: string },
  baseSha: string,
  headSha: string,
): Promise<string[]> {
  const comparison = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/compare/${baseSha}...${headSha}?per_page=100`,
  )) as { files?: { filename?: string }[] };

  return (comparison.files ?? []).map(file => file.filename ?? '').filter(name => name.length > 0);
}
