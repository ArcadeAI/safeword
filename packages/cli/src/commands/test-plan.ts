/**
 * `safeword project test-plan` — emit the test/build commands for every language present
 * in the repo, as the single source of truth consumers (verify/audit/test-runner)
 * call. Plan-only: prints commands, never runs them.
 */

import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { renderShellPlan } from '../test-plan/render.js';
import { type Language, type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';

type Format = 'human' | 'json' | 'sh';

const LANE_NAMES: Readonly<Record<PlanKind, string>> = {
  test: 'test',
  build: 'build',
  verify: 'verification',
  typecheck: 'typecheck',
  deps: 'dependency',
  bdd: 'acceptance',
};

const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
};

function rawTestPlanPresentation(
  format: Format,
  plan: ReturnType<typeof resolveTestPlan>,
): CliResult['presentation'] {
  if (format === 'json') return { kind: 'raw', body: JSON.stringify(plan) };
  if (format === 'sh') return { kind: 'raw', body: renderShellPlan(plan) };
  return undefined;
}

export function observeTestPlan(
  cwd: string,
  dir: string | undefined,
  options: Readonly<Record<string, unknown>>,
): Promise<CliResult> {
  const kindValue = typeof options.kind === 'string' ? options.kind : undefined;
  const validKinds = new Set(['test', 'build', 'verify', 'typecheck', 'deps', 'bdd']);
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
  const formatValue = typeof options.format === 'string' ? options.format : 'human';
  if (!['human', 'json', 'sh'].includes(formatValue)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'TEST_PLAN_FORMAT_INVALID',
            message: `Unknown test-plan format "${formatValue}".`,
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
      message: `${LANGUAGE_NAMES[entry.language]} ${LANE_NAMES[kind]} lane skipped: ${entry.runner} is not installed.`,
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
      state: 'healthy',
      findings,
      presentation: rawTestPlanPresentation(formatValue as Format, plan),
      data: { command: 'project test-plan', kind, plan },
    }),
  );
}
