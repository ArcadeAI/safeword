import process from 'node:process';

import type { Command } from 'commander';

import { commandCatalog, type CommandDefinition, findCommandDefinition } from './catalog.js';
import {
  addGlobalOptions,
  readCommandOptions,
  readGlobalOptions,
  reportResult,
} from './execute.js';
import { createProgressReporter } from './policy.js';
import { createResult, withDeprecation } from './result.js';

const FAMILY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  project: 'Manage project-local Safeword state',
  tracker: 'Manage tracker connections and synchronization',
  codex: 'Manage the Safeword Codex plugin',
  ticket: 'Manage project tickets',
  retro: 'Inspect and file Safeword runtime findings',
  migrate: 'Compatibility migration commands',
};

function firstPathSegment(name: string): string {
  const first = name.split(' ', 1)[0];
  if (first === undefined) throw new Error('Command name cannot be empty');
  return first;
}

function familyNames(): Set<string> {
  return new Set(
    commandCatalog
      .filter(definition => definition.public && definition.name.includes(' '))
      .map(definition => firstPathSegment(definition.name)),
  );
}

function registerFamilies(program: Command): Map<string, Command> {
  const families = new Map<string, Command>();
  for (const name of familyNames()) {
    const family = program
      .command(name, { hidden: name === 'migrate' })
      .description(FAMILY_DESCRIPTIONS[name] ?? `Manage ${name} operations`);
    families.set(name, family);
  }
  return families;
}

function addDefinitionOptions(command: Command, definition: CommandDefinition): void {
  for (const option of definition.registration.options) {
    if (option.defaultValue === undefined) {
      command.option(option.flags, option.description);
    } else {
      command.option(option.flags, option.description, option.defaultValue);
    }
  }
}

function definitionCommand(
  program: Command,
  families: ReadonlyMap<string, Command>,
  definition: CommandDefinition,
): Command {
  const path = definition.name.split(' ');
  if (path.length === 1) {
    const family = families.get(definition.name);
    if (family !== undefined) return family;
    return program.command(definition.registration.syntax, {
      hidden: definition.aliasFor !== undefined,
    });
  }

  const parent = families.get(firstPathSegment(definition.name));
  if (parent === undefined) {
    throw new Error(`Missing command family for ${definition.name}`);
  }
  return parent.command(definition.registration.syntax, {
    hidden: definition.aliasFor !== undefined,
  });
}

async function executeDefinition(command: Command, definition: CommandDefinition): Promise<void> {
  const globalOptions = readGlobalOptions(command);
  const progress =
    globalOptions.json || globalOptions.quiet
      ? undefined
      : createProgressReporter({
          schedule: (callback, delay) => setTimeout(callback, delay),
          cancel: handle => {
            clearTimeout(handle as ReturnType<typeof setTimeout>);
          },
          emit: message => process.stderr.write(`${message}\n`),
        });
  let result;
  try {
    try {
      result = await definition.handler({
        cwd: globalOptions.cwd,
        noInput: globalOptions.noInput,
        offline: globalOptions.offline,
        options: readCommandOptions(command),
        operands: command.processedArgs,
        progress,
      });
    } catch (handlerError) {
      result = createResult({
        state: 'failed',
        errors: [
          {
            code: 'COMMAND_EXECUTION_FAILED',
            message: handlerError instanceof Error ? handlerError.message : String(handlerError),
            retryable: false,
          },
        ],
      });
    }
  } finally {
    progress?.stop();
  }
  if (definition.aliasFor !== undefined) {
    result = withDeprecation(result, definition.name, definition.aliasFor);
  }
  reportResult(result, globalOptions, definition.name);
}

function addDefinitionAction(command: Command, definition: CommandDefinition): void {
  addGlobalOptions(command);
  addDefinitionOptions(command, definition);
  if (definition.aliasFor === undefined || !familyNames().has(definition.name)) {
    command.description(definition.description);
  }
  command.action(async (...actionArguments: unknown[]) => {
    const actionCommand = actionArguments.at(-1);
    if (actionCommand !== command) {
      throw new Error(`Commander did not supply the command boundary for ${definition.name}`);
    }
    await executeDefinition(command, definition);
  });
}

export function registerPublicCommandCatalog(program: Command): void {
  const families = registerFamilies(program);
  for (const definition of commandCatalog) {
    if (!definition.public) continue;
    addDefinitionAction(definitionCommand(program, families, definition), definition);
  }

  program.action(async () => {
    const definition = findCommandDefinition('status');
    await executeDefinition(program, definition);
  });
}
