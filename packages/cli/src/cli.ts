#!/usr/bin/env node

import process from 'node:process';

import { Command, CommanderError, Option } from 'commander';

import { findCommandDefinition } from './cli-protocol/catalog.js';
import { addGlobalOptions } from './cli-protocol/execute.js';
import { machineOutputRequested } from './cli-protocol/machine-output.js';
import { registerPublicCommandCatalog } from './cli-protocol/register.js';
import { createResult, renderJsonResult } from './cli-protocol/result.js';
import { installCliCrashCapture } from './self-report-capture.js';
import { error } from './utils/output.js';
import { VERSION } from './version.js';

installCliCrashCapture();

// `retro` became a command family in the public catalog. Keep its established
// direct spelling working for installed hooks by routing option-led invocations
// to the canonical `retro run` child before Commander parses the argv.
if (process.argv[2] === 'retro' && process.argv[3]?.startsWith('--')) {
  process.env.SAFEWORD_CLI_RETAINED_ALIAS = 'retro';
  process.argv.splice(3, 0, 'run');
} else {
  delete process.env.SAFEWORD_CLI_RETAINED_ALIAS;
}

const program = new Command()
  .name('safeword')
  .description('CLI for setting up and managing Safeword development environments')
  .version(VERSION);
program.exitOverride();

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

const machineOutput = machineOutputRequested(process.argv.slice(2));
program.configureOutput({
  writeErr: output => {
    if (!machineOutput) process.stderr.write(output);
  },
});

addGlobalOptions(program);
registerPublicCommandCatalog(program);

const boundaryDefinition = findCommandDefinition('boundary');
program
  .command('boundary', { hidden: true })
  .description(boundaryDefinition.description)
  .requiredOption('--at <boundary>', 'which boundary: commit | push')
  .action(async options => {
    const { boundary } = await import('./commands/boundary.js');
    await boundary(options);
  });

const hookDefinition = findCommandDefinition('hook codex');
const hook = program.command('hook', { hidden: true }).description('Run packaged Safeword hooks');
hook
  .command('codex <event>')
  .description(hookDefinition.description)
  .addOption(new Option('--plugin-hook').hideHelp())
  .action(async (event: string, options: { pluginHook?: boolean }) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event, { pluginHook: options.pluginHook === true });
  });

const codexHookDefinition = findCommandDefinition('codex-hook');
program
  .command('codex-hook <event>', { hidden: true })
  .description(codexHookDefinition.description)
  .action(async (event: string) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event);
  });

const featureDirectoriesDefinition = findCommandDefinition('feature-directories');
program
  .command('feature-directories', { hidden: true })
  .description(featureDirectoriesDefinition.description)
  .action(async () => {
    const { featureDirectories } = await import('./commands/feature-directories.js');
    featureDirectories(process.cwd());
  });

try {
  await program.parseAsync();
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
