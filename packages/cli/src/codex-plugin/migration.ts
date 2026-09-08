import { SAFEWORD_SCHEMA } from '../schema.js';
import { CODEX_MIGRATION_SCHEMA } from './inventory.js';
import type { CodexHookProofObservation } from './profile-proof.js';

type CodexMigrationState =
  | 'recovery_required'
  | 'plugin_setup_required'
  | 'plugin_disabled'
  | 'plugin_update_required'
  | 'legacy'
  | 'plugin_installed_app_restart_required'
  | 'plugin_installed_hook_activation_failed'
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

export interface CodexMigrationResultV2 {
  schema_version: '2';
  ok: boolean;
  state: CodexMigrationState;
  /** Protection availability; interpret with `state` to identify its provider or absence. */
  protected: 'protected' | 'partial' | 'unprotected' | 'uncertain';
  changed: boolean;
  plugin: CodexPluginObservation;
  proof: CodexHookProofObservation;
  legacy: { events: string[]; viable_events: string[]; assets: string[] };
  effects: { files: { path: string; action: 'create' | 'update' | 'remove' | 'restore' }[] };
  errors: { code: string; message: string; retryable: boolean }[];
  next_actions: (
    | { command: string; mutates: boolean; requires_human: boolean }
    | {
        kind: 'human';
        instruction: string;
        mutates: false;
        requires_human: true;
      }
  )[];
}

export interface CodexMigrationFacts {
  plugin: CodexPluginObservation;
  proof: CodexHookProofObservation;
  legacyAssets: string[];
  legacyEvents: string[];
  viableLegacyEvents: string[];
  finalized: boolean;
  recoveryRequired: boolean;
  activationPending: boolean;
  activationRestartObserved: boolean;
  activationRestartProven: boolean;
}

export function codexInstallRequiresMutation(observation: CodexMigrationResultV2): boolean {
  return observation.plugin.enabled !== true || observation.state === 'plugin_update_required';
}

export const CODEX_RESTART_ACTION = 'Fully restart Codex, then resume this task';
export const CODEX_REVIEW_THEN_RESTART_ACTION =
  'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task';
const CODEX_RESTART_INSTRUCTION = `${CODEX_REVIEW_THEN_RESTART_ACTION}.`;

/**
 * Why the app may still be stale. The instruction that resolves it travels as a
 * typed human next action, so renderers must not repeat it here — a message and
 * a `Next:` line carrying the same sentence reads as a stutter, not as emphasis.
 */
export const CODEX_RESTART_CONTEXT =
  'This Codex app may keep its loaded Safeword catalogue. Independent reviews are unaffected: they run a fresh Codex with hooks disabled.';
export const CODEX_HOOK_ACTIVATION_FAILED_CONTEXT =
  'Codex restarted, but Safeword received no current lifecycle hook proof.';
const CODEX_HOOK_ACTIVATION_FAILED_ACTION =
  'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). If they are enabled and trusted, use a Codex surface that dispatches lifecycle hooks before relying on Safeword protection.';
const CODEX_PARTIAL_ACTIVATION_CONTEXT =
  'Codex restarted and Safeword has partial current lifecycle hook proof.';
const CODEX_PARTIAL_ACTIVATION_ACTION =
  'Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run.';

export function codexPluginVersionMatchesPackage(plugin: CodexPluginObservation): boolean {
  // Older Codex clients may omit nullable catalog version metadata. In that
  // case, current execution proof still binds protection to both the exact
  // packaged plugin version and hook-manifest digest.
  return plugin.version === null || plugin.version === SAFEWORD_SCHEMA.version;
}

function pluginProtectionIsCurrent(facts: CodexMigrationFacts): boolean {
  return (
    !facts.activationPending &&
    facts.plugin.enabled === true &&
    codexPluginVersionMatchesPackage(facts.plugin) &&
    facts.proof.status === 'current' &&
    (facts.plugin.version === null || facts.proof.plugin_version === facts.plugin.version)
  );
}

export function deriveCodexMigrationResult(facts: CodexMigrationFacts): CodexMigrationResultV2 {
  const hasLegacy = facts.legacyAssets.length > 0 || facts.legacyEvents.length > 0;
  const protectedStatus = legacyProtection(facts, hasLegacy);
  const state = migrationState(facts, hasLegacy);
  const next = nextAction(state, facts);

  return {
    schema_version: '2',
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
    next_actions: next === undefined ? [] : [next],
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
    state: 'plugin_installed_hook_activation_failed',
    matches: facts =>
      facts.plugin.enabled === true &&
      !pluginProtectionIsCurrent(facts) &&
      facts.activationPending &&
      facts.activationRestartObserved,
  },
  {
    state: 'plugin_installed_app_restart_required',
    matches: facts => facts.activationPending && facts.plugin.enabled === true,
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
): CodexMigrationResultV2['protected'] {
  if (pluginProtectionIsCurrent(facts)) return 'protected';
  if (!hasLegacy || facts.viableLegacyEvents.length === 0) return 'unprotected';
  return facts.viableLegacyEvents.length === facts.legacyEvents.length ? 'protected' : 'partial';
}

const NEXT_COMMANDS = {
  recovery_required: 'safeword codex recover',
  compatibility: 'safeword codex migrate --finalize',
  plugin: undefined,
  plugin_installed_app_restart_required: undefined,
  plugin_installed_hook_activation_failed: undefined,
  plugin_enabled_hook_unproven: undefined,
  plugin_setup_required: 'safeword codex migrate',
  plugin_disabled: 'safeword codex migrate',
  plugin_update_required: 'safeword codex migrate',
  legacy: 'safeword codex migrate',
  not_configured: 'safeword codex migrate',
} as const satisfies Readonly<Record<CodexMigrationState, string | undefined>>;

function nextAction(
  state: CodexMigrationState,
  facts: CodexMigrationFacts,
): CodexMigrationResultV2['next_actions'][number] | undefined {
  if (state === 'plugin_installed_hook_activation_failed') {
    return {
      kind: 'human',
      instruction: CODEX_HOOK_ACTIVATION_FAILED_ACTION,
      mutates: false,
      requires_human: true,
    };
  }
  if (
    state === 'plugin_enabled_hook_unproven' &&
    facts.activationRestartProven &&
    facts.proof.status === 'partial'
  ) {
    return {
      kind: 'human',
      instruction: CODEX_PARTIAL_ACTIVATION_ACTION,
      mutates: false,
      requires_human: true,
    };
  }
  if (
    state === 'plugin_installed_app_restart_required' ||
    state === 'plugin_enabled_hook_unproven'
  ) {
    return {
      kind: 'human',
      instruction: CODEX_RESTART_INSTRUCTION,
      mutates: false,
      requires_human: true,
    };
  }
  const command = NEXT_COMMANDS[state];
  return command === undefined ? undefined : { command, mutates: true, requires_human: true };
}

export function renderCodexMigrationHuman(result: CodexMigrationResultV2): string {
  const lines = [`Codex migration: ${result.state}`, `Protection: ${result.protected}`];
  const context = codexMigrationContext(result);
  if (context !== undefined) lines.push(context);
  const next = result.next_actions[0];
  if (next !== undefined) {
    lines.push(`Next: ${'command' in next ? next.command : next.instruction}`);
  }
  return `${lines.join('\n')}\n`;
}

function codexMigrationContext(result: CodexMigrationResultV2): string | undefined {
  const next = result.next_actions[0];
  if (
    result.state === 'plugin_enabled_hook_unproven' &&
    next !== undefined &&
    'instruction' in next &&
    next.instruction === CODEX_PARTIAL_ACTIVATION_ACTION
  ) {
    return CODEX_PARTIAL_ACTIVATION_CONTEXT;
  }
  return CODEX_MIGRATION_CONTEXT[result.state];
}

const CODEX_MIGRATION_CONTEXT = {
  recovery_required: undefined,
  plugin_setup_required: `Setup: ${CODEX_MIGRATION_SCHEMA.paths.bootstrapSkill}`,
  plugin_disabled: undefined,
  plugin_update_required: undefined,
  legacy: undefined,
  plugin_installed_app_restart_required: CODEX_RESTART_CONTEXT,
  plugin_installed_hook_activation_failed: CODEX_HOOK_ACTIVATION_FAILED_CONTEXT,
  plugin_enabled_hook_unproven: CODEX_RESTART_CONTEXT,
  compatibility: undefined,
  plugin: undefined,
  not_configured: undefined,
} as const satisfies Readonly<Record<CodexMigrationState, string | undefined>>;

export function codexMigrationExitCode(result: CodexMigrationResultV2): 0 | 1 | 2 {
  if (result.errors.length > 0) return 1;
  return result.ok ? 0 : 2;
}
