// The reviewer's write surface (ticket 36EEMY, Rule SM1.R3).
//
// The whole fork-safety argument is capability-absence: a hijacked reviewer must
// be able to SAY something wrong, never to DO something irreversible. GitHub
// gives us no token scope that permits commenting while forbidding approval —
// `pull-requests: write` grants both, and a `github-actions` approval counts
// toward required-approval protection. So the absence is enforced HERE, at the
// only place the runner is allowed to reach GitHub, plus two settings the
// install documents (org/repo "Allow GitHub Actions to create and approve pull
// requests" off, and "require approval of the most recent reviewable push").
//
// PRINCIPLES §1: instructions are the weakest enforcement tier. "Don't call the
// approve endpoint" is an instruction; an allow-list that throws is a mechanism.

/** One recorded GitHub request — the unit the audit and the tests observe. */
export interface GitHubCall {
  method: string;
  path: string;
  body?: unknown;
}

/** The process boundary: performs a GitHub API request. Injected, so tests fake it. */
export type GitHubRequest = (method: string, path: string, body?: unknown) => Promise<unknown>;

/** Identifies the pull request under review. */
export interface PullContext {
  owner: string;
  repo: string;
  pull: number;
  /** Head SHA the receipt attaches to — a check run cannot be created without one. */
  headSha: string;
}

/**
 * Everything the reviewer may write. Note what is NOT here and cannot be added
 * without also editing the allow-list below: submitting a review (which is how
 * an approval is issued) and merging.
 */
export interface ReviewPoster {
  /** An inline comment on a changed line — the surface findings are posted to. */
  postInlineComment(comment: { path: string; line: number; body: string }): Promise<void>;
  /** A conversation comment — used for notes that do not anchor to a line. */
  postIssueComment(body: string): Promise<void>;
  /**
   * The non-required receipt that records the verdict. Never a comment, never
   * an approval, and never a failure — the reviewer is advisory and gates
   * nothing, so `neutral` is the only conclusion it may write.
   */
  createCheckRun(run: {
    name: string;
    conclusion: 'neutral';
    /** The recorded verdict — what a reader checks to see what the pass concluded. */
    title: string;
    summary: string;
  }): Promise<void>;
}

/**
 * The complete set of endpoints the reviewer is permitted to call. Deliberately
 * a whitelist and not a blacklist: a blacklist silently permits whatever it
 * failed to anticipate, which is the wrong default for a security boundary.
 */
const ALLOWED_ENDPOINTS: RegExp[] = [
  /^POST \/repos\/[^/]+\/[^/]+\/pulls\/\d+\/comments$/,
  /^POST \/repos\/[^/]+\/[^/]+\/issues\/\d+\/comments$/,
  /^POST \/repos\/[^/]+\/[^/]+\/check-runs$/,
];

/**
 * Throw unless this endpoint is one the reviewer may call. Exported so the
 * boundary itself is directly testable — a future call site that adds an
 * approval fails a test instead of shipping.
 */
export function assertAllowedEndpoint(method: string, path: string): void {
  const endpoint = `${method.toUpperCase()} ${path}`;
  if (ALLOWED_ENDPOINTS.every(allowed => !allowed.test(endpoint))) {
    throw new Error(
      `pr-review: endpoint not permitted for the reviewer: ${endpoint}. ` +
        'The reviewer may only post comments and create its check-run receipt; ' +
        'submitting a review (which can approve) and merging are withheld by design (SM1.R3).',
    );
  }
}

/** Wrap the raw request seam so every call passes the allow-list first. */
export function createReviewPoster(request: GitHubRequest, context: PullContext): ReviewPoster {
  const { owner, repo, pull, headSha } = context;
  const guarded = async (method: string, path: string, body?: unknown): Promise<void> => {
    assertAllowedEndpoint(method, path);
    await request(method, path, body);
  };

  return {
    postInlineComment: comment =>
      guarded('POST', `/repos/${owner}/${repo}/pulls/${pull}/comments`, {
        body: comment.body,
        path: comment.path,
        line: comment.line,
        side: 'RIGHT',
        commit_id: headSha,
      }),
    postIssueComment: body =>
      guarded('POST', `/repos/${owner}/${repo}/issues/${pull}/comments`, { body }),
    createCheckRun: run =>
      guarded('POST', `/repos/${owner}/${repo}/check-runs`, {
        name: run.name,
        head_sha: headSha,
        status: 'completed',
        conclusion: run.conclusion,
        output: { title: run.title, summary: run.summary },
      }),
  };
}
