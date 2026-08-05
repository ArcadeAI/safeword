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

export function reviewPullRequest(_dependencies: ReviewDependencies): Promise<ReviewOutcome> {
  return Promise.reject(new Error('advisory pull request review is not implemented'));
}
