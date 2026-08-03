#!/usr/bin/env node

import process from 'node:process';

import { Command, CommanderError, Option } from 'commander';

import { registerRetroCommand } from './retro/command-registration.js';
import { installCliCrashCapture } from './self-report-capture.js';
import { error } from './utils/output.js';
import { VERSION } from './version.js';

installCliCrashCapture();

const program = new Command();

function relayRecoveryFromEnvironment():
  | {
      credential: string;
      fetch: typeof fetch;
      operatorCredential?: string;
      relayUrl: string;
    }
  | undefined {
  const credential = process.env.SAFEWORD_RETRO_RELAY_CREDENTIAL?.trim();
  if (credential === undefined || credential.length === 0) return undefined;
  const relayUrl = process.env.SAFEWORD_RETRO_RELAY_URL?.trim();
  if (relayUrl === undefined || relayUrl.length === 0) return undefined;
  const operatorCredential = process.env.SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL?.trim();
  return {
    credential,
    fetch,
    ...(operatorCredential !== undefined &&
      operatorCredential.length > 0 && { operatorCredential }),
    relayUrl,
  };
}

program
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

const hook = program.command('hook').description('Run packaged Safe Word hooks');

hook
  .command('codex <event>')
  .description('Run a packaged Safe Word Codex hook entrypoint')
  .action(async (event: string) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event);
  });

program
  .command('codex-hook <event>', { hidden: true })
  .description('Compatibility alias for `safeword hook codex <event>`')
  .action(async (event: string) => {
    const { codexHook } = await import('./commands/codex-hook.js');
    await codexHook(event);
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

registerRetroCommand(program);

function configuredRelayRecoveryDirectory(
  projectDirectory: string,
  resolveOutbox: (
    projectDirectory: string,
    configuredDirectory: string | undefined,
  ) => { directory: string } | { error: string },
  outputError: (message: string) => void,
): string | undefined {
  const outbox = resolveOutbox(projectDirectory, process.env.SAFEWORD_RETRO_RELAY_OUTBOX);
  if ('error' in outbox) {
    outputError(outbox.error);
    process.exitCode = 1;
    return undefined;
  }
  return outbox.directory;
}

program
  .command('retro-relay-retry [request-id]')
  .description('List durable relay requests or rearm one dead letter without changing its identity')
  .action(async (requestId: string | undefined) => {
    const { resolveRelayRecoveryOutboxDirectory, retryRelayDeadLetterCommand } =
      await import('./commands/retro.js');
    const { info, error: outputError, success } = await import('./utils/output.js');
    const relay = relayRecoveryFromEnvironment();
    const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const recoveryDirectory = configuredRelayRecoveryDirectory(
      projectDirectory,
      resolveRelayRecoveryOutboxDirectory,
      outputError,
    );
    if (recoveryDirectory === undefined) return;
    const ok = await retryRelayDeadLetterCommand(requestId, {
      output: { error: outputError, info, success },
      projectDirectory: recoveryDirectory,
      ...(relay && { relay }),
    });
    if (!ok) process.exitCode = 1;
  });

program
  .command('retro-relay-discard <request-id>')
  .description('Permanently discard one poisoned relay identity and its source reservation')
  .option('--confirm', 'Confirm irreversible deletion of this exact request identity')
  .action(async (requestId: string, options: { confirm?: boolean }) => {
    const { discardRelaySpoolCommand, resolveRelayRecoveryOutboxDirectory } =
      await import('./commands/retro.js');
    const { info, error: outputError, success } = await import('./utils/output.js');
    const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const recoveryDirectory = configuredRelayRecoveryDirectory(
      projectDirectory,
      resolveRelayRecoveryOutboxDirectory,
      outputError,
    );
    if (recoveryDirectory === undefined) return;
    const ok = await discardRelaySpoolCommand(requestId, options.confirm === true, {
      output: { error: outputError, info, success },
      projectDirectory: recoveryDirectory,
    });
    if (!ok) process.exitCode = 1;
  });

program
  .command('retro-reconcile')
  .description(
    'Flag open retro issues whose surface changed after their newest recorded code state (G19QG7)',
  )
  .action(async () => {
    const { retroReconcileCommand } = await import('./commands/retro.js');
    await retroReconcileCommand();
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

program
  .command('test-plan')
  .description('Emit the test/build commands for every language detected in the repo')
  .argument('[dir]', 'project directory to scan (defaults to the current directory)')
  .option('--kind <kind>', 'test, build, verify, typecheck, deps, or bdd', 'test')
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

// parseAsync lets async command failures consistently produce a non-zero exit
// status under Bun and Node.
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
