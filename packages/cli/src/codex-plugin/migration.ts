import { SAFEWORD_SCHEMA } from '../schema.js';
import type { CodexHookProofObservation } from './profile-proof.js';

type CodexMigrationState =
  | 'recovery_required'
  | 'plugin_setup_required'
  | 'plugin_disabled'
  | 'plugin_update_required'
  | 'legacy'
  | 'plugin_installed_restart_required'
  | 'plugin_enabled_hook_unproven'
  | 'compatibility'
  | 'plugin'
  | 'not_configured';

export interface CodexPluginObservation {
  installed: boolean;
  enabled: boolean | null;
  version: string | null;
  observation: 'observed' | 'unknown';
}

export interface CodexMigrationResultV1 {
  schema_version: '1';
  ok: boolean;
  state: CodexMigrationState;
  protected: 'protected' | 'partial' | 'unprotected' | 'uncertain';
  changed: boolean;
  plugin: CodexPluginObservation;
  proof: CodexHookProofObservation;
  legacy: { events: string[]; viable_events: string[]; assets: string[] };
  effects: { files: { path: string; action: 'create' | 'update' | 'remove' | 'restore' }[] };
  errors: { code: string; message: string; retryable: boolean }[];
  next_actions: { command: string; mutates: boolean; requires_human: boolean }[];
}

export interface CodexMigrationFacts {
  plugin: CodexPluginObservation;
  proof: CodexHookProofObservation;
  legacyAssets: string[];
  legacyEvents: string[];
  viableLegacyEvents: string[];
  finalized: boolean;
  recoveryRequired: boolean;
  restartPending: boolean;
}

export function codexPluginVersionMatchesPackage(plugin: CodexPluginObservation): boolean {
  return plugin.version === null || plugin.version === SAFEWORD_SCHEMA.version;
}

function pluginProtectionIsCurrent(facts: CodexMigrationFacts): boolean {
  return (
    facts.plugin.enabled === true &&
    codexPluginVersionMatchesPackage(facts.plugin) &&
    facts.proof.status === 'current' &&
    (facts.plugin.version === null || facts.proof.plugin_version === facts.plugin.version)
  );
}

export function deriveCodexMigrationResult(facts: CodexMigrationFacts): CodexMigrationResultV1 {
  const hasLegacy = facts.legacyAssets.length > 0 || facts.legacyEvents.length > 0;
  const protectedStatus = legacyProtection(facts, hasLegacy);
  const state = migrationState(facts, hasLegacy);
  const nextCommand = nextAction(state);

  return {
    schema_version: '1',
    ok: state === 'plugin',
    state,
    protected: facts.recoveryRequired ? 'uncertain' : protectedStatus,
    changed: false,
    plugin: facts.plugin,
    proof: facts.proof,
    legacy: {
      events: facts.legacyEvents,
      viable_events: facts.viableLegacyEvents,
      assets: facts.legacyAssets,
    },
    effects: { files: [] },
    errors: [],
    next_actions:
      nextCommand === undefined
        ? []
        : [
            {
              command: nextCommand,
              mutates:
                state !== 'plugin_installed_restart_required' &&
                state !== 'plugin_enabled_hook_unproven',
              requires_human: true,
            },
          ],
  };
}

const MIGRATION_STATE_RULES: readonly {
  state: CodexMigrationState;
  matches: (facts: CodexMigrationFacts, hasLegacy: boolean) => boolean;
}[] = [
  { state: 'recovery_required', matches: facts => facts.recoveryRequired },
  {
    state: 'plugin_setup_required',
    matches: facts => facts.finalized && facts.plugin.enabled !== true,
  },
  {
    state: 'plugin_disabled',
    matches: facts => facts.plugin.installed && facts.plugin.enabled === false,
  },
  {
    state: 'plugin_update_required',
    matches: facts =>
      facts.plugin.enabled === true && !codexPluginVersionMatchesPackage(facts.plugin),
  },
  {
    state: 'plugin_installed_restart_required',
    matches: facts => facts.restartPending && facts.plugin.enabled === true,
  },
  {
    state: 'plugin_enabled_hook_unproven',
    matches: facts => facts.plugin.enabled === true && !pluginProtectionIsCurrent(facts),
  },
  {
    state: 'compatibility',
    matches: (facts, hasLegacy) => pluginProtectionIsCurrent(facts) && hasLegacy,
  },
  {
    state: 'plugin',
    matches: facts => pluginProtectionIsCurrent(facts),
  },
  { state: 'legacy', matches: (_facts, hasLegacy) => hasLegacy },
];

function migrationState(facts: CodexMigrationFacts, hasLegacy: boolean): CodexMigrationState {
  return (
    MIGRATION_STATE_RULES.find(rule => rule.matches(facts, hasLegacy))?.state ?? 'not_configured'
  );
}

function legacyProtection(
  facts: CodexMigrationFacts,
  hasLegacy: boolean,
): CodexMigrationResultV1['protected'] {
  if (pluginProtectionIsCurrent(facts)) return 'protected';
  if (!hasLegacy || facts.viableLegacyEvents.length === 0) return 'unprotected';
  return facts.viableLegacyEvents.length === facts.legacyEvents.length ? 'protected' : 'partial';
}

const NEXT_ACTIONS = {
  recovery_required: 'safeword codex recover',
  compatibility: 'safeword codex migrate --finalize',
  plugin: undefined,
  plugin_installed_restart_required: 'safeword codex status',
  plugin_enabled_hook_unproven: 'safeword codex status',
  plugin_setup_required: 'safeword codex migrate',
  plugin_disabled: 'safeword codex migrate',
  plugin_update_required: 'safeword codex migrate',
  legacy: 'safeword codex migrate',
  not_configured: 'safeword codex migrate',
} as const satisfies Readonly<Record<CodexMigrationState, string | undefined>>;

function nextAction(state: CodexMigrationState): string | undefined {
  return NEXT_ACTIONS[state];
}

export function renderCodexMigrationHuman(result: CodexMigrationResultV1): string {
  const lines = [`Codex migration: ${result.state}`, `Protection: ${result.protected}`];
  if (result.state === 'plugin_setup_required') {
    lines.push('Setup: .agents/skills/safeword-plugin-setup/SKILL.md');
  } else if (
    result.state === 'plugin_installed_restart_required' ||
    result.state === 'plugin_enabled_hook_unproven'
  ) {
    lines.push('Start a new Codex session, then review the Safe Word plugin hooks with /hooks.');
  }
  const next = result.next_actions[0];
  if (next !== undefined) lines.push(`Next: ${next.command}`);
  return `${lines.join('\n')}\n`;
}

export function codexMigrationExitCode(result: CodexMigrationResultV1): 0 | 1 | 2 {
  if (result.errors.length > 0) return 1;
  return result.ok ? 0 : 2;
}
