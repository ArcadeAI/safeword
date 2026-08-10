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

/**
 * An accepted alternate model value: 1-200 characters of ASCII letters, digits,
 * dot, underscore, colon, slash or hyphen, never leading with a hyphen. Real
 * model identifiers fit (`claude-sonnet-4-5-20250929`, `vendor/model:tag`);
 * whitespace, control characters, shell metacharacters and option-like values
 * do not. Safeword passes the value as its own argument and never through a
 * shell, so this is a second line of defence rather than the only one.
 */
const MODEL_NAME = /^[\w.:/][\w.:/-]{0,199}$/u;

/**
 * The model Safeword should retry the reviewer agent on when its default
 * cannot complete. Safeword never supplies a model of its own: an absent,
 * malformed, or unusable value reads as "none configured", which keeps routing
 * exactly as it is today.
 */
export function readAlternateReviewerModel(cwd: string, reviewer: ReviewAgent): string | undefined {
  // Each source is validated on its own, so an unusable environment override
  // reads as "not set" and falls through to the configured value rather than
  // silently masking it.
  const sources = [
    process.env[`SAFEWORD_REVIEW_ALTERNATE_MODEL_${reviewer.toUpperCase()}`],
    readConfiguredAlternateModel(cwd, reviewer),
  ];
  return sources.find(value => value !== undefined && MODEL_NAME.test(value));
}

function readConfiguredAlternateModel(cwd: string, reviewer: ReviewAgent): string | undefined {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8'),
    );
    if (typeof raw !== 'object' || raw === null) return undefined;
    const models = (raw as Record<string, unknown>).crossAgentReviewAlternateModel;
    if (typeof models !== 'object' || models === null) return undefined;
    const value = (models as Record<string, unknown>)[reviewer];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readReviewPolicy(cwd: string): ReviewPolicy {
  try {
    const raw = readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8');
    return readCrossAgentReviewPolicy(raw);
  } catch {
    return 'prefer';
  }
}
