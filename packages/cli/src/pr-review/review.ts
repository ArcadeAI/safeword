export interface PullRequestReviewState {
  headSha: string;
  prerequisites: 'passed' | 'pending' | 'failed';
  ready: boolean;
}

export interface AdvisoryInspection {
  consequentialFindings: number;
  unknowns: string[];
}

export interface PublishedReceipt {
  reviewedSha: string;
  route: 'looks_ready' | 'needs_human';
}

export interface ReviewDependencies {
  inspect(headSha: string): Promise<AdvisoryInspection>;
  publish(receipt: PublishedReceipt): Promise<void>;
  readPullRequest(): Promise<PullRequestReviewState>;
}

export interface ReviewOutcome {
  attempts: number;
  reviewedSha: string;
}

export async function reviewPullRequest(dependencies: ReviewDependencies): Promise<ReviewOutcome> {
  const pullRequest = await dependencies.readPullRequest();
  if (!pullRequest.ready || pullRequest.prerequisites !== 'passed') {
    throw new Error('pull request is not eligible for advisory review');
  }

  const inspection = await dependencies.inspect(pullRequest.headSha);
  const route =
    inspection.consequentialFindings === 0 && inspection.unknowns.length === 0
      ? 'looks_ready'
      : 'needs_human';

  await dependencies.publish({ reviewedSha: pullRequest.headSha, route });
  return { attempts: 1, reviewedSha: pullRequest.headSha };
}
