import { accessSync, constants, lstatSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { SAFEWORD_SCHEMA } from '../schema.js';
import { CODEX_MIGRATION_SCHEMA } from './inventory.js';
import { legacyCommandIdentity } from './legacy-command.js';

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

function packageRunnerIsAvailable(cwd: string, environment: NodeJS.ProcessEnv): boolean {
  const runner = SAFEWORD_SCHEMA.codexMigration.packageRunner;
  const pathEntries = (environment.PATH ?? '').split(nodePath.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32' ? (environment.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  return pathEntries.some(entry =>
    extensions.some(extension => {
      const candidate = nodePath.resolve(cwd, entry, `${runner}${extension.toLowerCase()}`);
      try {
        accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
        return regularFile(candidate);
      } catch {
        return false;
      }
    }),
  );
}

function commandIsViable(
  command: string,
  event: string,
  cwd: string,
  environment: NodeJS.ProcessEnv,
): boolean {
  const identity = legacyCommandIdentity(command);
  if (identity?.event !== event) return false;
  if (identity.kind === 'package') {
    return (
      regularFile(nodePath.join(cwd, SAFEWORD_SCHEMA.codexMigration.projectMarker)) &&
      packageRunnerIsAvailable(cwd, environment)
    );
  }
  return (
    identity.kind === 'script' &&
    regularFile(nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.hookRuntimeRoot, identity.script))
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
