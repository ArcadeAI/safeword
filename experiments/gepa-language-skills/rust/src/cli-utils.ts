import { isAbsolute, resolve } from 'node:path';

import type { RustModelFamily, RustSecondaryMetrics } from './evaluator';
import { createDryRunCommandRunner, createNodeCommandRunner } from './process-runner';
import type { RustCommandRunner } from './runner';

export type RustCliMode = 'dry-run' | 'live';

interface CommonRustCliOptions {
  mode: RustCliMode;
  manifest: string;
  runRoot: string;
  artifact: string;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkillFile?: string;
  agentTrace: string;
  patchSummary: string;
  secondaryMetrics: RustSecondaryMetrics;
}

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

export function applyCommonRustCliFlag(
  options: CommonRustCliOptions,
  flag: string,
  value: string,
  cwd: string,
): boolean {
  switch (flag) {
    case '--manifest':
      options.manifest = resolveCliPath(cwd, value);
      return true;
    case '--run-root':
      options.runRoot = resolveCliPath(cwd, value);
      return true;
    case '--artifact':
      options.artifact = resolveCliPath(cwd, value);
      return true;
    case '--model-family':
      options.modelFamily = parseRustModelFamily(value);
      return true;
    case '--candidate-skill-id':
      options.candidateSkillId = value;
      return true;
    case '--candidate-skill-file':
      options.candidateSkillFile = resolveCliPath(cwd, value);
      return true;
    case '--agent-trace':
      options.agentTrace = value;
      return true;
    case '--patch-summary':
      options.patchSummary = value;
      return true;
    case '--diff-lines':
      options.secondaryMetrics.diffLines = parseNumericFlag(flag, value);
      return true;
    case '--duration-ms':
      options.secondaryMetrics.durationMs = parseNumericFlag(flag, value);
      return true;
    case '--lint-warnings':
      options.secondaryMetrics.lintWarnings = parseNumericFlag(flag, value);
      return true;
    case '--test-quality':
      options.secondaryMetrics.testQuality = parseNumericFlag(flag, value);
      return true;
    default:
      return false;
  }
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
