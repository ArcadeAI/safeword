import { createHash } from 'node:crypto';

import { type AgentIntegration, parseAgentSelection } from '../cli-protocol/agent-selection.js';
import type { CommandInvocation } from '../cli-protocol/handler.js';
import { onlineRequired } from '../cli-protocol/online-required.js';
import { type CliPlan, createPlan, toWirePlan } from '../cli-protocol/plan.js';
import {
  applyReconciliation,
  createReconciliationPlan,
  effectsForReconciliation,
} from '../cli-protocol/reconciliation.js';
import {
  type CliResult,
  combineEffects,
  createResult,
  type Effects,
} from '../cli-protocol/result.js';
import type { SafewordSchema } from '../schema.js';
import { convergeSetup } from './project-install.js';
import { projectLifecycleSchema } from './schema.js';

interface LifecycleInstallAdapters {
  readonly installClaude: () => Promise<CliResult>;
  readonly installCodex: () => Promise<CliResult>;
}

interface SurfaceResult {
  readonly name: string;
  readonly result: CliResult;
}

function lifecycleState(results: readonly CliResult[]): CliResult['state'] {
  if (results.some(result => result.state === 'failed')) return 'failed';
  if (results.some(result => result.state === 'action_required')) return 'action_required';
  if (results.some(result => result.state === 'changed')) return 'changed';
  return 'healthy';
}

function activationActionsFor(surface: SurfaceResult): string[] {
  if (surface.name === 'claude' && surface.result.changed) return ['run /reload-plugins'];
  if (surface.name === 'codex' && surface.result.state === 'action_required') {
    return ['restart Codex', 'start a new Codex task'];
  }
  return [];
}

function combineInstallResults(
  agents: readonly string[],
  surfaces: readonly SurfaceResult[],
): CliResult {
  const results = surfaces.map(surface => surface.result);
  const effects = combineEffects(results.map(result => result.effects));
  const surfaceByName = new Map(surfaces.map(surface => [surface.name, surface]));
  return createResult({
    state: lifecycleState(results),
    changed: results.some(result => result.changed),
    effects,
    findings: results
      .flatMap(result => result.findings)
      .filter(finding => finding.code !== 'SETUP_CODEX_PLUGIN_HANDOFF'),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: surfaces.flatMap(surface =>
      surface.result.nextActions.flatMap(action => {
        const profileInstall = /^safeword (claude|codex) install$/u.exec(action.command);
        if (profileInstall === null) return [action];
        if (surface.result.state !== 'failed' || surface.name !== profileInstall[1]) return [];
        return [{ ...action, command: `safeword install --agents=${surface.name}` }];
      }),
    ),
    data: {
      command: 'install',
      operation: 'install',
      selected_agents: agents,
      surfaces: ['project', 'claude', 'codex', 'cursor'].map(name => {
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
  agents: readonly string[],
  projectResult: CliResult,
  adapters: LifecycleInstallAdapters,
): Promise<SurfaceResult[]> {
  const surfaces: SurfaceResult[] = [];
  if (agents.includes('claude')) {
    surfaces.push({ name: 'claude', result: await adapters.installClaude() });
  }
  if (agents.includes('codex')) {
    surfaces.push({ name: 'codex', result: await adapters.installCodex() });
  }
  if (agents.includes('cursor')) {
    surfaces.push({
      name: 'cursor',
      result: createResult({ state: projectResult.state, changed: projectResult.changed }),
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
  const requiresProfileNetwork = agents.some(agent => agent === 'claude' || agent === 'codex');
  if (invocation.offline && requiresProfileNetwork) return onlineRequired('install');

  const projectResult = await installProjectSurface(invocation, agents);
  const surfaces = await installAgentSurfaces(agents, projectResult, adapters);
  return combineInstallResults(agents, [{ name: 'project', result: projectResult }, ...surfaces]);
}

function profileUninstallEffects(agent: 'claude' | 'codex'): Effects {
  const label = agent === 'claude' ? 'Claude profile plugin' : 'Codex profile plugin';
  return {
    files: [],
    packages: [],
    configuration: [{ kind: 'deactivate', target: label, operation: 'profile' }],
    network: [],
    destructive: [{ kind: 'remove', target: label, operation: 'profile' }],
  };
}

function agentInstallEffects(agent: AgentIntegration): Effects {
  const labels: Readonly<Record<AgentIntegration, string>> = {
    claude: 'Claude profile plugin',
    codex: 'Codex profile plugin',
    cursor: 'Cursor project integration',
  };
  const label = labels[agent];
  const profile = agent === 'claude' || agent === 'codex';
  return {
    files: [],
    packages: [],
    configuration: [
      { kind: 'activate', target: label, operation: profile ? 'profile' : 'project' },
    ],
    network: profile ? [{ kind: 'plugin-marketplace', target: label, operation: 'install' }] : [],
    destructive: [],
  };
}

interface PreparedUninstall {
  readonly agents: readonly AgentIntegration[];
  readonly projectSchema: SafewordSchema;
  readonly surfaces: readonly { readonly name: string; readonly effects: Effects }[];
  readonly plan: CliPlan;
}

async function profilePreconditions(
  cwd: string,
  agents: readonly AgentIntegration[],
): Promise<unknown[]> {
  const observations: unknown[] = [];
  if (agents.includes('claude')) {
    const { observeClaudeProfile } = await import('../claude-plugin/profile.js');
    observations.push(['claude', observeClaudeProfile(cwd)]);
  }
  if (agents.includes('codex')) {
    const { observeCodexMigrationResult } = await import('../codex-plugin/installer.js');
    observations.push(['codex', observeCodexMigrationResult(cwd)]);
  }
  return observations;
}

function plannedUninstallSurfaces(
  agents: readonly AgentIntegration[],
  projectEffects: Effects,
): { name: string; effects: Effects }[] {
  const surfaces = [{ name: 'project', effects: projectEffects }];
  for (const agent of agents) {
    if (agent === 'cursor') {
      surfaces.push({ name: agent, effects: createResult({ state: 'healthy' }).effects });
    } else surfaces.push({ name: agent, effects: profileUninstallEffects(agent) });
  }
  return surfaces;
}

async function prepareUninstall(
  cwd: string,
  agents: readonly AgentIntegration[],
): Promise<PreparedUninstall> {
  const projectSchema = projectLifecycleSchema(cwd, agents);
  const project = await createReconciliationPlan(cwd, 'uninstall', projectSchema);
  const surfaces = plannedUninstallSurfaces(agents, project.plan.effects);
  const observations = await profilePreconditions(cwd, agents);
  const preconditionDigest = createHash('sha256')
    .update(JSON.stringify([project.plan.preconditionDigest, agents, observations]))
    .digest('hex');
  return {
    agents,
    projectSchema,
    surfaces,
    plan: createPlan({
      command: 'uninstall',
      preconditionDigest,
      effects: combineEffects(surfaces.map(surface => surface.effects)),
      requiresConfirmation: true,
      verification: [{ description: 'Re-run safeword status', command: 'safeword status' }],
    }),
  };
}

async function prepareInstall(
  cwd: string,
  agents: readonly AgentIntegration[],
): Promise<PreparedUninstall> {
  const projectSchema = projectLifecycleSchema(cwd, agents);
  const project = await createReconciliationPlan(cwd, 'upgrade', projectSchema);
  const surfaces = [
    { name: 'project', effects: project.plan.effects },
    ...agents.map(agent => ({ name: agent, effects: agentInstallEffects(agent) })),
  ];
  const observations = await profilePreconditions(cwd, agents);
  const preconditionDigest = createHash('sha256')
    .update(JSON.stringify([project.plan.preconditionDigest, agents, observations]))
    .digest('hex');
  return {
    agents,
    projectSchema,
    surfaces,
    plan: createPlan({
      command: 'install',
      preconditionDigest,
      effects: combineEffects(surfaces.map(surface => surface.effects)),
      requiresConfirmation: false,
      verification: [{ description: 'Re-run safeword status', command: 'safeword status' }],
    }),
  };
}

function lifecyclePlanResult(
  operation: 'install' | 'uninstall',
  prepared: PreparedUninstall,
): CliResult {
  const hasEffects = Object.values(prepared.plan.effects).some(effects => effects.length > 0);
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
                ? 'safeword install'
                : `safeword uninstall --yes --plan ${prepared.plan.id}`,
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
  const prepared =
    operation === 'install'
      ? await prepareInstall(invocation.cwd, parsed.selection.agents)
      : await prepareUninstall(invocation.cwd, parsed.selection.agents);
  return lifecyclePlanResult(operation, prepared);
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
): Promise<SurfaceResult[]> {
  const completed: SurfaceResult[] = [];
  if (agents.includes('claude')) {
    const { uninstallClaudePlugin } = await import('../claude-plugin/profile.js');
    completed.push({ name: 'claude', result: uninstallClaudePlugin(cwd) });
  }
  if (agents.includes('codex')) {
    const { uninstallCodexPlugin } = await import('../codex-plugin/installer.js');
    completed.push({ name: 'codex', result: uninstallCodexPlugin() });
  }
  return completed;
}

async function applyPreparedUninstall(
  cwd: string,
  prepared: PreparedUninstall,
): Promise<CliResult> {
  const completed = await uninstallProfileSurfaces(cwd, prepared.agents);
  const appliedProject = await applyReconciliation(cwd, 'uninstall', prepared.projectSchema);
  const projectEffects = effectsForReconciliation(appliedProject, 'uninstall');
  const projectChanged = projectEffects.destructive.length > 0 || projectEffects.files.length > 0;
  completed.unshift({
    name: 'project',
    result: createResult({
      state: projectChanged ? 'changed' : 'healthy',
      effects: projectEffects,
      data: { command: 'project uninstall', removed: appliedProject.removed },
    }),
  });
  if (prepared.agents.includes('cursor')) {
    completed.push({ name: 'cursor', result: createResult({ state: 'changed' }) });
  }
  const results = completed.map(surface => surface.result);
  return createResult({
    state: lifecycleState(results),
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

function uninstallPreview(prepared: PreparedUninstall): CliResult {
  const selected = prepared.agents.length === 0 ? 'none' : prepared.agents.join(',');
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
        command: `safeword uninstall --agents=${selected} --yes --plan ${prepared.plan.id}`,
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
  const prepared = await prepareUninstall(invocation.cwd, parsed.selection.agents);
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
  if (invocation.options.yes === true && suppliedPlan !== undefined) {
    if (suppliedPlan !== prepared.plan.id) return staleUninstallPlan(prepared.plan);
    return applyPreparedUninstall(invocation.cwd, prepared);
  }
  return uninstallPreview(prepared);
}
