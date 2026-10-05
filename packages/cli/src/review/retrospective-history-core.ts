import { spawnSync } from 'node:child_process';

export const RETROSPECTIVE_TICKET = 'CKWE2D';

export interface RetrospectiveHistoryRequest {
  readonly ticketId: string;
  readonly cutoff: string;
  readonly baseline: string;
  readonly rationale: string;
}

export interface RetrospectiveHistoryResult {
  readonly eligibleForReview: boolean;
  readonly reason?: string;
}

function git(
  projectRoot: string,
  args: string[],
): { status: number | null; stdout: string; error: boolean } {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  const result = spawnSync('git', ['--no-replace-objects', '-C', projectRoot, ...args], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 4096,
    env: environment,
  });
  return { status: result.status, stdout: result.stdout ?? '', error: result.error !== undefined };
}

function requiredCommitError(projectRoot: string, sha: string): string | undefined {
  const commitSuffix = '^{commit}';
  const resolved = git(projectRoot, ['rev-parse', '--verify', '--quiet', `${sha}${commitSuffix}`]);
  if (resolved.error || resolved.status === null) return 'Git could not inspect migration history.';
  if (resolved.status !== 0 || resolved.stdout.trim() !== sha)
    return `Required commit ${sha} is unavailable.`;
  return undefined;
}

function ancestorError(
  projectRoot: string,
  ancestor: string,
  descendant: string,
  orderingError: string,
): string | undefined {
  const result = git(projectRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
  if (result.error || result.status === null || result.status > 1)
    return 'Git could not inspect migration history.';
  return result.status === 1 ? orderingError : undefined;
}

/** Internal history mechanism; the production entry point supplies the fixed cutoff. */
export function checkHistoryAgainstTrustedCutoff(
  projectRoot: string,
  request: RetrospectiveHistoryRequest,
  trustedCutoff: string,
): RetrospectiveHistoryResult {
  const deny = (reason: string): RetrospectiveHistoryResult => ({
    eligibleForReview: false,
    reason,
  });
  if (request.ticketId !== RETROSPECTIVE_TICKET) return deny('Only CKWE2D may use VERIFIED.');
  if (!/^[0-9a-f]{40}$/u.test(trustedCutoff))
    return deny('The trusted cutoff must be a full lowercase commit SHA.');
  if (request.cutoff !== trustedCutoff) return deny('The migration cutoff changed.');
  if (!/^[0-9a-f]{40}$/u.test(request.baseline))
    return deny('The baseline must be a full lowercase commit SHA.');
  if (request.rationale.trim() === '')
    return deny('The RED-unavailability explanation is missing.');

  for (const sha of [trustedCutoff, request.baseline]) {
    const error = requiredCommitError(projectRoot, sha);
    if (error !== undefined) return deny(error);
  }
  const cutoffError = ancestorError(
    projectRoot,
    trustedCutoff,
    'HEAD',
    'The fixed migration cutoff is not reachable from HEAD.',
  );
  if (cutoffError !== undefined) return deny(cutoffError);
  const baselineError = ancestorError(
    projectRoot,
    request.baseline,
    trustedCutoff,
    'The baseline must be an ancestor-or-equal of the cutoff.',
  );
  if (baselineError !== undefined) return deny(baselineError);
  return { eligibleForReview: true };
}
