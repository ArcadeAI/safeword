import {
  githubRequest,
  requiredEnvironment,
  requiredPullNumber,
} from '../pr-review/github-request.js';
import { evaluateReadinessEvidence, type ReadinessEvidenceReport } from '../pr-review/readiness.js';

/** The commit status a repository can require once it trusts the signal. */
export const READINESS_STATUS_CONTEXT = 'safeword/pr-readiness';

export interface ReadinessPullRequest {
  body: string | null | undefined;
  draft: boolean;
  headSha: string;
}

export interface ReviewPrReadinessBoundary {
  publishStatus(headSha: string, report: ReadinessEvidenceReport): Promise<void>;
  readPullRequest(): Promise<ReadinessPullRequest>;
}

export interface ReadinessOutcome extends ReadinessEvidenceReport {
  headSha: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function reportReadinessCommand(
  github: ReviewPrReadinessBoundary,
): Promise<ReadinessOutcome> {
  const pullRequest = await github.readPullRequest();
  const report = evaluateReadinessEvidence(pullRequest);
  await github.publishStatus(pullRequest.headSha, report);
  return { ...report, headSha: pullRequest.headSha };
}

export function createGitHubReadinessBoundary(): ReviewPrReadinessBoundary {
  const root = `/repos/${requiredEnvironment('GITHUB_REPOSITORY')}`;
  const pull = requiredPullNumber();

  return {
    // `description` is a constant chosen by the evaluator, never body text, so
    // an untrusted pull request cannot reach this privileged request.
    publishStatus: async (headSha, report) => {
      await githubRequest(`${root}/statuses/${headSha}`, {
        body: JSON.stringify({
          context: READINESS_STATUS_CONTEXT,
          description: report.description,
          state: report.state,
        }),
        method: 'POST',
      });
    },
    readPullRequest: async () => {
      const payload = await githubRequest(`${root}/pulls/${pull}`);
      if (!isRecord(payload) || !isRecord(payload.head) || typeof payload.head.sha !== 'string') {
        throw new Error('review-pr: invalid GitHub pull response');
      }
      return {
        body: typeof payload.body === 'string' ? payload.body : undefined,
        draft: payload.draft === true,
        headSha: payload.head.sha,
      };
    },
  };
}
