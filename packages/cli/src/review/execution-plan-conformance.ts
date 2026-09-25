import type { ReviewKind } from './contract.js';
import type { ReviewRoute } from './policy.js';

export function filterExecutionPlanRoutes(
  _kind: ReviewKind,
  routes: readonly ReviewRoute[],
  _evidence?: unknown,
): readonly ReviewRoute[] {
  return routes;
}
