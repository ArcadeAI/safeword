import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { nativeResult } from '../../scripts/run-host-contract-proof.js';
import { portableCases } from '../fixtures/host-contract/native-contract-cases.js';
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';

const intended = [
  'codex-0.167.0-portable-components',
  'cursor-cli-2026.11.05-86047df-portable-components',
  'cursor-ide-3.29.9-portable-components',
];

it('the public required runner selects all three portable executions before native setup', () => {
  const repo = nodePath.resolve(import.meta.dirname, '../../../..');
  const env = { ...process.env };
  for (const key of [
    'SAFEWORD_CODEX_TEST_CONFIG',
    'SAFEWORD_CURSOR_TEST_CONFIG',
    'SAFEWORD_CURSOR_CLI',
  ])
    env[key] = undefined;
  const result = spawnSync(
    nodePath.join(repo, 'scripts/dev'),
    [
      'bun',
      'packages/cli/scripts/run-host-contract-proof.ts',
      '--proof',
      'portable-components',
      '--require-targets',
    ],
    { cwd: repo, env, encoding: 'utf8', timeout: 30_000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(3);
  expect(result.stdout, 'PORTABLE_REQUIRED_RUNNER_UNWIRED').toContain(
    `PORTABLE_REQUIRED_CASES: ${JSON.stringify(intended)}`,
  );
  expect(result.stderr).toContain('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

// Synthetic Cucumber records exercise grading only, never native execution/proof.
it.each(['passed', 'failed', 'unavailable', 'missing', 'duplicate', 'wrong-row'])(
  'grades portable %s observations without filtered success',
  state => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'portable-grading-'));
    try {
      const required = portableCases().find(row => row.host === 'Codex');
      expect(required).toBeDefined();
      if (!required) throw new Error('missing Codex case');
      const statuses: Record<string, string> = { failed: 'failed', unavailable: 'skipped' };
      const scenario = {
        name: required.scenario,
        line: required.line,
        steps: ['passed', 'passed', statuses[state] ?? 'passed'].map(status => ({
          result: {
            status,
            error_message: 'PORTABLE_COMPONENTS_NOT_LOADED: wrong observed origin',
          },
        })),
      };
      let rows = [scenario];
      if (state === 'missing') rows = [];
      else if (state === 'duplicate') rows.push(scenario);
      const grade = () =>
        nativeResult(
          nodePath.resolve(import.meta.dirname, '../../../..'),
          nodePath.join(root, 'cucumber.json'),
          rows,
          state === 'failed' ? 1 : 0,
          {
            cases: [required],
            host: state === 'wrong-row' ? 'Cursor' : required.host,
            runtime: required.runtime,
          },
        );
      if (['missing', 'duplicate', 'wrong-row'].includes(state)) expect(grade).toThrow();
      else {
        const exits: Record<string, number> = { failed: 2, unavailable: 3, passed: 0 };
        expect(grade()).toBe(exits[state]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it('normally generates a clean IDE portable package before the external window boundary', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'portable-clean-ide-'));
  class SourceOnly extends CursorNativeCatalogueActor {
    protected override async prepareHost(): Promise<void> {}
    protected override launchWindow(): Promise<void> {
      return Promise.reject(new Error('WINDOW_BOUNDARY'));
    }
  }
  try {
    const actor = new SourceOnly({
      applicationBundle: '/unexecuted',
      profileDirectory: root,
      extensionsDirectory: root,
      runsDirectory: root,
    });
    await expect(actor.prepare('Cursor', '3.29.9', 'IDE', 'portable')).rejects.toThrow(
      'WINDOW_BOUNDARY',
    );
    const config = JSON.parse(
      readFileSync(nodePath.join(actor.workspace, '.cursor/hooks.json'), 'utf8'),
    );
    expect(Object.keys(config.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'afterShellExecution',
      'workspaceOpen',
    ]);
    const discovery = JSON.parse(
      readFileSync(
        nodePath.join(actor.workspace, '.host-contract/workspace-open-config.json'),
        'utf8',
      ),
    );
    expect(discovery.pluginPaths).toHaveLength(3);
    expect(
      readFileSync(nodePath.join(discovery.pluginPaths[1], 'skills/explain/SKILL.md'), 'utf8'),
    ).toContain('WORKFLOW_');
    expect(
      readFileSync(nodePath.join(discovery.pluginPaths[2], '.cursor-plugin/plugin.json'), 'utf8'),
    ).toContain('safeword');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
