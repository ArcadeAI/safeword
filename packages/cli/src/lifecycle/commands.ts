import { createHash } from 'node:crypto';

import { type AgentIntegration, parseAgentSelection } from '../cli-protocol/agent-selection.js';
import type { CommandInvocation } from '../cli-protocol/handler.js';
import { onlineRequired } from '../cli-protocol/online-required.js';
import { type CliPlan, createPlan, toWirePlan } from '../cli-protocol/plan.js';
import { createReconciliationPlan } from '../cli-protocol/reconciliation.js';
import {
  type CliResult,
  combinedResultState,
  combineEffects,
  createResult,
  type Effects,
  type NextAction,
} from '../cli-protocol/result.js';
import { removeProject } from '../commands/remove.js';
import type { SafewordSchema } from '../schema.js';
import { hasCursorProjectAssets, observeCursorProject } from './cursor.js';
import { convergeSetup, createSetupPlan, type SetupPlanOptions } from './project-install.js';
import { projectLifecycleSchema } from './schema.js';

interface LifecycleInstallAdapters {
  readonly installClaude: () => Promise<CliResult>;
  readonly installCodex: () => Promise<CliResult>;
}

/** Reporting order for install surfaces: project first, then each integration. */
const LIFECYCLE_SURFACE_ORDER: readonly ('project' | AgentIntegration)[] = [
  'project',
  'claude',
  'codex',
  'cursor',
];

interface SurfaceResult {
  readonly name: string;
  readonly result: CliResult;
}

function codexLegacyHandoffDeferred(result: CliResult): boolean {
  return result.findings.some(finding => finding.code === 'CODEX_PLUGIN_HANDOFF_DEFERRED');
}

function activationActionsFor(surface: SurfaceResult): string[] {
  if (surface.name === 'claude' && surface.result.changed) return ['run /reload-plugins'];
  if (surface.name === 'codex' && surface.result.state === 'action_required') {
    return ['restart Codex', 'start a new Codex task'];
  }
  return [];
}

/** One entry per distinct action: surfaces can independently suggest the same next step. */
function uniqueNextActions(actions: readonly NextAction[]): NextAction[] {
  const seen = new Set<string>();
  return actions.filter(action => {
    const identity =
      'command' in action ? `command:${action.command}` : `human:${action.instruction}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function projectReloadSuperseded(
  command: string,
  surface: SurfaceResult,
  surfaceByName: ReadonlyMap<string, SurfaceResult>,
): boolean {
  if (command !== '/reload-plugins' || surface.name !== 'project') return false;
  return surfaceByName.has('claude');
}

function normalizedProjectInstallAction(
  action: Extract<NextAction, { readonly command: string }>,
  surface: SurfaceResult,
  surfaceByName: ReadonlyMap<string, SurfaceResult>,
): NextAction[] | undefined {
  // The project surface computes its next action before the agent surfaces
  // run, so it can suggest installing an agent this very run already handled.
  // Drop that: the agent's own activation action is the accurate next step,
  // and repeating the install is not.
  const unifiedInstall = /^safeword install --agents=(claude|codex)$/u.exec(action.command);
  if (unifiedInstall === null || surface.name !== 'project') return undefined;
  const target = surfaceByName.get(unifiedInstall[1] ?? '');
  return target !== undefined && target.result.state !== 'failed' ? [] : [action];
}

function normalizedProfileInstallAction(
  action: Extract<NextAction, { readonly command: string }>,
  surface: SurfaceResult,
): NextAction[] {
  const profileInstall = /^safeword (claude|codex) install$/u.exec(action.command);
  if (profileInstall === null) return [action];
  if (surface.result.state !== 'failed' || surface.name !== profileInstall[1]) return [];
  return [{ ...action, command: `safeword install --agents=${surface.name}` }];
}

function normalizedInstallNextAction(
  action: NextAction,
  surface: SurfaceResult,
  surfaceByName: ReadonlyMap<string, SurfaceResult>,
): NextAction[] {
  if (!('command' in action)) return [action];
  if (projectReloadSuperseded(action.command, surface, surfaceByName)) return [];
  const projectAction = normalizedProjectInstallAction(action, surface, surfaceByName);
  return projectAction ?? normalizedProfileInstallAction(action, surface);
}

function normalizedInstallNextActions(
  surface: SurfaceResult,
  surfaceByName: ReadonlyMap<string, SurfaceResult>,
): NextAction[] {
  return surface.result.nextActions.flatMap(action =>
    normalizedInstallNextAction(action, surface, surfaceByName),
  );
}

function combineInstallResults(
  agents: readonly string[],
  surfaces: readonly SurfaceResult[],
): CliResult {
  const results = surfaces.map(surface => surface.result);
  const effects = combineEffects(results.map(result => result.effects));
  const surfaceByName = new Map(surfaces.map(surface => [surface.name, surface]));
  return createResult({
    state: combinedResultState(results),
    changed: results.some(result => result.changed),
    effects,
    findings: results.flatMap(result => result.findings),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: uniqueNextActions(
      surfaces.flatMap(surface => normalizedInstallNextActions(surface, surfaceByName)),
    ),
    data: {
      command: 'install',
      operation: 'install',
      selected_agents: agents,
      surfaces: LIFECYCLE_SURFACE_ORDER.map(name => {
        const surface = surfaceByName.get(name);
        if (surface === undefined) return { name, selected: false };
        const activationActions = activationActionsFor(surface);
        return {
          name,
          selected: true,
          state: surface.result.state,
          ...(activationActions.length > 0 && { activation_actions: activationActions }),
        };
      }),
    },
  });
}

async function installProjectSurface(
  invocation: CommandInvocation,
  agents: readonly string[],
): Promise<CliResult> {
  const projectSchema = projectLifecycleSchema(invocation.cwd, agents);
  return convergeSetup(invocation.cwd, {
    noModify: invocation.options.modify === false,
    repairVersionMarker: invocation.options.repairVersionMarker === true,
    migrateNamespace:
      typeof invocation.options.migrateNamespace === 'boolean'
        ? invocation.options.migrateNamespace
        : undefined,
    progress: invocation.progress,
    schema: projectSchema,
  });
}

async function installAgentSurfaces(
  cwd: string,
  agents: readonly string[],
  projectResult: CliResult,
  adapters: LifecycleInstallAdapters,
): Promise<SurfaceResult[]> {
  const surfaces: SurfaceResult[] = [];
  if (agents.includes('claude')) {
    surfaces.push({ name: 'claude', result: await adapters.installClaude() });
  }
  if (agents.includes('codex')) {
    // Project convergence already attempted the legacy handoff. Its failure is
    // deliberately advisory: legacy hooks remain active and the project
    // bootstrap retries for the next task/developer. Retrying the same profile
    // mutation here only changes that safe, loud outcome into a fatal install.
    if (codexLegacyHandoffDeferred(projectResult)) {
      surfaces.push({ name: 'codex', result: createResult({ state: 'healthy' }) });
    } else {
      surfaces.push({ name: 'codex', result: await adapters.installCodex() });
    }
  }
  if (agents.includes('cursor')) {
    // Cursor has no host process; its outcome is read back from the assets the
    // project reconciliation just wrote, never mirrored from the project state.
    const observed = observeCursorProject(cwd, projectLifecycleSchema(cwd, agents));
    surfaces.push({
      name: 'cursor',
      result: { ...observed, changed: projectResult.changed },
    });
  }
  return surfaces;
}

export async function installLifecycle(
  invocation: CommandInvocation,
  adapters: LifecycleInstallAdapters,
): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) {
    return createResult({
      state: 'failed',
      errors: [{ ...parsed.error, retryable: false }],
      data: { command: 'install' },
    });
  }
  const { agents } = parsed.selection;
  const scope = lifecycleScope(invocation.options.scope, 'install', agents);
  if (!scope.ok) return scope.result;
  const requiresProfileNetwork = agents.some(agent => agent === 'claude' || agent === 'codex');
  if (invocation.offline && requiresProfileNetwork) return onlineRequired('install');

  const projectResult = await installProjectSurface(invocation, agents);
  const surfaces = await installAgentSurfaces(invocation.cwd, agents, projectResult, adapters);
  return combineInstallResults(agents, [{ name: 'project', result: projectResult }, ...surfaces]);
}

const EMPTY_SURFACE_EFFECTS: Effects = {
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
    files: [],
    packages: [],
    configuration: [{ kind: 'deactivate', target: label, operation }],
    network: [],
    destructive: [{ kind: 'remove', target: label, operation }],
  };
}

function agentInstallEffects(
  agent: Exclude<AgentIntegration, 'cursor'>,
  scope: 'project' | 'user',
): Effects {
  const labels: Readonly<Record<AgentIntegration, string>> = {
    claude: scope === 'project' ? 'Claude project plugin' : 'Claude profile plugin',
    codex: 'Codex profile plugin',
    cursor: 'Cursor project integration',
  };
  const label = labels[agent];
  const operation = agent === 'claude' && scope === 'project' ? 'project' : 'profile';
  return {
    files: [],
    packages: [],
    configuration: [{ kind: 'activate', target: label, operation }],
    network: [{ kind: 'plugin-marketplace', target: label, operation: 'install' }],
    destructive: [],
  };
}

interface PreparedLifecycle {
  readonly agents: readonly AgentIntegration[];
  readonly projectSchema: SafewordSchema;
  readonly projectPlan: CliPlan;
  readonly full: boolean;
  readonly scope: 'project' | 'user';
  readonly surfaces: readonly { readonly name: string; readonly effects: Effects }[];
  readonly plan: CliPlan;
}

interface PrepareLifecycleOptions {
  readonly full?: boolean;
  readonly install?: SetupPlanOptions;
  readonly scope?: 'project' | 'user';
}

interface ProfilePrecondition {
  readonly agent: 'claude' | 'codex';
  readonly observation: unknown;
}

async function profilePreconditions(
  cwd: string,
  agents: readonly AgentIntegration[],
  scope: 'project' | 'user',
  operation: 'install' | 'uninstall',
): Promise<ProfilePrecondition[]> {
  const observations: ProfilePrecondition[] = [];
  if (agents.includes('claude')) {
    const { claudeInstallRequiresMutation, observeClaudeProfile } =
      await import('../claude-plugin/profile.js');
    observations.push({
      agent: 'claude',
      observation: {
        ...observeClaudeProfile(cwd, scope),
        ...(operation === 'install' && {
          installRequired: claudeInstallRequiresMutation(cwd, scope),
        }),
      },
    });
  }
  if (agents.includes('codex')) {
    const { codexInstallRequiresMutation, observeCodexMigrationResult } =
      await import('../codex-plugin/operations.js');
    const observation = observeCodexMigrationResult(cwd);
    observations.push({
      agent: 'codex',
      observation: {
        ...observation,
        ...(operation === 'install' && {
          installRequired: codexInstallRequiresMutation(observation),
        }),
      },
    });
  }
  return observations;
}

function observedAgentEffects(
  operation: 'install' | 'uninstall',
  agent: AgentIntegration,
  observation: unknown,
  scope: 'project' | 'user',
): Effects {
  if (agent === 'cursor') return EMPTY_SURFACE_EFFECTS;
  if (agent === 'claude') {
    const observed = observation as {
      readonly health?: string;
      readonly installRequired?: boolean;
      readonly plugin?: unknown;
    };
    if (operation === 'install') {
      return observed.installRequired === false
        ? EMPTY_SURFACE_EFFECTS
        : agentInstallEffects(agent, scope);
    }
    return observed.plugin === undefined
      ? EMPTY_SURFACE_EFFECTS
      : profileUninstallEffects(agent, scope);
  }
  const observed = observation as {
    readonly installRequired?: boolean;
    readonly plugin?: { readonly installed?: boolean };
  };
  if (operation === 'install') {
    return observed.installRequired === false
      ? EMPTY_SURFACE_EFFECTS
      : agentInstallEffects(agent, scope);
  }
  return observed.plugin?.installed === true
    ? profileUninstallEffects(agent, scope)
    : EMPTY_SURFACE_EFFECTS;
}

async function prepareLifecycle(
  cwd: string,
  operation: 'install' | 'uninstall',
  agents: readonly AgentIntegration[],
  options: PrepareLifecycleOptions = {},
): Promise<PreparedLifecycle> {
  const { full = false, install: installOptions = {}, scope = 'project' } = options;
  const uninstalling = operation === 'uninstall';
  const projectSchema = projectLifecycleSchema(cwd, agents);
  const uninstallOperation = full ? 'uninstall-full' : 'uninstall';
  const project = uninstalling
    ? await createReconciliationPlan(cwd, uninstallOperation, projectSchema)
    : {
        plan: await createSetupPlan(cwd, projectSchema, installOptions),
        dryRun: undefined,
      };
  const observations = await profilePreconditions(cwd, agents, scope, operation);
  const observationByAgent = new Map(
    observations.map(observation => [observation.agent, observation.observation]),
  );
  const surfaces = [
    { name: 'project', effects: project.plan.effects },
    ...agents.map(agent => ({
      name: agent,
      effects: observedAgentEffects(
        operation,
        agent,
        agent === 'cursor' ? undefined : observationByAgent.get(agent),
        scope,
      ),
    })),
  ];
  const preconditionDigest = createHash('sha256')
    .update(JSON.stringify([project.plan.preconditionDigest, agents, scope, observations]))
    .digest('hex');
  return {
    agents,
    projectSchema,
    projectPlan: project.plan,
    full: uninstalling && full,
    scope,
    surfaces,
    plan: createPlan({
      command: operation,
      preconditionDigest,
      effects: combineEffects(surfaces.map(surface => surface.effects)),
      requiresConfirmation: uninstalling,
      verification: [{ description: 'Re-run safeword status', command: 'safeword status' }],
    }),
  };
}

function lifecyclePlanResult(
  operation: 'install' | 'uninstall',
  prepared: PreparedLifecycle,
  installOptions: SetupPlanOptions = {},
): CliResult {
  const hasEffects = Object.values(prepared.plan.effects).some(effects => effects.length > 0);
  const selected = prepared.agents.length === 0 ? 'none' : prepared.agents.join(',');
  const scopeFlag = prepared.agents.includes('claude') ? ` --scope=${prepared.scope}` : '';
  const installFlags = installReplayFlags(installOptions);
  return createResult({
    state: hasEffects ? 'action_required' : 'healthy',
    findings: hasEffects
      ? [
          {
            code: 'LIFECYCLE_EFFECTS_PLANNED',
            message: `Safeword can ${operation} the selected lifecycle surfaces.`,
            severity: 'warning',
          },
        ]
      : [],
    nextActions: hasEffects
      ? [
          {
            command:
              operation === 'install'
                ? `safeword install --agents=${selected}${scopeFlag}${installFlags}`
                : `safeword uninstall --agents=${selected}${scopeFlag} --yes --plan ${prepared.plan.id}`,
            mutates: true,
            requiresHuman: operation === 'uninstall',
          },
        ]
      : [],
    data: {
      command: 'plan',
      operation,
      selected_agents: prepared.agents,
      surfaces: prepared.surfaces.map(surface => ({
        name: surface.name,
        selected: true,
        state: 'planned',
      })),
      plan: toWirePlan(prepared.plan),
    },
  });
}

function installReplayFlags(options: SetupPlanOptions): string {
  return [
    options.noModify === true ? '--no-modify' : undefined,
    options.migrateNamespace === true ? '--migrate-namespace' : undefined,
    options.migrateNamespace === false ? '--no-migrate-namespace' : undefined,
    options.repairVersionMarker === true ? '--repair-version-marker' : undefined,
  ]
    .filter(flag => flag !== undefined)
    .map(flag => ` ${flag}`)
    .join('');
}

function lifecycleScope(
  value: unknown,
  command: 'install' | 'plan' | 'uninstall',
  agents: readonly AgentIntegration[],
):
  | { readonly ok: true; readonly value: 'project' | 'user' }
  | { readonly ok: false; readonly result: CliResult } {
  if (value === undefined || value === 'project') return { ok: true, value: 'project' };
  if (value === 'user' && agents.includes('claude')) return { ok: true, value: 'user' };
  const message =
    value === 'user'
      ? 'User scope requires Claude in the selected agents.'
      : 'Claude plugin scope must be either project or user.';
  return {
    ok: false,
    result: createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message,
          retryable: false,
        },
      ],
      data: { command },
    }),
  };
}

export async function planLifecycle(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) {
    return createResult({
      state: 'failed',
      errors: [{ ...parsed.error, retryable: false }],
      data: { command: 'plan' },
    });
  }
  const operand = invocation.operands[0];
  const operation = operand === undefined ? 'install' : operand;
  if (operation !== 'install' && operation !== 'uninstall') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'LIFECYCLE_OPERATION_INVALID',
          message: 'Plan operation must be install or uninstall.',
          retryable: false,
        },
      ],
      data: { command: 'plan' },
    });
  }
  const scope = lifecycleScope(invocation.options.scope, 'plan', parsed.selection.agents);
  if (!scope.ok) return scope.result;
  const installOptions: SetupPlanOptions = {
    noModify: invocation.options.modify === false,
    repairVersionMarker: invocation.options.repairVersionMarker === true,
    ...(typeof invocation.options.migrateNamespace === 'boolean' && {
      migrateNamespace: invocation.options.migrateNamespace,
    }),
  };
  const prepared =
    operation === 'install'
      ? await prepareLifecycle(invocation.cwd, 'install', parsed.selection.agents, {
          install: installOptions,
          scope: scope.value,
        })
      : await prepareLifecycle(invocation.cwd, 'uninstall', parsed.selection.agents, {
          scope: scope.value,
        });
  return lifecyclePlanResult(operation, prepared, installOptions);
}

function staleUninstallPlan(plan: CliPlan): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'PLAN_STALE',
        message: 'Selected project or profile state changed after this uninstall plan was created.',
        severity: 'warning',
      },
    ],
    nextActions: [{ command: 'safeword uninstall', mutates: false, requiresHuman: true }],
    data: { command: 'uninstall', plan: toWirePlan(plan) },
  });
}

async function uninstallProfileSurfaces(
  cwd: string,
  agents: readonly AgentIntegration[],
  scope: 'project' | 'user',
): Promise<SurfaceResult[]> {
  const completed: SurfaceResult[] = [];
  if (agents.includes('claude')) {
    const { uninstallClaudePlugin } = await import('../claude-plugin/profile.js');
    completed.push({ name: 'claude', result: uninstallClaudePlugin(cwd, scope) });
  }
  if (agents.includes('codex')) {
    const { uninstallCodexPlugin } = await import('../codex-plugin/operations.js');
    completed.push({ name: 'codex', result: uninstallCodexPlugin() });
  }
  return completed;
}

async function applyPreparedLifecycle(
  cwd: string,
  prepared: PreparedLifecycle,
): Promise<CliResult> {
  const cursorSelected = prepared.agents.includes('cursor');
  const cursorHadAssets = cursorSelected && hasCursorProjectAssets(cwd, prepared.projectSchema);
  const completed = await uninstallProfileSurfaces(cwd, prepared.agents, prepared.scope);
  const projectResult = await removeProject(cwd, {
    full: prepared.full,
    yes: true,
    plan: prepared.projectPlan.id,
    schema: prepared.projectSchema,
  });
  completed.unshift({
    name: 'project',
    result: projectResult,
  });
  if (cursorSelected) {
    const cursorRemoved = cursorHadAssets && !hasCursorProjectAssets(cwd, prepared.projectSchema);
    completed.push({
      name: 'cursor',
      result: createResult({ state: cursorRemoved ? 'changed' : 'healthy' }),
    });
  }
  const results = completed.map(surface => surface.result);
  return createResult({
    state: combinedResultState(results),
    changed: results.some(result => result.changed),
    effects: combineEffects(results.map(result => result.effects)),
    findings: results.flatMap(result => result.findings),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: results.flatMap(result => result.nextActions),
    data: {
      command: 'uninstall',
      operation: 'uninstall',
      selected_agents: prepared.agents,
      surfaces: completed.map(surface => ({
        name: surface.name,
        selected: true,
        state: surface.result.state,
      })),
    },
  });
}

function uninstallPreview(prepared: PreparedLifecycle): CliResult {
  const selected = prepared.agents.length === 0 ? 'none' : prepared.agents.join(',');
  const fullFlag = prepared.full ? ' --full' : '';
  const scopeFlag = prepared.agents.includes('claude') ? ` --scope=${prepared.scope}` : '';
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CONFIRMATION_REQUIRED',
        message: 'Review and confirm the exact unified uninstall plan.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword uninstall --agents=${selected}${scopeFlag}${fullFlag} --yes --plan ${prepared.plan.id}`,
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: {
      command: 'uninstall',
      operation: 'uninstall',
      selected_agents: prepared.agents,
      surfaces: prepared.surfaces.map(surface => ({
        name: surface.name,
        selected: true,
        state: 'planned',
      })),
      plan: toWirePlan(prepared.plan),
    },
  });
}

export async function uninstallLifecycle(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) {
    return createResult({
      state: 'failed',
      errors: [{ ...parsed.error, retryable: false }],
      data: { command: 'uninstall' },
    });
  }
  const full = invocation.options.full === true;
  if (invocation.offline && full) return onlineRequired('uninstall');
  const scope = lifecycleScope(invocation.options.scope, 'uninstall', parsed.selection.agents);
  if (!scope.ok) return scope.result;
  const prepared = await prepareLifecycle(invocation.cwd, 'uninstall', parsed.selection.agents, {
    full,
    scope: scope.value,
  });
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
  if (invocation.options.yes === true && suppliedPlan !== undefined) {
    if (suppliedPlan !== prepared.plan.id) return staleUninstallPlan(prepared.plan);
    return applyPreparedLifecycle(invocation.cwd, prepared);
  }
  return uninstallPreview(prepared);
}
