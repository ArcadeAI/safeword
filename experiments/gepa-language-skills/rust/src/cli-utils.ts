import { isAbsolute, resolve } from 'node:path';

import type { RustModelFamily, RustSecondaryMetrics } from './evaluator';
import { createDryRunCommandRunner, createNodeCommandRunner } from './process-runner';
import type { RustCommandRunner } from './runner';

export type RustCliMode = 'dry-run' | 'live';

export function createRustCommandRunner<Mode extends RustCliMode>(
  mode: Mode,
  factory?: (mode: Mode) => RustCommandRunner,
): RustCommandRunner {
  if (factory) return factory(mode);
  return mode === 'live' ? createNodeCommandRunner() : createDryRunCommandRunner();
}

export function emptyRustSecondaryMetrics(): RustSecondaryMetrics {
  return {
    diffLines: 0,
    durationMs: 0,
    lintWarnings: 0,
    testQuality: 0,
  };
}

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

export function requiredFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function resolveCliPath(cwd: string, path: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}
