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
  const kindValue = typeof options.kind === 'string' ? options.kind : undefined;
  const validKinds = new Set<string>(Object.keys(PLAN_LANE_NAMES));
  if (kindValue !== undefined && !validKinds.has(kindValue)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'TEST_PLAN_KIND_INVALID',
            message: `Unknown test-plan kind "${kindValue}".`,
            retryable: false,
          },
        ],
      }),
    );
  }
  const kind = (kindValue ?? 'test') as PlanKind;
  const formatValue = options.format ?? 'human';
  if (typeof formatValue !== 'string' || !(formatValue in TEST_PLAN_FORMATS)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'TEST_PLAN_FORMAT_INVALID',
            message: `Unknown test-plan format "${String(formatValue)}".`,
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
  return Promise.resolve(
    createResult({
      state: findings.length === 0 ? 'healthy' : 'action_required',
      findings,
      presentation: rawTestPlanPresentation(formatValue as Format, plan, kind),
      // Compatibility aliases normalize to the canonical command in machine
      // output, matching the deprecation metadata emitted by the CLI layer.
      data: { command: 'project test-plan', kind, plan },
    }),
  );
}
