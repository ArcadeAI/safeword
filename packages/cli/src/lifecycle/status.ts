import type { AgentIntegration } from '../cli-protocol/agent-selection.js';
import {
  type CliResult,
  combineEffects,
  createResult,
  type Finding,
  type NextAction,
} from '../cli-protocol/result.js';
import {
  legacyGlobalGuidanceDiagnostic,
  observeLegacyGlobalGuidance,
} from '../codex-plugin/legacy-global-guidance.js';
import { checkHealth } from '../health.js';
import { detectPackageManager } from '../utils/install.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import { projectLifecycleSchema } from './schema.js';

function healthFindings(
  values: readonly string[],
  code: string,
  severity: Finding['severity'],
): Finding[] {
  return values.map(message => ({ code, message, severity }));
}

function statusNextActions(
  blockingFindings: readonly Finding[],
  versionAction: NextAction | undefined,
): readonly NextAction[] {
  if (versionAction !== undefined) return [versionAction];
  return blockingFindings.length === 0
    ? []
    : [{ command: 'safeword plan', mutates: false, requiresHuman: false }];
}

function projectVersionFinding(
  cwd: string,
  projectVersion: string | undefined,
  cliVersion: string,
): { finding?: Finding; nextAction?: NextAction } {
  if (projectVersion === undefined) return {};
  if (!isSafePackageVersion(projectVersion)) {
    return {
      finding: {
        code: 'PROJECT_VERSION_UNSAFE',
        message:
          'Project version is not safe to use in a package install command; inspect .safeword/version.',
        severity: 'warning',
      },
    };
  }
  const comparison = compareVersions(projectVersion, cliVersion);
  if (comparison < 0) {
    return {
      finding: {
        code: 'PROJECT_UPDATE_AVAILABLE',
        message: `Project config v${projectVersion} can be upgraded to v${cliVersion}.`,
        severity: 'info',
      },
      nextAction: { command: 'safeword install', mutates: true, requiresHuman: false },
    };
  }
  if (comparison <= 0) return {};
  const packageManager = detectPackageManager(cwd);
  const runUpgrade =
    packageManager === 'bun' || packageManager === 'yarn'
      ? `${packageManager} run safeword install`
      : `${packageManager} exec safeword install`;
  return {
    finding: {
      code: 'CLI_OLDER_THAN_PROJECT',
      message: `Project config (v${projectVersion}) is newer than CLI (v${cliVersion}).`,
      severity: 'warning',
    },
    nextAction: {
      command: `${packageManager} add -D safeword@${projectVersion} && ${runUpgrade}`,
      mutates: true,
      requiresHuman: false,
    },
  };
}

export async function observeStatus(
  cwd: string,
  agents: readonly AgentIntegration[] = ['claude', 'codex'],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CliResult> {
  const result = await observeProjectStatus(cwd, agents);
  return withGlobalGuidance(result, environment);
}

export interface LifecycleSurfaceObservation {
  readonly name: 'project' | AgentIntegration;
  readonly result: CliResult;
}

function lifecycleState(surfaces: readonly LifecycleSurfaceObservation[]): CliResult['state'] {
  const states = new Set(surfaces.map(surface => surface.result.state));
  if (states.has('failed')) return 'failed';
  if (states.has('action_required')) return 'action_required';
  if (states.has('changed')) return 'changed';
  return 'healthy';
}

function projectIsConfigured(result: CliResult): boolean {
  return (result.data as { configured?: boolean } | undefined)?.configured === true;
}

export async function observeLifecycleSurfaces(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<readonly LifecycleSurfaceObservation[]> {
  const project = await observeStatus(cwd, agents, environment);
  const surfaces: LifecycleSurfaceObservation[] = [{ name: 'project', result: project }];
  if (!projectIsConfigured(project)) return surfaces;

  if (agents.includes('claude')) {
    const { observeClaudeStatus } = await import('../claude-plugin/status.js');
    surfaces.push({ name: 'claude', result: observeClaudeStatus(cwd) });
  }
  if (agents.includes('codex')) {
    const { observeCodexMigration } = await import('../codex-plugin/installer.js');
    surfaces.push({ name: 'codex', result: observeCodexMigration(cwd, environment) });
  }
  if (agents.includes('cursor')) {
    surfaces.push({
      name: 'cursor',
      result: createResult({
        state: project.state,
        data: { command: 'cursor status', coverage: 'project-owned Cursor assets' },
      }),
    });
  }
  return surfaces;
}

export function summarizeLifecycleStatus(
  agents: readonly AgentIntegration[],
  surfaces: readonly LifecycleSurfaceObservation[],
): CliResult {
  const results = surfaces.map(surface => surface.result);
  return createResult({
    state: lifecycleState(surfaces),
    changed: results.some(result => result.changed),
    effects: combineEffects(surfaces.map(surface => surface.result.effects)),
    findings: results.flatMap(result => result.findings),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: results.flatMap(result => result.nextActions).slice(0, 1),
    data: {
      command: 'status',
      operation: 'status',
      selected_agents: agents,
      surfaces: surfaces.map(surface => ({
        name: surface.name,
        selected: true,
        state: surface.result.state,
      })),
    },
  });
}

export async function observeLifecycleStatus(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CliResult> {
  return summarizeLifecycleStatus(agents, await observeLifecycleSurfaces(cwd, agents, environment));
}

function withGlobalGuidance(result: CliResult, environment: NodeJS.ProcessEnv): CliResult {
  if (result.state === 'failed') return result;
  if ((result.data as { configured?: boolean } | undefined)?.configured !== true) return result;
  const diagnostic = legacyGlobalGuidanceDiagnostic(observeLegacyGlobalGuidance(environment));
  if (diagnostic.finding === undefined) {
    return {
      ...result,
      data: { ...(result.data as object), global_guidance: diagnostic.observation },
    };
  }
  return {
    ...result,
    state: 'action_required',
    findings: [...result.findings, diagnostic.finding],
    nextActions: [
      ...result.nextActions,
      ...(diagnostic.nextAction === undefined ? [] : [diagnostic.nextAction]),
    ],
    data: { ...(result.data as object), global_guidance: diagnostic.observation },
  };
}

async function observeProjectStatus(
  cwd: string,
  agents: readonly AgentIntegration[],
): Promise<CliResult> {
  try {
    const health = await checkHealth(cwd, { schema: projectLifecycleSchema(cwd, agents) });
    if (!health.configured) {
      return createResult({
        state: 'action_required',
        findings: [
          {
            code: 'PROJECT_NOT_CONFIGURED',
            message: 'Safeword is not configured in this project.',
            severity: 'warning',
          },
        ],
        nextActions: [{ command: 'safeword install', mutates: true, requiresHuman: false }],
        data: { configured: false, cli_version: health.cliVersion },
      });
    }

    const blockingFindings = [
      ...healthFindings(
        health.missingPacks.map(pack => `${pack} language pack is not installed.`),
        'MISSING_LANGUAGE_PACK',
        'error',
      ),
      ...healthFindings(
        health.missingPackages.map(packageName => `${packageName} package is not installed.`),
        'MISSING_PACKAGE',
        'error',
      ),
      ...healthFindings(health.issues, 'PROJECT_DRIFT', 'warning'),
    ];
    const versionGuidance = projectVersionFinding(cwd, health.projectVersion, health.cliVersion);
    if (versionGuidance.finding?.severity === 'warning') {
      blockingFindings.push(versionGuidance.finding);
    }
    const findings = [
      {
        code: 'SAFEWORD_VERSION',
        message: `Safeword CLI v${health.cliVersion}; project config v${health.projectVersion ?? 'unknown'}.`,
        severity: 'info' as const,
      },
      ...blockingFindings,
      ...(versionGuidance.finding === undefined || versionGuidance.finding.severity === 'warning'
        ? []
        : [versionGuidance.finding]),
      ...healthFindings(health.advisories, 'PROJECT_ADVISORY', 'info'),
    ];
    const nextActions = statusNextActions(blockingFindings, versionGuidance.nextAction);

    return createResult({
      state: blockingFindings.length === 0 ? 'healthy' : 'action_required',
      findings,
      nextActions,
      data: {
        configured: true,
        cli_version: health.cliVersion,
        project_version: health.projectVersion,
      },
    });
  } catch (statusError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'STATUS_FAILED',
          message: statusError instanceof Error ? statusError.message : String(statusError),
          retryable: false,
        },
      ],
      nextActions: [
        {
          command: 'safeword doctor --verbose',
          mutates: false,
          requiresHuman: true,
        },
      ],
    });
  }
}
