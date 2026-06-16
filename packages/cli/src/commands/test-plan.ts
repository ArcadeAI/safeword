/**
 * `safeword test-plan` — emit the test/build commands for every language present
 * in the repo, as the single source of truth consumers (verify/audit/test-runner)
 * call. Plan-only: prints commands, never runs them.
 */

import nodePath from 'node:path';
import process from 'node:process';

import { renderShellPlan } from '../test-plan/render.js';
import { type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';

type Format = 'human' | 'json' | 'sh';

export function testPlan(
  options: { kind?: string; json?: boolean; format?: string },
  dir?: string,
): Promise<void> {
  const kind = parseKind(options.kind);
  const format = parseFormat(options);
  const root = dir === undefined ? process.cwd() : nodePath.resolve(process.cwd(), dir);
  const plan = resolveTestPlan(root, { kind });

  if (format === 'json') {
    console.log(JSON.stringify(plan));
    return Promise.resolve();
  }
  if (format === 'sh') {
    process.stdout.write(renderShellPlan(plan));
    return Promise.resolve();
  }

  if (plan.length === 0) {
    console.log(`No ${kind} suites detected.`);
    return Promise.resolve();
  }
  for (const planEntry of plan) {
    const suffix = planEntry.available ? '' : ' (unavailable — skipped)';
    console.log(`${planEntry.language}: ${planEntry.command}${suffix}`);
  }
  return Promise.resolve();
}

/** `--json` is the back-compat alias for `--format json`. */
function parseFormat(options: { json?: boolean; format?: string }): Format {
  if (options.json) return 'json';
  const value = options.format;
  if (value === undefined || value === 'human') return 'human';
  if (value === 'json' || value === 'sh') return value;
  console.error(`Unknown --format "${value}" (expected "human", "json", or "sh")`);
  process.exit(1);
}

function parseKind(value: string | undefined): PlanKind {
  if (value === undefined || value === 'test') return 'test';
  if (value === 'build') return 'build';
  console.error(`Unknown --kind "${value}" (expected "test" or "build")`);
  process.exit(1);
}
