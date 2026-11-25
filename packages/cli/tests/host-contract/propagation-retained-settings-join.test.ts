import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import type { runRetainedSettings } from '../../scripts/lib/propagation-settings.js';
import {
  type DesignSettingObservation,
  type PolicyObservation,
  type PropagationLane,
  propagationLanes,
  type TerminalObservation,
} from '../../scripts/lib/resource-propagation.js';
import { prepareClaudeRetainedFixture } from './claude-retained-fixture.js';
import { prepareCursorRetainedFixture } from './cursor-retained-fixture.js';
import { exercise } from './propagation-retained-fixture.js';

it('joins both Cursor IDE continuations through the retained settings diagnostic', async () => {
  const native = await prepareCursorRetainedFixture('portable');
  const project = await prepareCursorRetainedFixture('project-hooks');
  try {
    const cursor = { native, 'project-hooks': project };
    const { result, records } = await exercise('none', true, true, undefined, { cursor });
    expect(result.exit, result.failures.join('\n')).toBe(0);
    const observed = Reflect.get(result, 'cursorContinuation');
    expect(observed, 'CURSOR_RETAINED_CONTINUATION_MISSING').toHaveLength(2);
    for (const [delivery, fixture] of Object.entries(cursor)) {
      const lane = propagationLanes().find(
        row => row.agent === 'cursor' && row.runtime === 'IDE' && row.delivery === delivery,
      );
      const row = observed.find((item: { lane: string }) => item.lane === lane?.id);
      expect(row.installation).toBe(fixture.prior.installation);
      expect(row.observation.origin).toBe(fixture.prior.origin);
      expect(row.observation.ticket).toContain('phase: verify');
      expect(JSON.parse(row.observation.configuration.bytes)).toMatchObject({
        architectureReviewGate: true,
        crossModelReview: false,
      });
      expect(row.observation.stops[0].followup).toContain('cited evidence');
      expect(row.observation.cap.response.input.conversation_id).toBe(
        row.observation.stops[0].input.conversation_id,
      );
      expect(row.observation.cap.skip).toMatchObject({ loop: 1, limit: 1 });
      const captured = records
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
      expect(captured).toContainEqual(expect.objectContaining({ lane: lane?.id, kind: 'policy' }));
    }
  } finally {
    native.close();
    project.close();
  }
}, 600_000);

it('refuses a replaced Cursor installation at the continuation boundary', async () => {
  const native = await prepareCursorRetainedFixture('portable');
  const project = await prepareCursorRetainedFixture('project-hooks');
  try {
    const cursor = { native, 'project-hooks': project };
    const { result } = await exercise('none', true, true, undefined, { cursor, replacement: true });
    expect(result.exit).toBe(2);
    expect(result.failures.join('\n')).toContain('PROPAGATION_INSTALLATION_REPLACED');
  } finally {
    native.close();
    project.close();
  }
}, 600_000);

it.each([
  ['conversation', 2, 'CURSOR_CONTINUATION_CONVERSATION'],
  ['cap', 3, 'Cursor cap missing'],
  ['followup', 2, 'OUTCOME_MISMATCH'],
  ['origin', 2, 'CURSOR_CONTINUATION_ORIGIN'],
] as const)(
  'refuses Cursor continuation with %s fault',
  async (cursorFault, exit, reason) => {
    const native = await prepareCursorRetainedFixture('portable');
    const project = await prepareCursorRetainedFixture('project-hooks');
    try {
      const { result } = await exercise('none', true, true, undefined, {
        cursor: { native, 'project-hooks': project },
        cursorFault,
      });
      expect(result.exit).toBe(exit);
      expect(result.failures.join('\n')).toContain(reason);
    } finally {
      native.close();
      project.close();
    }
  },
  600_000,
);

it('joins Claude continuation into the retained settings diagnostic', async () => {
  const fixture = await prepareClaudeRetainedFixture();
  try {
    const { result, records } = await exercise('none', true, true, undefined, { fixture });
    expect(result.exit, result.failures.join('\n')).toBe(0);
    const continuation: { installation: string; raw: string } | undefined = Reflect.get(
      result,
      'claudeContinuation',
    );
    expect(continuation, 'CLAUDE_RETAINED_CONTINUATION_MISSING').toBeDefined();
    if (!continuation) throw new Error('continuation missing');
    expect(continuation.installation).toBe(fixture.prior.installation);
    const raw = JSON.parse(continuation.raw);
    const earlier = JSON.parse(fixture.prior.raw).observations;
    expect(raw.stops).toHaveLength(2);
    expect(raw.stops.map((row: { input: { session_id: string } }) => row.input.session_id)).toEqual(
      [earlier[0].input.session_id, earlier[0].input.session_id],
    );
    expect(
      raw.stops.map((row: { input: { stop_hook_active: boolean } }) => row.input.stop_hook_active),
    ).toEqual([false, true]);
    expect(JSON.parse(raw.stops[0].stdout)).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('verify.md'),
    });
    expect(raw.events.at(-1)?.subtype).toBe('error_max_turns');
    const responses = raw.events.filter(
      (event: { type: string; message?: { content?: { type: string }[] } }) =>
        event.type === 'assistant' && event.message?.content?.some(part => part.type === 'text'),
    );
    expect(responses).toHaveLength(2);
    expect(JSON.stringify(responses[1])).toContain('Missing verify.md verification.');
    const lane = propagationLanes().find(row => row.agent === 'claude');
    expect(
      records
        .split('\n')
        .filter(Boolean)
        .map(row => JSON.parse(row)),
    ).toContainEqual(expect.objectContaining({ lane: lane?.id, kind: 'continuation' }));
  } finally {
    fixture.close();
  }
}, 120_000);

it.each([
  ['missing', false, 'HOST_CONTINUATION_MISSING'],
  ['excess', false, 'CONTINUATION_BOUND_EXCEEDED'],
  ['foreign', false, 'foreign-session'],
  ['none', true, 'PROPAGATION_INSTALLATION_REPLACED'],
] as const)(
  'refuses Claude %s continuation with replacement %s',
  async (fault, replacement, reason) => {
    const fixture = await prepareClaudeRetainedFixture(fault);
    try {
      const { result } = await exercise('none', true, true, undefined, { fixture, replacement });
      expect(result.exit, result.failures.join('\n')).toBe(2);
      expect(result.failures.join('\n')).toContain(reason);
    } finally {
      fixture.close();
    }
  },
  120_000,
);

it.each(['none', 'installation', 'missing', 'assertion', 'setup'] as const)(
  'binds diagnostic Codex continuation and refuses %s controller faults',
  async fault => {
    const { result, records, inputs, lanes, continuationCalls } = await exercise(
      'none',
      true,
      true,
      fault,
    );
    const expected = {
      none: '',
      installation: 'PROPAGATION_INSTALLATION_REPLACED',
      missing: 'retained Codex continuation missing',
      assertion: 'HOST_CONTINUATION_MISSING',
      setup: 'HOST_CONTRACT_PROOF_UNAVAILABLE: first Stop did not block',
    };
    if (fault !== 'none') {
      expect(result.exit).toBe(fault === 'missing' || fault === 'setup' ? 3 : 2);
      expect(result.failures.join('\n')).toContain(expected[fault]);
      expect(continuationCalls.asserted).toBe(Number(fault === 'assertion' || fault === 'setup'));
      return;
    }
    expect(result.exit, result.failures.join('\n')).toBe(0);
    expect(continuationCalls).toEqual({ observed: 1, asserted: 1 });
    expect(Reflect.get(result, 'continuation').installation).toBe(
      lanes.find(row => row.agent === 'codex')?.id,
    );
    expect(records).toContain('"kind":"continuation"');
    expect(inputs.diagnostic).toBe('retained-settings-codex-continuation');
    for (const name of ['codex-native-continuation.ts', 'codex-native-catalogue.ts']) {
      const relative = `../../tests/helpers/${name}`;
      const source = path.resolve(import.meta.dirname, '../helpers', name);
      expect(inputs.controller_sha256[relative]).toBe(
        createHash('sha256').update(readFileSync(source)).digest('hex'),
      );
    }
  },
);

it('keeps the default and public propagation paths out of the settings join', async () => {
  const { result, counts, records } = await exercise('none', false);
  expect(result.exit).toBe(0);
  expect(result.settings).toBeUndefined();
  expect(counts).toEqual({ architecture: 0, handoff: 0, design: 0 });
  expect(records).not.toContain('"kind":"design"');
  expect(records).not.toContain('"kind":"handoff"');
  const root = mkdtempSync(path.join(tmpdir(), 'settings-public-'));
  try {
    const fixture = path.join(root, 'fixtures.json');
    writeFileSync(fixture, '{}');
    const runner = path.resolve(import.meta.dirname, '../../scripts/run-host-contract-proof.ts');
    const args = [runner, '--proof', 'propagation', '--require-targets'];
    const env = { ...process.env, SAFEWORD_PROPAGATION_FIXTURES: fixture };
    const bare = spawnSync('bun', args, { encoding: 'utf8', env });
    const component = spawnSync('bun', [...args, '--component', 'resources'], {
      encoding: 'utf8',
      env,
    });
    expect(bare.status).toBe(3);
    expect(bare.stderr).toContain('policy/options native probes remain unwired');
    expect(component.status).toBe(3);
    expect(component.stderr).toContain('fixture bindings differ from required population');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('joins every applicable settings case on the retained seven-lane controller', async () => {
  const { result, counts, lanes, records, seen } = await exercise('none');
  expect(result.exit, result.failures.join('\n')).toBe(0);
  expect(result.settings, 'PROPAGATION_SETTINGS_JOIN_MISSING').toBeDefined();
  expect(lanes).toHaveLength(7);
  expect(counts).toEqual({ architecture: 24, handoff: 28, design: 42 });
  expect(records).toContain('"kind":"design"');
  expect(records).toContain('"kind":"handoff"');
  if (!result.settings) throw new Error('settings missing');
  assertJoined(result.settings, lanes, seen);
});

it('runs the diagnostic native entry on the same captured seven installations', async () => {
  const { result, lanes, records, seen, inputs, counts } = await exercise('none', true, true);
  expect(result.exit, result.failures.join('\n')).toBe(0);
  expect(result.settings, 'PROPAGATION_NATIVE_SETTINGS_ENTRY_MISSING').toBeDefined();
  if (!result.settings) throw new Error('diagnostic settings missing');
  assertJoined(result.settings, lanes, seen);
  expect(counts).toEqual({ architecture: 24, handoff: 28, design: 42 });
  expect(records).toContain('"kind":"design"');
  expect(records).toContain('"kind":"handoff"');
  const source = path.resolve(import.meta.dirname, '../../scripts/lib/propagation-settings.ts');
  expect(inputs.controller_sha256['propagation-settings.ts']).toBe(
    createHash('sha256').update(readFileSync(source)).digest('hex'),
  );
  expect(inputs.diagnostic).toBe('retained-settings');
});

it('refuses a misrouted Cursor settings observation through the diagnostic runner', async () => {
  const { result } = await exercise('cursor-protocol', true, true);
  expect(result.exit).toBe(2);
  expect(result.failures.join('\n')).toContain('PROPAGATION_SETTINGS_PROTOCOL');
});

it.each([
  ['missing', 3, 'PROPAGATION_DESIGN_SETTING:0:UNOBSERVED'],
  ['outcome', 2, 'PROPAGATION_DESIGN_SETTING:0:MISMATCH'],
] as const)('fails the diagnostic runner on %s settings data', async (fault, exit, reason) => {
  const { result } = await exercise(fault, true, true);
  expect(result.exit).toBe(exit);
  expect(result.failures.join('\n')).toContain(reason);
});

it('does not expose the diagnostic entry through the public propagation command', () => {
  const runner = path.resolve(import.meta.dirname, '../../scripts/run-host-contract-proof.ts');
  const root = mkdtempSync(path.join(tmpdir(), 'settings-public-diagnostic-'));
  try {
    const fixture = path.join(root, 'fixtures.json');
    writeFileSync(fixture, '{}');
    const result = spawnSync(
      'bun',
      [
        runner,
        '--proof',
        'propagation',
        '--require-targets',
        '--component',
        'policy-resources-settings',
      ],
      { encoding: 'utf8', env: { ...process.env, SAFEWORD_PROPAGATION_FIXTURES: fixture } },
    );
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('HOST_CONTRACT_PROOF_UNAVAILABLE: false == true');
    expect(result.stdout).not.toContain('PROPAGATION_NATIVE_ARTIFACTS');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function assertJoined(
  rows: Awaited<ReturnType<typeof runRetainedSettings>>,
  lanes: PropagationLane[],
  seen: Map<
    string,
    {
      architecture: PolicyObservation[];
      handoff: TerminalObservation[];
      design: DesignSettingObservation[];
    }
  >,
) {
  const key = (id: string) => {
    const lane = lanes.find(row => row.id === id);
    if (!lane) throw new Error('foreign lane');
    return `${lane.agent}/${lane.runtime}/${lane.delivery}`;
  };
  const compare = (a: string, b: string) => a.localeCompare(b);
  const stop = [
    'claude/CLI/native',
    'codex/CLI/native',
    'cursor/IDE/native',
    'cursor/IDE/project-hooks',
  ].toSorted(compare);
  const all = [...stop, 'cursor/CLI/native', 'opencode/CLI/native', 'opencode/TUI/native'].toSorted(
    compare,
  );
  expect(rows.map(row => key(row.lane)).toSorted(compare)).toEqual(all);
  expect(
    rows
      .filter(row => row.architecture)
      .map(row => key(row.lane))
      .toSorted(compare),
  ).toEqual(stop);
  expect(
    rows
      .filter(row => row.handoff)
      .map(row => key(row.lane))
      .toSorted(compare),
  ).toEqual(stop);
  for (const row of rows) assertOriginal(row, seen.get(row.lane));
}

function assertOriginal(
  row: Awaited<ReturnType<typeof runRetainedSettings>>[number],
  original:
    | {
        architecture: PolicyObservation[];
        handoff: TerminalObservation[];
        design: DesignSettingObservation[];
      }
    | undefined,
) {
  if (!original) throw new Error('original observations missing');
  expect(row.installation).toBe(row.lane);
  expect(row.design.observations).toHaveLength(6);
  expect(row.design.observations).toEqual(original.design);
  for (const [index, item] of row.design.observations.entries())
    expect(item).toBe(original.design[index]);
  if (row.architecture) {
    expect(row.architecture.observations).toHaveLength(6);
    expect(row.architecture.observations).toEqual(original.architecture);
    for (const [index, item] of row.architecture.observations.entries())
      expect(item).toBe(original.architecture[index]);
  }
  if (row.handoff) {
    expect(row.handoff.observations).toHaveLength(7);
    expect(row.handoff.caseIndices.toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(row.handoff.observations).toEqual(original.handoff);
    for (const [index, item] of row.handoff.observations.entries())
      expect(item).toBe(original.handoff[index]);
  }
}

it.each([
  ['missing', 3, 'PROPAGATION_DESIGN_SETTING:0:UNOBSERVED'],
  ['case', 3, 'case observation missing'],
  ['protocol', 2, 'PROPAGATION_SETTINGS_PROTOCOL'],
  ['cursor-protocol', 2, 'PROPAGATION_SETTINGS_PROTOCOL'],
  ['installation', 2, 'PROPAGATION_INSTALLATION_REPLACED'],
  ['foreign', 2, 'PROPAGATION_INSTALLATION_REPLACED'],
  ['outcome', 2, 'PROPAGATION_DESIGN_SETTING:0:MISMATCH'],
] as const)('refuses the settings join when %s is invalid', async (fault, exit, reason) => {
  const { result } = await exercise(fault);
  expect(result.exit, result.failures.join('\n')).toBe(exit);
  expect(result.failures.join('\n')).toContain(reason);
});
