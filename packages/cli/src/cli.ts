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
  .option(
    '--migrate-namespace',
    'Move the legacy .safeword-project/ namespace to .project/ (recommended) without prompting',
  )
  .option('--no-migrate-namespace', 'Keep the legacy namespace; skip the migration prompt')
  .action(async options => {
    const { upgrade } = await import('./commands/upgrade.js');
    await upgrade({
      noModify: options.modify === false,
      // Commander leaves the tri-state undefined when neither flag is passed.
      migrateNamespace: options.migrateNamespace as boolean | undefined,
    });
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
  .option('--check', 'Report drift without writing (exits non-zero on drift)')
  .action(async (options: { check?: boolean }) => {
    const { syncConfig } = await import('./commands/sync-config.js');
    await syncConfig({ check: options.check });
  });

const ticket = program.command('ticket').description('Ticket management');

ticket
  .command('new <slug>')
  .description('Create a new ticket with a Crockford Base32 ID')
  .option('--type <type>', 'Ticket type: patch, task, or feature', 'task')
  .option('--title <title>', 'Ticket title (defaults to slug)')
  .action(async (slug: string, options: { type?: string; title?: string }) => {
    const { ticketNew } = await import('./commands/ticket-new.js');
    await ticketNew(slug, options);
  });

program
  .command('sync-learnings')
  .description('Regenerate the namespace learnings/INDEX.md')
  .option('-q, --quiet', 'Suppress success output (still prints skipped-file warnings to stderr)')
  .action(async (options: { quiet?: boolean }) => {
    const { syncLearningsCommand } = await import('./commands/sync-learnings.js');
    syncLearningsCommand({ quiet: options.quiet });
  });

program
  .command('sync-tickets')
  .description('Regenerate the namespace tickets/INDEX.md and INDEX-completed.md')
  .option('-q, --quiet', 'Suppress success output (still prints skipped-folder warnings to stderr)')
  .action(async (options: { quiet?: boolean }) => {
    const { syncTicketsCommand } = await import('./commands/sync-tickets.js');
    syncTicketsCommand({ quiet: options.quiet });
  });

program
  .command('codify <ticket>')
  .description("Emit a test skeleton from a ticket's feature source or legacy test-definitions.md")
  .option('--format <format>', 'Output format: vitest (default) or gherkin', 'vitest')
  .option(
    '--red',
    'Emit throwing it(...) bodies (true-RED board) instead of pending stubs (vitest only)',
  )
  .option('--out <path>', 'Write to a file (refuses to overwrite) instead of stdout')
  .action(async (ticketId: string, options: { format?: string; red?: boolean; out?: string }) => {
    const { codify } = await import('./commands/codify.js');
    await codify(ticketId, options);
  });

program
  .command('lint-gherkin')
  .description('Lint Gherkin feature files using Safeword-owned checks')
  .argument(
    '[files...]',
    'Feature files to lint; discovers root and workspace feature files when omitted',
  )
  .action(async (files: string[]) => {
    const { lintGherkin } = await import('./commands/lint-gherkin.js');
    await lintGherkin(files);
  });

const autonomy = program
  .command('autonomy')
  .description('View and set the project autonomy posture');

autonomy
  .command('show')
  .description('Print the resolved per-axis autonomy posture')
  .action(async () => {
    const { autonomyShow } = await import('./commands/autonomy.js');
    autonomyShow();
  });

autonomy
  .command('set <preset>')
  .description('Record a named preset (Full review | Guard the contract | Hands-off)')
  .action(async (preset: string) => {
    const { autonomySet } = await import('./commands/autonomy.js');
    autonomySet(preset);
  });

autonomy
  .command('override <axis> <posture>')
  .description('Override one axis (posture: ask | autonomous)')
  .option('--personal', 'Write to the gitignored personal config instead of the project config')
  .action(async (axis: string, posture: string, options: { personal?: boolean }) => {
    const { autonomyOverride } = await import('./commands/autonomy.js');
    autonomyOverride(axis, posture, { personal: options.personal });
  });

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help();
}

// Parse arguments
program.parse();
