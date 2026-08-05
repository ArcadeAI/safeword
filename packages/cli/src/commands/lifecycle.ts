import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { parseAgentSelection } from '../cli-protocol/agent-selection.js';
import type { CommandInvocation } from '../cli-protocol/handler.js';
import { onlineRequired } from '../cli-protocol/online-required.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
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
  if (invocation.offline && agents.length > 0) return onlineRequired('install');

  const projectResult = await installProjectSurface(invocation, agents);
  const surfaces = await installAgentSurfaces(agents, projectResult, adapters);
  return combineInstallResults(agents, [{ name: 'project', result: projectResult }, ...surfaces]);
}
