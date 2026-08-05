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
