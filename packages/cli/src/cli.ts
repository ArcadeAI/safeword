#!/usr/bin/env node

import process from 'node:process';

import { Command } from 'commander';

import { installCliCrashCapture } from './self-report-capture.js';
import { VERSION } from './version.js';

// Self-observation (issues #345 / #720): capture safeword's own genuine crashes
// (uncaught exception / unhandled rejection) — NOT deliberate non-zero status
// exits, which many commands use as normal control flow. Gated to configured
// safeword projects and best-effort, so it never alters CLI behavior.
installCliCrashCapture();

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

program
  .command('sync-tracker')
  .description('Project the ticket corpus one-way into the configured tracker (Linear/GitHub)')
  .option('--reset-tracker-map', 'Rebuild the tracker-map sidecar from scratch')
  .action(async (options: { resetTrackerMap?: boolean }) => {
    const { syncTrackerCommand } = await import('./commands/sync-tracker.js');
    await syncTrackerCommand({ resetTrackerMap: options.resetTrackerMap });
  });

program
  .command('connect <provider>')
  .description('Connect a tracker (linear/github): write config, verify auth, seed the sidecar')
  .option('--repo <owner/name>', 'GitHub target repository')
  .option('--team <team>', 'Linear target team')
  .option('--workspace <workspace>', 'Linear target workspace')
  .action(
    async (provider: string, options: { repo?: string; team?: string; workspace?: string }) => {
      const { connectCommand } = await import('./commands/connect.js');
      await connectCommand(provider, options);
    },
  );

program
  .command('architecture')
  .description(
    'Refresh the generated architecture state document (.project/architecture.generated.md)',
  )
  .option(
    '--check',
    'Report staleness without writing (exits non-zero when the doc is stale; CI backstop)',
  )
  .option(
    '--stage',
    'Regenerate a stale doc and git-add it into the in-flight commit (never blocks)',
  )
  .action(async (options: { check?: boolean; stage?: boolean }) => {
    const { architecture } = await import('./commands/architecture.js');
    await architecture(process.cwd(), { check: options.check, stage: options.stage });
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
  .command('self-report')
  .description("View safeword's own captured runtime signals (zero-egress local spool)")
  .option('--json', 'Emit machine-readable JSON instead of a human summary')
  .option(
    '--format <format>',
    'Output format: human (default), json, or issue (ready-to-file sanitized drafts)',
  )
  .action(async (options: { json?: boolean; format?: string }) => {
    const { selfReport } = await import('./commands/self-report.js');
    const format = options.format as 'human' | 'json' | 'issue' | undefined;
    await selfReport({ json: options.json, format });
  });

program
  .command('retro')
  .description('Mine a session transcript for qualitative safeword friction and file it (RV9JT4)')
  .requiredOption('--transcript <path>', 'Path to the session transcript (never guessed)')
  .option('--findings <path>', 'Path to agent-produced raw findings JSON to sanitize and file')
  .option(
    '--auto-extract',
    'Extract findings out-of-band via a headless `claude -p` session (no --findings needed)',
  )
  .option(
    '--window-start <chars>',
    'Delta re-arm: digest only the transcript from this char offset onward (ZFGWS1)',
  )
  .option('--session-id <id>', 'Stable session id to attribute findings to (ledger accounting)')
  .action(
    async (options: {
      transcript?: string;
      findings?: string;
      autoExtract?: boolean;
      windowStart?: string;
      sessionId?: string;
    }) => {
      const { retroCommand } = await import('./commands/retro.js');
      const windowStart =
        options.windowStart === undefined ? undefined : Number(options.windowStart);
      await retroCommand({
        transcript: options.transcript,
        findings: options.findings,
        autoExtract: options.autoExtract,
        windowStart: Number.isFinite(windowStart) ? windowStart : undefined,
        sessionId: options.sessionId,
      });
    },
  );

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

program
  .command('test-plan')
  .description('Emit the test/build commands for every language detected in the repo')
  .argument('[dir]', 'project directory to scan (defaults to the current directory)')
  .option('--kind <kind>', 'test, build, verify, or typecheck', 'test')
  .option('--format <format>', 'human, json, or sh (eval-able)', 'human')
  .option('--json', 'alias for --format json')
  .action(
    async (
      dir: string | undefined,
      options: { kind?: string; json?: boolean; format?: string },
    ) => {
      const { testPlan } = await import('./commands/test-plan.js');
      await testPlan(options, dir);
    },
  );

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help();
}

// Parse arguments
program.parse();
