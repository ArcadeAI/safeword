import process from 'node:process';

/** Keep focused feedback prompt; callers can explicitly opt into a longer wait. */
export const defaultMaximumLockWaitMilliseconds = 60_000;

export function resolveSafeIntegerEnvironmentVariable(name, fallback, minimum, allowZero = true) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  const isValid = Number.isSafeInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
  return isValid ? Math.max(parsed, minimum) : fallback;
}
