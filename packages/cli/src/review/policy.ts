import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readCrossAgentReviewPolicy } from '../../templates/hooks/lib/review-ledger.js';
import type { ReviewAgent, ReviewAuthor, ReviewPolicy, SupportedReviewAuthor } from './contract.js';
import { effectiveConfiguredRoutes } from './preferences.js';
import { MODEL_NAME, type ReviewRoute } from './route-config.js';

export type { ReviewRoute } from './route-config.js';

export interface ReviewRoutePlan {
  readonly author: SupportedReviewAuthor;
  readonly preferred: ReviewAgent;
  readonly independentFallback: ReviewAgent;
  readonly degradedFallback?: ReviewAgent;
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
  if (author === 'cursor') {
    return {
      author,
      preferred: 'claude',
      independentFallback: 'codex',
    };
  }
  return undefined;
}

// Every review kind uses each agent's latest flagship first and retries on its
// smaller sibling. Claude's `opus`/`sonnet` aliases track the newest release;
// Codex has no alias, so update these names when a new Sol or Terra ships.
const DEFAULT_PRIMARY_MODEL: Partial<Record<ReviewAgent, string>> = {
  claude: 'opus',
  codex: 'gpt-6.1-sol',
};
const DEFAULT_ALTERNATE_MODEL: Partial<Record<ReviewAgent, string>> = {
  claude: 'sonnet',
  codex: 'gpt-6.1-terra',
};

export function readConfiguredReviewRoutes(
  cwd: string,
  author: ReviewAuthor,
): readonly ReviewRoute[] | undefined {
  const plan = reviewRoutePlan(author);
  if (plan === undefined) return undefined;
  return effectiveConfiguredRoutes(cwd, author)?.routes;
}

/**
 * The models Safeword asks one reviewer agent for, in order: its primary model,
 * then its alternate when different. An agent with neither runs its default.
 * Every route, preferred or fallback, uses this one chain.
 */
export function reviewerModelChain(
  cwd: string,
  reviewer: ReviewAgent,
): readonly (string | undefined)[] {
  const primary = readPrimaryReviewerModel(cwd, reviewer);
  const alternate = readAlternateReviewerModel(cwd, reviewer);
  return alternate !== undefined && alternate !== primary ? [primary, alternate] : [primary];
}

function agentRoutes(
  cwd: string,
  reviewer: ReviewAgent,
  independence: ReviewRoute['independence'],
): readonly ReviewRoute[] {
  return reviewerModelChain(cwd, reviewer).map(model => ({
    reviewer,
    ...(model !== undefined && { model }),
    independence,
  }));
}

export function builtInReviewRoutes(
  cwd: string,
  author: SupportedReviewAuthor,
): readonly ReviewRoute[] {
  const plan = reviewRoutePlan(author);
  if (plan === undefined) return [];
  return [
    ...agentRoutes(cwd, plan.preferred, 'cross-agent'),
    ...agentRoutes(cwd, plan.independentFallback, 'cross-agent'),
    ...(plan.degradedFallback === undefined
      ? []
      : agentRoutes(cwd, plan.degradedFallback, 'degraded')),
  ];
}

export function readPrimaryReviewerModel(cwd: string, reviewer: ReviewAgent): string | undefined {
  return (
    readReviewerModel(cwd, reviewer, 'PRIMARY', 'crossAgentReviewPrimaryModel') ??
    DEFAULT_PRIMARY_MODEL[reviewer]
  );
}

/**
 * The model Safeword should retry the reviewer agent on when its primary route
 * cannot complete. Explicit values override the built-in Claude and Codex
 * defaults; agents without one (OpenCode) keep their authenticated profile.
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
    if (typeof config !== 'object' || config === null || Array.isArray(config)) return 'prefer';
    return readCrossAgentReviewPolicy(raw);
  } catch {
    return 'prefer';
  }
}
