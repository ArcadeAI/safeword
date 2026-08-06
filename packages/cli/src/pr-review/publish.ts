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
}

export interface ReceiptFindingView {
  consequence: string;
  evidence: string;
  line?: number;
  nextAction: string;
  path: string;
  unverifiedRemedy?: string;
}

function hasExactReceiptMarker(body: string): boolean {
  return body.split(/\r?\n/u).includes(RECEIPT_MARKER);
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function renderFinding(finding: ReceiptFindingView): string[] {
  const location = finding.line === undefined ? finding.path : `${finding.path}:${finding.line}`;
  return [
    `Finding: ${location}`,
    `Evidence: ${finding.evidence}`,
    `Consequence: ${finding.consequence}`,
    `Next action: ${finding.nextAction}`,
    ...(finding.unverifiedRemedy ? [`Unverified remedy: ${finding.unverifiedRemedy}`] : []),
  ];
}

export function renderReceipt(receipt: ReceiptView): string {
  const checks = receipt.checks.map(check => `${check.name}: ${check.status ?? 'unknown'}`);
  const inputTokens = receipt.tokenUsage.input ?? 'unknown';
  const outputTokens = receipt.tokenUsage.output ?? 'unknown';

  const summary = [
    `Reviewed revision: ${receipt.reviewedSha}`,
    `Run state: ${receipt.runState}`,
    ...(receipt.route
      ? [`Route: ${receipt.route === 'looks_ready' ? 'looks ready' : 'needs a human'}`]
      : []),
    `Reviewers: ${listOrNone(receipt.reviewers)}`,
    `Checks: ${listOrNone(checks)}`,
    `Skipped checks: ${listOrNone(receipt.skippedChecks)}`,
    `Unknowns: ${listOrNone(receipt.unknowns)}`,
    `Token usage: ${inputTokens} input, ${outputTokens} output`,
    `Findings: ${receipt.findingCounts.consequential} consequential, ${receipt.findingCounts.nonConsequential} non-consequential`,
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
): Promise<void> {
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
}
