import type { CommandDefinition } from './catalog.js';
import type { CliResult, Effects } from './result.js';

function firstNonEmptyEffect(effects: Effects): keyof Effects | undefined {
  return (Object.keys(effects) as (keyof Effects)[]).find(
    effectClass => effects[effectClass].length > 0,
  );
}

export function assertEffectPolicy(
  definition: CommandDefinition,
  result: CliResult,
  options: { offline: boolean },
): void {
  if (options.offline && result.effects.network.length > 0) {
    throw new Error(`Command ${definition.name} reported network effects while running offline`);
  }

  if (definition.effectClass === 'observe' || definition.effectClass === 'plan') {
    const effectClass = firstNonEmptyEffect(result.effects);
    if (effectClass !== undefined) {
      throw new Error(
        `The ${definition.effectClass} command ${definition.name} reported ${effectClass.slice(0, -1)} effects`,
      );
    }
  }

  if (
    definition.effectClass === 'hook' &&
    (result.effects.packages.length > 0 ||
      result.effects.network.length > 0 ||
      result.effects.destructive.length > 0)
  ) {
    throw new Error(`Hook command ${definition.name} reported forbidden lifecycle effects`);
  }
}

interface ProgressAdapters {
  readonly schedule: (callback: () => void, delayMilliseconds: number) => unknown;
  readonly cancel: (handle: unknown) => void;
  readonly emit: (message: string) => void;
}

export function createProgressReporter(adapters: ProgressAdapters): {
  start: (message: string) => void;
  stop: () => void;
} {
  let scheduledHandle: unknown;
  return {
    start(message: string): void {
      if (scheduledHandle !== undefined) adapters.cancel(scheduledHandle);
      scheduledHandle = adapters.schedule(() => {
        adapters.emit(message);
        scheduledHandle = undefined;
      }, 100);
    },
    stop(): void {
      if (scheduledHandle === undefined) return;
      adapters.cancel(scheduledHandle);
      scheduledHandle = undefined;
    },
  };
}
