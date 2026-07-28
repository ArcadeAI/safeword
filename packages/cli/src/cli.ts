#!/usr/bin/env node

import process from 'node:process';

import { Command, CommanderError, Option } from 'commander';

import { findCommandDefinition } from './cli-protocol/catalog.js';
import { addGlobalOptions } from './cli-protocol/execute.js';
import { registerPublicCommandCatalog } from './cli-protocol/register.js';
import { installCliCrashCapture } from './self-report-capture.js';
import { error } from './utils/output.js';
import { VERSION } from './version.js';

installCliCrashCapture();

const program = new Command()
  .name('safeword')
  .description('CLI for setting up and managing Safeword development environments')
  .version(VERSION);

addGlobalOptions(program);
registerPublicCommandCatalog(program);

function family(name: string): Command {
  const command = program.commands.find(candidate => candidate.name() === name);
  if (command === undefined) throw new Error(`Missing registered command family: ${name}`);
  return command;
}

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

family('codex')
  .command('diff', { hidden: true })
  .description('Show project-hook differences before Codex finalization')
  .action(async () => {
    const { previewCodexFinalization } = await import('./commands/migrate-codex-plugin.js');
    previewCodexFinalization(process.cwd());
  });

family('codex')
  .command('reset', { hidden: true })
  .description('Recover backed-up project hooks after Codex migration')
  .action(async () => {
    const { recoverCodexMigration } = await import('./commands/migrate-codex-plugin.js');
    recoverCodexMigration(process.cwd());
  });

program.exitOverride();
try {
  await program.parseAsync();
} catch (parseError: unknown) {
  if (parseError instanceof CommanderError && parseError.exitCode === 0) {
    process.exitCode = 0;
  } else {
    error(parseError instanceof Error ? parseError.message : String(parseError));
    process.exitCode = parseError instanceof CommanderError ? parseError.exitCode : 1;
  }
}
