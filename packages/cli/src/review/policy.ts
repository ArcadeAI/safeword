import type { ReviewAgent, ReviewAuthor } from './contract.js';

export function oppositeReviewer(author: ReviewAuthor): ReviewAgent | undefined {
  if (author === 'claude') return 'codex';
  if (author === 'codex') return 'claude';
  return undefined;
}
