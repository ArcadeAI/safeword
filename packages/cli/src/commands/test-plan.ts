/**
 * `safeword test-plan` — emit the test/build commands for every language present
 * in the repo, as the single source of truth consumers (verify/audit/test-runner)
 * call. Plan-only: prints commands, never runs them.
 */

import nodePath from 'node:path';
import process from 'node:process';

import { type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';

export function testPlan(options: { kind?: string; json?: boolean }, dir?: string): Promise<void> {
  const kind = parseKind(options.kind);
  const root = dir === undefined ? process.cwd() : nodePath.resolve(process.cwd(), dir);
  const plan = resolveTestPlan(root, { kind });

  if (options.json) {
    console.log(JSON.stringify(plan));
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

function parseKind(value: string | undefined): PlanKind {
  if (value === undefined || value === 'test') return 'test';
  if (value === 'build') return 'build';
  console.error(`Unknown --kind "${value}" (expected "test" or "build")`);
  process.exit(1);
}
