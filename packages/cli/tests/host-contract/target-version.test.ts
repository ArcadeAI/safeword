import { rmSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';
import { observeExactHostVersion } from '../helpers/host-contract-version.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

describe('current-only required target selection', () => {
  it('publishes exactly the current required deliveries through the public checker', () => {
    const directory = createContractRepoFixture();
    fixtures.push(directory);
    const result = runContractRepoCheck(directory);
    const report = JSON.parse(result.output.trim()) as {
      errors: unknown[];
      data: { ownership_graph: { lanes: { id: string }[] }; admission_eligible: boolean };
    };
    expect(report.errors).toEqual([]);
    const expected = [
      'claude:2.1.319:CLI:native',
      'codex:0.167.0:CLI:native',
      'cursor:2026.11.05-86047df:CLI:native',
      'cursor:3.29.9:IDE:native',
      'cursor:3.29.9:IDE:project-hooks',
      'opencode:2.4.1:CLI:native',
      'opencode:2.4.1:TUI:native',
    ];
    const actual = report.data.ownership_graph.lanes
      .map(row => row.id)
      .toSorted((left, right) => left.localeCompare(right));
    expect(
      actual.filter(id => !expected.includes(id)),
      'RETIRED_HOST_TARGET_REQUIRED',
    ).toEqual([]);
    expect(actual, 'CURRENT_HOST_TARGET_MISSING').toEqual(
      expected.toSorted((left, right) => left.localeCompare(right)),
    );
    expect(result.status).toBe(0);
    expect(report.data.admission_eligible).toBe(false);
  });
});

describe('required host version observations', () => {
  it.each([
    ['2.1.319', '2.1.319 (Claude Code)\n'],
    ['0.167.0', 'codex-cli 0.167.0\n'],
    ['3.29.9', '3.29.9\n'],
    ['2.4.1', 'opencode v2.4.1\n'],
  ])('recognizes the exact required version %s', (expectedVersion, output) => {
    expect(observeExactHostVersion(expectedVersion, output)).toEqual({
      state: 'verified',
      version: expectedVersion,
    });
  });

  it('rejects a newer binary returned by a version-shaped download URL', () => {
    expect(observeExactHostVersion('3.29.9', '3.30.0\n')).toEqual({
      state: 'unavailable',
      reason: 'version-mismatch',
      expectedVersion: '3.29.9',
      observedVersion: '3.30.0',
    });
  });

  it.each([
    '',
    'requested 3.29.9; actually 3.30.0',
    '3.29.9\n3.30.0\n',
    'opencode v3.29.9-beta.1',
    '3.29.9 trailing diagnostics',
  ])('does not infer the required version from unreadable output %#', output => {
    expect(observeExactHostVersion('3.29.9', output)).toEqual({
      state: 'unavailable',
      reason: 'unreadable-version',
      expectedVersion: '3.29.9',
    });
  });
});
