#!/usr/bin/env node

import process from 'node:process';

import { Command, Option } from 'commander';

import { createCapabilitiesResult } from './cli-protocol/catalog.js';
import {
  addGlobalOptions,
  type GlobalCliOptions,
  readGlobalOptions,
  reportResult,
} from './cli-protocol/execute.js';
import { describeNonInteractiveIntent } from './cli-protocol/intent.js';
import { withDeprecation } from './cli-protocol/result.js';
import { installCliCrashCapture } from './self-report-capture.js';
import { error } from './utils/output.js';
import { VERSION } from './version.js';

// Self-observation (issues #345 / #720): capture safeword's own genuine crashes
// (uncaught exception / unhandled rejection) — NOT deliberate non-zero status
// exits, which many commands use as normal control flow. Gated to configured
// safeword projects and best-effort, so it never alters CLI behavior.
installCliCrashCapture();

const program = new Command();

function isMachineInvocation(options: GlobalCliOptions): boolean {
  return (
    options.json ||
    options.noInput ||
    options.quiet ||
    options.offline ||
    options.cwd !== process.cwd()
  );
}

function reportIntent(
  name: string,
  command: Command,
  alias?: { legacy: string; replacement: string },
  details?: Readonly<Record<string, unknown>>,
): void {
  const options = readGlobalOptions(command);
  const intent = describeNonInteractiveIntent(name, options.offline, details);
  reportResult(
    alias === undefined ? intent : withDeprecation(intent, alias.legacy, alias.replacement),
    options,
    alias?.legacy ?? name,
  );
}

program
  .name('safeword')
  .description('CLI for setting up and managing safeword development environments')
  .version(VERSION);

addGlobalOptions(program);
program.action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  const { observeStatus } = await import('./commands/status.js');
  reportResult(await observeStatus(globalOptions.cwd), globalOptions, 'status');
});

const status = addGlobalOptions(
  program.command('status').description('Report project health and one next action'),
);
status.action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  const { observeStatus } = await import('./commands/status.js');
  reportResult(await observeStatus(globalOptions.cwd), globalOptions, 'status');
});

const doctor = addGlobalOptions(
  program.command('doctor').description('Diagnose project configuration without changing it'),
);
doctor.action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  const { observeStatus } = await import('./commands/status.js');
  reportResult(await observeStatus(globalOptions.cwd), globalOptions, 'doctor');
});

const capabilities = addGlobalOptions(
  program.command('capabilities').description('Describe the public machine interface'),
);
capabilities.action((_options, command: Command) => {
  reportResult(createCapabilitiesResult(), readGlobalOptions(command), 'capabilities');
});

const project = program.command('project').description('Manage project-local Safeword state');
addGlobalOptions(
  project.command('sync-config').description('Regenerate dependency-cruiser configuration'),
).action(async (options: { check?: boolean }, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('project sync-config', command);
    return;
  }
  const { syncConfig } = await import('./commands/sync-config.js');
  await syncConfig({ check: options.check });
});
addGlobalOptions(
  project.command('architecture').description('Refresh generated architecture state'),
).action(async (options: { check?: boolean; stage?: boolean }, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('project architecture', command);
    return;
  }
  const { architecture } = await import('./commands/architecture.js');
  await architecture(globalOptions.cwd, options);
});
addGlobalOptions(
  project.command('sync-learnings').description('Refresh the project learning index'),
).action(async (options: { quiet?: boolean }, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('project sync-learnings', command);
    return;
  }
  const { syncLearningsCommand } = await import('./commands/sync-learnings.js');
  syncLearningsCommand({ quiet: options.quiet });
});
addGlobalOptions(
  project.command('sync-tickets').description('Refresh project ticket indexes'),
).action(async (options: { quiet?: boolean }, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('project sync-tickets', command);
    return;
  }
  const { syncTicketsCommand } = await import('./commands/sync-tickets.js');
  syncTicketsCommand({ quiet: options.quiet });
});
addGlobalOptions(
  project
    .command('codify <ticket>')
    .description('Generate a test skeleton from ticket behavior')
    .option('--format <format>', 'Output format: vitest or gherkin', 'vitest')
    .option('--red', 'Emit failing test bodies')
    .option('--out <path>', 'Write to a new file'),
).action(
  async (
    ticketId: string,
    options: { format?: string; red?: boolean; out?: string },
    command: Command,
  ) => {
    const globalOptions = readGlobalOptions(command);
    if (isMachineInvocation(globalOptions)) {
      reportIntent('project codify', command);
      return;
    }
    const { codify } = await import('./commands/codify.js');
    await codify(ticketId, options);
  },
);
addGlobalOptions(
  project
    .command('test-plan')
    .description('Describe repository test commands')
    .argument('[dir]')
    .option('--kind <kind>', 'test, build, verify, typecheck, deps, or bdd', 'test')
    .option('--format <format>', 'human, json, or sh', 'human'),
).action(
  async (
    directory: string | undefined,
    options: { kind?: string; format?: string },
    command: Command,
  ) => {
    const globalOptions = readGlobalOptions(command);
    if (isMachineInvocation(globalOptions)) {
      reportIntent('project test-plan', command);
      return;
    }
    const { testPlan } = await import('./commands/test-plan.js');
    await testPlan(options, directory);
  },
);
addGlobalOptions(
  project
    .command('lint-gherkin')
    .description('Validate executable feature files')
    .argument('[files...]'),
).action(async (files: string[], _options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('project lint-gherkin', command, undefined, { arguments: files });
    return;
  }
  const { lintGherkin } = await import('./commands/lint-gherkin.js');
  await lintGherkin(files);
});

const tracker = program
  .command('tracker')
  .description('Manage tracker connections and synchronization');
addGlobalOptions(
  tracker
    .command('sync')
    .description('Synchronize tickets with the configured tracker')
    .option('--reset-tracker-map')
    .option('--plan')
    .option('--apply-results <file>'),
).action(
  async (
    options: { resetTrackerMap?: boolean; plan?: boolean; applyResults?: string },
    command: Command,
  ) => {
    const globalOptions = readGlobalOptions(command);
    if (isMachineInvocation(globalOptions)) {
      reportIntent('tracker sync', command);
      return;
    }
    const { syncTrackerCommand } = await import('./commands/sync-tracker.js');
    await syncTrackerCommand(options);
  },
);
addGlobalOptions(
  tracker
    .command('connect <provider>')
    .description('Connect the project to a tracker')
    .option('--repo <owner/name>')
    .option('--team <team>')
    .option('--workspace <workspace>'),
).action(
  async (
    provider: string,
    options: { repo?: string; team?: string; workspace?: string },
    command: Command,
  ) => {
    const globalOptions = readGlobalOptions(command);
    if (isMachineInvocation(globalOptions)) {
      reportIntent('tracker connect', command);
      return;
    }
    const { connectCommand } = await import('./commands/connect.js');
    await connectCommand(provider, options);
  },
);

const planCommand = addGlobalOptions(
  program.command('plan').description('Preview reconciliation without changing the project'),
);
planCommand.action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  const { observePlan } = await import('./commands/plan.js');
  reportResult(await observePlan(globalOptions.cwd), globalOptions, 'plan');
});

const remove = addGlobalOptions(
  program.command('remove').description('Remove only an explicitly confirmed plan'),
)
  .option('--yes', 'Confirm the supplied plan identity')
  .option('--plan <id>', 'Identity of the exact plan being confirmed')
  .option('--full', 'Also remove linting configuration and packages');
remove.action(
  async (options: { yes?: boolean; plan?: string; full?: boolean }, command: Command) => {
    const globalOptions = readGlobalOptions(command);
    const { removeProject } = await import('./commands/remove.js');
    reportResult(await removeProject(globalOptions.cwd, options), globalOptions, 'remove');
  },
);

addGlobalOptions(
  program
    .command('setup')
    .description('Set up safeword in the current project')
    .option('-y, --yes', 'Skip confirmation prompts (for scripting)')
    .option(
      '--no-modify',
      'Skip auto-editing the project ESLint config (prints the manual snippet instead). Also honored via SAFEWORD_NO_MODIFY env var.',
    ),
).action(async (options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (globalOptions.offline && process.env.SAFEWORD_SKIP_INSTALL === undefined) {
    reportIntent('setup', command);
    return;
  }
  if (
    globalOptions.json ||
    globalOptions.noInput ||
    globalOptions.quiet ||
    globalOptions.cwd !== process.cwd()
  ) {
    const { convergeSetup } = await import('./commands/converge-setup.js');
    reportResult(
      await convergeSetup(globalOptions.cwd, { noModify: options.modify === false }),
      globalOptions,
      'setup',
    );
    return;
  }
  const { exists } = await import('./utils/fs.js');
  if (exists(`${process.cwd()}/.safeword`)) {
    const { upgrade } = await import('./commands/upgrade.js');
    await upgrade({ noModify: options.modify === false });
  } else {
    const { setup } = await import('./commands/setup.js');
    await setup({ noModify: options.modify === false });
  }
});

addGlobalOptions(
  program.command('check', { hidden: true }).description('Check project health and versions'),
).action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (globalOptions.json || globalOptions.noInput || globalOptions.quiet || globalOptions.verbose) {
    const { observeStatus } = await import('./commands/status.js');
    reportResult(
      withDeprecation(await observeStatus(globalOptions.cwd), 'check', 'status'),
      globalOptions,
      'check',
    );
    return;
  }
  const { check } = await import('./commands/check.js');
  await check({ offline: globalOptions.offline });
});

program
  .command('boundary', { hidden: true })
  .description(
    'Reconcile workflow evidence at a git boundary — warn-and-record, never blocks (exit 0 always)',
  )
  .requiredOption('--at <boundary>', 'which boundary: commit | push')
  .action(async options => {
    const { boundary } = await import('./commands/boundary.js');
    await boundary(options);
  });

addGlobalOptions(
  program
    .command('upgrade', { hidden: true })
    .description('Upgrade safeword configuration to latest version')
    .option(
      '--no-modify',
      'Skip auto-editing the project ESLint config (prints the manual snippet instead). Also honored via SAFEWORD_NO_MODIFY env var.',
    )
    .option(
      '--migrate-namespace',
      'Move the legacy .safeword-project/ namespace to .project/ (recommended) without prompting',
    )
    .option('--no-migrate-namespace', 'Keep the legacy namespace; skip the migration prompt'),
).action(async (options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    if (globalOptions.offline && process.env.SAFEWORD_SKIP_INSTALL === undefined) {
      reportIntent('setup', command, { legacy: 'upgrade', replacement: 'setup' });
      return;
    }
    const { convergeSetup } = await import('./commands/converge-setup.js');
    reportResult(
      withDeprecation(
        await convergeSetup(globalOptions.cwd, { noModify: options.modify === false }),
        'upgrade',
        'setup',
      ),
      globalOptions,
      'upgrade',
    );
    return;
  }
  const { upgrade } = await import('./commands/upgrade.js');
  await upgrade({
    noModify: options.modify === false,
    // Commander leaves the tri-state undefined when neither flag is passed.
    migrateNamespace: options.migrateNamespace as boolean | undefined,
  });
});

const migrate = program
  .command('migrate', { hidden: true })
  .description('Migrate an agent integration');

addGlobalOptions(
  migrate
    .command('codex-plugin')
    .description('Install the Safe Word Codex plugin and complete its explicit hook handoff')
    .option(
      '--remove-legacy-hooks',
      'Remove Safe Word-owned legacy project hooks after reviewing the plugin hooks in Codex /hooks',
    )
    .option('--yes', 'Confirm a non-interactive finalization plan'),
).action(async (options: { removeLegacyHooks?: boolean; yes?: boolean }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('codex migrate', command, {
      legacy: 'migrate codex-plugin',
      replacement: 'codex migrate',
    });
    return;
  }
  const { migrateCodexPlugin } = await import('./commands/migrate-codex-plugin.js');
  await migrateCodexPlugin(process.cwd(), {
    removeLegacyHooks: options.removeLegacyHooks === true,
    yes: options.yes === true,
  });
});

interface CodexMigrateOptions {
  finalize?: boolean;
  json?: boolean;
  removeLegacyHooks?: boolean;
  yes?: boolean;
}

async function runCodexFinalizationCommand(options: CodexMigrateOptions): Promise<void> {
  const { previewCodexFinalization, removeLegacyCodexHooks, reportCodexMigrationFailure } =
    await import('./commands/migrate-codex-plugin.js');
  try {
    if (options.json === true && options.yes !== true) {
      previewCodexFinalization(process.cwd());
      return;
    }
    const { promptCodexFinalization } = await import('./codex-plugin/finalization.js');
    const confirm =
      process.stdin.isTTY && process.stdout.isTTY
        ? (plan: string) => promptCodexFinalization(plan)
        : undefined;
    await removeLegacyCodexHooks(process.cwd(), {
      yes: options.yes === true,
      confirm,
      json: options.json === true,
    });
  } catch (migrationError) {
    if (options.json !== true) throw migrationError;
    reportCodexMigrationFailure(process.cwd(), migrationError, {
      code: 'FINALIZATION_FAILED',
    });
  }
}

async function runCodexMigrateCommand(options: CodexMigrateOptions): Promise<void> {
  if (options.finalize === true || options.removeLegacyHooks === true) {
    await runCodexFinalizationCommand(options);
    return;
  }
  const { installCodexPlugin, reportCodexMigrationFailure } =
    await import('./commands/migrate-codex-plugin.js');
  try {
    installCodexPlugin({ reportMigrationState: true, json: options.json === true });
  } catch (migrationError) {
    if (options.json !== true) throw migrationError;
    reportCodexMigrationFailure(process.cwd(), migrationError, {
      code: 'PLUGIN_INSTALL_FAILED',
    });
  }
}

async function runCodexRecoverCommand(options: { json?: boolean }): Promise<void> {
  const { recoverCodexMigration, reportCodexMigrationFailure } =
    await import('./commands/migrate-codex-plugin.js');
  try {
    recoverCodexMigration(process.cwd(), { json: options.json === true });
  } catch (recoveryError) {
    if (options.json !== true) throw recoveryError;
    reportCodexMigrationFailure(process.cwd(), recoveryError, {
      code: 'RECOVERY_FAILED',
    });
  }
}

const codex = program.command('codex').description('Manage the Safe Word Codex plugin');

codex
  .command('install')
  .description('Install and verify the Safe Word plugin in the active Codex profile')
  .action(async () => {
    const { installCodexPlugin } = await import('./commands/migrate-codex-plugin.js');
    installCodexPlugin({ reportMigrationState: true });
  });

codex
  .command('status')
  .description('Report profile-plugin proof and project migration state')
  .option('--json', 'Write the versioned migration result as JSON')
  .action(async (options: { json?: boolean }) => {
    const { statusCodexMigration } = await import('./commands/migrate-codex-plugin.js');
    statusCodexMigration(process.cwd(), { json: options.json === true });
  });

addGlobalOptions(
  codex
    .command('migrate')
    .description('Safely migrate Codex from project hooks to the profile plugin')
    .option('--finalize', 'Finalize migration after current plugin-hook proof exists')
    .option('--yes', 'Confirm a non-interactive finalization plan')
    .option('--remove-legacy-hooks', 'Deprecated alias for --finalize'),
).action(async (options: CodexMigrateOptions, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (isMachineInvocation(globalOptions)) {
    reportIntent('codex migrate', command);
    return;
  }
  await runCodexMigrateCommand(options);
});

codex
  .command('recover')
  .description('Restore a backed-up Safe Word legacy Codex project state')
  .option('--json', 'Write the versioned migration result as JSON')
  .action(runCodexRecoverCommand);

addGlobalOptions(
  program
    .command('diff', { hidden: true })
    .description('Preview changes that would be made by upgrade'),
).action(async (_options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (globalOptions.json || globalOptions.noInput || globalOptions.quiet) {
    const { observePlan } = await import('./commands/plan.js');
    reportResult(
      withDeprecation(await observePlan(globalOptions.cwd), 'diff', 'plan'),
      globalOptions,
      'diff',
    );
    return;
  }
  const { diff } = await import('./commands/diff.js');
  await diff({ verbose: globalOptions.verbose });
});

addGlobalOptions(
  program
    .command('reset', { hidden: true })
    .description('Remove safeword configuration from project')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--full', 'Also remove linting config and uninstall packages'),
).action(async (options, command: Command) => {
  const globalOptions = readGlobalOptions(command);
  if (globalOptions.json || globalOptions.noInput || globalOptions.quiet) {
    const { removeProject } = await import('./commands/remove.js');
    reportResult(
      withDeprecation(
        await removeProject(globalOptions.cwd, { full: options.full === true }),
        'reset',
        'remove',
      ),
      globalOptions,
      'reset',
    );
    return;
  }
  const { reset } = await import('./commands/reset.js');
  await reset(options);
});

addGlobalOptions(
  program
    .command('sync-config', { hidden: true })
    .description('Regenerate depcruise config from current project structure')
    .option('--check', 'Report drift without writing (exits non-zero on drift)'),
).action(async (options: { check?: boolean }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('project sync-config', command, {
      legacy: 'sync-config',
      replacement: 'project sync-config',
    });
    return;
  }
  const { syncConfig } = await import('./commands/sync-config.js');
  await syncConfig({ check: options.check });
});

addGlobalOptions(
  program
    .command('sync-tracker', { hidden: true })
    .description('Project the ticket corpus one-way into the configured tracker (Linear/GitHub)')
    .option('--reset-tracker-map', 'Rebuild the tracker-map sidecar from scratch')
    .option('--plan', 'Emit the sync plan as JSON to stdout (offline; for a pluggable executor)')
    .option(
      '--apply-results <file>',
      "Fold an executor's results file into the tracker-map (offline)",
    ),
).action(
  async (
    options: { resetTrackerMap?: boolean; plan?: boolean; applyResults?: string },
    command: Command,
  ) => {
    if (isMachineInvocation(readGlobalOptions(command))) {
      reportIntent('tracker sync', command, {
        legacy: 'sync-tracker',
        replacement: 'tracker sync',
      });
      return;
    }
    const { syncTrackerCommand } = await import('./commands/sync-tracker.js');
    await syncTrackerCommand({
      resetTrackerMap: options.resetTrackerMap,
      plan: options.plan,
      applyResults: options.applyResults,
    });
  },
);

addGlobalOptions(
  program
    .command('connect <provider>', { hidden: true })
    .description('Connect a tracker (linear/github): write config, verify auth, seed the sidecar')
    .option('--repo <owner/name>', 'GitHub target repository')
    .option('--team <team>', 'Linear target team')
    .option('--workspace <workspace>', 'Linear target workspace'),
).action(
  async (
    provider: string,
    options: { repo?: string; team?: string; workspace?: string },
    command: Command,
  ) => {
    if (isMachineInvocation(readGlobalOptions(command))) {
      reportIntent('tracker connect', command, {
        legacy: 'connect',
        replacement: 'tracker connect',
      });
      return;
    }
    const { connectCommand } = await import('./commands/connect.js');
    await connectCommand(provider, options);
  },
);

addGlobalOptions(
  program
    .command('architecture', { hidden: true })
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
    ),
).action(async (options: { check?: boolean; stage?: boolean }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('project architecture', command, {
      legacy: 'architecture',
      replacement: 'project architecture',
    });
    return;
  }
  const { architecture } = await import('./commands/architecture.js');
  await architecture(process.cwd(), { check: options.check, stage: options.stage });
});

const ticket = program.command('ticket').description('Ticket management');

addGlobalOptions(ticket.command('list').description('List project tickets')).action(
  (_options, command: Command) => {
    reportIntent('ticket list', command);
  },
);

ticket
  .command('new <slug>')
  .description('Create a new ticket with a Crockford Base32 ID')
  .option('--type <type>', 'Ticket type: patch, task, feature, or epic', 'task')
  .option('--title <title>', 'Ticket title (defaults to slug)')
  .option('--goal <goal>', 'One-line goal; fills the Goal field instead of a placeholder')
  .option('--why <why>', 'One-line rationale (task/patch/epic; features use spec.md)')
  .option(
    '--parent <epicId>',
    'Link this ticket to an epic (sets parent: and appends to its children)',
  )
  .option('--issue <key>', 'Adopt an existing tracker issue key as the ticket identity')
  .action(
    async (
      slug: string,
      options: {
        type?: string;
        title?: string;
        goal?: string;
        why?: string;
        parent?: string;
        issue?: string;
      },
    ) => {
      const { ticketNew } = await import('./commands/ticket-new.js');
      await ticketNew(slug, options);
    },
  );

addGlobalOptions(
  program
    .command('sync-learnings', { hidden: true })
    .description('Regenerate the namespace learnings/INDEX.md'),
).action(async (options: { quiet?: boolean }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('project sync-learnings', command, {
      legacy: 'sync-learnings',
      replacement: 'project sync-learnings',
    });
    return;
  }
  const { syncLearningsCommand } = await import('./commands/sync-learnings.js');
  syncLearningsCommand({ quiet: options.quiet });
});

addGlobalOptions(
  program
    .command('sync-tickets', { hidden: true })
    .description('Regenerate the namespace tickets/INDEX.md and INDEX-completed.md'),
).action(async (options: { quiet?: boolean }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('project sync-tickets', command, {
      legacy: 'sync-tickets',
      replacement: 'project sync-tickets',
    });
    return;
  }
  const { syncTicketsCommand } = await import('./commands/sync-tickets.js');
  syncTicketsCommand({ quiet: options.quiet });
});

addGlobalOptions(
  program
    .command('codify <ticket>', { hidden: true })
    .description(
      "Emit a test skeleton from a ticket's feature source or legacy test-definitions.md",
    )
    .option('--format <format>', 'Output format: vitest (default) or gherkin', 'vitest')
    .option(
      '--red',
      'Emit throwing it(...) bodies (true-RED board) instead of pending stubs (vitest only)',
    )
    .option('--out <path>', 'Write to a file (refuses to overwrite) instead of stdout'),
).action(
  async (
    ticketId: string,
    options: { format?: string; red?: boolean; out?: string },
    command: Command,
  ) => {
    if (isMachineInvocation(readGlobalOptions(command))) {
      reportIntent('project codify', command, {
        legacy: 'codify',
        replacement: 'project codify',
      });
      return;
    }
    const { codify } = await import('./commands/codify.js');
    await codify(ticketId, options);
  },
);

program
  .command('feature-directories', { hidden: true })
  .description('Print executable feature directories for internal shell consumers')
  .action(async () => {
    const { featureDirectories } = await import('./commands/feature-directories.js');
    featureDirectories(process.cwd());
  });

const hook = program.command('hook', { hidden: true }).description('Run packaged Safe Word hooks');

hook
  .command('codex <event>')
  .description('Run a packaged Safe Word Codex hook entrypoint')
  .addOption(new Option('--plugin-hook').hideHelp())
  .action(async (event: string, options: { pluginHook?: boolean }) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event, { pluginHook: options.pluginHook === true });
  });

program
  .command('codex-hook <event>', { hidden: true })
  .description('Compatibility alias for `safeword hook codex <event>`')
  .action(async (event: string) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event);
  });

addGlobalOptions(
  program
    .command('self-report', { hidden: true })
    .description("View safeword's own captured runtime signals (zero-egress local spool)")
    .option(
      '--format <format>',
      'Output format: human (default), json, or issue (ready-to-file sanitized drafts)',
    ),
).action(async (options: { json?: boolean; format?: string }, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('retro signals', command, {
      legacy: 'self-report',
      replacement: 'retro signals',
    });
    return;
  }
  const { selfReport } = await import('./commands/self-report.js');
  const format = options.format as 'human' | 'json' | 'issue' | undefined;
  await selfReport({ json: options.json, format });
});

const retro = addGlobalOptions(
  program
    .command('retro')
    .description('Mine a session transcript for qualitative safeword friction and file it (RV9JT4)')
    .option('--transcript <path>', 'Path to the session transcript (never guessed)')
    .option('--findings <path>', 'Path to agent-produced raw findings JSON to sanitize and file')
    .option(
      '--auto-extract',
      'Extract findings out-of-band via a headless `claude -p` session (no --findings needed)',
    )
    .option(
      '--window-start <chars>',
      'Delta re-arm: digest only the transcript from this char offset onward (ZFGWS1)',
    )
    .option('--session-id <id>', 'Stable session id to attribute findings to (ledger accounting)'),
);
retro.action(
  async (
    options: {
      transcript?: string;
      findings?: string;
      autoExtract?: boolean;
      windowStart?: string;
      sessionId?: string;
    },
    command: Command,
  ) => {
    const globalOptions = readGlobalOptions(command);
    if (isMachineInvocation(globalOptions)) {
      reportIntent('retro run', command, { legacy: 'retro', replacement: 'retro run' });
      return;
    }
    const { retroCommand } = await import('./commands/retro.js');
    const windowStart = options.windowStart === undefined ? undefined : Number(options.windowStart);
    await retroCommand({
      transcript: options.transcript,
      findings: options.findings,
      autoExtract: options.autoExtract,
      windowStart: Number.isFinite(windowStart) ? windowStart : undefined,
      sessionId: options.sessionId,
    });
  },
);

addGlobalOptions(
  retro
    .command('run')
    .description('Extract and file session findings')
    .option('--transcript <path>')
    .option('--findings <path>')
    .option('--auto-extract')
    .option('--window-start <chars>')
    .option('--session-id <id>'),
).action((_options, command: Command) => {
  reportIntent('retro run', command);
});
addGlobalOptions(
  retro.command('signals').description('Inspect locally captured runtime signals'),
).action((_options, command: Command) => {
  reportIntent('retro signals', command);
});
addGlobalOptions(retro.command('reconcile').description('Reconcile open retro findings')).action(
  (_options, command: Command) => {
    reportIntent('retro reconcile', command);
  },
);

addGlobalOptions(
  program
    .command('retro-reconcile', { hidden: true })
    .description(
      'Flag open retro issues whose surface changed after their newest recorded code state (G19QG7)',
    ),
).action(async (_options, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('retro reconcile', command, {
      legacy: 'retro-reconcile',
      replacement: 'retro reconcile',
    });
    return;
  }
  const { retroReconcileCommand } = await import('./commands/retro.js');
  await retroReconcileCommand();
});

addGlobalOptions(
  program
    .command('lint-gherkin', { hidden: true })
    .description('Lint Gherkin feature files using Safeword-owned checks')
    .argument(
      '[files...]',
      'Feature files to lint; discovers root and workspace feature files when omitted',
    ),
).action(async (files: string[], _options, command: Command) => {
  if (isMachineInvocation(readGlobalOptions(command))) {
    reportIntent('project lint-gherkin', command, {
      legacy: 'lint-gherkin',
      replacement: 'project lint-gherkin',
    });
    return;
  }
  const { lintGherkin } = await import('./commands/lint-gherkin.js');
  await lintGherkin(files);
});

addGlobalOptions(
  program
    .command('test-plan', { hidden: true })
    .description('Emit the test/build commands for every language detected in the repo')
    .argument('[dir]', 'project directory to scan (defaults to the current directory)')
    .option('--kind <kind>', 'test, build, verify, typecheck, deps, or bdd', 'test')
    .option('--format <format>', 'human, json, or sh (eval-able)', 'human'),
).action(
  async (
    dir: string | undefined,
    options: { kind?: string; json?: boolean; format?: string },
    command: Command,
  ) => {
    if (isMachineInvocation(readGlobalOptions(command))) {
      reportIntent('project test-plan', command, {
        legacy: 'test-plan',
        replacement: 'project test-plan',
      });
      return;
    }
    const { testPlan } = await import('./commands/test-plan.js');
    await testPlan(options, dir);
  },
);

// parseAsync lets async command failures consistently produce a non-zero exit
// status under Bun and Node.
try {
  await program.parseAsync();
} catch (parseError: unknown) {
  error(parseError instanceof Error ? parseError.message : String(parseError));
  process.exit(1);
}
