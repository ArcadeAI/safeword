import {
  adaptHookValue,
  pluginEventGroupCommand,
  pluginEventGroupEvents,
  pluginEventGroups,
  pluginHookCommand,
  pluginHookManifest,
  projectHookCommand,
} from '../claude-plugin/hook-manifest.js';
import { type CliResult, createResult, type Effects } from '../cli-protocol/result.js';
import { codexPluginHookCommand } from '../codex-plugin/hooks.js';
import {
  cursorPluginBindings,
  cursorPluginHookCommand,
  cursorPluginHookManifest,
} from '../cursor-plugin/bindings.js';
import {
  type BehaviorRoute,
  type CallbackBoundaryRoute,
  type CallbackResourceRoute,
  configuredCommandHandlers,
  type HandlerComposition,
  type HandlerEnvelope,
  type OuterCallDisposition,
} from '../host-contract/handlers.js';
import type { observeOpenCodeV2Removal } from '../opencode/v2-profile.js';
import { CURSOR_HOOKS, EDIT_TOOLS, SETTINGS_HOOKS } from '../templates/config.js';
import hostReleases from './host-releases.json' with { type: 'json' };
import { claudeRetainsProject, codexRetainsProject } from './sibling-registration.js';

/** Current supported host releases; SDK and development toolchain pins are separate. */
export const CURRENT_HOST_RELEASES = hostReleases;

export interface HostHandlerRegistration {
  readonly host: string;
  readonly event: string;
  readonly command?: string;
  readonly matcher?: string;
  readonly condition?: string;
  readonly handler_path: string;
  readonly interpreter?: string;
  readonly execution: 'synchronous' | 'async-rewake' | 'background' | 'native-callback';
  readonly configuration: object;
  readonly source_family?: string;
}

export interface NativeHandlerSource {
  readonly family: string;
  readonly source: string;
  readonly format: 'command-manifest' | 'group-manifest' | 'callback-object' | 'sdk-source';
  readonly generate?: () => string;
}

export const LIFECYCLE_EVENTS = [
  'session_start',
  'prompt_submit',
  'pre_tool',
  'post_tool',
  'stop',
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];
export type LifecycleStrength = 'block' | 'observe' | 'unavailable';

type EvidenceCapability =
  | { readonly availability: 'available'; readonly proof: string }
  | { readonly availability: 'unavailable' };

export interface LifecycleCapabilities {
  readonly lifecycle: Readonly<
    Record<LifecycleEvent, LifecycleStrength> & Partial<Record<'session_end', LifecycleStrength>>
  >;
  readonly blockableHooks: readonly LifecycleEvent[];
  /** Host can request another turn; bounds and native proof remain separate. */
  readonly continuationHooks?: readonly LifecycleEvent[];
  readonly activation: EvidenceCapability;
  readonly conformance: EvidenceCapability;
}

/** Declared host requestability only; neither registration nor native delivery proof. */
export function supportsBehaviorGuarantee(
  capabilities: LifecycleCapabilities | undefined,
  trigger: BehaviorRoute['trigger'],
  guarantee: BehaviorRoute['guarantees'][number] | undefined,
): boolean {
  const strength = capabilities?.lifecycle[trigger];
  if (strength === undefined || strength === 'unavailable') return false;
  if (guarantee === 'observe') return true;
  if (guarantee === 'reject_action')
    return strength === 'block' && new Set<string>(capabilities?.blockableHooks).has(trigger);
  return (
    guarantee === 'bounded_continuation' &&
    new Set<string>(capabilities?.continuationHooks).has(trigger)
  );
}

export interface LifecycleContext {
  readonly cwd: string;
  readonly agents: readonly string[];
  readonly operation: 'check' | 'install' | 'uninstall';
  readonly scope: 'project' | 'user';
  readonly environment?: NodeJS.ProcessEnv;
  readonly observation?: unknown;
  readonly projectResult?: CliResult;
  readonly ports?: {
    readonly installClaude?: () => Promise<CliResult>;
    readonly installCodex?: () => Promise<CliResult>;
  };
}

type ProfileDescriptor =
  | { readonly available: false }
  | {
      readonly available: true;
      readonly observePrecondition: (context: LifecycleContext) => Promise<unknown>;
      readonly preflight?: (context: LifecycleContext) => CliResult | Promise<CliResult>;
    };

export interface IntegrationAdapter {
  readonly id: string;
  readonly defaultSelected: boolean;
  readonly exposeStatusData?: boolean;
  readonly behaviorRoutes?: readonly BehaviorRoute[];
  readonly handlerEnvelopes?: readonly HandlerEnvelope[];
  readonly handlerCompositions?: readonly HandlerComposition[];
  readonly outerCallDispositions?: readonly OuterCallDisposition[];
  readonly callbackResources?: readonly CallbackResourceRoute[];
  readonly callbackBoundaries?: readonly CallbackBoundaryRoute[];
  readonly configuredHandlers?: () => readonly HostHandlerRegistration[];
  readonly nativeHandlerSources?: readonly NativeHandlerSource[];
  readonly project: {
    readonly owned: readonly string[];
    readonly shared: readonly string[];
  };
  readonly profile: ProfileDescriptor;
  readonly capabilities: LifecycleCapabilities;
  readonly observe: (context: LifecycleContext) => CliResult | Promise<CliResult>;
  readonly install: (context: LifecycleContext) => CliResult | Promise<CliResult>;
  readonly uninstall: (context: LifecycleContext) => CliResult | Promise<CliResult>;
  readonly effects: (context: LifecycleContext) => Effects | Promise<Effects>;
}

export type IntegrationRegistry = readonly IntegrationAdapter[];

const ADAPTER_KEYS = new Set([
  'id',
  'defaultSelected',
  'exposeStatusData',
  'configuredHandlers',
  'behaviorRoutes',
  'handlerCompositions',
  'handlerEnvelopes',
  'outerCallDispositions',
  'callbackResources',
  'callbackBoundaries',
  'nativeHandlerSources',
  'project',
  'profile',
  'capabilities',
  'observe',
  'install',
  'uninstall',
  'effects',
]);
const LIFECYCLE_STRENGTHS = new Set<unknown>(['block', 'observe', 'unavailable']);

function invalidAdapter(id: unknown, reason: string): never {
  const label = typeof id === 'string' && id.length > 0 ? id : '<unknown>';
  throw new Error(`Invalid integration adapter ${label}: ${reason}.`);
}

function validateEvidenceCapability(
  id: unknown,
  name: 'activation' | 'conformance',
  capability: EvidenceCapability,
): void {
  if (capability?.availability === 'unavailable') return;
  if (
    capability?.availability !== 'available' ||
    typeof capability.proof !== 'string' ||
    capability.proof.length === 0
  ) {
    invalidAdapter(id, `${name} capability requires a proof mechanism`);
  }
}

function validateProjectOwnership(adapter: IntegrationAdapter): void {
  if (!Array.isArray(adapter.project?.owned) || !Array.isArray(adapter.project.shared)) {
    invalidAdapter(adapter.id, 'project ownership must declare owned and shared surfaces');
  }
  const surfaces = [...adapter.project.owned, ...adapter.project.shared];
  if (surfaces.some(surface => typeof surface !== 'string' || surface.length === 0)) {
    invalidAdapter(adapter.id, 'project ownership contains an undeclared surface');
  }
  if (new Set(surfaces).size !== surfaces.length) {
    invalidAdapter(adapter.id, 'project ownership surfaces must be unique');
  }
}

function validateBlockableHooks(
  id: string,
  lifecycle: Readonly<Record<LifecycleEvent, LifecycleStrength>>,
  blockableHooks: readonly LifecycleEvent[],
): void {
  for (const event of blockableHooks as readonly unknown[]) {
    if (!LIFECYCLE_EVENTS.includes(event as LifecycleEvent)) {
      invalidAdapter(id, `blockable hook ${String(event)} is not a lifecycle event`);
    }
    if (lifecycle[event as LifecycleEvent] !== 'block') {
      invalidAdapter(id, `blockable hook ${String(event)} is not declared blocking`);
    }
  }
}

function validateContinuationHooks(adapter: IntegrationAdapter): void {
  const continuation = adapter.capabilities.continuationHooks ?? [];
  if (
    !Array.isArray(continuation) ||
    continuation.some(
      (event: LifecycleEvent) =>
        !LIFECYCLE_EVENTS.includes(event) ||
        adapter.capabilities.lifecycle[event] === 'unavailable',
    )
  )
    invalidAdapter(adapter.id, 'continuation hook must name an available lifecycle event');
}
function validateLifecycleStrength(id: string, event: string, strength: LifecycleStrength): void {
  if (!LIFECYCLE_STRENGTHS.has(strength))
    invalidAdapter(id, `lifecycle capability ${event} is invalid`);
}
function validateCapabilities(adapter: IntegrationAdapter): void {
  const lifecycle = adapter.capabilities?.lifecycle;
  const blockableHooks = adapter.capabilities?.blockableHooks;
  if (lifecycle === undefined || !Array.isArray(blockableHooks)) {
    invalidAdapter(adapter.id, 'lifecycle capabilities are incomplete');
  }
  for (const event of LIFECYCLE_EVENTS) {
    const strength = lifecycle[event];
    validateLifecycleStrength(adapter.id, event, strength);
    if (strength === 'block' && !blockableHooks.includes(event)) {
      invalidAdapter(adapter.id, `blocking capability ${event} has no blockable hook`);
    }
  }
  if (lifecycle.session_end !== undefined)
    validateLifecycleStrength(adapter.id, 'session_end', lifecycle.session_end);
  validateBlockableHooks(adapter.id, lifecycle, blockableHooks);
  validateContinuationHooks(adapter);
  validateEvidenceCapability(adapter.id, 'activation', adapter.capabilities.activation);
  validateEvidenceCapability(adapter.id, 'conformance', adapter.capabilities.conformance);
}

export function defineIntegrationAdapter(adapter: IntegrationAdapter): IntegrationAdapter {
  if (typeof adapter?.id !== 'string' || adapter.id.length === 0) {
    invalidAdapter(adapter?.id, 'id must be non-empty');
  }
  validateAdapterShape(adapter);
  validateProjectOwnership(adapter);
  validateProfile(adapter);
  validateCapabilities(adapter);
  validateOperations(adapter);
  return Object.freeze(adapter);
}

function validateAdapterShape(adapter: IntegrationAdapter): void {
  const unexpectedKey = Object.keys(adapter).find(key => !ADAPTER_KEYS.has(key));
  if (unexpectedKey !== undefined) {
    invalidAdapter(adapter.id, `unsupported operation or declaration ${unexpectedKey}`);
  }
  if (adapter.configuredHandlers !== undefined && typeof adapter.configuredHandlers !== 'function')
    invalidAdapter(adapter.id, 'configured handlers must be a discovery function');
}

function validateProfile(adapter: IntegrationAdapter): void {
  if (typeof adapter.profile?.available !== 'boolean') {
    invalidAdapter(adapter.id, 'profile support must be declared');
  }
  if (adapter.profile.available && typeof adapter.profile.observePrecondition !== 'function') {
    invalidAdapter(adapter.id, 'profile support requires a precondition observer');
  }
}

function validateOperations(adapter: IntegrationAdapter): void {
  for (const operation of ['observe', 'install', 'uninstall', 'effects'] as const) {
    if (typeof adapter[operation] !== 'function') {
      invalidAdapter(adapter.id, `${operation} operation is missing`);
    }
  }
}

export function createIntegrationRegistry(
  entries: readonly IntegrationAdapter[],
): IntegrationRegistry {
  const ids = new Set<string>();
  return Object.freeze(
    entries.map(entry => {
      const adapter = defineIntegrationAdapter(entry);
      if (ids.has(adapter.id)) invalidAdapter(adapter.id, 'duplicate integration id');
      ids.add(adapter.id);
      return adapter;
    }),
  );
}

export async function coordinateSelectedIntegrations<T>(
  registry: IntegrationRegistry,
  selected: readonly string[],
  visit: (adapter: IntegrationAdapter) => T | Promise<T>,
): Promise<T[]> {
  const selectedIds = new Set(selected);
  const results: T[] = [];
  for (const adapter of registry) {
    if (selectedIds.has(adapter.id)) results.push(await visit(adapter));
  }
  return results;
}

const EMPTY_EFFECTS: Effects = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: [],
};

function profileUninstallEffects(agent: 'claude' | 'codex', scope: 'project' | 'user'): Effects {
  let label = 'Codex profile plugin';
  if (agent === 'claude') {
    label = scope === 'project' ? 'Claude project plugin' : 'Claude profile plugin';
  }
  const operation = agent === 'claude' && scope === 'project' ? 'project' : 'profile';
  return {
    ...EMPTY_EFFECTS,
    configuration: [{ kind: 'deactivate', target: label, operation }],
    destructive: [{ kind: 'remove', target: label, operation }],
  };
}

function installEffects(agent: 'claude' | 'codex', scope: 'project' | 'user'): Effects {
  if (agent === 'codex') {
    return {
      ...EMPTY_EFFECTS,
      configuration: [{ kind: 'enable', target: 'Safeword Codex profile plugin' }],
    };
  }
  return {
    ...EMPTY_EFFECTS,
    configuration: [
      { kind: 'add', target: 'safeword', operation: scope },
      { kind: 'enable', target: 'safeword marketplace auto-update', operation: scope },
      {
        kind: 'enable',
        target: 'safeword last-known-good marketplace fallback',
        operation: scope,
      },
      { kind: 'install', target: 'safeword@safeword', operation: scope },
    ],
    network: [
      { kind: 'add', target: 'Claude plugin marketplace', operation: scope },
      { kind: 'install', target: 'Claude plugin marketplace', operation: scope },
    ],
  };
}

function claudeEffects(context: LifecycleContext): Effects {
  const observed = context.observation as
    { readonly installRequired?: boolean; readonly plugin?: unknown } | undefined;
  if (context.operation === 'install') {
    return observed?.installRequired === false
      ? EMPTY_EFFECTS
      : installEffects('claude', context.scope);
  }
  if (context.operation === 'check') return EMPTY_EFFECTS;
  return observed?.plugin === undefined
    ? EMPTY_EFFECTS
    : profileUninstallEffects('claude', context.scope);
}

function codexEffects(context: LifecycleContext): Effects {
  const observed = context.observation as
    | { readonly installRequired?: boolean; readonly plugin?: { readonly installed?: boolean } }
    | undefined;
  if (context.operation === 'install') {
    return observed?.installRequired === false
      ? EMPTY_EFFECTS
      : installEffects('codex', context.scope);
  }
  if (context.operation === 'check') return EMPTY_EFFECTS;
  return observed?.plugin?.installed === true
    ? profileUninstallEffects('codex', context.scope)
    : EMPTY_EFFECTS;
}

const FULL_HOOK_CAPABILITIES: LifecycleCapabilities = {
  lifecycle: {
    session_start: 'observe',
    prompt_submit: 'observe',
    pre_tool: 'block',
    post_tool: 'observe',
    stop: 'block',
  },
  blockableHooks: ['pre_tool', 'stop'],
  continuationHooks: ['stop'],
  activation: { availability: 'available', proof: 'observe' },
  conformance: { availability: 'unavailable' },
};

/** One mechanical command projection; policy owners and host selections stay separately validated. */
function claudeCommandRoutes(
  routes: readonly (Omit<BehaviorRoute, 'command' | 'sourceFamily'> & {
    interpreter?: 'bun' | 'bash';
    arguments?: string;
    native?: boolean;
  })[],
): BehaviorRoute[] {
  return routes.flatMap(
    ({ interpreter = 'bun', arguments: suffix = '', native = true, ...route }) => {
      const command = (owner: string) => projectHookCommand(owner, interpreter) + suffix;
      const selected = { ...route, execution: route.execution ?? ('synchronous' as const) };
      const project = { ...selected, command };
      if (!native) return [project];
      const grouped = pluginEventGroupEvents().includes(route.event);
      return [
        project,
        {
          ...selected,
          sourceFamily: grouped ? 'claude-native-event-groups' : 'claude-native',
          command: (owner: string) =>
            grouped
              ? (adaptHookValue(command(owner)) as string)
              : pluginHookCommand(route.event, command(owner)),
        },
      ];
    },
  );
}

const claude = defineIntegrationAdapter({
  id: 'claude',
  handlerEnvelopes: [
    ...(['SessionStart', 'UserPromptSubmit'] as const).map(event => ({
      id: event === 'SessionStart' ? 'claude.startup-envelope' : 'claude.prompt-envelope',
      event,
      sourceFamily: 'claude-native',
      execution: 'synchronous' as const,
      owner: 'packages/cli/src/claude-plugin/runtime/dispatch.ts',
      childFamily: 'claude-native-event-groups',
      command: () => pluginEventGroupCommand(event),
      localPolicyScopes:
        event === 'SessionStart'
          ? ['viableLegacyAuthority']
          : ['viableLegacyAuthority', 'automaticMigrationUnsafe'],
      reason:
        'Verified command-group transport and local legacy precedence; prompt-only migration delegates to cleanup. Children retain separate guarantees.',
    })),
    {
      id: 'claude.setup-envelope',
      event: 'Setup',
      sourceFamily: 'claude-native',
      execution: 'synchronous',
      matcher: 'init',
      owner: 'packages/cli/src/claude-plugin/runtime/dispatch.ts',
      command: () => pluginHookCommand('Setup', 'true'),
      localPolicyScopes: ['viableLegacyAuthority'],
      reason: 'Verified bootstrap no-op; no workflow guarantee or shared policy child.',
    },
  ],
  behaviorRoutes: [
    {
      behavior: 'session.quality-state-cleanup',
      event: 'SessionEnd',
      trigger: 'session_end',
      guarantees: ['observe'],
      command: projectHookCommand,
    },
    {
      behavior: 'session.quality-state-cleanup',
      event: 'SessionEnd',
      trigger: 'session_end',
      guarantees: ['observe'],
      sourceFamily: 'claude-native',
      command: owner => pluginHookCommand('SessionEnd', projectHookCommand(owner)),
    },
    {
      behavior: 'git.repair-bare-state',
      event: 'PreToolUse',
      trigger: 'pre_tool',
      guarantees: ['observe'],
      command: owner => projectHookCommand(owner, 'bash'),
    },
    {
      behavior: 'git.repair-bare-state',
      event: 'PreToolUse',
      trigger: 'pre_tool',
      guarantees: ['observe'],
      sourceFamily: 'claude-native',
      command: owner => pluginHookCommand('PreToolUse', projectHookCommand(owner, 'bash')),
    },
    ...claudeCommandRoutes(
      (
        [
          ['prompt.timestamp', 'UserPromptSubmit', 'prompt_submit', 'observe', 'synchronous'],
          ['prompt.work-reminders', 'UserPromptSubmit', 'prompt_submit', 'observe', 'synchronous'],
          [
            'retrospective.filing-nudge',
            'UserPromptSubmit',
            'prompt_submit',
            'observe',
            'synchronous',
          ],
          ['quality.stop', 'Stop', 'stop', 'reject_action', 'synchronous'],
          ['session.reentry-capture', 'Stop', 'stop', 'observe', 'synchronous'],
          ['diagnostics.self-report', 'Stop', 'stop', 'observe', 'synchronous'],
          ['retrospective.filing', 'Stop', 'stop', 'bounded_continuation', 'synchronous'],
          ['retrospective.extract', 'Stop', 'stop', 'observe', 'background'],
        ] as const
      ).map(([behavior, event, trigger, guarantee, execution]) => ({
        behavior,
        event,
        trigger,
        execution,
        guarantees: [guarantee],
      })),
    ),
    ...claudeCommandRoutes([
      {
        behavior: 'session.auto-upgrade',
        delegate: 'hooks/session-auto-upgrade.ts',
        event: 'SessionStart',
        trigger: 'session_start',
        guarantees: ['observe'],
        execution: 'async-rewake',
        native: false,
      },
      ...(
        [
          ['session.runtime-readiness', 'bash', '', undefined],
          ['session.dependencies', 'bun', '', undefined],
          ['session.standing-context', 'bun', ' --agent=claude', undefined],
          ['session.reply-format', 'bun', ' --agent=claude', undefined],
          ['session.version-advice', 'bun', '', undefined],
          ['session.lint-advice', 'bun', '', undefined],
          ['session.architecture-heal', 'bun', '', undefined],
          ['session.reentry-context', 'bun', '', undefined],
          ['session.compact-context', 'bun', '', 'compact'],
        ] as const
      ).map(([behavior, interpreter, suffix, matcher]) => ({
        behavior,
        interpreter,
        arguments: suffix,
        matcher,
        event: 'SessionStart',
        trigger: 'session_start' as const,
        guarantees: ['observe'] as const,
      })),
    ]),
    ...claudeCommandRoutes(
      [EDIT_TOOLS, 'Bash'].map(matcher => ({
        behavior: 'quality.pre-tool',
        event: 'PreToolUse',
        trigger: 'pre_tool',
        guarantees: ['reject_action'],
        matcher,
      })),
    ),
    ...claudeCommandRoutes(
      (
        [
          ['dependencies.pre-tool', 'Bash', undefined, 'reject_action'],
          ['config.approval-request', EDIT_TOOLS, undefined, 'observe'],
          ['architecture.stage', 'Bash', 'Bash(git commit*)', 'observe'],
          ['git.stale-branch-warning', 'Bash', 'Bash(git checkout*)', 'observe'],
          ['git.stale-branch-warning', 'Bash', 'Bash(git switch*)', 'observe'],
        ] as const
      ).map(([behavior, matcher, condition, guarantee]) => ({
        behavior,
        matcher,
        condition,
        event: 'PreToolUse',
        trigger: 'pre_tool',
        guarantees: [guarantee],
      })),
    ),
    ...claudeCommandRoutes(
      (
        [
          ['feedback.lint', EDIT_TOOLS],
          ['feedback.quality', `${EDIT_TOOLS}|Bash`],
          ['feedback.language-skill', EDIT_TOOLS],
          ['feedback.bypass-warning', EDIT_TOOLS],
          ['learning.index-sync', EDIT_TOOLS],
          ['ticket.phase-work-log', EDIT_TOOLS],
          ['dependencies.install-stamp', 'Bash'],
        ] as const
      ).map(([behavior, matcher]) => ({
        behavior,
        ...(behavior === 'feedback.lint' && { delegate: 'hooks/post-tool-lint.ts' }),
        matcher,
        event: 'PostToolUse',
        trigger: 'post_tool',
        guarantees: ['observe'],
      })),
    ),
  ],
  configuredHandlers: () => configuredCommandHandlers('claude', SETTINGS_HOOKS),
  nativeHandlerSources: [
    {
      family: 'claude-native',
      source: 'packages/cli/src/claude-plugin/hook-manifest.ts',
      format: 'command-manifest',
      generate: pluginHookManifest,
    },
    {
      family: 'claude-native-event-groups',
      source: 'packages/cli/src/claude-plugin/hook-manifest.ts',
      format: 'group-manifest',
      generate: pluginEventGroups,
    },
  ],
  defaultSelected: true,
  project: { owned: ['claude'], shared: ['skills'] },
  profile: {
    available: true,
    async observePrecondition(context) {
      if (context.operation === 'uninstall' && !context.agents.includes('claude'))
        return claudeRetainsProject(context.cwd, context.environment);
      const { claudeInstallRequiresMutation, observeClaudeProfile } =
        await import('../claude-plugin/profile.js');
      return {
        ...observeClaudeProfile(
          context.cwd,
          context.agents.includes('claude') ? context.scope : undefined,
        ),
        ...(context.operation === 'install' && {
          installRequired: claudeInstallRequiresMutation(context.cwd, context.scope),
        }),
      };
    },
  },
  capabilities: {
    ...FULL_HOOK_CAPABILITIES,
    lifecycle: { ...FULL_HOOK_CAPABILITIES.lifecycle, session_end: 'observe' },
  },
  async observe(context) {
    const { observeClaudeStatus } = await import('../claude-plugin/status.js');
    return observeClaudeStatus(context.cwd);
  },
  async install(context) {
    if (context.ports?.installClaude !== undefined) return context.ports.installClaude();
    const { installClaudePlugin } = await import('../claude-plugin/profile.js');
    return installClaudePlugin(context.cwd, context.scope);
  },
  async uninstall(context) {
    const { uninstallClaudePlugin } = await import('../claude-plugin/profile.js');
    return uninstallClaudePlugin(context.cwd, context.scope);
  },
  effects(context) {
    return claudeEffects(context);
  },
});

const codex = defineIntegrationAdapter({
  id: 'codex',
  outerCallDispositions: (
    [
      ['readStdin', 'transport', undefined],
      ['normalizeEvent', 'transport', undefined],
      ['parseCodexHookInput', 'transport', undefined],
      ['augmentSessionStart', 'transport', ['SessionStart']],
      ['postToolLintInputs', 'transport', ['PostToolUse']],
      ['packagedAdditionalContext', 'transport', ['PostToolUse', 'UserPromptSubmit']],
      ['emitAdditionalContext', 'transport', ['PostToolUse', 'UserPromptSubmit']],
      ['emitStopNoop', 'transport', ['Stop']],
      ['emitStopContinuation', 'transport', ['Stop']],
      ['resolveCodexProjectDirectory', 'host_policy', undefined],
      ['requireNativeProject', 'host_policy', undefined],
      ['legacyCodexEventIsViable', 'host_policy', undefined],
      ['packagedWorkflowContext', 'host_policy', ['SessionStart']],
      ['readPackagedSafewordInstructions', 'host_policy', ['SessionStart']],
      ['usablePackagedHandbookPath', 'host_policy', ['SessionStart']],
      ['packagedSafewordHandbookPath', 'host_policy', ['SessionStart']],
      ['hasSafewordProjectMarker', 'host_policy', ['PostToolUse', 'UserPromptSubmit', 'Stop']],
      ['readProjectTextFile', 'host_policy', ['PostToolUse', 'UserPromptSubmit', 'Stop']],
      ['classifyPackagedStopOutput', 'host_policy', ['Stop']],
      ['runPackagedHook', 'shared_delegate', undefined],
      ['collectPostToolLintContexts', 'shared_delegate', ['PostToolUse']],
      ['recordCodexHookProof', 'evidence', undefined],
    ] as const
  ).map(([callee, kind, events]) => ({
    callee,
    kind,
    events,
    reason: {
      transport: 'Host input/output projection; no independent policy guarantee.',
      host_policy:
        'Local authority, fallback or precedence policy; transitive semantics unadjudicated.',
      shared_delegate: 'Packaged child transport; shared facets remain separate obligations.',
      evidence: 'Advisory hook observation; not conformance or admission authority.',
    }[kind],
  })),
  handlerCompositions: [
    ...(
      [
        [
          'codex.session-context',
          'SessionStart',
          'session-start',
          'session_start',
          'hooks/session-codex-start.ts',
          'session.standing-context.read',
          '',
        ],
        [
          'codex.post-context',
          'PostToolUse',
          'post-tool-use',
          'post_tool',
          'hooks/post-tool-lint.ts',
          'feedback.lint',
          '^(apply_patch|Bash|Edit|Write)$',
        ],
        [
          'codex.prompt-context',
          'UserPromptSubmit',
          'user-prompt-submit',
          'prompt_submit',
          'hooks/prompt-retro-nudge.ts',
          'retrospective.filing-nudge',
          '',
        ],
      ] as const
    ).map(([id, event, command, trigger, delegate, primaryBehavior, matcher]) => ({
      id,
      envelope: {
        owner: 'packages/cli/src/commands/codex-hook.ts',
        localPolicyScopes: [
          'codexHook',
          'requireNativeProject',
          ...{
            SessionStart: [
              'runSessionStart',
              'packagedWorkflowContext',
              'readPackagedSafewordInstructions',
              'usablePackagedHandbookPath',
              'packagedSafewordHandbookPath',
            ],
            PostToolUse: ['runPostToolUse', 'readProjectTextFile'],
            UserPromptSubmit: ['runUserPromptSubmit', 'readProjectTextFile'],
          }[event],
        ],
        reason:
          'Local native authority/legacy precedence, packaged context fallback/index validation or project guidance queue/output merge; canonical child policies remain separate facets.',
      },
      event,
      trigger,
      delegate,
      matcher,
      sourceFamily: 'codex-native',
      execution: 'synchronous' as const,
      command: () => codexPluginHookCommand(command),
      facets: [
        primaryBehavior,
        ...(id === 'codex.post-context' ? ['feedback.quality', 'feedback.language-skill'] : []),
        ...(id === 'codex.prompt-context' ? ['prompt.timestamp'] : []),
      ].map(behavior => ({
        behavior,
        disposition: 'implementation' as const,
        guarantee: 'observe' as const,
      })),
    })),
    {
      id: 'codex.stop',
      envelope: {
        owner: 'packages/cli/src/commands/codex-hook.ts',
        localPolicyScopes: [
          'codexHook',
          'requireNativeProject',
          'runStop',
          'classifyPackagedStopOutput',
          'readProjectTextFile',
        ],
        reason:
          'Local native/legacy precedence and packaged-before-project continuation arbitration. Packaged codex/stop.ts orchestrates extraction through canonical retro trigger/child arguments; completion/presentation/architecture/filing facets retain their own guarantees.',
      },
      event: 'Stop',
      trigger: 'stop',
      sourceFamily: 'codex-native',
      delegate: 'hooks/codex/stop.ts',
      matcher: '',
      execution: 'synchronous',
      command: () => codexPluginHookCommand('stop'),
      facets: [
        ...['completion.session-evidence', 'presentation.terminal-handoff'].map(behavior => ({
          behavior,
          disposition: 'permitted_alternative' as const,
          guarantee: 'bounded_continuation' as const,
        })),
        {
          behavior: 'architecture.done-advice',
          disposition: 'implementation',
          guarantee: 'observe',
        },
        {
          behavior: 'retrospective.filing-decision',
          disposition: 'implementation',
          guarantee: 'bounded_continuation',
        },
      ],
    },
  ],
  behaviorRoutes: [
    {
      behavior: 'quality.pre-tool',
      event: 'PreToolUse',
      trigger: 'pre_tool',
      guarantees: ['reject_action'],
      sourceFamily: 'codex-native',
      matcher: '^(apply_patch|Bash|Edit|Write)$',
      delegate: 'hooks/codex/pre-tool-quality.ts',
      command: () => codexPluginHookCommand('pre-tool-use'),
    },
  ],
  nativeHandlerSources: [
    {
      family: 'codex-native',
      source: 'packages/cli/codex-plugin/hooks.json',
      format: 'command-manifest',
    },
  ],
  defaultSelected: true,
  project: { owned: ['codex'], shared: [] },
  profile: {
    available: true,
    async observePrecondition(context) {
      if (context.operation === 'uninstall' && !context.agents.includes('codex'))
        return codexRetainsProject(context.environment);
      const { codexInstallRequiresMutation, observeCodexMigrationResult } =
        await import('../codex-plugin/operations.js');
      const observation = observeCodexMigrationResult(context.cwd);
      return {
        ...observation,
        ...(context.operation === 'install' && {
          installRequired: codexInstallRequiresMutation(observation),
        }),
      };
    },
  },
  capabilities: FULL_HOOK_CAPABILITIES,
  async observe(context) {
    const { observeCodexMigration } = await import('../codex-plugin/operations.js');
    return observeCodexMigration(context.cwd, context.environment);
  },
  async install(context) {
    if (
      context.projectResult?.findings.some(
        finding => finding.code === 'CODEX_PLUGIN_HANDOFF_DEFERRED',
      ) === true
    ) {
      return createResult({ state: 'healthy' });
    }
    if (context.ports?.installCodex === undefined) {
      return createResult({
        state: 'failed',
        errors: [
          {
            code: 'CODEX_INSTALL_PORT_UNAVAILABLE',
            message: 'Codex installation is unavailable in this execution context.',
            retryable: false,
          },
        ],
      });
    }
    return context.ports.installCodex();
  },
  async uninstall() {
    const { uninstallCodexPlugin } = await import('../codex-plugin/operations.js');
    return uninstallCodexPlugin();
  },
  effects(context) {
    return codexEffects(context);
  },
});

async function resolveOpenCodeRoot(context: LifecycleContext): Promise<string | undefined> {
  const { resolveOpenCodeConfigRoot } = await import('../opencode/profile.js');
  return resolveOpenCodeConfigRoot({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: context.environment ?? process.env,
  });
}

function openCodeConfigRootRequired(): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'OPENCODE_CONFIG_ROOT_UNRESOLVED',
        message: 'Set OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME, HOME, or USERPROFILE for OpenCode.',
        severity: 'error',
      },
    ],
    nextActions: [
      {
        kind: 'human',
        instruction:
          'Set OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME, HOME, or USERPROFILE, then rerun Safeword.',
        mutates: false,
        requiresHuman: true,
      },
    ],
  });
}

async function observeOpenCode(context: LifecycleContext): Promise<CliResult> {
  const root = await resolveOpenCodeRoot(context);
  if (root === undefined) {
    return openCodeConfigRootRequired();
  }
  const [{ observeOpenCodeProfile }, { observeOpenCodeVersion }] = await Promise.all([
    import('../opencode/profile.js'),
    import('../opencode/conformance.js'),
  ]);
  return observeOpenCodeProfile(root, {
    projectDirectory: context.cwd,
    opencodeVersion: observeOpenCodeVersion(context.environment ?? process.env),
  });
}

const opencode = defineIntegrationAdapter({
  id: 'opencode',
  callbackBoundaries: [
    {
      id: 'v2.enrollment',
      event: 'plugin.setup',
      scope: 'setup',
      disposition: 'enrollment' as const,
      owner: 'packages/cli/src/opencode/v2-enrollment.ts',
      entrypoint: 'readOpenCodeV2Enrollment',
      requiredCalls: [
        ['readOpenCodeV2Enrollment', 'profile', 'project', 'packageRoot', 'layout'],
        ['registerWorkerRestrictions', 'context'],
      ],
      conditions: [
        'profile !== activeProfile',
        '!hasSafewordProjectMarker(project)',
        "!context.app.version.startsWith('2.')",
        '!readOpenCodeV2Enrollment(profile, project, packageRoot, layout)',
      ],
      reason:
        'Lifecycle enrollment reader owns package/project/profile identity; setup locally gates all native registrations. Enrollment is not activation or proof.',
    },
    {
      id: 'v2.ticket.observation',
      event: 'tool.execute.after',
      scope: 'setup',
      disposition: 'host_policy' as const,
      owner: 'packages/cli/src/opencode/observe-ticket.ts',
      entrypoint: 'observeOpenCodeTicket',
      producer: 'packages/cli/src/opencode/dispatcher.ts',
      requiredCalls: [['normalizeOpenCodeTool', "'v2'", 'event.tool', 'event.input']],
      conditions: ["event.status !== 'completed'", "!file.endsWith('.md')"],
      reason:
        'Completed Markdown edits notify the shared dispatcher so a saved feature ticket can bind its conversation.',
    },
    ...(['prompt', 'context'] as const).map(event => ({
      id: `v2.worker.${event}`,
      event: `session.${event}`,
      scope: 'registerWorkerRestrictions',
      disposition: 'host_policy' as const,
      owner: 'packages/cli/src/host-contract/workers.ts',
      entrypoint: 'readWorkerContracts',
      projectionEntrypoint: 'workerInvocationHeader',
      producer: 'packages/cli/scripts/generate-opencode-v2-plugin.ts',
      readerArgument: 'layout.workers',
      requiredCalls:
        event === 'prompt'
          ? [
              ['workerInvocationHeader', 'worker.name'],
              ['sessions.set', 'session.id', 'mask'],
            ]
          : [
              ['sessions.get', 'event.sessionID'],
              ['Reflect.deleteProperty', 'event.tools', 'tool'],
            ],
      conditions:
        event === 'prompt'
          ? ['header === undefined', 'session.parentID !== undefined && mask !== undefined']
          : ['mask === undefined', '!mask.has(tool)'],
      reason:
        'Canonical worker declarations own tools; this SDK-local child-session map narrows model tools. Native child creation/fresh-context delivery remains host-owned.',
    })),
  ].map(route => ({
    ...route,
    ordinal: 0,
    sourceFamily: 'opencode-v2',
    callbackSource: 'packages/opencode-v2-plugin/src/index.ts',
    callbackCallees:
      (
        {
          'plugin.setup': ['readOpenCodeV2Enrollment', 'registerWorkerRestrictions'],
          'tool.execute.after': ['normalizeOpenCodeTool', 'dispatch'],
          'session.prompt': ['context.session.get', 'sessions.set'],
          'session.context': ['sessions.get', 'Reflect.deleteProperty'],
        } as Record<string, string[]>
      )[route.event] ?? [],
  })),
  callbackResources: [
    ['v2.skills.initial', 'skill.transform', 'registerSkills', 0],
    ['v2.skills.refresh', 'skill.transform', 'registerSkills', 1],
    ['v2.skills.prompt', 'session.prompt', 'registerSkills', 0],
    ['v2.commands', 'command.transform', 'registerCommands', 0],
  ].map(([id, event, scope, ordinal]) => ({
    id: String(id),
    event: String(event),
    scope: String(scope),
    ordinal: Number(ordinal),
    sourceFamily: 'opencode-v2',
    callbackSource: 'packages/opencode-v2-plugin/src/index.ts',
    owner: 'packages/cli/src/host-contract/catalogue.ts',
    producer:
      scope === 'registerCommands'
        ? 'packages/cli/scripts/generate-opencode-v2-plugin.ts'
        : 'packages/cli/src/host-contract/portable-core.ts',
    entrypoint:
      scope === 'registerCommands' ? 'readCanonicalCommandWrappers' : 'readPackagedSkillContracts',
    readerArgument: scope === 'registerCommands' ? 'layout.commands' : 'layout.catalogue',
    requiredCallees:
      scope === 'registerCommands'
        ? ['context.session.prompt']
        : ['registerSkill', 'initial.dispose'],
    callbackTarget: event === 'skill.transform' ? 'apply' : undefined,
    callbackCallees:
      (
        {
          'session.prompt': ['initial.dispose', 'context.skill.transform'],
          'command.transform': ['context.session.prompt'],
        } as Record<string, string[]>
      )[String(event)] ?? [],
  })),
  behaviorRoutes: [
    {
      behavior: 'quality.pre-tool',
      event: 'tool.execute.before',
      trigger: 'pre_tool',
      guarantees: ['reject_action'],
      sourceFamily: 'opencode-v2',
      callbackSource: 'packages/opencode-v2-plugin/src/index.ts',
      delegate: 'hooks/codex/pre-tool-quality.ts',
    },
  ],
  nativeHandlerSources: [
    {
      family: 'opencode-v2',
      source: 'packages/opencode-v2-plugin/src/index.ts',
      format: 'sdk-source',
    },
  ],
  defaultSelected: false,
  exposeStatusData: true,
  project: { owned: [], shared: [] },
  profile: {
    available: true,
    async observePrecondition(context) {
      if (context.operation !== 'uninstall') return observeOpenCode(context);
      const root = await resolveOpenCodeRoot(context);
      const { observeOpenCodeV2Removal } = await import('../opencode/v2-profile.js');
      const removal = root ? observeOpenCodeV2Removal(root, context.cwd) : undefined;
      return context.agents.includes('opencode') ? removal : removal?.enrollment !== undefined;
    },
    async preflight(context) {
      return (await resolveOpenCodeRoot(context)) === undefined
        ? openCodeConfigRootRequired()
        : createResult({ state: 'healthy' });
    },
  },
  capabilities: {
    lifecycle: {
      session_start: 'unavailable',
      prompt_submit: 'unavailable',
      pre_tool: 'block',
      post_tool: 'unavailable',
      stop: 'unavailable',
    },
    blockableHooks: ['pre_tool'],
    activation: { availability: 'available', proof: 'activation-v2' },
    conformance: { availability: 'available', proof: 'conformance-v2' },
  },
  observe(context) {
    return observeOpenCode(context);
  },
  async install(context) {
    const root = await resolveOpenCodeRoot(context);
    if (root === undefined) return openCodeConfigRootRequired();
    const [{ installOpenCodeProfile }, { observeOpenCodeVersion }] = await Promise.all([
      import('../opencode/profile.js'),
      import('../opencode/conformance.js'),
    ]);
    return installOpenCodeProfile(root, {
      projectDirectory: context.cwd,
      opencodeVersion: observeOpenCodeVersion(context.environment ?? process.env),
    });
  },
  async uninstall(context) {
    const root = await resolveOpenCodeRoot(context);
    if (root === undefined) return openCodeConfigRootRequired();
    const { uninstallOpenCodeProfile } = await import('../opencode/profile.js');
    const removal = context.observation as ReturnType<typeof observeOpenCodeV2Removal>;
    return uninstallOpenCodeProfile(root, context.cwd, { fingerprint: removal?.fingerprint });
  },
  effects(context) {
    if (context.operation === 'uninstall') {
      const removal = context.observation as ReturnType<typeof observeOpenCodeV2Removal>;
      if (typeof removal?.enrollment !== 'string') return EMPTY_EFFECTS;
      return {
        ...EMPTY_EFFECTS,
        destructive: [
          { kind: 'remove', target: removal.enrollment },
          ...(removal.declaration ? [{ kind: 'remove-entry', target: removal.declaration }] : []),
        ],
      };
    }
    if (context.operation !== 'install') return EMPTY_EFFECTS;
    return {
      ...EMPTY_EFFECTS,
      configuration: [{ kind: 'install', target: 'Safeword OpenCode profile plugin' }],
    };
  },
});

/** Cursor binding IDs are looked up by actual source and arguments, never a fixed index. */
function cursorCommandRoutes<
  T extends Omit<BehaviorRoute, 'behavior' | 'guarantees' | 'command' | 'sourceFamily'> & {
    arguments?: readonly string[];
  },
>(routes: readonly T[]) {
  return routes.flatMap(input => {
    const { arguments: args = [], ...route } = input;
    const suffix = args.length > 0 ? ` ${args.join(' ')}` : '';
    return [
      {
        ...route,
        execution: input.execution ?? ('synchronous' as const),
        command: (adapter: string) => `bun ./.safeword/${adapter}${suffix}`,
      },
      {
        ...route,
        execution: input.execution ?? ('synchronous' as const),
        sourceFamily: 'cursor-native',
        command: (adapter: string) => {
          const binding = cursorPluginBindings().find(
            row =>
              row.event === route.event &&
              `hooks/${row.path}` === adapter &&
              row.args.length === args.length &&
              row.args.every((argument, index) => argument === args[index]),
          );
          return binding ? cursorPluginHookCommand(binding.id) : undefined;
        },
      },
    ];
  });
}

const cursor = defineIntegrationAdapter({
  id: 'cursor',
  handlerCompositions: cursorCommandRoutes<HandlerComposition>([
    {
      id: 'cursor.stop',
      envelope: {
        owner: 'packages/cli/templates/hooks/cursor/stop.ts',
        localPolicyScopes: [
          '<module>',
          'assistantText',
          'readLastAssistantMessage',
          'emitRetroOrEmpty',
          'isAutomatedEvidenceRun',
          'architectureNudgeForDonePhase',
        ],
        reason:
          'Local workspace/status/loop/edit-marker/transcript and priority/output coordination. Six canonical decision facets retain separate guarantees; native transport forwards the selected schema-owned binding path and arguments.',
      },
      delegate: 'hooks/cursor/stop.ts',
      event: 'stop',
      trigger: 'stop',
      loopLimit: 1,
      facets: [
        ...['completion.session-evidence', 'presentation.terminal-handoff'].map(behavior => ({
          behavior,
          disposition: 'permitted_alternative' as const,
          guarantee: 'bounded_continuation' as const,
        })),
        ...(
          [
            ['review.stop-option', 'observe'],
            ['architecture.done-advice', 'observe'],
            ['retrospective.filing-decision', 'bounded_continuation'],
            ['retrospective.availability', 'observe'],
          ] as const
        ).map(([behavior, guarantee]) => ({
          behavior,
          disposition: 'implementation' as const,
          guarantee,
        })),
      ],
    },
  ]),
  behaviorRoutes: cursorCommandRoutes<BehaviorRoute & { arguments?: readonly string[] }>([
    {
      behavior: 'session.auto-upgrade',
      delegate: 'hooks/session-cursor-auto-upgrade.ts',
      event: 'sessionStart',
      trigger: 'session_start',
      guarantees: ['observe'],
    },
    {
      behavior: 'feedback.lint',
      delegate: 'hooks/cursor/after-file-edit.ts',
      event: 'afterFileEdit',
      trigger: 'post_tool',
      guarantees: ['observe'],
    },
    ...[
      { event: 'preToolUse', delegate: 'hooks/cursor/pre-tool-quality.ts', matcher: 'Write' },
      { event: 'beforeShellExecution', delegate: 'hooks/cursor/before-shell-execution.ts' },
    ].map(route => ({
      ...route,
      behavior: 'quality.pre-tool',
      trigger: 'pre_tool' as const,
      guarantees: ['reject_action'] as const,
    })),
    {
      behavior: 'session.standing-context',
      event: 'sessionStart',
      trigger: 'session_start',
      guarantees: ['observe'],
      arguments: ['--agent=cursor'],
    },
    ...(
      [
        ['feedback.quality', 'hooks/cursor/post-tool-quality.ts', 'Write|Shell'],
        ['feedback.language-skill', 'hooks/cursor/post-tool-skill-nudge.ts', 'Write'],
      ] as const
    ).map(([behavior, delegate, matcher]) => ({
      behavior,
      delegate,
      matcher,
      event: 'postToolUse',
      trigger: 'post_tool' as const,
      guarantees: ['observe'] as const,
    })),
  ]),
  configuredHandlers: () => configuredCommandHandlers('cursor', CURSOR_HOOKS),
  nativeHandlerSources: [
    {
      family: 'cursor-native',
      source: 'packages/cli/src/cursor-plugin/bindings.ts',
      format: 'command-manifest',
      generate: cursorPluginHookManifest,
    },
  ],
  defaultSelected: false,
  project: { owned: ['cursor'], shared: ['skills'] },
  profile: { available: false },
  capabilities: {
    lifecycle: {
      session_start: 'observe',
      prompt_submit: 'unavailable',
      pre_tool: 'block',
      post_tool: 'observe',
      stop: 'observe',
    },
    blockableHooks: ['pre_tool'],
    continuationHooks: ['stop'],
    activation: { availability: 'unavailable' },
    conformance: { availability: 'unavailable' },
  },
  async observe(context) {
    const [{ hasCursorProjectAssets, observeCursorProject }, { projectLifecycleSchema }] =
      await Promise.all([import('./cursor.js'), import('./schema.js')]);
    const schema = projectLifecycleSchema(context.cwd, context.agents);
    const result = observeCursorProject(context.cwd, schema);
    if (context.operation !== 'uninstall') return result;
    return {
      ...result,
      data: { ...(result.data as object), present: hasCursorProjectAssets(context.cwd, schema) },
    };
  },
  async install(context) {
    const result = await cursor.observe(context);
    return { ...result, changed: context.projectResult?.changed === true };
  },
  uninstall(context) {
    const present = (
      context.observation as { readonly data?: { readonly present?: boolean } } | undefined
    )?.data?.present;
    return createResult({ state: present === true ? 'changed' : 'healthy' });
  },
  effects() {
    return EMPTY_EFFECTS;
  },
});

export const PRODUCTION_INTEGRATIONS = createIntegrationRegistry([claude, codex, opencode, cursor]);
