import { writeSync } from 'node:fs';
import process from 'node:process';

import { type Command, InvalidArgumentError, Option } from 'commander';

import {
  commandCatalog,
  type CommandDefinition,
  commandFamilies,
  compatibilityRoutes,
  findCommandDefinition,
} from './catalog.js';
import {
  addGlobalOptions,
  readCommandOptions,
  readGlobalOptions,
  reportResult,
} from './execute.js';
import type { ProgressReporter } from './handler.js';
import { isPlanIdentity } from './plan.js';
import {
  consumeManagedProgressSignal,
  createBestEffortProgressSink,
  createManagedReviewProgress,
  createProgressReporter,
  shouldReportProgress,
} from './policy.js';
import { type CliResult, createResult, withDeprecation } from './result.js';

function familyNames(): Set<string> {
  const families = new Set<string>();
  for (const definition of commandCatalog) {
    if (definition.classification === 'internal') continue;
    const path = definition.name.split(' ');
    for (let length = 1; length < path.length; length += 1) {
      families.add(path.slice(0, length).join(' '));
    }
  }
  return families;
}

function registerFamilies(program: Command): Map<string, Command> {
  const families = new Map<string, Command>();
  const names = [...familyNames()].toSorted((left, right) => {
    const depth = left.split(' ').length - right.split(' ').length;
    return depth === 0 ? left.localeCompare(right) : depth;
  });
  for (const name of names) {
    const contract = commandFamilies.find(candidate => candidate.route === name);
    const path = name.split(' ');
    const parentName = path.slice(0, -1).join(' ');
    const parent = parentName === '' ? program : families.get(parentName);
    if (parent === undefined) throw new Error(`Missing parent command family for ${name}`);
    const syntax = path.at(-1);
    if (syntax === undefined) throw new Error('Command family name cannot be empty');
    const family = parent
      .command(syntax, { hidden: contract?.visibility === 'hidden' })
      .description(contract?.description ?? `Manage ${name} operations`);
    families.set(name, family);
  }
  return families;
}

function configureValueParser(
  option: Option,
  valueKind: CommandDefinition['registration']['options'][number]['valueKind'],
): void {
  switch (valueKind) {
    case 'plan-identity': {
      option.argParser(value => {
        if (!isPlanIdentity(value)) {
          throw new InvalidArgumentError(
            'plan identity must be the 64-character hexadecimal id returned by the latest preview',
          );
        }
        return value;
      });
      return;
    }
    case 'claude-plugin-scope':
    case 'review-route-scope': {
      option.argParser(value => {
        if (value !== 'project' && value !== 'user') {
          throw new InvalidArgumentError('scope must be either project or user');
        }
        return value;
      });
      return;
    }
    case 'execution-mode-list':
    case 'review-route-list': {
      option.argParser((value: string, previous: string[] | undefined) => [
        ...(previous ?? []),
        value,
      ]);
      return;
    }
    case undefined: {
      return;
    }
  }
}

export function addDefinitionOptions(command: Command, definition: CommandDefinition): void {
  for (const option of definition.registration.options) {
    const commanderOption = new Option(option.flags, option.description);
    if (option.defaultValue !== undefined) commanderOption.default(option.defaultValue);
    if (option.hidden === true) commanderOption.hideHelp();
    configureValueParser(commanderOption, option.valueKind);
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
      hidden: definition.visibility === 'hidden',
    });
  }

  const parent = families.get(path.slice(0, -1).join(' '));
  if (parent === undefined) {
    throw new Error(`Missing command family for ${definition.name}`);
  }
  return parent.command(definition.registration.syntax, {
    hidden: definition.visibility === 'hidden',
  });
}

function withAliasDeprecation(
  result: CliResult,
  definition: CommandDefinition,
  commandOptions: Readonly<Record<string, unknown>>,
): CliResult {
  if (definition.aliasFor === undefined || definition.compatibility === undefined) {
    throw new Error(`Missing compatibility policy for retained alias ${definition.name}`);
  }
  return withDeprecation(
    result,
    definition.name,
    definition.compatibility.replacement ?? definition.aliasFor,
    definition.compatibility,
    commandOptions,
  );
}

function withCompatibilityDeprecation(
  result: CliResult,
  definition: CommandDefinition,
  commandOptions: Readonly<Record<string, unknown>> = {},
  invocation: RuntimeInvocation = {},
): CliResult {
  if (definition.aliasFor !== undefined) {
    // `replacement` names the scoped canonical route (`install --agents=claude`)
    // where the alias maps to more than the bare canonical command name.
    return withAliasDeprecation(result, definition, commandOptions);
  }
  if (definition.name !== 'retro run' || invocation.retainedAlias !== 'retro') {
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

function commandProgress(
  definition: CommandDefinition,
  options: { readonly json: boolean; readonly quiet: boolean },
): ProgressReporter | undefined {
  // The opt-in is private to one wrapper -> review-run hop. Consume it for every
  // route so an inherited or misrouted signal cannot leak into descendants.
  const managedProgressRequested = consumeManagedProgressSignal(process.env);
  const managedReview = managedProgressRequested && definition.name === 'review run';
  if (!shouldReportProgress({ ...options, managedReview })) return undefined;
  const progress = createProgressReporter({
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: handle => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    emit: createBestEffortProgressSink((buffer, offset, length) =>
      writeSync(2, buffer, offset, length),
    ),
  });
  return managedReview && options.json ? createManagedReviewProgress(progress) : progress;
}

async function executeDefinition(
  command: Command,
  definition: CommandDefinition,
  invocation: RuntimeInvocation = {},
): Promise<void> {
  const globalOptions = readGlobalOptions(command);
  const commandOptions = readCommandOptions(command);
  const progress = commandProgress(definition, globalOptions);
  let result;
  try {
    try {
      result = await definition.handler({
        cwd: globalOptions.cwd,
        json: globalOptions.json,
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
  result = withCompatibilityDeprecation(result, definition, commandOptions, invocation);
  const actionRequiredAsSuccessOption = definition.exitPolicy?.actionRequiredAsSuccessOption;
  reportResult(result, globalOptions, definition.name, {
    actionRequiredAsSuccess:
      actionRequiredAsSuccessOption !== undefined &&
      commandOptions[actionRequiredAsSuccessOption] === true,
  });
}

function addDefinitionAction(
  command: Command,
  definition: CommandDefinition,
  invocation: RuntimeInvocation,
): void {
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
    await executeDefinition(command, definition, invocation);
  });
}

export interface RuntimeInvocation {
  readonly retainedAlias?: string;
}

export function registerPublicCommandCatalog(
  program: Command,
  invocation: RuntimeInvocation = {},
): void {
  const families = registerFamilies(program);
  for (const definition of commandCatalog) {
    if (definition.classification === 'internal') continue;
    // A retained alias cannot share a name with a command family: attaching its
    // action to the family makes Commander treat every subcommand as an excess
    // argument. The family remains the public entry point for its children.
    if (definition.aliasFor !== undefined && families.has(definition.name)) continue;
    addDefinitionAction(definitionCommand(program, families, definition), definition, invocation);
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
    await executeDefinition(program, definition, invocation);
  });
}
