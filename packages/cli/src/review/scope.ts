import { AsyncLocalStorage } from 'node:async_hooks';

interface ReviewScope {
  excludedTargets?: readonly string[];
}

const reviewScope = new AsyncLocalStorage<ReviewScope>();

export function withReviewScope<T>(
  run: () => Promise<T>,
): Promise<{ result: T; scope: ReviewScope }> {
  const scope: ReviewScope = {};
  return reviewScope.run(scope, async () => ({ result: await run(), scope }));
}

export function recordFinalizedScope(excludedTargets: readonly string[]): void {
  const scope = reviewScope.getStore();
  if (scope !== undefined) scope.excludedTargets = [...excludedTargets];
}
