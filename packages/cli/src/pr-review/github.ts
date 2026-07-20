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
}

interface PullResponse {
  draft?: boolean;
  head?: { sha?: string };
  base?: { ref?: string };
}

interface CheckRunsResponse {
  check_runs?: { name?: string; conclusion?: string | null }[];
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
  };
}

export async function fetchCheckRuns(
  request: GitHubRequest,
  context: { owner: string; repo: string },
  sha: string,
): Promise<CheckRun[]> {
  const response = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/commits/${sha}/check-runs?per_page=100`,
  )) as CheckRunsResponse;

  return (response.check_runs ?? []).map(run => ({
    name: run.name ?? '',
    // GitHub reports a null conclusion while a check is still running; the
    // pure layer models that as an absent conclusion.
    conclusion: (run.conclusion ?? undefined) as CheckRun['conclusion'],
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

export async function fetchChangedPaths(
  request: GitHubRequest,
  context: { owner: string; repo: string; pull: number },
): Promise<string[]> {
  const files = (await request(
    'GET',
    `/repos/${context.owner}/${context.repo}/pulls/${context.pull}/files?per_page=100`,
  )) as { filename?: string }[];

  return (Array.isArray(files) ? files : [])
    .map(file => file.filename ?? '')
    .filter(name => name.length > 0);
}
