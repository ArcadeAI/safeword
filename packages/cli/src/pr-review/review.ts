export interface PullRequestReviewState {
  headSha: string;
  markerReceiptExists?: boolean;
  missingPrerequisites?: readonly string[];
  prerequisitesConfigured: boolean;
  requiredPrerequisites?: readonly string[];
  prerequisites: 'passed' | 'pending' | 'failed';
  ready: boolean;
  reviewedReceiptSha?: string;
  state?: 'closed' | 'draft' | 'merged';
}

export interface AdvisoryInspection {
  artifacts?: ArtifactEvidence[];
  consequentialFindings: number;
  coverage?: ArtifactCoverage[];
  unknowns: string[];
}

export interface ArtifactEvidence {
  kind: 'non_text';
  path: string;
}

export type ArtifactCoverage =
  | {
      path: string;
      status: 'integrity_reviewed';
    }
  | {
      path: string;
      skipReason: 'non_text';
      status: 'skipped';
    };

export type PublishedReceipt =
  | {
      coverage?: ArtifactCoverage[];
      reviewedSha: string;
      route: 'looks_ready' | 'needs_human';
      unknowns?: string[];
    }
  | {
      markerOwned: true;
      missingChecks: string[];
      nextAction: string;
      reviewedSha: string;
      status: 'prerequisites_pending';
    }
  | {
      markerOwned: true;
      nextAction: string;
      reviewedSha: string;
      status: 'prerequisites_unconfigured';
    }
  | {
      markerOwned: true;
      reviewedSha: string;
      status: 'prerequisites_failed';
    }
  | {
      markerOwned: true;
      reason: 'closed' | 'draft' | 'merged';
      reviewedSha: string;
      status: 'not_ready';
    };

export type ReceiptPublicationMode = 'upsert_marker_owned';

export interface ReviewDependencies {
  inspect(headSha: string): Promise<AdvisoryInspection>;
  publish(receipt: PublishedReceipt, mode: ReceiptPublicationMode): Promise<void>;
  readPullRequest(): Promise<PullRequestReviewState>;
  summarize?(summary: string): Promise<void>;
}

export interface ReviewOutcome {
  attempts: number;
  reviewedSha?: string;
  result: 'not_run' | 'reviewed' | 'suppressed';
}

function resolvePrerequisites(
  pullRequest: PullRequestReviewState,
): PullRequestReviewState['prerequisites'] {
  return pullRequest.requiredPrerequisites?.length === 0 ? 'passed' : pullRequest.prerequisites;
}

function resolveCoverage(inspection: AdvisoryInspection): ArtifactCoverage[] | undefined {
  const coverage: ArtifactCoverage[] = [
    ...(inspection.coverage ?? []),
    ...(inspection.artifacts ?? []).map(({ path }) => ({
      path,
      skipReason: 'non_text' as const,
      status: 'skipped' as const,
    })),
  ];
  return coverage.length > 0 ? coverage : undefined;
}

async function stopBeforeReview(
  dependencies: ReviewDependencies,
  pullRequest: PullRequestReviewState,
): Promise<ReviewOutcome | undefined> {
  if (!pullRequest.ready) {
    const reason = pullRequest.state ?? 'draft';
    if (pullRequest.markerReceiptExists) {
      await dependencies.publish(
        {
          markerOwned: true,
          reason,
          reviewedSha: pullRequest.headSha,
          status: 'not_ready',
        },
        'upsert_marker_owned',
      );
    }
    await dependencies.summarize?.(`not ready (${reason})`);
    return { attempts: 0, result: 'not_run' };
  }

  if (pullRequest.reviewedReceiptSha === pullRequest.headSha) {
    await dependencies.summarize?.('suppressed');
    return { attempts: 0, result: 'suppressed' };
  }

  if (!pullRequest.prerequisitesConfigured) {
    await dependencies.publish(
      {
        markerOwned: true,
        nextAction: 'Set prReview.requiredChecks explicitly.',
        reviewedSha: pullRequest.headSha,
        status: 'prerequisites_unconfigured',
      },
      'upsert_marker_owned',
    );
    return { attempts: 0, result: 'not_run' };
  }

  return undefined;
}

export async function reviewPullRequest(dependencies: ReviewDependencies): Promise<ReviewOutcome> {
  const pullRequest = await dependencies.readPullRequest();
  const earlyOutcome = await stopBeforeReview(dependencies, pullRequest);
  if (earlyOutcome) return earlyOutcome;

  const prerequisites = resolvePrerequisites(pullRequest);

  if (prerequisites !== 'passed') {
    const receipt: PublishedReceipt =
      prerequisites === 'pending'
        ? {
            markerOwned: true,
            missingChecks: [...(pullRequest.missingPrerequisites ?? [])],
            nextAction: 'Verify the check or prReview.requiredChecks configuration.',
            reviewedSha: pullRequest.headSha,
            status: 'prerequisites_pending',
          }
        : {
            markerOwned: true,
            reviewedSha: pullRequest.headSha,
            status: 'prerequisites_failed',
          };
    await dependencies.publish(receipt, 'upsert_marker_owned');
    return { attempts: 0, result: 'not_run' };
  }

  const inspection = await dependencies.inspect(pullRequest.headSha);
  const route =
    inspection.consequentialFindings === 0 && inspection.unknowns.length === 0
      ? 'looks_ready'
      : 'needs_human';
  const coverage = resolveCoverage(inspection);

  await dependencies.publish(
    {
      ...(coverage && { coverage, unknowns: inspection.unknowns }),
      reviewedSha: pullRequest.headSha,
      route,
    },
    'upsert_marker_owned',
  );
  return { attempts: 1, result: 'reviewed', reviewedSha: pullRequest.headSha };
}
