import { isAbsolute, resolve } from 'node:path';

import type { RustModelFamily } from './evaluator';

export function parseRustModelFamily(value: string): RustModelFamily {
  if (value === 'claude-opus' || value === 'gpt-codex') return value;
  throw new Error(`--model-family must be claude-opus or gpt-codex, got: ${value}`);
}

export function parseNumericFlag(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be numeric`);
  }
  return parsed;
}

export function resolveCliPath(cwd: string, path: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}
