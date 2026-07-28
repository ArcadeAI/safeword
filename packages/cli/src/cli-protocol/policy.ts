import type { CommandDefinition } from './catalog.js';
import type { CliResult } from './result.js';

export function assertEffectPolicy(
  _definition: CommandDefinition,
  _result: CliResult,
  _options: { offline: boolean },
): void {
  throw new Error('Not implemented');
}

export function createProgressReporter(_adapters: {
  schedule: (callback: () => void) => unknown;
  cancel: (handle: unknown) => void;
  emit: (message: string) => void;
}): {
  start: (message: string) => void;
  stop: () => void;
} {
  throw new Error('Not implemented');
}
