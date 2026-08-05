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
      marker: comment.body.includes(RECEIPT_MARKER) ? 'exact' : 'absent',
    })),
  );
  const body = `${RECEIPT_MARKER}\n${renderedReceipt}`;

  if (plan.canonicalCommentId === undefined) await publisher.createComment(body);
  else await publisher.updateComment(plan.canonicalCommentId, body);

  for (const duplicateCommentId of plan.duplicateCommentIds) {
    await publisher.deleteComment(duplicateCommentId);
  }
}
