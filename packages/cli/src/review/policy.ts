import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readCrossAgentReviewPolicy } from '../../templates/hooks/lib/review-ledger.js';
import type { ReviewAgent, ReviewAuthor, ReviewPolicy } from './contract.js';

export interface OppositeReviewPair {
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
}

export interface ReviewRoutePlan {
  readonly author: ReviewAgent;
  readonly preferred: ReviewAgent;
  readonly independentFallback: ReviewAgent;
  readonly degradedFallback: ReviewAgent;
}

export function reviewRoutePlan(author: ReviewAuthor): ReviewRoutePlan | undefined {
  if (author === 'claude') {
    return {
      author,
      preferred: 'codex',
      independentFallback: 'opencode',
      degradedFallback: author,
    };
  }
  if (author === 'codex') {
    return {
      author,
      preferred: 'claude',
      independentFallback: 'opencode',
      degradedFallback: author,
    };
  }
  if (author === 'opencode') {
    return {
      author,
      preferred: 'claude',
      independentFallback: 'codex',
      degradedFallback: author,
    };
  }
  return undefined;
}

export function oppositeReviewPair(author: ReviewAuthor): OppositeReviewPair | undefined {
  const plan = reviewRoutePlan(author);
  return plan === undefined ? undefined : { author: plan.author, reviewer: plan.preferred };
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

const DEFAULT_PRIMARY_MODEL: Partial<Record<ReviewAgent, string>> = { claude: 'opus' };
const DEFAULT_ALTERNATE_MODEL: Partial<Record<ReviewAgent, string>> = { claude: 'sonnet' };

export function readPrimaryReviewerModel(cwd: string, reviewer: ReviewAgent): string | undefined {
  return (
    readReviewerModel(cwd, reviewer, 'PRIMARY', 'crossAgentReviewPrimaryModel') ??
    DEFAULT_PRIMARY_MODEL[reviewer]
  );
}

/**
 * The model Safeword should retry the reviewer agent on when its primary route
 * cannot complete. Explicit values override the Claude default; agents without
 * a default retain their authenticated profile behavior.
 */
export function readAlternateReviewerModel(cwd: string, reviewer: ReviewAgent): string | undefined {
  return (
    readReviewerModel(cwd, reviewer, 'ALTERNATE', 'crossAgentReviewAlternateModel') ??
    DEFAULT_ALTERNATE_MODEL[reviewer]
  );
}

function readReviewerModel(
  cwd: string,
  reviewer: ReviewAgent,
  route: 'PRIMARY' | 'ALTERNATE',
  configKey: 'crossAgentReviewPrimaryModel' | 'crossAgentReviewAlternateModel',
): string | undefined {
  const environmentValue = process.env[`SAFEWORD_REVIEW_${route}_MODEL_${reviewer.toUpperCase()}`];
  if (environmentValue !== undefined && MODEL_NAME.test(environmentValue)) return environmentValue;
  const configuredValue = readConfiguredModel(cwd, reviewer, configKey);
  return configuredValue !== undefined && MODEL_NAME.test(configuredValue)
    ? configuredValue
    : undefined;
}

function readConfiguredModel(
  cwd: string,
  reviewer: ReviewAgent,
  configKey: 'crossAgentReviewPrimaryModel' | 'crossAgentReviewAlternateModel',
): string | undefined {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8'),
    );
    if (typeof raw !== 'object' || raw === null) return undefined;
    const models = (raw as Record<string, unknown>)[configKey];
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
    const config: unknown = JSON.parse(raw);
    if (typeof config !== 'object' || config === null || Array.isArray(config)) return 'require';
    return readCrossAgentReviewPolicy(raw);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'prefer' : 'require';
  }
}
