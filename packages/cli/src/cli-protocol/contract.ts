import type { Argument } from 'commander';
import { Command, Option } from 'commander';

import { invocationCatalog, type InvocationContract } from './catalog.js';
import { GLOBAL_OPTION_DEFINITIONS } from './execute.js';

export interface CliContractFinding {
  readonly code:
    | 'CLI_CONTRACT_UNCLASSIFIED_INVOCATION'
    | 'CLI_CONTRACT_MISSING_REGISTRATION'
    | 'CLI_CONTRACT_DUPLICATE_CLASSIFICATION'
    | 'CLI_CONTRACT_UNKNOWN_CLASSIFICATION'
    | 'CLI_CONTRACT_UNKNOWN_KIND'
    | 'CLI_CONTRACT_UNKNOWN_VISIBILITY'
    | 'CLI_CONTRACT_MISSING_TARGET'
    | 'CLI_CONTRACT_VISIBILITY_MISMATCH'
    | 'CLI_CONTRACT_ARGUMENT_MISMATCH'
    | 'CLI_CONTRACT_OPTION_MISMATCH';
  readonly route: string;
  readonly flag?: string;
  readonly field?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

interface RuntimeCommand {
  readonly command: Command;
  readonly route: string;
  readonly visibility: 'public' | 'hidden';
}

export interface CommanderOwnedOption {
  readonly route: string;
  readonly flags: string;
}

interface OptionShape {
  readonly flag: string;
  readonly short?: string;
  readonly attribute: string;
  readonly required: boolean;
  readonly optional: boolean;
  readonly variadic: boolean;
  readonly negate: boolean;
  readonly defaultValue?: unknown;
  readonly choices?: readonly string[];
  readonly hidden: boolean;
  readonly conflicts: readonly string[];
  readonly implies?: Readonly<Record<string, unknown>>;
}

interface ArgumentShape {
  readonly name: string;
  readonly required: boolean;
  readonly variadic: boolean;
}

function runtimeCommands(program: Command): RuntimeCommand[] {
  const found: RuntimeCommand[] = [];
  const visit = (parent: Command, ancestors: readonly string[]): void => {
    const visible = new Set(parent.createHelp().visibleCommands(parent));
    for (const command of parent.commands) {
      const segments = [...ancestors, command.name()];
      found.push({
        command,
        route: segments.join(' '),
        visibility: visible.has(command) ? 'public' : 'hidden',
      });
      visit(command, segments);
    }
  };
  visit(program, []);
  return found;
}

export function commanderOwnedOptions(program: Command): CommanderOwnedOption[] {
  const commands = [{ command: program, route: 'safeword' }, ...runtimeCommands(program)];
  const globalFlags = new Set<string>(GLOBAL_OPTION_DEFINITIONS.map(option => option.flags));
  return commands
    .flatMap(({ command, route }) => {
      const registered = new Set(command.options.map(option => option.flags));
      const implicitHelp = command
        .createHelp()
        .visibleOptions(command)
        .filter(option => !registered.has(option.flags));
      const rootOwned =
        command === program ? command.options.filter(option => !globalFlags.has(option.flags)) : [];
      return [...rootOwned, ...implicitHelp].map(option => ({ route, flags: option.flags }));
    })
    .toSorted((left, right) =>
      `${left.route}\0${left.flags}`.localeCompare(`${right.route}\0${right.flags}`),
    );
}

function optionShape(option: Option): OptionShape {
  const commanderInternals = option as Option & {
    readonly conflictsWith?: readonly string[];
    readonly implied?: Readonly<Record<string, unknown>>;
  };
  return {
    flag: option.long ?? option.short ?? option.flags,
    ...(option.short !== undefined && { short: option.short }),
    attribute: option.attributeName(),
    required: option.required,
    optional: option.optional,
    variadic: option.variadic,
    negate: option.negate,
    ...(option.defaultValue !== undefined && { defaultValue: option.defaultValue }),
    ...(option.argChoices !== undefined && { choices: option.argChoices }),
    hidden: option.hidden,
    conflicts: [...(commanderInternals.conflictsWith ?? [])].toSorted((left, right) =>
      left.localeCompare(right),
    ),
    ...(commanderInternals.implied !== undefined && { implies: commanderInternals.implied }),
  };
}

function argumentShape(argument: Argument): ArgumentShape {
  return {
    name: argument.name(),
    required: argument.required,
    variadic: argument.variadic,
  };
}

function optionFromDefinition(definition: {
  readonly flags: string;
  readonly description: string;
  readonly defaultValue?: string;
  readonly hidden?: boolean;
}): Option {
  const option = new Option(definition.flags, definition.description);
  if (definition.defaultValue !== undefined) option.default(definition.defaultValue);
  if (definition.hidden === true) option.hideHelp();
  return option;
}

function expectedOptions(contract: InvocationContract): OptionShape[] {
  if (contract.kind !== 'command' || contract.command === undefined) return [];
  const definitions = [
    ...(contract.command.classification === 'internal' ? [] : GLOBAL_OPTION_DEFINITIONS),
    ...contract.command.registration.options,
  ];
  return definitions
    .map(definition => optionFromDefinition(definition))
    .map(option => optionShape(option))
    .toSorted(compareOptions);
}

function expectedArguments(contract: InvocationContract): ArgumentShape[] {
  if (contract.kind !== 'command' || contract.command === undefined) return [];
  const temporary = new Command().command(contract.command.registration.syntax);
  return temporary.registeredArguments.map(argument => argumentShape(argument));
}

function compareOptions(left: OptionShape, right: OptionShape): number {
  return left.flag.localeCompare(right.flag);
}

function firstDifferentField<T extends object>(expected: T, actual: T): string | undefined {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])] as (keyof T)[];
  return keys.find(key => JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) as
    string | undefined;
}

function compareCommand(
  contract: InvocationContract,
  runtime: RuntimeCommand,
): CliContractFinding[] {
  const findings: CliContractFinding[] = [];
  if (contract.visibility !== runtime.visibility) {
    findings.push({
      code: 'CLI_CONTRACT_VISIBILITY_MISMATCH',
      route: contract.route,
      expected: contract.visibility,
      actual: runtime.visibility,
    });
  }

  const expectedArgumentsShape = expectedArguments(contract);
  const actualArgumentsShape = runtime.command.registeredArguments.map(argument =>
    argumentShape(argument),
  );
  if (JSON.stringify(expectedArgumentsShape) !== JSON.stringify(actualArgumentsShape)) {
    findings.push({
      code: 'CLI_CONTRACT_ARGUMENT_MISMATCH',
      route: contract.route,
      expected: expectedArgumentsShape,
      actual: actualArgumentsShape,
    });
  }

  const expected = expectedOptions(contract);
  const actual = runtime.command.options
    .map(option => optionShape(option))
    .toSorted(compareOptions);
  const expectedByFlag = new Map(expected.map(option => [option.flag, option]));
  const actualByFlag = new Map(actual.map(option => [option.flag, option]));
  const flags = [...new Set([...expectedByFlag.keys(), ...actualByFlag.keys()])].toSorted(
    (left, right) => left.localeCompare(right),
  );
  for (const flag of flags) {
    const expectedOption = expectedByFlag.get(flag);
    const actualOption = actualByFlag.get(flag);
    const field =
      expectedOption === undefined || actualOption === undefined
        ? 'presence'
        : firstDifferentField(expectedOption, actualOption);
    if (field !== undefined) {
      findings.push({
        code: 'CLI_CONTRACT_OPTION_MISMATCH',
        route: contract.route,
        flag,
        field,
        expected: expectedOption,
        actual: actualOption,
      });
    }
  }
  return findings;
}

function registeredContracts(contracts: readonly InvocationContract[]): InvocationContract[] {
  return contracts.filter(contract => contract.kind === 'command' || contract.kind === 'family');
}

function targetResolves(target: string, runtime: readonly RuntimeCommand[]): boolean {
  const targetTokens = target.split(/\s+/u);
  const candidate = runtime
    .toSorted((left, right) => right.route.length - left.route.length)
    .find(({ route }) => target === route || target.startsWith(`${route} `));
  if (candidate === undefined) return false;

  const routeTokens = candidate.route.split(' ');
  const trailing = targetTokens.slice(routeTokens.length);
  try {
    const parsed = candidate.command.parseOptions(trailing);
    if (parsed.unknown.length > 0) return false;
    const arguments_ = candidate.command.registeredArguments;
    const required = arguments_.filter(argument => argument.required).length;
    const acceptsVariadic = arguments_.some(argument => argument.variadic);
    return (
      parsed.operands.length >= required &&
      (acceptsVariadic || parsed.operands.length <= arguments_.length)
    );
  } catch {
    return false;
  }
}

function contractMetadataFindings(
  contract: InvocationContract,
  runtime: readonly RuntimeCommand[],
): CliContractFinding[] {
  const findings: CliContractFinding[] = [];
  if (!['public', 'retained-alias', 'internal'].includes(contract.classification)) {
    findings.push({
      code: 'CLI_CONTRACT_UNKNOWN_CLASSIFICATION',
      route: contract.route,
      actual: contract.classification,
    });
  }
  if (!['command', 'family', 'default', 'argv-rewrite'].includes(contract.kind)) {
    findings.push({
      code: 'CLI_CONTRACT_UNKNOWN_KIND',
      route: contract.route,
      actual: contract.kind,
    });
  }
  if (!['public', 'hidden'].includes(contract.visibility)) {
    findings.push({
      code: 'CLI_CONTRACT_UNKNOWN_VISIBILITY',
      route: contract.route,
      actual: contract.visibility,
    });
  }
  const targetRequired = contract.kind === 'default' || contract.kind === 'argv-rewrite';
  if (
    (targetRequired && contract.target === undefined) ||
    (contract.target !== undefined && !targetResolves(contract.target, runtime))
  ) {
    findings.push({
      code: 'CLI_CONTRACT_MISSING_TARGET',
      route: contract.route,
      actual: contract.target,
    });
  }
  return findings;
}

function catalogFindings(
  contracts: readonly InvocationContract[],
  runtime: readonly RuntimeCommand[],
): CliContractFinding[] {
  const findings = contracts.flatMap(contract => contractMetadataFindings(contract, runtime));
  const routeCounts = new Map<string, number>();
  for (const contract of contracts) {
    routeCounts.set(contract.route, (routeCounts.get(contract.route) ?? 0) + 1);
  }
  for (const [route, count] of routeCounts) {
    if (count > 1) {
      findings.push({
        code: 'CLI_CONTRACT_DUPLICATE_CLASSIFICATION',
        route,
        expected: 1,
        actual: count,
      });
    }
  }
  return findings;
}

export function reconcileCliProgram(
  program: Command,
  contracts: readonly InvocationContract[] = invocationCatalog,
): CliContractFinding[] {
  const runtime = runtimeCommands(program);
  const runtimeByRoute = new Map(runtime.map(command => [command.route, command]));
  const registered = registeredContracts(contracts);
  const contractByRoute = new Map(registered.map(contract => [contract.route, contract]));
  const findings: CliContractFinding[] = catalogFindings(contracts, runtime);

  for (const command of runtime) {
    if (!contractByRoute.has(command.route)) {
      findings.push({ code: 'CLI_CONTRACT_UNCLASSIFIED_INVOCATION', route: command.route });
    }
  }
  for (const contract of registered) {
    const command = runtimeByRoute.get(contract.route);
    if (command === undefined) {
      findings.push({ code: 'CLI_CONTRACT_MISSING_REGISTRATION', route: contract.route });
      continue;
    }
    findings.push(...compareCommand(contract, command));
  }
  return findings.toSorted((left, right) =>
    `${left.route}\0${left.flag ?? ''}\0${left.field ?? ''}\0${left.code}`.localeCompare(
      `${right.route}\0${right.flag ?? ''}\0${right.field ?? ''}\0${right.code}`,
    ),
  );
}
