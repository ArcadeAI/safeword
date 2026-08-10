import process from 'node:process';

import type { OutputConfiguration } from 'commander';
import { Command, CommanderError, Option } from 'commander';

import { installCliCrashCapture } from '../self-report-capture.js';
import { error } from '../utils/output.js';
import { VERSION } from '../version.js';
import { commandFamilies, findCommandDefinition } from './catalog.js';
import { addGlobalOptions, GLOBAL_OPTION_DEFINITIONS } from './execute.js';
import { machineOutputRequested } from './machine-output.js';
import {
  addDefinitionOptions,
  registerPublicCommandCatalog,
  type RuntimeInvocation,
} from './register.js';
import { createResult, renderJsonResult } from './result.js';

function isCommanderError(value: unknown): value is CommanderError {
  if (value instanceof CommanderError) return true;
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { code?: unknown; exitCode?: unknown; message?: unknown };
  return (
    typeof candidate.code === 'string' &&
    candidate.code.startsWith('commander.') &&
    typeof candidate.exitCode === 'number' &&
    typeof candidate.message === 'string'
  );
}

function registerInternalCommands(program: Command): void {
  const boundaryDefinition = findCommandDefinition('boundary');
  const boundary = program
    .command(boundaryDefinition.registration.syntax, { hidden: true })
    .description(boundaryDefinition.description);
  addDefinitionOptions(boundary, boundaryDefinition);
  boundary.action(async options => {
    const { boundary: runBoundary } = await import('../commands/boundary.js');
    await runBoundary(options);
  });

  const hookDefinition = findCommandDefinition('hook codex');
  const hookFamily = commandFamilies.find(family => family.route === 'hook');
  if (hookFamily === undefined) throw new Error('Missing hook command family contract');
  const hook = program
    .command(hookFamily.route, { hidden: hookFamily.visibility === 'hidden' })
    .description(hookFamily.description);
  const hookCodex = hook
    .command(hookDefinition.registration.syntax, { hidden: true })
    .description(hookDefinition.description);
  addDefinitionOptions(hookCodex, hookDefinition);
  hookCodex.action(async (event: string, options: { pluginHook?: boolean }) => {
    const { codexHook } = await import('../commands/codex-hook.js');
    await codexHook(event, { pluginHook: options.pluginHook === true });
  });

  const codexHookDefinition = findCommandDefinition('codex-hook');
  program
    .command(codexHookDefinition.registration.syntax, { hidden: true })
    .description(codexHookDefinition.description)
    .action(async (event: string) => {
      const { codexHook } = await import('../commands/codex-hook.js');
      await codexHook(event);
    });

  const featureDirectoriesDefinition = findCommandDefinition('feature-directories');
  program
    .command(featureDirectoriesDefinition.registration.syntax, { hidden: true })
    .description(featureDirectoriesDefinition.description)
    .action(async () => {
      const { featureDirectories } = await import('../commands/feature-directories.js');
      featureDirectories(process.cwd());
    });
}

export function createCliProgram(invocation: RuntimeInvocation = {}): Command {
  const program = new Command()
    .name('safeword')
    .description('CLI for setting up and managing Safeword development environments')
    .version(VERSION);
  program.exitOverride();
  addGlobalOptions(program);
  registerPublicCommandCatalog(program, invocation);
  registerInternalCommands(program);
  return program;
}

const ROOT_OPTIONS = [
  ...GLOBAL_OPTION_DEFINITIONS.map(definition => new Option(definition.flags)),
  new Option('-V, --version'),
  new Option('-h, --help'),
];

function rootOptionMatch(
  token: string,
): { readonly option: Option; readonly attached: boolean } | undefined {
  const exact = ROOT_OPTIONS.find(
    candidate =>
      token === candidate.short ||
      token === candidate.long ||
      (candidate.long !== undefined && token.startsWith(`${candidate.long}=`)),
  );
  if (exact !== undefined) return { option: exact, attached: token.includes('=') };
  const attached = ROOT_OPTIONS.find(
    candidate =>
      candidate.required && candidate.short !== undefined && token.startsWith(candidate.short),
  );
  return attached === undefined ? undefined : { option: attached, attached: true };
}

function commandTokenIndex(argv: readonly string[]): number | undefined {
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined || token === '--') return undefined;
    if (!token.startsWith('-')) return index;
    const match = rootOptionMatch(token);
    if (match === undefined) return undefined;
    if (match.option.required && !match.attached) index += 1;
  }
  return undefined;
}

export function normalizeCliArgv(argv: readonly string[]): {
  readonly argv: string[];
  readonly invocation: RuntimeInvocation;
} {
  const normalized = [...argv];
  const commandIndex = commandTokenIndex(normalized);
  const nextToken = commandIndex === undefined ? undefined : normalized[commandIndex + 1];
  if (
    commandIndex !== undefined &&
    normalized[commandIndex] === 'retro' &&
    (nextToken === undefined || nextToken.startsWith('-'))
  ) {
    normalized.splice(commandIndex + 1, 0, 'run');
    return { argv: normalized, invocation: { retainedAlias: 'retro' } };
  }
  return { argv: normalized, invocation: {} };
}

export function configureCliOutput(program: Command, config: OutputConfiguration): void {
  program.configureOutput(config);
  for (const command of program.commands) configureCliOutput(command, config);
}

export async function runCli(argv: readonly string[]): Promise<void> {
  installCliCrashCapture();
  const normalized = normalizeCliArgv(argv);
  const machineOutput = machineOutputRequested(normalized.argv.slice(2));
  const program = createCliProgram(normalized.invocation);
  configureCliOutput(program, {
    writeErr: output => {
      if (!machineOutput) process.stderr.write(output);
    },
  });

  try {
    await program.parseAsync(normalized.argv);
  } catch (parseError: unknown) {
    if (isCommanderError(parseError) && parseError.exitCode === 0) {
      process.exitCode = 0;
    } else if (machineOutput && isCommanderError(parseError)) {
      const result = createResult({
        state: 'failed',
        errors: [
          {
            code: 'CLI_ARGUMENT_INVALID',
            message: parseError.message,
            retryable: false,
          },
        ],
      });
      process.stdout.write(`${renderJsonResult(result)}\n`);
      process.exitCode = 1;
    } else if (isCommanderError(parseError)) {
      process.exitCode = parseError.exitCode;
    } else {
      error(parseError instanceof Error ? parseError.message : String(parseError));
      process.exitCode = 1;
    }
  }
}
