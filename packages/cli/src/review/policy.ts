import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readCrossAgentReviewPolicy } from '../../templates/hooks/lib/review-ledger.js';
import type { ReviewAgent, ReviewAuthor, ReviewPolicy } from './contract.js';

export interface OppositeReviewPair {
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
}

export function oppositeReviewPair(author: ReviewAuthor): OppositeReviewPair | undefined {
  if (author === 'claude') return { author, reviewer: 'codex' };
  if (author === 'codex') return { author, reviewer: 'claude' };
  return undefined;
}

export function readReviewPolicy(cwd: string): ReviewPolicy {
  try {
    const raw = readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8');
    return readCrossAgentReviewPolicy(raw);
  } catch {
    return 'prefer';
  }
}
