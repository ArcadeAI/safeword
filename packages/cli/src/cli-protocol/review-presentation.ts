import type { CliResult } from './result.js';

type ReviewCoverage = 'standard' | 'independent' | 'incomplete';
type ReviewVerdict = 'approve' | 'request_changes';

const REVIEW_AGENTS = new Set(['claude', 'codex', 'opencode']);
const REVIEW_AUTHORS = new Set(['claude', 'codex', 'cursor', 'opencode']);
const REPLACED_REVIEW_FINDINGS = new Set([
  'REVIEW_INDEPENDENCE',
  'REVIEW_NOT_REQUESTED',
  'REVIEW_STALE',
]);
const RETRYABLE_REVIEW_FAILURES = new Set([
  'timed_out',
  'process_failed',
  'invalid_output',
  'REVIEWER_PROVENANCE_MISSING',
  'REVIEWER_PROVENANCE_CONTRADICTORY',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reviewCoverage(data: Record<string, unknown>): ReviewCoverage {
  const author = data.author_agent;
  const reviewer = data.actual_reviewer;
  if (typeof author !== 'string' || !REVIEW_AUTHORS.has(author) || typeof reviewer !== 'string') {
    return 'incomplete';
  }
  if (data.independence === 'degraded' && REVIEW_AGENTS.has(reviewer) && reviewer === author)
    return 'standard';
  if (data.independence === 'cross-agent' && REVIEW_AGENTS.has(reviewer) && reviewer !== author) {
    return 'independent';
  }
  return 'incomplete';
}

function reviewVerdict(data: Record<string, unknown>): ReviewVerdict | undefined {
  const output = data.reviewer_output;
  if (!isRecord(output)) return undefined;
  if (
    typeof output.reviewer_agent !== 'string' ||
    !REVIEW_AGENTS.has(output.reviewer_agent) ||
    output.reviewer_agent !== data.actual_reviewer
  ) {
    return undefined;
  }
  return output.verdict === 'approve' || output.verdict === 'request_changes'
    ? output.verdict
    : undefined;
}

function reviewVerdictMatchesStatus(status: unknown, verdict: ReviewVerdict | undefined): boolean {
  if (status === 'approved') return verdict === 'approve';
  if (status === 'changes_requested') return verdict === 'request_changes';
  return status === 'blocked' && verdict !== undefined;
}

function reviewPolicyMatchesStatus(data: Record<string, unknown>): boolean {
  if (data.status === 'blocked') {
    return data.review_policy === 'prefer' || data.review_policy === 'require';
  }
  return (
    (data.status === 'approved' || data.status === 'changes_requested') &&
    data.review_policy === undefined
  );
}

function reviewStateMatchesStatus(state: CliResult['state'], status: unknown): boolean {
  if (status === 'approved') return state === 'healthy';
  return (status === 'changes_requested' || status === 'blocked') && state === 'action_required';
}

function isConsistentReviewResult(
  data: Record<string, unknown>,
  state: CliResult['state'],
  verdict: ReviewVerdict | undefined,
): boolean {
  return (
    reviewStateMatchesStatus(state, data.status) &&
    reviewPolicyMatchesStatus(data) &&
    reviewVerdictMatchesStatus(data.status, verdict)
  );
}

function incompleteCoverageLine(data: Record<string, unknown>): string {
  return data.status === 'blocked' && data.review_policy === 'require'
    ? 'Review incomplete — required independent coverage is unsatisfied.'
    : 'Review incomplete.';
}

function blockedReviewCoverageLine(
  data: Record<string, unknown>,
  coverage: ReviewCoverage,
  verdict: ReviewVerdict,
): string {
  if (coverage === 'standard' && data.review_policy === 'require') {
    return verdict === 'request_changes'
      ? 'Review blocked — changes requested with standard coverage; required independent coverage is unsatisfied.'
      : 'Review blocked — standard coverage achieved; required independent coverage is unsatisfied.';
  }
  return incompleteCoverageLine(data);
}

function specialReviewCoverageLine(status: unknown, state: CliResult['state']): string | undefined {
  if (status === 'existing_route' && state === 'healthy') return 'Review not requested.';
  if (status === 'pending' && state === 'action_required') {
    return 'Review running in the background.';
  }
  if (status === 'stale' && state === 'action_required') {
    return 'Review stale — sources changed during the check.';
  }
  return undefined;
}

function reviewCoverageLine(data: Record<string, unknown>, state: CliResult['state']): string {
  const status = data.status;
  const specialLine = specialReviewCoverageLine(status, state);
  if (specialLine !== undefined) return specialLine;

  const verdict = reviewVerdict(data);
  if (!reviewStateMatchesStatus(state, status)) return incompleteCoverageLine(data);
  if (!reviewPolicyMatchesStatus(data)) return 'Review incomplete.';
  if (!reviewVerdictMatchesStatus(status, verdict)) return incompleteCoverageLine(data);
  // Preserve an explicit narrowing guard for blockedReviewCoverageLine below.
  if (verdict === undefined) return incompleteCoverageLine(data);
  const coverage = reviewCoverage(data);
  if (status === 'blocked') return blockedReviewCoverageLine(data, coverage, verdict);
  if (coverage === 'incomplete') return 'Review incomplete.';
  if (verdict === 'request_changes') return `Review changes requested — ${coverage} coverage.`;
  return `Review complete — ${coverage} coverage.`;
}

function isCompletedStandardReview(
  data: Record<string, unknown>,
  state: CliResult['state'],
): boolean {
  const verdict = reviewVerdict(data);
  return (
    data.status === 'approved' &&
    isConsistentReviewResult(data, state, verdict) &&
    reviewCoverage(data) === 'standard'
  );
}

function reviewUpgradeSuggestion(
  data: Record<string, unknown>,
  state: CliResult['state'],
): string | undefined {
  if (!isCompletedStandardReview(data, state)) return undefined;
  const author = data.author_agent;
  const reviewer = data.assigned_reviewer;
  if (
    typeof author !== 'string' ||
    typeof reviewer !== 'string' ||
    !REVIEW_AGENTS.has(reviewer) ||
    reviewer === author
  ) {
    return undefined;
  }
  const label = `${reviewer.charAt(0).toUpperCase()}${reviewer.slice(1)}`;
  return suggestionForFailure(data.preferred_failure, label);
}

function suggestionForFailure(failure: unknown, label: string): string | undefined {
  if (failure === 'not_installed') {
    return `To add independent coverage, install or update ${label}, then retry review.`;
  }
  if (failure === 'untrusted_install') {
    return `To add independent coverage, move ${label} to a trusted non-writable-by-group directory, then retry review.`;
  }
  if (failure === 'unsupported') {
    return `To add independent coverage, update ${label}, then retry review.`;
  }
  if (failure === 'probe_timed_out' || failure === 'launch_failed') {
    return `To add independent coverage, run ${label} --help to diagnose it, then retry review.`;
  }
  if (failure === 'not_authenticated') {
    return `To add independent coverage, sign in to ${label}, then retry review.`;
  }
  if (RETRYABLE_REVIEW_FAILURES.has(String(failure))) {
    return `To add independent coverage, retry ${label} review.`;
  }
  return undefined;
}

export function reviewResultLines(
  result: CliResult,
  options: { verbose?: boolean },
): string[] | undefined {
  if (!isRecord(result.data) || result.data.command !== 'review run') return undefined;
  if (result.state === 'failed' && result.errors.length > 0) return undefined;
  const messages = result.findings
    .filter(finding => !REPLACED_REVIEW_FINDINGS.has(finding.code))
    .map(finding => finding.message);
  messages.push(...result.errors.map(error => error.message));
  const lines = [reviewCoverageLine(result.data, result.state), ...messages];
  if (options.verbose === true) {
    const suggestion = reviewUpgradeSuggestion(result.data, result.state);
    if (suggestion !== undefined) lines.push(suggestion);
  }
  return lines;
}
