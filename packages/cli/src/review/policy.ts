import type { ReviewAgent, ReviewAuthor } from './contract.js';

export interface OppositeReviewPair {
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
}

export function oppositeReviewPair(author: ReviewAuthor): OppositeReviewPair | undefined {
  if (author === 'claude') return { author, reviewer: 'codex' };
  if (author === 'codex') return { author, reviewer: 'claude' };
  return undefined;
}
