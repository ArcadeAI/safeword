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
import { coordinateSelectedIntegrations, PRODUCTION_INTEGRATIONS } from './integrations.js';
import { convergeSetup, createSetupPlan, type SetupPlanOptions } from './project-install.js';
import { projectLifecycleSchema } from './schema.js';

interface LifecycleInstallAdapters {
  readonly installClaude: () => Promise<CliResult>;
  readonly installCodex: () => Promise<CliResult>;
}

/** Reporting order for install surfaces: project first, then each integration. */
const LIFECYCLE_SURFACE_ORDER: readonly string[] = [
  'project',
  ...PRODUCTION_INTEGRATIONS.map(adapter => adapter.id),
];

interface SurfaceResult {
  readonly name: string;
  readonly result: CliResult;
}

function activationActionsFor(surface: SurfaceResult): string[] {
  if (surface.name === 'claude' && surface.result.changed) return ['run /reload-plugins'];
  if (surface.name === 'codex' && surface.result.state === 'action_required') {
    return ['fully restart Codex', 'resume this Codex task'];
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
      surfaces: LIFECYCLE_SURFACE_ORDER.filter(
        name => name !== 'opencode' || agents.includes('opencode'),
      ).map(name => {
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
  scope: 'project' | 'user',
  projectResult: CliResult,
  adapters: LifecycleInstallAdapters,
): Promise<SurfaceResult[]> {
  return coordinateSelectedIntegrations(PRODUCTION_INTEGRATIONS, agents, async adapter => ({
    name: adapter.id,
    result: await adapter.install({
      cwd,
      agents,
      operation: 'install',
      scope,
      projectResult,
      ports: adapters,
    }),
  }));
}

async function preflightAgentSurfaces(
  cwd: string,
  agents: readonly string[],
  scope: 'project' | 'user',
): Promise<SurfaceResult[]> {
  const results = await coordinateSelectedIntegrations(
    PRODUCTION_INTEGRATIONS,
    agents,
    async adapter => {
      if (!adapter.profile.available || adapter.profile.preflight === undefined) return [];
      return [
        {
          name: adapter.id,
          result: await adapter.profile.preflight({ cwd, agents, operation: 'install', scope }),
        },
      ];
    },
  );
  return results.flat();
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

  const preflight = await preflightAgentSurfaces(invocation.cwd, agents, scope.value);
  const blocked = preflight.filter(
    surface => surface.result.state === 'failed' || surface.result.state === 'action_required',
  );
  if (blocked.length > 0) return combineInstallResults(agents, blocked);

  const projectResult = await installProjectSurface(invocation, agents);
  const surfaces = await installAgentSurfaces(
    invocation.cwd,
    agents,
    scope.value,
    projectResult,
    adapters,
  );
  return combineInstallResults(agents, [{ name: 'project', result: projectResult }, ...surfaces]);
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
  readonly agent: string;
  readonly observation: unknown;
}

function serializedProfilePreconditions(
  cwd: string,
  observations: readonly ProfilePrecondition[],
): string {
  return JSON.stringify(observations, (_key, value: unknown) =>
    typeof value === 'string' ? value.replaceAll(cwd, '<project>') : value,
  );
}

async function profilePreconditions(
  cwd: string,
  agents: readonly AgentIntegration[],
  scope: 'project' | 'user',
  operation: 'install' | 'uninstall',
): Promise<ProfilePrecondition[]> {
  const observations = await coordinateSelectedIntegrations(
    PRODUCTION_INTEGRATIONS,
    agents,
    async adapter => {
      if (!adapter.profile.available) return false;
      return {
        agent: adapter.id,
        observation: await adapter.profile.observePrecondition({
          cwd,
          agents,
          scope,
          operation,
        }),
      };
    },
  );
  return observations.filter(
    (observation): observation is ProfilePrecondition => observation !== false,
  );
}

async function prepareLifecycle(
  cwd: string,
  operation: 'install' | 'uninstall',
  agents: readonly AgentIntegration[],
  options: PrepareLifecycleOptions = {},
): Promise<PreparedLifecycle> {
  const { full = false, install: installOptions = {}, scope = 'user' } = options;
  const uninstalling = operation === 'uninstall';
  const projectSchema = projectLifecycleSchema(cwd, agents, operation);
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
  const integrationSurfaces = await coordinateSelectedIntegrations(
    PRODUCTION_INTEGRATIONS,
    agents,
    async adapter => ({
      name: adapter.id,
      effects: await adapter.effects({
        cwd,
        agents,
        operation,
        scope,
        observation: observationByAgent.get(adapter.id),
      }),
    }),
  );
  const surfaces = [{ name: 'project', effects: project.plan.effects }, ...integrationSurfaces];
  const preconditionDigest = createHash('sha256')
    .update(
      JSON.stringify([
        project.plan.preconditionDigest,
        agents,
        scope,
        serializedProfilePreconditions(cwd, observations),
      ]),
    )
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
  if (value === undefined)
    return { ok: true, value: agents.includes('claude') ? 'user' : 'project' };
  if (value === 'project') return { ok: true, value: 'project' };
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
  const agents =
    operation === 'uninstall'
      ? uninstallAgentSelection(invocation.options.agents, parsed.selection.agents)
      : parsed.selection.agents;
  const scope = lifecycleScope(invocation.options.scope, 'plan', agents);
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
      ? await prepareLifecycle(invocation.cwd, 'install', agents, {
          install: installOptions,
          scope: scope.value,
        })
      : await prepareLifecycle(invocation.cwd, 'uninstall', agents, {
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

async function uninstallIntegrationSurfaces(
  cwd: string,
  agents: readonly AgentIntegration[],
  scope: 'project' | 'user',
  observations: ReadonlyMap<string, unknown>,
): Promise<SurfaceResult[]> {
  return coordinateSelectedIntegrations(PRODUCTION_INTEGRATIONS, agents, async adapter => ({
    name: adapter.id,
    result: await adapter.uninstall({
      cwd,
      agents,
      operation: 'uninstall',
      scope,
      observation: observations.get(adapter.id),
    }),
  }));
}

async function applyPreparedLifecycle(
  cwd: string,
  prepared: PreparedLifecycle,
): Promise<CliResult> {
  const projectOnlyObservations = await coordinateSelectedIntegrations(
    PRODUCTION_INTEGRATIONS,
    prepared.agents,
    async adapter =>
      adapter.profile.available
        ? undefined
        : ([
            adapter.id,
            await adapter.observe({
              cwd,
              agents: prepared.agents,
              operation: 'uninstall',
              scope: prepared.scope,
            }),
          ] as const),
  );
  const observationByAgent = new Map<string, CliResult>();
  for (const observation of projectOnlyObservations) {
    if (observation !== undefined) observationByAgent.set(...observation);
  }
  const projectResult = await removeProject(cwd, {
    full: prepared.full,
    yes: true,
    plan: prepared.projectPlan.id,
    schema: prepared.projectSchema,
  });
  const completed: SurfaceResult[] = [
    {
      name: 'project',
      result: projectResult,
    },
  ];
  if (projectResult.state === 'failed' || projectResult.state === 'action_required') {
    return combinedUninstallResult(prepared, completed);
  }
  completed.push(
    ...(await uninstallIntegrationSurfaces(
      cwd,
      prepared.agents,
      prepared.scope,
      observationByAgent,
    )),
  );
  return combinedUninstallResult(prepared, completed);
}

function combinedUninstallResult(
  prepared: PreparedLifecycle,
  completed: readonly SurfaceResult[],
): CliResult {
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
  const agents = uninstallAgentSelection(invocation.options.agents, parsed.selection.agents);
  const scope = lifecycleScope(invocation.options.scope, 'uninstall', agents);
  if (!scope.ok) return scope.result;
  const prepared = await prepareLifecycle(invocation.cwd, 'uninstall', agents, {
    full,
    scope: scope.value,
  });
  if (invocation.offline && (full || prepared.plan.effects.packages.length > 0)) {
    return onlineRequired('uninstall');
  }
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
  if (invocation.options.yes === true && suppliedPlan !== undefined) {
    if (suppliedPlan !== prepared.plan.id) return staleUninstallPlan(prepared.plan);
    return applyPreparedLifecycle(invocation.cwd, prepared);
  }
  return uninstallPreview(prepared);
}
function uninstallAgentSelection(
  requested: unknown,
  selected: readonly AgentIntegration[],
): readonly AgentIntegration[] {
  // Cursor has project artifacts but no profile plugin, so it is not part of
  // the install default. A repository-wide uninstall must nevertheless sweep
  // that surface unless the user explicitly narrows --agents.
  return requested === undefined && !selected.includes('cursor')
    ? [...selected, 'cursor']
    : selected;
}
