import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import {
  type AgentIntegration,
  DEFAULT_AGENT_INTEGRATIONS,
} from '../cli-protocol/agent-selection.js';
import {
  type CliResult,
  combinedResultState,
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
import { readReviewRouteProofs } from '../review/job.js';
import { readConfiguredReviewRoutes } from '../review/policy.js';
import { inspectReviewRoute, type ReviewRouteObservation } from '../review/runtime.js';
import { detectPackageManager } from '../utils/install.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import { unselectedCursorFinding } from './cursor.js';
import { coordinateSelectedIntegrations, PRODUCTION_INTEGRATIONS } from './integrations.js';
import { projectLifecycleSchema } from './schema.js';

async function inspectConfiguredRoute(
  route: { readonly reviewer: 'claude' | 'codex' | 'opencode'; readonly model?: string },
  cwd: string,
  offline: boolean,
  deadline: number,
): Promise<ReviewRouteObservation> {
  try {
    return await inspectReviewRoute(
      route.reviewer,
      route.model,
      cwd,
      Math.max(1, deadline - Date.now()),
      offline,
    );
  } catch {
    return {
      installed: 'inspection_unavailable',
      compatibility: 'inspection_unavailable',
      catalogue: route.model === undefined ? 'not_applicable' : 'unavailable',
    };
  }
}

async function reviewRouteObservations(
  cwd: string,
  offline: boolean,
  routes: readonly {
    readonly reviewer: 'claude' | 'codex' | 'opencode';
    readonly model?: string;
    readonly independence: 'cross-agent' | 'degraded';
  }[],
): Promise<readonly Record<string, unknown>[]> {
  const inspectionDeadline = Date.now() + 5000;
  const proofs = new Map(
    readReviewRouteProofs(cwd).map(proof => [
      `${proof.reviewer}\0${proof.model ?? '<runtime-default>'}`,
      proof,
    ]),
  );
  return await Promise.all(
    routes.map(async route => {
      const proof = proofs.get(`${route.reviewer}\0${route.model ?? '<runtime-default>'}`);
      const inspection = await inspectConfiguredRoute(route, cwd, offline, inspectionDeadline);
      return {
        reviewer: route.reviewer,
        ...(route.model !== undefined && { model: route.model }),
        runtime_default: route.model === undefined,
        independence: route.independence,
        ...inspection,
        proof: proof?.proof ?? 'unknown',
        ...(proof?.failure !== undefined && { known_failure: proof.failure }),
        ...(proof !== undefined && { proof_observed_at: proof.observed_at }),
      };
    }),
  );
}

async function configuredReviewRouteStatus(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  offline: boolean,
): Promise<{
  readonly reviewRoutes: readonly Record<string, unknown>[];
  readonly routeFinding?: Finding;
}> {
  const author = resolveRunIdentity({}, { env: environment }).runtime;
  let configuredRoutes: ReturnType<typeof readConfiguredReviewRoutes>;
  try {
    configuredRoutes = readConfiguredReviewRoutes(cwd, author);
  } catch (error) {
    return {
      reviewRoutes: [],
      routeFinding: {
        code: 'REVIEW_ROUTE_CONFIG_INVALID',
        message:
          error instanceof Error ? error.message : 'Invalid crossAgentReviewRoutes configuration.',
        severity: 'warning',
      },
    };
  }
  try {
    return {
      reviewRoutes: await reviewRouteObservations(cwd, offline, configuredRoutes ?? []),
    };
  } catch {
    return { reviewRoutes: [] };
  }
}

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
  agents: readonly AgentIntegration[] = DEFAULT_AGENT_INTEGRATIONS,
  environment: NodeJS.ProcessEnv = process.env,
  offline = false,
): Promise<CliResult> {
  const result = await observeProjectStatus(cwd, agents, environment, offline);
  return withGlobalGuidance(result, environment);
}

export interface LifecycleSurfaceObservation {
  readonly name: 'project' | AgentIntegration;
  readonly result: CliResult;
  readonly exposeData?: boolean;
}

export async function observeLifecycleSurfaces(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv = process.env,
  offline = false,
): Promise<readonly LifecycleSurfaceObservation[]> {
  const project = await observeStatus(cwd, agents, environment, offline);
  const integrationSurfaces = await coordinateSelectedIntegrations(
    PRODUCTION_INTEGRATIONS,
    agents,
    async adapter => ({
      name: adapter.id as AgentIntegration,
      exposeData: adapter.exposeStatusData,
      result: await adapter.observe({
        cwd,
        agents,
        operation: 'check',
        scope: 'project',
        environment,
      }),
    }),
  );
  return [{ name: 'project', result: project }, ...integrationSurfaces];
}

export interface LifecycleSurfaceSummary {
  readonly name: string;
  readonly selected: true;
  readonly state: CliResult['state'];
  readonly data?: unknown;
}

/** Per-surface outcomes shared by the status summary and doctor diagnostics. */
export function lifecycleSurfaceSummaries(
  surfaces: readonly LifecycleSurfaceObservation[],
): readonly LifecycleSurfaceSummary[] {
  return surfaces.map(surface => ({
    name: surface.name,
    selected: true,
    state: surface.result.state,
    ...(surface.exposeData === true &&
      surface.result.data !== undefined && { data: surface.result.data }),
  }));
}

const STATE_PRIORITY: Readonly<Record<CliResult['state'], number>> = {
  failed: 4,
  action_required: 3,
  changed: 2,
  healthy: 1,
};
const FINDING_PRIORITY: Readonly<Record<Finding['severity'], number>> = {
  error: 3,
  warning: 2,
  info: 1,
};

function actionPriority(result: CliResult): number {
  const findingPriority = Math.max(
    0,
    ...result.findings.map(finding => FINDING_PRIORITY[finding.severity]),
  );
  return STATE_PRIORITY[result.state] * 10 + findingPriority;
}

function primaryNextAction(
  surfaces: readonly LifecycleSurfaceObservation[],
): readonly NextAction[] {
  const prioritized = surfaces
    .filter(surface => surface.result.nextActions.length > 0)
    .toSorted((left, right) => actionPriority(right.result) - actionPriority(left.result));
  return prioritized[0]?.result.nextActions.slice(0, 1) ?? [];
}

/** The project surface's own observation keys, which callers read top-level. */
export function projectObservationData(
  surfaces: readonly LifecycleSurfaceObservation[],
): Record<string, unknown> {
  const project = surfaces.find(surface => surface.name === 'project')?.result.data;
  return typeof project === 'object' && project !== null && !Array.isArray(project)
    ? (project as Record<string, unknown>)
    : {};
}

export function summarizeLifecycleStatus(
  agents: readonly AgentIntegration[],
  surfaces: readonly LifecycleSurfaceObservation[],
): CliResult {
  const results = surfaces.map(surface => surface.result);
  return createResult({
    state: combinedResultState(results),
    changed: results.some(result => result.changed),
    effects: combineEffects(surfaces.map(surface => surface.result.effects)),
    findings: results.flatMap(result => result.findings),
    errors: results.flatMap(result => result.errors),
    recovery: results.flatMap(result => result.recovery),
    nextActions: primaryNextAction(surfaces),
    data: {
      ...projectObservationData(surfaces),
      command: 'status',
      operation: 'status',
      selected_agents: agents,
      surfaces: lifecycleSurfaceSummaries(surfaces),
    },
  });
}

export async function observeLifecycleStatus(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv = process.env,
  offline = false,
): Promise<CliResult> {
  return summarizeLifecycleStatus(
    agents,
    await observeLifecycleSurfaces(cwd, agents, environment, offline),
  );
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

// eslint-disable-next-line complexity -- Project health and route evidence have distinct recovery states.
async function observeProjectStatus(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv,
  offline: boolean,
): Promise<CliResult> {
  try {
    const schema = projectLifecycleSchema(cwd, agents);
    const health = await checkHealth(cwd, { schema });
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
      ...healthFindings(
        health.missingPythonTools.map(tool => `${tool} is not declared for this Python project.`),
        'MISSING_PYTHON_TOOL',
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
      ...unselectedCursorFinding(cwd, agents),
    ];
    const nextActions = statusNextActions(blockingFindings, versionGuidance.nextAction);
    const { reviewRoutes, routeFinding } = await configuredReviewRouteStatus(
      cwd,
      environment,
      offline,
    );

    return createResult({
      state:
        blockingFindings.length === 0 && routeFinding === undefined ? 'healthy' : 'action_required',
      findings: [...findings, ...(routeFinding === undefined ? [] : [routeFinding])],
      nextActions,
      data: {
        configured: true,
        cli_version: health.cliVersion,
        project_version: health.projectVersion,
        ...((reviewRoutes.length > 0 || routeFinding !== undefined) && {
          review_routes: reviewRoutes,
        }),
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
