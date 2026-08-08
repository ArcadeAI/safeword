import process from 'node:process';

import { type Command, InvalidArgumentError, Option } from 'commander';

import {
  commandCatalog,
  type CommandDefinition,
  compatibilityRoutes,
  findCommandDefinition,
} from './catalog.js';
import {
  addGlobalOptions,
  readCommandOptions,
  readGlobalOptions,
  reportResult,
} from './execute.js';
import { isPlanIdentity } from './plan.js';
import { createProgressReporter } from './policy.js';
import { type CliResult, createResult, withDeprecation } from './result.js';

const FAMILY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  project: 'Manage project-local Safeword state',
  tracker: 'Manage tracker connections and synchronization',
  codex: 'Manage the Safeword Codex plugin',
  ticket: 'Manage project tickets',
  review: 'Run independent adversarial reviews',
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
    const commanderOption = new Option(option.flags, option.description);
    if (option.defaultValue !== undefined) commanderOption.default(option.defaultValue);
    if (option.valueKind === 'plan-identity') {
      commanderOption.argParser(value => {
        if (!isPlanIdentity(value)) {
          throw new InvalidArgumentError(
            'plan identity must be the 64-character hexadecimal id returned by the latest preview',
          );
        }
        return value;
      });
    } else if (option.valueKind === 'claude-plugin-scope') {
      commanderOption.argParser(value => {
        if (value !== 'project' && value !== 'user') {
          throw new InvalidArgumentError('scope must be either project or user');
        }
        return value;
      });
    }
    command.addOption(commanderOption);
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

function withCompatibilityDeprecation(
  result: CliResult,
  definition: CommandDefinition,
  commandOptions: Readonly<Record<string, unknown>> = {},
): CliResult {
  if (definition.aliasFor !== undefined) {
    if (definition.compatibility === undefined) {
      throw new Error(`Missing compatibility policy for retained alias ${definition.name}`);
    }
    // `replacement` names the scoped canonical route (`install --agents=claude`)
    // where the alias maps to more than the bare canonical command name.
    return withDeprecation(
      result,
      definition.name,
      definition.compatibility.replacement ?? definition.aliasFor,
      definition.compatibility,
      commandOptions,
    );
  }
  if (definition.name !== 'retro run' || process.env.SAFEWORD_CLI_RETAINED_ALIAS !== 'retro') {
    return result;
  }

  const alias = findCommandDefinition('retro');
  if (alias.aliasFor === undefined || alias.compatibility === undefined) {
    throw new Error('Missing compatibility policy for retained alias retro');
  }
  return withDeprecation(
    result,
    alias.name,
    alias.compatibility.replacement ?? alias.aliasFor,
    alias.compatibility,
    commandOptions,
  );
}

async function executeDefinition(command: Command, definition: CommandDefinition): Promise<void> {
  const globalOptions = readGlobalOptions(command);
  const commandOptions = readCommandOptions(command);
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
        options: commandOptions,
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
  result = withCompatibilityDeprecation(result, definition, commandOptions);
  const actionRequiredAsSuccessOption = definition.exitPolicy?.actionRequiredAsSuccessOption;
  reportResult(result, globalOptions, definition.name, {
    actionRequiredAsSuccess:
      actionRequiredAsSuccessOption !== undefined &&
      commandOptions[actionRequiredAsSuccessOption] === true,
  });
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
    // A retained alias cannot share a name with a command family: attaching its
    // action to the family makes Commander treat every subcommand as an excess
    // argument. The family remains the public entry point for its children.
    if (definition.aliasFor !== undefined && families.has(definition.name)) continue;
    addDefinitionAction(definitionCommand(program, families, definition), definition);
  }

  const compatibilityHelp = compatibilityRoutes
    .map(({ route, replacement }) => `  ${route} -> ${replacement}`)
    .join('\n');
  program.addHelpText(
    'after',
    `\nCompatibility routes (retained indefinitely):\n${compatibilityHelp}\n`,
  );

  program.action(async () => {
    const definition = findCommandDefinition('status');
    await executeDefinition(program, definition);
  });
}
