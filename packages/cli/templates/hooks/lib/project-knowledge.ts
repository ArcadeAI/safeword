export type ReviewKnowledgeKey = 'principles' | 'personas' | 'surfaces';

export interface ReviewKnowledgeSource {
  key: ReviewKnowledgeKey;
  configured: boolean;
  path: string;
  exists: boolean;
  content: string | null;
}

/** Resolve project knowledge immediately before an independent review. */
export function resolveReviewKnowledgeSources(_projectDirectory: string): ReviewKnowledgeSource[] {
  return [];
}
