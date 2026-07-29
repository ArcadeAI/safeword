import { CODEX_MIGRATION_SCHEMA } from './inventory.js';

export type LegacyCommandIdentity =
  | {
      readonly kind: 'package';
      readonly event: string;
    }
  | {
      readonly kind: 'script';
      readonly event: string;
      readonly script: string;
    };

function commandParts(command: string): string[] {
  return command
    .trim()
    .split(' ')
    .filter(part => part !== '');
}

function isHistoricalPackagePrefix(parts: readonly string[]): boolean {
  return (
    parts[0] === CODEX_MIGRATION_SCHEMA.packageRunner &&
    parts[1] === '--yes' &&
    parts[2] === 'safeword'
  );
}

function packagedHookEvent(hook: readonly string[]): string | undefined {
  if (
    hook.length === 3 &&
    hook[0] === 'hook' &&
    hook[1] === 'codex' &&
    CODEX_MIGRATION_SCHEMA.hookEvents.includes(hook[2] ?? '')
  ) {
    return hook[2];
  }
  if (
    hook.length === 2 &&
    hook[0] === 'codex-hook' &&
    CODEX_MIGRATION_SCHEMA.hookEvents.includes(hook[1] ?? '')
  ) {
    return hook[1];
  }
  return undefined;
}

function packageIdentity(command: string): LegacyCommandIdentity | undefined {
  const parts = commandParts(command);
  if (!isHistoricalPackagePrefix(parts)) return undefined;
  const event = packagedHookEvent(parts.slice(3));
  return event === undefined ? undefined : { kind: 'package', event };
}

function scriptIdentity(command: string): LegacyCommandIdentity | undefined {
  const prefix = CODEX_MIGRATION_SCHEMA.hookScriptPrefix;
  if (!command.startsWith(prefix)) return undefined;
  const remainder = command.slice(prefix.length);
  const quote = remainder.indexOf('"');
  if (quote === -1) return undefined;
  const script = remainder.slice(0, quote);
  const event = CODEX_MIGRATION_SCHEMA.hookScriptEvents[script];
  if (event === undefined) return undefined;
  const arguments_ = remainder.slice(quote + 1);
  const supportedArguments =
    arguments_ === '' ||
    (script === 'session-safeword-context.ts' && arguments_ === ' --agent=codex');
  return supportedArguments ? { kind: 'script', event, script } : undefined;
}

export function legacyCommandIdentity(command: string): LegacyCommandIdentity | undefined {
  return packageIdentity(command) ?? scriptIdentity(command);
}
