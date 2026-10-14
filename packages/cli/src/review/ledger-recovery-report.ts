import { createHash } from 'node:crypto';

import cases from './ledger-recovery-cases.json' with { type: 'json' };
import { LEDGER_RECOVERY_PROFILE } from './ledger-recovery-profile.js';

export interface RecoveryReportSummary {
  readonly passed: number;
  readonly deferred: number;
  readonly cases: readonly string[];
}

/** Report validation alone never grants authenticated completion authority. */
export function assessRecoveryReport(
  report: unknown,
  exitCode: number,
): RecoveryReportSummary | undefined {
  if (exitCode !== 0) return undefined;
  const elements = featureElements(report);
  const active = cases.filter(item => !item.deferred);
  if (elements?.length !== active.length) return undefined;
  const seen = new Set<string>();
  for (const element of elements) {
    if (!record(element)) return undefined;
    const expected = active.find(item => item.name === element.name && item.line === element.line);
    if (expected === undefined || seen.has(expected.digest)) return undefined;
    if (!validSteps(element.steps, expected.stepDigests)) return undefined;
    seen.add(expected.digest);
  }
  return {
    passed: active.length,
    deferred: cases.filter(item => item.deferred).length,
    cases: active.map(item => item.digest),
  };
}

function featureElements(report: unknown): unknown[] | undefined {
  if (!Array.isArray(report) || report.length !== 1) return undefined;
  const feature: unknown = report[0];
  if (!record(feature) || feature.uri !== LEDGER_RECOVERY_PROFILE.feature) return undefined;
  return Array.isArray(feature.elements) ? feature.elements : undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validSteps(steps: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(steps) || steps.some(step => !record(step))) return false;
  if (steps.some(step => !record(step.result) || step.result.status !== 'passed')) return false;
  const assertions = steps.filter(step => step.hidden !== true);
  return (
    assertions.length === expected.length &&
    assertions.every((step, index) => {
      const assertion = expected[index];
      return (
        assertion !== undefined &&
        record(step.match) &&
        createHash('sha256')
          .update(JSON.stringify([step.name, step.match.location]))
          .digest('hex') === assertion
      );
    })
  );
}
