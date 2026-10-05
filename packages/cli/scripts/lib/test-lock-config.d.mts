export const defaultMaximumLockWaitMilliseconds: number;
export const lockBusyExitCode: number;

export function resolveSafeIntegerEnvironmentVariable(
  name: string,
  fallback: number,
  minimum: number,
  allowZero?: boolean,
): number;
