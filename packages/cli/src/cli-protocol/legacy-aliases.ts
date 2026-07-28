import process from 'node:process';

import type { Command } from 'commander';

import type { CommandDefinition } from './catalog.js';
import type { GlobalCliOptions } from './execute.js';

interface AliasContext {
  readonly operands: readonly unknown[];
  readonly options: Readonly<Record<string, unknown>>;
}

type LegacyAliasAdapter = (context: AliasContext) => Promise<void>;

function stringOption(options: Readonly<Record<string, unknown>>, name: string) {
  const value = options[name];
  return typeof value === 'string' ? value : undefined;
}

const LEGACY_ALIAS_ADAPTERS: Readonly<Record<string, LegacyAliasAdapter>> = {
  setup: async ({ options }) => {
    const { exists } = await import('../utils/fs.js');
    if (exists(`${process.cwd()}/.safeword`)) {
      const { upgrade } = await import('../commands/upgrade.js');
      await upgrade({ noModify: options.modify === false });
      return;
    }
    const { setup } = await import('../commands/setup.js');
    await setup({ noModify: options.modify === false });
  },
  check: async ({ options }) => {
    const { check } = await import('../commands/check.js');
    await check({ offline: options.offline === true });
  },
  upgrade: async ({ options }) => {
    const { upgrade } = await import('../commands/upgrade.js');
    await upgrade({
      noModify: options.modify === false,
      migrateNamespace:
        typeof options.migrateNamespace === 'boolean' ? options.migrateNamespace : undefined,
    });
  },
  diff: async ({ options }) => {
    const { diff } = await import('../commands/diff.js');
    await diff({ verbose: options.verbose === true });
  },
  reset: async ({ options }) => {
    const { reset } = await import('../commands/reset.js');
    await reset({ full: options.full === true, yes: options.yes === true });
  },
  'sync-config': async ({ options }) => {
    const { syncConfig } = await import('../commands/sync-config.js');
    await syncConfig({ check: options.check === true });
  },
  architecture: async ({ options }) => {
    const { architecture } = await import('../commands/architecture.js');
    await architecture(process.cwd(), {
      check: options.check === true,
      stage: options.stage === true,
    });
  },
  'sync-learnings': async ({ options }) => {
    const { syncLearningsCommand } = await import('../commands/sync-learnings.js');
    syncLearningsCommand({ quiet: options.quiet === true });
  },
  'sync-tickets': async ({ options }) => {
    const { syncTicketsCommand } = await import('../commands/sync-tickets.js');
    syncTicketsCommand({ quiet: options.quiet === true });
  },
  codify: async ({ operands, options }) => {
    const { codify } = await import('../commands/codify.js');
    await codify(typeof operands[0] === 'string' ? operands[0] : '', {
      format: stringOption(options, 'format'),
      red: options.red === true,
      out: stringOption(options, 'out'),
    });
  },
  'test-plan': async ({ operands, options }) => {
    const { testPlan } = await import('../commands/test-plan.js');
    await testPlan(
      {
        kind: stringOption(options, 'kind'),
        format: stringOption(options, 'format'),
        json: options.json === true,
      },
      typeof operands[0] === 'string' ? operands[0] : undefined,
    );
  },
  'lint-gherkin': async ({ operands }) => {
    const { lintGherkin } = await import('../commands/lint-gherkin.js');
    await lintGherkin((operands[0] as string[] | undefined) ?? []);
  },
  'sync-tracker': async ({ options }) => {
    const { syncTrackerCommand } = await import('../commands/sync-tracker.js');
    await syncTrackerCommand({
      resetTrackerMap: options.resetTrackerMap === true,
      plan: options.plan === true,
      applyResults: stringOption(options, 'applyResults'),
    });
  },
  connect: async ({ operands, options }) => {
    const { connectCommand } = await import('../commands/connect.js');
    await connectCommand(typeof operands[0] === 'string' ? operands[0] : '', {
      repo: stringOption(options, 'repo'),
      team: stringOption(options, 'team'),
      workspace: stringOption(options, 'workspace'),
    });
  },
  'self-report': async ({ options }) => {
    const { selfReport } = await import('../commands/self-report.js');
    const format = stringOption(options, 'format');
    await selfReport({
      format:
        format !== undefined && ['human', 'json', 'issue'].includes(format)
          ? (format as 'human' | 'json' | 'issue')
          : undefined,
    });
  },
  retro: async ({ options }) => {
    const { retroCommand } = await import('../commands/retro.js');
    const rawWindowStart = stringOption(options, 'windowStart');
    const windowStart = rawWindowStart === undefined ? undefined : Number(rawWindowStart);
    await retroCommand({
      transcript: stringOption(options, 'transcript'),
      findings: stringOption(options, 'findings'),
      autoExtract: options.autoExtract === true,
      windowStart: Number.isFinite(windowStart) ? windowStart : undefined,
      sessionId: stringOption(options, 'sessionId'),
    });
  },
  'retro-reconcile': async () => {
    const { retroReconcileCommand } = await import('../commands/retro.js');
    await retroReconcileCommand();
  },
  'migrate codex-plugin': async ({ options }) => {
    const { migrateCodexPlugin } = await import('../commands/migrate-codex-plugin.js');
    await migrateCodexPlugin(process.cwd(), {
      removeLegacyHooks: options.removeLegacyHooks === true,
      yes: options.yes === true,
    });
  },
  'codex install': async () => {
    const { installCodexPlugin } = await import('../commands/migrate-codex-plugin.js');
    installCodexPlugin({ reportMigrationState: true });
  },
  'codex status': async ({ options }) => {
    const { statusCodexMigration } = await import('../commands/migrate-codex-plugin.js');
    statusCodexMigration(process.cwd(), { json: options.json === true });
  },
  'codex migrate': async ({ options }) => {
    await runLegacyCodexMigration(options);
  },
  'codex recover': async ({ options }) => {
    const { recoverCodexMigration, reportCodexMigrationFailure } =
      await import('../commands/migrate-codex-plugin.js');
    try {
      recoverCodexMigration(process.cwd(), { json: options.json === true });
    } catch (recoveryError) {
      if (options.json !== true) throw recoveryError;
      reportCodexMigrationFailure(process.cwd(), recoveryError, { code: 'RECOVERY_FAILED' });
    }
  },
};

const LEGACY_CANONICAL_COMMANDS = new Set([
  'setup',
  'codex install',
  'codex status',
  'codex migrate',
  'codex recover',
]);
const LEGACY_JSON_ALIASES = new Set(['test-plan', 'self-report']);

async function runLegacyCodexMigration(options: Readonly<Record<string, unknown>>): Promise<void> {
  const { installCodexPlugin, reportCodexMigrationFailure } =
    await import('../commands/migrate-codex-plugin.js');
  const finalize = options.finalize === true || options.removeLegacyHooks === true;
  try {
    if (!finalize) {
      installCodexPlugin({ reportMigrationState: true, json: options.json === true });
      return;
    }
    const { previewCodexFinalization, removeLegacyCodexHooks } =
      await import('../commands/migrate-codex-plugin.js');
    if (options.json === true && options.yes !== true) {
      previewCodexFinalization(process.cwd());
      return;
    }
    const { promptCodexFinalization } = await import('../codex-plugin/finalization.js');
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
      code: finalize ? 'FINALIZATION_FAILED' : 'PLUGIN_INSTALL_FAILED',
    });
  }
}

function isSafeLegacyInvocation(options: GlobalCliOptions): boolean {
  return !options.noInput && !options.quiet && !options.offline;
}

function isLegacyCheckInvocation(options: GlobalCliOptions): boolean {
  return !options.json && !options.noInput && !options.quiet && !options.verbose;
}

export function shouldUseLegacyAliasAdapter(
  definition: CommandDefinition,
  options: GlobalCliOptions,
): boolean {
  if (options.cwd !== process.cwd()) return false;
  if (LEGACY_CANONICAL_COMMANDS.has(definition.name)) {
    return isSafeLegacyInvocation(options);
  }
  if (definition.aliasFor === undefined) return false;
  if (definition.name === 'check') return isLegacyCheckInvocation(options);
  const compatibleOutput = !options.json || LEGACY_JSON_ALIASES.has(definition.name);
  return isSafeLegacyInvocation(options) && compatibleOutput;
}

export async function runLegacyAliasAdapter(name: string, command: Command): Promise<void> {
  const adapter = LEGACY_ALIAS_ADAPTERS[name];
  if (adapter === undefined) throw new Error(`Missing legacy alias adapter: ${name}`);
  await adapter({
    options: command.optsWithGlobals<Record<string, unknown>>(),
    operands: command.processedArgs,
  });
}
