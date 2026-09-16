/**
 * `safeword project test-plan` — emit the test/build commands for every language present
 * in the repo, as the single source of truth consumers (verify/audit/test-runner)
 * call. Plan-only: prints commands, never runs them.
 */

import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { PLAN_LANE_NAMES, renderShellPlan, unavailablePlanMessage } from '../test-plan/render.js';
import { type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';

type Format = 'human' | 'json' | 'sh';

const TEST_PLAN_FORMATS: Readonly<Record<Format, true>> = {
  human: true,
  json: true,
  sh: true,
};

function parseFormat(value: unknown): Format | undefined {
  if (value === undefined) return 'human';
  if (typeof value !== 'string') return undefined;
  const validFormats = new Set<string>(Object.keys(TEST_PLAN_FORMATS));
  return validFormats.has(value) ? (value as Format) : undefined;
}

function parseKind(value: unknown): PlanKind | undefined {
  if (value === undefined) return 'test';
  if (typeof value !== 'string') return undefined;
  const validKinds = new Set<string>(Object.keys(PLAN_LANE_NAMES));
  return validKinds.has(value) ? (value as PlanKind) : undefined;
}

function rawTestPlanPresentation(
  format: Format,
  plan: ReturnType<typeof resolveTestPlan>,
  kind: PlanKind,
): CliResult['presentation'] {
  if (format === 'json') return { kind: 'raw', body: JSON.stringify(plan) };
  if (format === 'sh') return { kind: 'raw', body: renderShellPlan(plan, kind) };
  return undefined;
}

export function observeTestPlan(
  cwd: string,
  dir: string | undefined,
  options: Readonly<Record<string, unknown>>,
): Promise<CliResult> {
  const kind = parseKind(options.kind);
  if (kind === undefined) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'TEST_PLAN_KIND_INVALID',
            message:
              typeof options.kind === 'string'
                ? `Unknown test-plan kind "${options.kind}".`
                : 'Test-plan kind must be a string.',
            retryable: false,
          },
        ],
      }),
    );
  }
  const formatValue = parseFormat(options.format);
  if (formatValue === undefined) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'TEST_PLAN_FORMAT_INVALID',
            message:
              typeof options.format === 'string'
                ? `Unknown test-plan format "${options.format}".`
                : 'Test-plan format must be a string.',
            retryable: false,
          },
        ],
      }),
    );
  }
  const root = dir === undefined ? cwd : nodePath.resolve(cwd, dir);
  const plan = resolveTestPlan(root, { kind });
  const findings = plan
    .filter(entry => !entry.available)
    .map(entry => ({
      code: 'TEST_PLAN_RUNNER_UNAVAILABLE',
      message: unavailablePlanMessage(entry, kind),
      severity: 'warning' as const,
      metadata: {
        kind,
        language: entry.language,
        runner: entry.runner,
        command: entry.command,
        cwd: entry.cwd,
      },
    }));
  const machinePlan = plan.map(entry => ({
    ...entry,
    unavailableReason: entry.available ? undefined : unavailablePlanMessage(entry, kind),
  }));
  return Promise.resolve(
    createResult({
      // Shell output carries its own per-lane failure status. Return it so the
      // verify consumer can evaluate every available lane; JSON/human callers
      // still receive action_required immediately for missing runners.
      state: findings.length === 0 || formatValue === 'sh' ? 'healthy' : 'action_required',
      findings,
      presentation: rawTestPlanPresentation(formatValue, machinePlan, kind),
      // Compatibility aliases normalize to the canonical command in machine
      // output, matching the deprecation metadata emitted by the CLI layer.
      data: { command: 'project test-plan', kind, plan: machinePlan },
    }),
  );
}
