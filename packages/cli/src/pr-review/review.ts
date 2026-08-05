export interface PullRequestReviewState {
  headSha: string;
  prerequisites: 'passed' | 'pending' | 'failed';
  ready: boolean;
}

export interface AdvisoryInspection {
  consequentialFindings: number;
  unknowns: string[];
}

export type PublishedReceipt =
  | {
      reviewedSha: string;
      route: 'looks_ready' | 'needs_human';
    }
  | {
      markerOwned: true;
      reviewedSha: string;
      status: 'prerequisites_failed' | 'prerequisites_pending';
    };

export interface ReviewDependencies {
  inspect(headSha: string): Promise<AdvisoryInspection>;
  publish(receipt: PublishedReceipt): Promise<void>;
  readPullRequest(): Promise<PullRequestReviewState>;
  summarize?(summary: string): Promise<void>;
}

export interface ReviewOutcome {
  attempts: number;
  reviewedSha?: string;
  result: 'not_run' | 'reviewed';
}

export async function reviewPullRequest(dependencies: ReviewDependencies): Promise<ReviewOutcome> {
  const pullRequest = await dependencies.readPullRequest();
  if (!pullRequest.ready) {
    await dependencies.summarize?.('not ready (draft)');
    return { attempts: 0, result: 'not_run' };
  }

  if (pullRequest.prerequisites !== 'passed') {
    await dependencies.publish({
      markerOwned: true,
      reviewedSha: pullRequest.headSha,
      status:
        pullRequest.prerequisites === 'pending' ? 'prerequisites_pending' : 'prerequisites_failed',
    });
    return { attempts: 0, result: 'not_run' };
  }

  const inspection = await dependencies.inspect(pullRequest.headSha);
  const route =
    inspection.consequentialFindings === 0 && inspection.unknowns.length === 0
      ? 'looks_ready'
      : 'needs_human';

  await dependencies.publish({ reviewedSha: pullRequest.headSha, route });
  return { attempts: 1, result: 'reviewed', reviewedSha: pullRequest.headSha };
}
