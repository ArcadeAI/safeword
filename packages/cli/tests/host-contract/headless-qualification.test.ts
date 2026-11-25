import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { assertHeadlessContinuation } from '../../scripts/lib/headless-completion-controls.js';
import { prepareClaudeRetainedFixture } from './claude-retained-fixture.js';
import { exercise } from './propagation-retained-fixture.js';

const headlessLanes = [
  'cursor@2026.11.05-86047df/CLI/native',
  'claude@2.1.319/CLI/native',
  'codex@0.167.0/CLI/native',
  'opencode@2.4.1/CLI/native',
  'opencode@2.4.1/TUI/native',
];

it('checks retained settings and repairs a stale installation across exactly five headless lanes', async () => {
  const { result, counts } = await exercise('none', true, true, 'none', {
    headless: true,
  });
  expect(result.exit, result.failures.join('\n')).toBe(0);
  expect(result.settings?.map(row => row.lane).toSorted((a, b) => a.localeCompare(b))).toEqual(
    headlessLanes.toSorted((a, b) => a.localeCompare(b)),
  );
  expect(counts).toEqual({ architecture: 12, handoff: 14, design: 30 });
  expect(Reflect.get(result, 'rejected')).toEqual({
    exit: 2,
    failures: ['PROPAGATION_RESOURCE_STALE:opencode@2.4.1/TUI/native'],
  });
  expect(Reflect.get(result, 'repaired')).toHaveLength(5);
});

it('runs both continuations and all policy rejections through the headless entry', async () => {
  const fixture = await prepareClaudeRetainedFixture();
  try {
    const { result, continuationCalls } = await exercise('none', true, true, 'none', {
      headless: true,
      viaNativeMain: true,
      fixture,
    });
    expect(result.exit, result.failures.join('\n')).toBe(0);
    expect(result).toMatchObject({
      purpose: 'diagnostic-only',
      admission_eligible: false,
      continuation: { installation: 'codex@0.167.0/CLI/native' },
      claudeContinuation: { installation: fixture.prior.installation },
    });
    expect(continuationCalls).toEqual({ observed: 1, asserted: 1 });
    const policy = Reflect.get(result, 'policy');
    for (const phase of [policy.changed, policy.finalDenied]) {
      expect(
        phase
          .map((row: { lane: string }) => row.lane)
          .toSorted((a: string, b: string) => a.localeCompare(b)),
      ).toEqual(headlessLanes.toSorted((a, b) => a.localeCompare(b)));
    }
  } finally {
    fixture.close();
  }
});

it('routes the public headless command to the scoped runner and requires owned fixtures', () => {
  const runner = path.resolve(import.meta.dirname, '../../scripts/run-host-contract-proof.ts');
  const result = spawnSync(
    'bun',
    [runner, '--proof', 'headless-propagation', '--require-targets'],
    {
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_PROPAGATION_FIXTURES: '' },
    },
  );
  expect(result.status).toBe(3);
  expect(result.stderr).toContain('explicit owned native fixture map required');
});

function runQualification(lanes: readonly string[]) {
  const directory = mkdtempSync(path.join(tmpdir(), 'headless-qualification-'));
  try {
    const bindings = Object.fromEntries(
      lanes.map((lane, index) => {
        const fixture = path.join(directory, `fixture-${index}.json`);
        writeFileSync(fixture, '{}');
        return [lane, fixture];
      }),
    );
    const fixtureMap = path.join(directory, 'fixtures.json');
    writeFileSync(fixtureMap, JSON.stringify(bindings));
    const runner = path.resolve(import.meta.dirname, '../../scripts/run-host-contract-proof.ts');
    return spawnSync('bun', [runner, '--proof', 'headless-qualification', '--require-targets'], {
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_PROPAGATION_FIXTURES: fixtureMap },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it('reports exactly five headless targets before refusing fixtures without native evidence', () => {
  const result = runQualification(headlessLanes);
  const manifest = /^HEADLESS_QUALIFICATION_TARGETS (.+)$/mu.exec(result.stdout);
  expect(
    manifest,
    'HEADLESS_QUALIFICATION_MISSING: runner emitted no target manifest',
  ).not.toBeNull();
  const targets = JSON.parse(manifest?.[1] ?? '[]') as string[];
  expect(targets.toSorted((a, b) => a.localeCompare(b))).toEqual(
    headlessLanes.toSorted((a, b) => a.localeCompare(b)),
  );
  expect(result.status).toBe(3);
  expect(result.stderr).toContain('HEADLESS_QUALIFICATION_FIXTURES_UNAVAILABLE');
});

it.each([
  ['missing', headlessLanes.slice(1)],
  ['foreign', [...headlessLanes.slice(1), 'foreign@1/CLI/native']],
  ['extra', [...headlessLanes, 'opencode@2.2.6/CLI/native']],
  ['Cursor IDE', [...headlessLanes, 'cursor@3.29.9/IDE/native']],
] as const)('refuses a fixture map with a %s lane before inspecting evidence', (_, lanes) => {
  const result = runQualification(lanes);
  expect(result.status).toBe(3);
  expect(result.stderr).toContain('HEADLESS_QUALIFICATION_POPULATION_MISMATCH');
  expect(result.stdout).not.toContain('HEADLESS_QUALIFICATION_TARGETS');
});

it('requires bounded completion to report that verification is missing', () => {
  const session = 'owned-thread';
  const stops = [
    {
      input: { session_id: session, stop_hook_active: false },
      stdout: '{"decision":"block","reason":"Missing verify.md"}',
    },
    { input: { session_id: session, stop_hook_active: true }, stdout: '{}' },
  ];
  const events = [
    { type: 'thread.started', thread_id: session },
    { type: 'item.completed', item: { type: 'agent_message', text: 'READY' } },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Missing verify.md' } },
    { type: 'turn.completed' },
  ];
  expect(() => {
    assertHeadlessContinuation('codex', JSON.stringify({ stops, events }));
  }).not.toThrow();
  expect(() => {
    assertHeadlessContinuation('codex', JSON.stringify({ stops: [...stops, stops[1]], events }));
  }).toThrow('exactly one continuation');
  const reply = events[2]?.item;
  if (!reply) throw new Error('Test fixture is missing the completion reply');
  reply.text = 'Verification passed';
  expect(() => {
    assertHeadlessContinuation('codex', JSON.stringify({ stops, events }));
  }).toThrow('expected unmet verification');
});
