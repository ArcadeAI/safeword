import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { SAFEWORD_SCHEMA } from '../schema.js';
import { CODEX_MIGRATION_SCHEMA } from './inventory.js';

type LegacyHook = { command?: unknown; type?: unknown };
type LegacyHookGroup = { hooks?: unknown };
type LegacyConfig = { hooks?: unknown };

function regularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function eventCommands(config: LegacyConfig, eventName: string): string[] {
  if (typeof config.hooks !== 'object' || config.hooks === null) return [];
  const groups = (config.hooks as Record<string, unknown>)[eventName];
  if (!Array.isArray(groups)) return [];

  return groups.flatMap(group => {
    const hooks = (group as LegacyHookGroup).hooks;
    if (!Array.isArray(hooks)) return [];
    return hooks.flatMap(hook => {
      const candidate = hook as LegacyHook;
      return candidate.type === 'command' && typeof candidate.command === 'string'
        ? [candidate.command]
        : [];
    });
  });
}

function packageCommandMatches(command: string, event: string): boolean {
  const prefix = `${SAFEWORD_SCHEMA.codexMigration.packageRunner} --yes safeword`;
  return command === `${prefix} hook codex ${event}` || command === `${prefix} codex-hook ${event}`;
}

function scriptFromCommand(command: string): string | undefined {
  const prefix = SAFEWORD_SCHEMA.codexMigration.hookScriptPrefix;
  if (!command.startsWith(prefix)) return undefined;
  const remainder = command.slice(prefix.length);
  const quote = remainder.indexOf('"');
  if (quote === -1) return undefined;
  const script = remainder.slice(0, quote);
  if (SAFEWORD_SCHEMA.codexMigration.hookScriptEvents[script] === undefined) return undefined;
  const arguments_ = remainder.slice(quote + 1);
  if (
    arguments_ !== '' &&
    !(script === 'session-safeword-context.ts' && arguments_ === ' --agent=codex')
  ) {
    return undefined;
  }
  return script;
}

function packageRunnerIsAvailable(cwd: string, environment: NodeJS.ProcessEnv): boolean {
  const result = spawnSync(SAFEWORD_SCHEMA.codexMigration.packageRunner, ['--version'], {
    cwd,
    env: environment,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function commandIsViable(
  command: string,
  event: string,
  cwd: string,
  environment: NodeJS.ProcessEnv,
): boolean {
  if (packageCommandMatches(command, event)) {
    return (
      regularFile(nodePath.join(cwd, SAFEWORD_SCHEMA.codexMigration.projectMarker)) &&
      packageRunnerIsAvailable(cwd, environment)
    );
  }

  const script = scriptFromCommand(command);
  return (
    script !== undefined &&
    SAFEWORD_SCHEMA.codexMigration.hookScriptEvents[script] === event &&
    regularFile(nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.hookRuntimeRoot, script))
  );
}

export function legacyCodexEventIsViable(
  cwd: string,
  event: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const eventName = SAFEWORD_SCHEMA.codexMigration.hookEventNames[event];
  if (eventName === undefined) return false;

  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  if (!regularFile(configPath)) return false;

  let config: LegacyConfig;
  try {
    config = parse(readFileSync(configPath, 'utf8'));
  } catch {
    return false;
  }

  return eventCommands(config, eventName).some(command =>
    commandIsViable(command, event, cwd, environment),
  );
}
