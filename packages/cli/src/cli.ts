#!/usr/bin/env node

import process from 'node:process';

import { Command } from 'commander';

import { VERSION } from './version.js';

const program = new Command();

program
  .name('safeword')
  .description('CLI for setting up and managing safeword development environments')
  .version(VERSION);

program
  .command('setup')
  .description('Set up safeword in the current project')
  .option('-y, --yes', 'Skip confirmation prompts (for scripting)')
  .option(
    '--no-modify',
    'Skip auto-editing the project ESLint config (prints the manual snippet instead). Also honored via SAFEWORD_NO_MODIFY env var.',
  )
  .action(async options => {
    const { setup } = await import('./commands/setup.js');
    await setup({ noModify: options.modify === false });
  });

program
  .command('check')
  .description('Check project health and versions')
  .option('--offline', 'Skip remote version check')
  .action(async options => {
    const { check } = await import('./commands/check.js');
    await check(options);
  });

program
  .command('upgrade')
  .description('Upgrade safeword configuration to latest version')
  .option(
    '--no-modify',
    'Skip auto-editing the project ESLint config (prints the manual snippet instead). Also honored via SAFEWORD_NO_MODIFY env var.',
  )
  .action(async options => {
    const { upgrade } = await import('./commands/upgrade.js');
    await upgrade({ noModify: options.modify === false });
  });

program
  .command('diff')
  .description('Preview changes that would be made by upgrade')
  .option('-v, --verbose', 'Show full diff output')
  .action(async options => {
    const { diff } = await import('./commands/diff.js');
    await diff(options);
  });

program
  .command('reset')
  .description('Remove safeword configuration from project')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--full', 'Also remove linting config and uninstall packages')
  .action(async options => {
    const { reset } = await import('./commands/reset.js');
    await reset(options);
  });

program
  .command('sync-config')
  .description('Regenerate depcruise config from current project structure')
  .action(async () => {
    const { syncConfig } = await import('./commands/sync-config.js');
    await syncConfig();
  });

program
  .command('sync-learnings')
  .description('Regenerate .safeword-project/learnings/INDEX.md')
  .option('-q, --quiet', 'Suppress success output (still prints skipped-file warnings to stderr)')
  .action(async (options: { quiet?: boolean }) => {
    const { syncLearningsCommand } = await import('./commands/sync-learnings.js');
    syncLearningsCommand({ quiet: options.quiet });
  });

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help();
}

// Parse arguments
program.parse();
