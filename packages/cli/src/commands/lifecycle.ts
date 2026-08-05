import { createHash } from 'node:crypto';

import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { parseAgentSelection } from '../cli-protocol/agent-selection.js';
import type { CommandInvocation } from '../cli-protocol/handler.js';
import { onlineRequired } from '../cli-protocol/online-required.js';
import { createPlan, toWirePlan } from '../cli-protocol/plan.js';
import { createReconciliationPlan } from '../cli-protocol/reconciliation.js';
import { type CliResult, createResult, type Effects } from '../cli-protocol/result.js';
import { schemaForProjectSurfaces } from '../schema.js';
import { convergeSetup } from './converge-setup.js';

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

function combineInstallResults(
  agents: readonly string[],
  surfaces: readonly SurfaceResult[],
): CliResult {
  const results = surfaces.map(surface => surface.result);
  const effectCategories = [
    'files',
    'packages',
    'configuration',
    'network',
    'destructive',
  ] as const;
  const effects = Object.fromEntries(
    effectCategories.map(category => [
      category,
      results.flatMap(result => result.effects[category]),
    ]),
  );
  return createResult({
    state: lifecycleState(results),
    changed: results.some(result => result.changed),
    effects,
    findings: results
      .flatMap(result => result.findings)
      .filter(finding => finding.code !== 'SETUP_CODEX_PLUGIN_HANDOFF'),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: results
      .flatMap(result => result.nextActions)
      .filter(
        action => !['safeword claude install', 'safeword codex install'].includes(action.command),
      ),
    data: {
      command: 'install',
      operation: 'install',
      selected_agents: agents,
      surfaces: surfaces.map(surface => ({
        name: surface.name,
        selected: true,
        state: surface.result.state,
      })),
    },
  });
}

async function installProjectSurface(
  invocation: CommandInvocation,
  agents: readonly string[],
): Promise<CliResult> {
  const projectSchema = schemaForProjectSurfaces(schemaForClaudeDelivery(invocation.cwd), [
    'core',
    ...(agents.includes('cursor') ? (['cursor'] as const) : []),
  ]);
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

function mergeEffects(groups: readonly Effects[]): Effects {
  return {
    files: groups.flatMap(effects => effects.files),
    packages: groups.flatMap(effects => effects.packages),
    configuration: groups.flatMap(effects => effects.configuration),
    network: groups.flatMap(effects => effects.network),
    destructive: groups.flatMap(effects => effects.destructive),
  };
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

export async function uninstallLifecycle(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) {
    return createResult({
      state: 'failed',
      errors: [{ ...parsed.error, retryable: false }],
      data: { command: 'uninstall' },
    });
  }
  const agents = parsed.selection.agents;
  const projectSchema = schemaForProjectSurfaces(schemaForClaudeDelivery(invocation.cwd), [
    'core',
    ...(agents.includes('cursor') ? (['cursor'] as const) : []),
  ]);
  const project = await createReconciliationPlan(invocation.cwd, 'uninstall', projectSchema);
  const surfaces = [
    { name: 'project', effects: project.plan.effects },
    ...agents
      .filter((agent): agent is 'claude' | 'codex' => agent !== 'cursor')
      .map(agent => ({ name: agent, effects: profileUninstallEffects(agent) })),
    ...(agents.includes('cursor') ? [{ name: 'cursor', effects: project.plan.effects }] : []),
  ];
  const preconditionDigest = createHash('sha256')
    .update(JSON.stringify([project.plan.preconditionDigest, agents]))
    .digest('hex');
  const plan = createPlan({
    command: 'uninstall',
    preconditionDigest,
    effects: mergeEffects(surfaces.map(surface => surface.effects)),
    requiresConfirmation: true,
    verification: [{ description: 'Re-run safeword status', command: 'safeword status' }],
  });

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
        command: `safeword uninstall --agents=${agents.length === 0 ? 'none' : agents.join(',')} --yes --plan ${plan.id}`,
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: {
      command: 'uninstall',
      operation: 'uninstall',
      selected_agents: agents,
      surfaces: surfaces.map(surface => ({ name: surface.name, selected: true, state: 'planned' })),
      plan: toWirePlan(plan),
    },
  });
}
