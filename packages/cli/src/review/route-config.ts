import type { ReviewAgent } from './contract.js';

export interface ReviewRoute {
  readonly reviewer: ReviewAgent;
  readonly model?: string;
  readonly independence: 'cross-agent' | 'degraded';
}

/**
 * An accepted model value: 1-200 characters of ASCII letters, digits, dot,
 * underscore, colon, slash or hyphen, never leading with a hyphen. Real model
 * identifiers fit (`claude-sonnet-4-5-20250929`, `vendor/model:tag`), while
 * whitespace, control characters, shell metacharacters and option-like values
 * do not. Safeword passes the value as its own argument and never through a
 * shell, so this is a second line of defence rather than the only one.
 */
export const MODEL_NAME = /^[\w.:/][\w.:/-]{0,199}$/u;
const REVIEW_AGENTS = new Set<ReviewAgent>(['claude', 'codex', 'opencode']);

export function parseConfiguredReviewRoutes(
  config: Record<string, unknown>,
  author: ReviewAgent,
): readonly ReviewRoute[] | undefined {
  const configured = config.crossAgentReviewRoutes;
  if (configured === undefined) return undefined;
  if (!isRecord(configured) || Array.isArray(configured)) throw configError('must be an object');
  const values = configured[author];
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0)
    throw configError(`.${author} must be a non-empty array`);
  return values.map((value, index) => parseRoute(value, index, author));
}

export function parseRouteText(value: string, author: ReviewAgent): ReviewRoute {
  const separator = value.indexOf('=');
  return parseRoute(
    {
      reviewer: separator === -1 ? value : value.slice(0, separator),
      ...(separator !== -1 && { model: value.slice(separator + 1) }),
    },
    0,
    author,
  );
}

function parseRoute(value: unknown, index: number, author: ReviewAgent): ReviewRoute {
  if (!isRecord(value) || Array.isArray(value))
    throw configError(`.${author}[${index}] must be an object`);
  const reviewer = value.reviewer;
  if (typeof reviewer !== 'string' || !REVIEW_AGENTS.has(reviewer as ReviewAgent))
    throw configError(`.${author}[${index}].reviewer is unsupported`);
  const model = value.model;
  if (model !== undefined && (typeof model !== 'string' || !MODEL_NAME.test(model)))
    throw configError(`.${author}[${index}].model is invalid`);
  return {
    reviewer: reviewer as ReviewAgent,
    ...(model !== undefined && { model }),
    independence: reviewer === author ? 'degraded' : 'cross-agent',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function configError(detail: string): Error {
  return new Error(`Invalid crossAgentReviewRoutes configuration: ${detail}`);
}
