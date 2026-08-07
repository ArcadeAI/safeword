import type { AgentIntegration } from '../cli-protocol/agent-selection.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  type LifecycleSurfaceObservation,
  lifecycleSurfaceSummaries,
  observeLifecycleSurfaces,
  summarizeLifecycleStatus,
} from './status.js';

interface LifecycleDiagnostic {
  readonly surface: string;
  readonly kind: 'finding' | 'error';
  readonly code: string;
  readonly cause: string;
  readonly severity?: string;
  readonly retryable?: boolean;
}

function diagnostics(
  surfaces: readonly LifecycleSurfaceObservation[],
): readonly LifecycleDiagnostic[] {
  return surfaces.flatMap(surface => [
    ...surface.result.findings.map(finding => ({
      surface: surface.name,
      kind: 'finding' as const,
      code: finding.code,
      cause: finding.message,
      severity: finding.severity,
    })),
    ...surface.result.errors.map(error => ({
      surface: surface.name,
      kind: 'error' as const,
      code: error.code,
      cause: error.message,
      retryable: error.retryable,
    })),
  ]);
}

export async function diagnoseLifecycle(
  cwd: string,
  agents: readonly AgentIntegration[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CliResult> {
  const surfaces = await observeLifecycleSurfaces(cwd, agents, environment);
  const summary = summarizeLifecycleStatus(agents, surfaces);
  return createResult({
    state: summary.state,
    changed: summary.changed,
    effects: summary.effects,
    findings: surfaces.flatMap(surface => surface.result.findings),
    errors: surfaces.flatMap(surface => surface.result.errors),
    recovery: surfaces.flatMap(surface => surface.result.recovery),
    nextActions: surfaces.flatMap(surface => surface.result.nextActions),
    data: {
      command: 'doctor',
      operation: 'doctor',
      selected_agents: agents,
      surfaces: lifecycleSurfaceSummaries(surfaces),
      coverage: surfaces.map(surface => ({
        surface: surface.name,
        state: surface.result.state,
        evidence: surface.result.data,
      })),
      diagnostics: diagnostics(surfaces),
    },
  });
}
