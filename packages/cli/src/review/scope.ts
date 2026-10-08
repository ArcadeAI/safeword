import { AsyncLocalStorage } from 'node:async_hooks';

export type AuthenticationReviewer = 'claude' | 'codex';
export interface ReviewContinuation {
  readonly reviewer: AuthenticationReviewer;
  readonly model?: string;
  readonly executable: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly validate: () => void;
}

interface ReviewScope {
  excludedTargets?: readonly string[];
  continuation?: ReviewContinuation;
}

const reviewScope = new AsyncLocalStorage<ReviewScope>();

export function withReviewScope<T>(
  run: () => Promise<T>,
  continuation?: ReviewContinuation,
): Promise<{ result: T; scope: ReviewScope }> {
  const scope: ReviewScope = { continuation };
  return reviewScope.run(scope, async () => ({ result: await run(), scope }));
}

export function reviewContinuation(): ReviewContinuation | undefined {
  return reviewScope.getStore()?.continuation;
}

export function recordFinalizedScope(excludedTargets: readonly string[]): void {
  const scope = reviewScope.getStore();
  if (scope !== undefined) scope.excludedTargets = [...excludedTargets];
}
