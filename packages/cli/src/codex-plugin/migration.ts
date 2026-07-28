import type { CodexHookProofObservation } from './profile-proof.js';

export type CodexMigrationState =
  | 'recovery_required'
  | 'plugin_setup_required'
  | 'plugin_disabled'
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
              mutates: state !== 'plugin_installed_restart_required',
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
    matches: facts => facts.finalized && !facts.plugin.installed,
  },
  {
    state: 'plugin_disabled',
    matches: facts => facts.plugin.installed && facts.plugin.enabled === false,
  },
  { state: 'plugin_installed_restart_required', matches: facts => facts.restartPending },
  {
    state: 'plugin_enabled_hook_unproven',
    matches: facts => facts.plugin.enabled === true && facts.proof.status !== 'current',
  },
  {
    state: 'compatibility',
    matches: (facts, hasLegacy) =>
      facts.plugin.enabled === true && facts.proof.status === 'current' && hasLegacy,
  },
  {
    state: 'plugin',
    matches: facts => facts.plugin.enabled === true && facts.proof.status === 'current',
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
  if (facts.plugin.enabled === true && facts.proof.status === 'current') return 'protected';
  if (!hasLegacy || facts.viableLegacyEvents.length === 0) return 'unprotected';
  return facts.viableLegacyEvents.length === facts.legacyEvents.length ? 'protected' : 'partial';
}

function nextAction(state: CodexMigrationState): string | undefined {
  switch (state) {
    case 'recovery_required': {
      return 'safeword codex recover';
    }
    case 'compatibility': {
      return 'safeword codex migrate --finalize';
    }
    case 'plugin': {
      return undefined;
    }
    case 'plugin_installed_restart_required':
    case 'plugin_enabled_hook_unproven': {
      return 'restart Codex and review /hooks';
    }
    case 'plugin_setup_required':
    case 'plugin_disabled':
    case 'legacy':
    case 'not_configured': {
      return 'safeword codex migrate';
    }
  }
}

export function renderCodexMigrationHuman(result: CodexMigrationResultV1): string {
  const lines = [`Codex migration: ${result.state}`, `Protection: ${result.protected}`];
  const next = result.next_actions[0];
  if (next !== undefined) lines.push(`Next: ${next.command}`);
  return `${lines.join('\n')}\n`;
}

export function codexMigrationExitCode(result: CodexMigrationResultV1): 0 | 1 | 2 {
  if (result.errors.length > 0) return 1;
  return result.ok ? 0 : 2;
}
