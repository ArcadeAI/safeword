import type { CommandDefinition } from './catalog.js';
import type { ProgressReporter } from './handler.js';
import type { CliResult, Effects } from './result.js';

const EFFECT_NOUNS: Readonly<Record<keyof Effects, string>> = {
  files: 'file',
  packages: 'package',
  configuration: 'configuration',
  network: 'network',
  destructive: 'destructive',
};

function firstNonEmptyEffect(effects: Effects): keyof Effects | undefined {
  return (Object.keys(effects) as (keyof Effects)[]).find(
    effectClass => effects[effectClass].length > 0,
  );
}

function assertNetworkPolicy(
  definition: CommandDefinition,
  result: CliResult,
  offline: boolean,
): void {
  if (offline && result.effects.network.length > 0) {
    throw new Error(`Command ${definition.name} reported network effects while running offline`);
  }
  if (definition.networkPolicy === 'never' && result.effects.network.length > 0) {
    throw new Error(`Command ${definition.name} reported undeclared network effects`);
  }
}

export function assertEffectPolicy(
  definition: CommandDefinition,
  result: CliResult,
  options: { offline: boolean },
): void {
  assertNetworkPolicy(definition, result, options.offline);

  if (definition.effectClass === 'observe' || definition.effectClass === 'plan') {
    const effectClass = firstNonEmptyEffect(result.effects);
    if (effectClass !== undefined) {
      throw new Error(
        `The ${definition.effectClass} command ${definition.name} reported ${EFFECT_NOUNS[effectClass]} effects`,
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

const MANAGED_PROGRESS_SIGNAL = 'SAFEWORD_REVIEW_PROGRESS';

export function consumeManagedProgressSignal(environment: NodeJS.ProcessEnv): boolean {
  const enabled = environment[MANAGED_PROGRESS_SIGNAL] === '1';
  Reflect.deleteProperty(environment, MANAGED_PROGRESS_SIGNAL);
  return enabled;
}

export function shouldReportProgress(options: {
  readonly json: boolean;
  readonly managedReview: boolean;
  readonly quiet: boolean;
}): boolean {
  return !options.quiet && (!options.json || options.managedReview);
}

export function createBestEffortProgressSink(
  write: (message: string) => void,
): (message: string) => void {
  return message => {
    try {
      write(`${message}\n`);
    } catch {
      // Progress is advisory and must never affect the typed command result.
    }
  };
}

export function createManagedReviewProgress(progress: ProgressReporter): ProgressReporter {
  return {
    managed: true,
    start(message, phase): void {
      if (phase === 'preparation') return;
      if (phase === undefined) progress.start(message);
      else progress.start(message, phase);
    },
    heartbeat: progress.heartbeat?.bind(progress),
    stop: progress.stop.bind(progress),
  };
}

/** Operations finishing faster than this are not worth announcing. */
const PROGRESS_ANNOUNCE_DELAY_MS = 100;
/** A long wait needs proof that the coordinator is still responsive. */
const PROGRESS_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Shorten the heartbeat so a test can observe a real one without waiting 30
 * seconds. Internal: a value outside 1ms..30s is ignored.
 */
export function resolveHeartbeatIntervalMs(environment: NodeJS.ProcessEnv = process.env): number {
  const override = Number(environment.SAFEWORD_PROGRESS_HEARTBEAT_MS);
  if (
    !Number.isSafeInteger(override) ||
    override < 1 ||
    override > PROGRESS_HEARTBEAT_INTERVAL_MS
  ) {
    return PROGRESS_HEARTBEAT_INTERVAL_MS;
  }
  return override;
}

export function createProgressReporter(adapters: ProgressAdapters): ProgressReporter {
  let announcementHandle: unknown;
  let heartbeatHandle: unknown;
  const heartbeatIntervalMs = resolveHeartbeatIntervalMs();

  function scheduleHeartbeat(message: string): void {
    heartbeatHandle = adapters.schedule(() => {
      adapters.emit(message);
      scheduleHeartbeat(message);
    }, heartbeatIntervalMs);
  }

  return {
    start(message: string): void {
      if (announcementHandle !== undefined) adapters.cancel(announcementHandle);
      if (heartbeatHandle !== undefined) adapters.cancel(heartbeatHandle);
      heartbeatHandle = undefined;
      announcementHandle = adapters.schedule(() => {
        adapters.emit(message);
        announcementHandle = undefined;
      }, PROGRESS_ANNOUNCE_DELAY_MS);
    },
    heartbeat(message: string): void {
      if (heartbeatHandle !== undefined) adapters.cancel(heartbeatHandle);
      scheduleHeartbeat(message);
    },
    stop(): void {
      if (announcementHandle !== undefined) adapters.cancel(announcementHandle);
      if (heartbeatHandle !== undefined) adapters.cancel(heartbeatHandle);
      announcementHandle = undefined;
      heartbeatHandle = undefined;
    },
  };
}
