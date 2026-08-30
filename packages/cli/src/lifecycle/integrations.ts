import { type CliResult, createResult, type Effects } from '../cli-protocol/result.js';

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
  readonly lifecycle: Readonly<Record<LifecycleEvent, LifecycleStrength>>;
  readonly blockableHooks: readonly LifecycleEvent[];
  readonly activation: EvidenceCapability;
  readonly conformance: EvidenceCapability;
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

function validateCapabilities(adapter: IntegrationAdapter): void {
  const lifecycle = adapter.capabilities?.lifecycle;
  const blockableHooks = adapter.capabilities?.blockableHooks;
  if (lifecycle === undefined || !Array.isArray(blockableHooks)) {
    invalidAdapter(adapter.id, 'lifecycle capabilities are incomplete');
  }
  for (const event of LIFECYCLE_EVENTS) {
    const strength = lifecycle[event];
    if (!LIFECYCLE_STRENGTHS.has(strength)) {
      invalidAdapter(adapter.id, `lifecycle capability ${event} is invalid`);
    }
    if (strength === 'block' && !blockableHooks.includes(event)) {
      invalidAdapter(adapter.id, `blocking capability ${event} has no blockable hook`);
    }
  }
  validateBlockableHooks(adapter.id, lifecycle, blockableHooks);
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
  activation: { availability: 'available', proof: 'observe' },
  conformance: { availability: 'unavailable' },
};

const claude = defineIntegrationAdapter({
  id: 'claude',
  defaultSelected: true,
  project: { owned: ['claude'], shared: ['skills'] },
  profile: {
    available: true,
    async observePrecondition(context) {
      const { claudeInstallRequiresMutation, observeClaudeProfile } =
        await import('../claude-plugin/profile.js');
      return {
        ...observeClaudeProfile(context.cwd, context.scope),
        ...(context.operation === 'install' && {
          installRequired: claudeInstallRequiresMutation(context.cwd, context.scope),
        }),
      };
    },
  },
  capabilities: FULL_HOOK_CAPABILITIES,
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
  defaultSelected: true,
  project: { owned: ['codex'], shared: [] },
  profile: {
    available: true,
    async observePrecondition(context) {
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

function openCodeProfileEffects(kind: 'add' | 'remove'): Effects {
  const files = [
    'OpenCode profile plugin',
    'OpenCode Safeword identity',
    'OpenCode Safeword dispatcher',
  ].map(target => ({ kind, target }));
  return {
    ...EMPTY_EFFECTS,
    files,
    destructive:
      kind === 'remove'
        ? files.map(({ target }) => ({ kind: 'remove', target, operation: 'profile' }))
        : [],
  };
}

function openCodeEffects(context: LifecycleContext): Effects {
  if (context.operation === 'check') return EMPTY_EFFECTS;
  const data = (
    context.observation as
      | {
          readonly data?: {
            readonly installed?: boolean;
            readonly profile_removable?: boolean;
          };
        }
      | undefined
  )?.data;
  if (context.operation === 'install') {
    return data?.installed === true ? EMPTY_EFFECTS : openCodeProfileEffects('add');
  }
  return data?.profile_removable === true ? openCodeProfileEffects('remove') : EMPTY_EFFECTS;
}

const opencode = defineIntegrationAdapter({
  id: 'opencode',
  defaultSelected: false,
  exposeStatusData: true,
  project: { owned: [], shared: [] },
  profile: {
    available: true,
    async observePrecondition(context) {
      return observeOpenCode(context);
    },
    async preflight(context) {
      return (await resolveOpenCodeRoot(context)) === undefined
        ? openCodeConfigRootRequired()
        : createResult({ state: 'healthy' });
    },
  },
  capabilities: {
    lifecycle: {
      session_start: 'observe',
      prompt_submit: 'observe',
      pre_tool: 'block',
      post_tool: 'observe',
      stop: 'observe',
    },
    blockableHooks: ['pre_tool'],
    activation: { availability: 'available', proof: 'activation-v1' },
    conformance: { availability: 'available', proof: 'conformance-v1' },
  },
  observe(context) {
    return observeOpenCode(context);
  },
  async install(context) {
    const root = await resolveOpenCodeRoot(context);
    if (root === undefined) return openCodeConfigRootRequired();
    const { installOpenCodeProfile } = await import('../opencode/profile.js');
    return installOpenCodeProfile(root);
  },
  async uninstall(context) {
    const root = await resolveOpenCodeRoot(context);
    if (root === undefined) return openCodeConfigRootRequired();
    const { uninstallOpenCodeProfile } = await import('../opencode/profile.js');
    return uninstallOpenCodeProfile(root);
  },
  effects(context) {
    return openCodeEffects(context);
  },
});

const cursor = defineIntegrationAdapter({
  id: 'cursor',
  defaultSelected: false,
  project: { owned: ['cursor'], shared: ['skills'] },
  profile: { available: false },
  capabilities: {
    lifecycle: {
      session_start: 'unavailable',
      prompt_submit: 'unavailable',
      pre_tool: 'block',
      post_tool: 'observe',
      stop: 'observe',
    },
    blockableHooks: ['pre_tool'],
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
