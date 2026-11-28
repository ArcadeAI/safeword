import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { type NativeTurn, resourceLoad } from '../helpers/codex-workflow-observation.js';

// Synthetic protocol controls, NOT native receipts. Ranges retain the observed353-line shapes.
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function trace(ranges: number[][]) {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-segments-'));
  roots.push(root);
  const target = path.join(root, 'SKILL.md');
  const marker = 'RESOURCE_CURRENT_CONTROL';
  const lines = Array.from({ length: 353 }, (_, i) =>
    i === 0 ? `<!-- ${marker} -->\n` : `Current instruction ${i}.\n`,
  );
  writeFileSync(target, lines.join(''));
  const turn: NativeTurn = {
    thread: 'control',
    rollout: 'non-receipt',
    models: [],
    allEntries: [],
    entries: [],
    events: [],
  };
  const observations = ranges.map(([from = 1, to = 353], index) => {
    const command = `sed -n '${from},${to}p' '${target}'`;
    const call = { type: 'custom_tool_call', call_id: `range-${index}`, input: '' };
    const response = { type: 'custom_tool_call_output', call_id: call.call_id, output: '' };
    const item = {
      type: 'command_execution',
      command: '',
      exit_code: 0,
      aggregated_output: lines.slice(from - 1, to).join(''),
    };
    const sync = (command_ = command) => {
      call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: command_ })}); text(r.output);`;
      item.command = `/bin/zsh -lc '${command_.replaceAll("'", "'\"'\"'")}'`;
      response.output = JSON.stringify({
        chunk_id: call.call_id,
        wall_time_seconds: 0,
        exit_code: item.exit_code,
        output: item.aggregated_output,
      });
    };
    sync();
    turn.entries.push(
      { type: 'response_item', payload: call },
      { type: 'response_item', payload: response },
    );
    turn.events.push({ type: 'item.completed', item });
    return { call, response, item, sync, command };
  });
  const load = (afterEntryIndex = -1) => {
    const evidence = { ...turn, afterEntryIndex };
    return resourceLoad(evidence, target, marker);
  };
  return { target, turn, observations, load };
}

it.each([
  {
    ranges: [
      [1, 260],
      [261, 620],
    ],
  },
  {
    ranges: [
      [1, 260],
      [201, 520],
    ],
  },
])('credits complete current delivery across successful ranges $ranges', ({ ranges }) => {
  const c = trace(ranges);
  expect(c.load()).toMatchObject({ completeBody: true, callIds: ['range-0', 'range-1'] });
  expect(c.load().entryIndex).toBe(3);
});

it.each([
  {
    ranges: [
      [1, 260],
      [262, 620],
    ],
  },
  {
    ranges: [
      [1, 260],
      [201, 260],
    ],
  },
])('rejects a gap or repeated-only overlap $ranges', ({ ranges }) => {
  expect(trace(ranges).load).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it.each(['stale-overlap', 'foreign-target', 'failed', 'quoted-echo', 'conditional', 'pipeline'])(
  'rejects %s segment evidence',
  fault => {
    const c = trace([
      [1, 260],
      [201, 520],
    ]);
    const last = c.observations[1];
    if (!last) throw new Error('Missing fixture observation');
    let command = last.command;
    switch (fault) {
      case 'stale-overlap': {
        last.item.aggregated_output = last.item.aggregated_output.replace(
          'Current instruction 201.',
          'Stale instruction 201.',
        );
        break;
      }
      case 'foreign-target': {
        command = command.replace(c.target, '/foreign/SKILL.md');
        break;
      }
      case 'failed': {
        last.item.exit_code = 1;
        break;
      }
      case 'quoted-echo': {
        command = `printf '%s' ${JSON.stringify(command)}`;
        break;
      }
      case 'conditional': {
        command = `false && ${command}; printf done`;
        break;
      }
      case 'pipeline': {
        {
          command += ' | cat';
          // No default
        }
        break;
      }
    }
    last.sync(command);
    expect(c.load).toThrow('INTERNAL_WORKFLOW_UNMET');
  },
);

it.each([0, 1])('requires successful SDK evidence for a complete body, exit %s', status => {
  const c = trace([[1, 620]]);
  const observation = c.observations[0];
  if (!observation) throw new Error('Missing fixture observation');
  observation.item.exit_code = status;
  observation.sync();
  if (status === 0) expect(c.load().completeBody).toBe(true);
  else expect(c.load).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it('rejects mismatched call IDs rather than pooling uncorrelated bytes', () => {
  const c = trace([
    [1, 260],
    [261, 620],
  ]);
  const last = c.observations[1];
  if (!last) throw new Error('Missing fixture observation');
  last.response.call_id = 'foreign';
  expect(c.load).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

it('rejects an output containing only the final line', () => {
  const c = trace([
    [1, 260],
    [261, 620],
  ]);
  const last = c.observations[1];
  if (!last) throw new Error('Missing fixture observation');
  last.item.aggregated_output = readFileSync(c.target, 'utf8').split('\n').at(-2) ?? '';
  last.sync();
  expect(c.load).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it.each([
  'printf ignored # ; READ',
  'printf ignored; ( READ )',
  'printf ignored; if true; then READ; fi',
  'READ || printf masked',
  'false && READ; printf masked',
  'printf allowed && READ; printf masked',
  "sed -n '261,620p' 'TARGET",
])('rejects unsupported or masked range execution: %s', template => {
  const c = trace([
    [1, 260],
    [261, 620],
  ]);
  const last = c.observations[1];
  if (!last) throw new Error('Missing fixture observation');
  last.sync(template.replace('READ', () => last.command).replace('TARGET', () => c.target));
  expect(c.load).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it('accepts a literal range in a successful final && chain', () => {
  const c = trace([
    [1, 260],
    [261, 620],
  ]);
  const last = c.observations[1];
  if (!last) throw new Error('Missing fixture observation');
  last.sync(`printf before && ${last.command} && printf after`);
  expect(c.load().callIds).toEqual(['range-0', 'range-1']);
});

it('records the first complete delivery instead of a redundant later re-read', () => {
  const c = trace([
    [1, 260],
    [261, 620],
    [1, 10],
  ]);
  expect(c.load()).toMatchObject({ entryIndex: 3, callIds: ['range-0', 'range-1'] });
});

it.each([
  {
    ranges: [
      [1, 620],
      [1, 10],
    ],
    after: 1,
  },
  {
    ranges: [
      [1, 260],
      [261, 620],
    ],
    after: 1,
  },
  {
    ranges: [
      [1, 260],
      [261, 620],
      [1, 10],
    ],
    after: 3,
  },
])('does not pool earlier history into a post-public load: $ranges', ({ ranges, after }) => {
  expect(() => trace(ranges).load(after)).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it('accepts complete new coverage after the public load, ignoring earlier reads', () => {
  const c = trace([
    [1, 260],
    [261, 620],
    [1, 260],
    [261, 620],
  ]);
  for (const observation of c.observations.slice(2))
    observation.sync(observation.command.replaceAll("'", '"'));
  expect(c.load(3)).toMatchObject({ entryIndex: 7, callIds: ['range-2', 'range-3'] });
});

it('reports ambiguous identical commands and outputs as unavailable', () => {
  expect(() =>
    trace([
      [1, 260],
      [261, 620],
      [1, 260],
      [261, 620],
    ]).load(3),
  ).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous identical tool observations');
});

it('ignores unrelated identical observations beside a complete split read', () => {
  const c = trace([
    [1, 260],
    [261, 620],
    [1, 10],
    [1, 10],
  ]);
  for (const observation of c.observations.slice(2)) {
    observation.item.aggregated_output = 'On branch codex/fixture\n';
    observation.sync('git status');
  }
  expect(c.load()).toMatchObject({ entryIndex: 3, callIds: ['range-0', 'range-1'] });
});

it('uses actual output completion for a single full-body read', () => {
  expect(trace([[1, 620]]).load().entryIndex).toBe(1);
});
