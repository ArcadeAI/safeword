import { appendFileSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

export const RETRO_DEBUG_LOG_ENV = 'SAFEWORD_RETRO_DEBUG_LOG';

type DebugValue =
  string | number | boolean | null | undefined | DebugValue[] | { [key: string]: DebugValue };

export type RetroDebugEvent = {
  event: string;
  [key: string]: DebugValue;
};

const REDACTED = '[redacted]';
const REDACT_KEY_PATTERN =
  /^(?:transcript|transcriptText|transcriptContent|prompt|stdout|stderr|findings|rawFindings|body)$/i;

function sanitizeDebugValue(key: string, value: DebugValue): DebugValue {
  if (value === undefined) return undefined;
  if (REDACT_KEY_PATTERN.test(key)) return REDACTED;
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDebugValue(key, item));
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, DebugValue> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const clean = sanitizeDebugValue(childKey, childValue);
      if (clean !== undefined) sanitized[childKey] = clean;
    }
    return sanitized;
  }
  return value;
}

function sanitizedEvent(event: RetroDebugEvent): Record<string, DebugValue> {
  const result: Record<string, DebugValue> = {};
  for (const [key, value] of Object.entries(event)) {
    const clean = sanitizeDebugValue(key, value);
    if (clean !== undefined) result[key] = clean;
  }
  return result;
}

export function recordRetroDebugEvent(
  event: RetroDebugEvent,
  env: Record<string, string | undefined> = process.env,
): void {
  const logPath = env[RETRO_DEBUG_LOG_ENV];
  if (!logPath) return;
  try {
    mkdirSync(nodePath.dirname(logPath), { recursive: true });
    appendFileSync(
      logPath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...sanitizedEvent(event) })}\n`,
    );
  } catch {
    // Debugging must never make a hook or CLI run visible or blocking.
  }
}
