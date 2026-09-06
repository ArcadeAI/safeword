export interface ExistingIssueComment {
  authorType: 'Bot' | 'User';
  createdAt: string;
  id: number;
  marker: 'absent' | 'exact' | 'malformed';
}

export interface ReceiptPublicationPlan {
  canonicalCommentId?: number;
  duplicateCommentIds: number[];
}

export const RECEIPT_MARKER = '<!-- safeword:pr-review-receipt:v1 -->';

export interface IssueComment {
  authorType: 'Bot' | 'User';
  body: string;
  createdAt: string;
  id: number;
}

export interface IssueCommentPublisher {
  createComment(body: string): Promise<void>;
  deleteComment(id: number): Promise<void>;
  listComments(): Promise<readonly IssueComment[]>;
  updateComment(id: number, body: string): Promise<void>;
}

export interface IssueCommentPublicationAudit {
  calls: ['issue_comment'];
  mergeEligibilityMutation: false;
  surface: 'ordinary_issue_comment';
}

export interface ReceiptView {
  checks: { name: string; status?: 'failed' | 'pending' | 'success' | 'unknown' }[];
  findingCounts: { consequential: number; nonConsequential: number };
  findings?: ReceiptFindingView[];
  reviewedSha: string;
  reviewers: string[];
  route?: 'looks_ready' | 'needs_human';
  runState: 'complete' | 'failed' | 'incomplete' | 'stale';
  skippedChecks: string[];
  tokenUsage: { input?: number; output?: number };
  unknowns: string[];
  coverage?: ReceiptCoverageView[];
  missingEvidence?: string[];
  reviewableTextArtifacts?: number;
}

export interface ReceiptCoverageView {
  path: string;
  skipReason?: 'non_text';
  status: 'integrity_reviewed' | 'skipped';
}

export interface ReceiptFindingView {
  consequential?: boolean;
  consequence: string;
  evidence: string;
  line?: number;
  nextAction: string;
  path: string;
  unverifiedRemedy?: string;
}

/**
 * A receipt is Safeword-owned only when the exact marker occupies its own line.
 * A comment that merely mentions the marker inline stays user-owned.
 */
export function hasExactReceiptMarker(body: string): boolean {
  return body.split(/\r?\n/u).includes(RECEIPT_MARKER);
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function renderFinding(finding: ReceiptFindingView): string[] {
  const location = finding.line === undefined ? finding.path : `${finding.path}:${finding.line}`;
  const consequenceLabel = finding.consequential === false ? ' (non-consequential)' : '';
  return [
    `Finding${consequenceLabel}: ${location}`,
    `Evidence: ${finding.evidence}`,
    `Consequence: ${finding.consequence}`,
    `Next action (model-proposed; unverified): ${finding.nextAction}`,
    ...(finding.unverifiedRemedy ? [`Unverified remedy: ${finding.unverifiedRemedy}`] : []),
  ];
}

function renderCoverage(entry: ReceiptCoverageView): string {
  if (entry.status === 'integrity_reviewed') return `${entry.path}: integrity-reviewed`;
  const reason = entry.skipReason === 'non_text' ? 'non-text' : 'unknown';
  return `${entry.path}: skipped (${reason})`;
}

/**
 * Say so on the findings line itself when the run did not finish.
 *
 * A crashed run and a clean run both count zero findings, so the counts alone read
 * as a pass; the `Run state:` line above carries the truth but a reader has to
 * correlate the two, and readers do not. The counts stay either way — an incomplete
 * run still reports whatever it managed to collect, so suppressing them would hide
 * real findings.
 */
function incompleteFindingsCaveat(runState: ReceiptView['runState']): string {
  if (runState === 'complete' || runState === 'stale') return '';
  return ` (${runState} — the review did not finish, so no findings is not a clean result)`;
}

export function renderReceipt(receipt: ReceiptView): string {
  const checks = receipt.checks.map(check => `${check.name}: ${check.status ?? 'unknown'}`);
  const inputTokens = receipt.tokenUsage.input ?? 'unknown';
  const outputTokens = receipt.tokenUsage.output ?? 'unknown';
  const coverage = (receipt.coverage ?? []).map(entry => renderCoverage(entry));

  const summary = [
    'Advisory only: this review can miss issues, does not replace human review, and is not evidence that this pull request is safe to merge.',
    `Reviewed revision: ${receipt.reviewedSha}`,
    `Run state: ${receipt.runState}`,
    ...(receipt.route
      ? [`Route: ${receipt.route === 'looks_ready' ? 'looks ready' : 'needs a human'}`]
      : []),
    `Reviewers: ${listOrNone(receipt.reviewers)}`,
    `Checks: ${listOrNone(checks)}`,
    `Skipped checks: ${listOrNone(receipt.skippedChecks)}`,
    `Coverage: ${listOrNone(coverage)}`,
    `Missing evidence: ${listOrNone(receipt.missingEvidence ?? [])}`,
    `Reviewable text artifacts: ${receipt.reviewableTextArtifacts ?? 'unknown'}`,
    `Unknowns: ${listOrNone(receipt.unknowns)}`,
    `Token usage: ${inputTokens} input, ${outputTokens} output`,
    `Findings: ${receipt.findingCounts.consequential} consequential, ${receipt.findingCounts.nonConsequential} non-consequential${incompleteFindingsCaveat(receipt.runState)}`,
  ];
  const findings = (receipt.findings ?? []).flatMap(finding => renderFinding(finding));

  return [...summary, ...findings].join('\n');
}

export function planReceiptPublication(
  comments: readonly ExistingIssueComment[],
): ReceiptPublicationPlan {
  const ownedComments = comments
    .filter(comment => comment.authorType === 'Bot' && comment.marker === 'exact')
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id);
  const [canonicalComment, ...duplicateComments] = ownedComments;

  return {
    canonicalCommentId: canonicalComment?.id,
    duplicateCommentIds: duplicateComments.map(comment => comment.id),
  };
}

export async function publishReceipt(
  publisher: IssueCommentPublisher,
  renderedReceipt: string,
): Promise<IssueCommentPublicationAudit> {
  const comments = await publisher.listComments();
  const plan = planReceiptPublication(
    comments.map(comment => ({
      authorType: comment.authorType,
      createdAt: comment.createdAt,
      id: comment.id,
      marker: hasExactReceiptMarker(comment.body) ? 'exact' : 'absent',
    })),
  );
  const body = `${RECEIPT_MARKER}\n${renderedReceipt}`;

  if (plan.canonicalCommentId === undefined) await publisher.createComment(body);
  else await publisher.updateComment(plan.canonicalCommentId, body);

  for (const duplicateCommentId of plan.duplicateCommentIds) {
    await publisher.deleteComment(duplicateCommentId);
  }

  return {
    calls: ['issue_comment'],
    mergeEligibilityMutation: false,
    surface: 'ordinary_issue_comment',
  };
}
