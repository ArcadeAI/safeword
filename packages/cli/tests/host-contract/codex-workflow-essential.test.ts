import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { finalizeWorkflowRevision } from '../../src/codex-plugin/resource-revision.js';
import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';
import { testingCoreBlock } from '../../src/testing/shared-core.js';
import encoded from '../fixtures/host-contract/codex-encoded-output-shape.json' with { type: 'json' };
import parallelShape from '../fixtures/host-contract/codex-parallel-call-shape.json' with { type: 'json' };
import startupShape from '../fixtures/host-contract/codex-startup-context-shape.json' with { type: 'json' };
import truncatedShape from '../fixtures/host-contract/codex-truncated-envelope-shape.json' with { type: 'json' };
import {
  captureNodeBaseline,
  discriminateNodeTests,
  essentialOwner,
  markEssentialCore,
} from '../helpers/codex-workflow-essential.js';
import {
  messageText,
  type NativeTurn,
  resourceLoad,
  type Rollout,
  startupEssential,
} from '../helpers/codex-workflow-observation.js';
import {
  CodexWorkflowRuntimeActor,
  runWorkflowGenerator,
} from '../helpers/codex-workflow-runtime.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

// Unit transport controls only: these entries never attest native execution.
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function observation(outputCore: string, guideRead = false) {
  const installed = mkdtempSync(path.join(tmpdir(), 'safeword-essential-observer-'));
  roots.push(installed);
  const target = path.join(installed, 'internal/testing/SKILL.md');
  const guide = path.join(installed, 'templates/guides/testing-guide.md');
  const marker = 'CURRENT_PROCEDURE_UNIT_MARKER';
  const guideMarker = 'OPTIONAL_GUIDE_UNIT_MARKER';
  for (const file of [target, guide, path.join(installed, 'resources/SAFEWORD.md')]) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '# Fixture\n');
  }
  writeFileSync(target, `<!-- ${marker} -->\n# Testing\n${testingCoreBlock()}\n`);
  writeFileSync(guide, guideMarker);
  writeFileSync(
    path.join(installed, 'resources/workflow-index.json'),
    JSON.stringify({
      version: 1,
      workflows: [
        {
          name: 'testing',
          description: 'Unit testing description',
          userInvocable: false,
          allowImplicitInvocation: true,
          path: 'internal/testing/SKILL.md',
          resources: ['internal/testing/SKILL.md'],
        },
      ],
    }),
  );
  const revision = finalizeWorkflowRevision(installed);
  const bodyInput = JSON.stringify({ cmd: `cat ${target}` });
  const guideInput = JSON.stringify({ cmd: `cat ${guide}` });
  const entries: Rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'developer',
        content: [
          {
            text: `Safeword internal workflows are available automatically by description.\nUnit testing description\n${target}\nResource revision: ${revision}`,
          },
        ],
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'current-body',
        input: `await tools.exec_command(${bodyInput})`,
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'current-body',
        output: `<!-- ${marker} -->\n# Testing\n${outputCore}\n`,
      },
    },
  ];
  if (guideRead)
    entries.push(
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          call_id: 'optional-guide',
          input: `await tools.exec_command(${guideInput})`,
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'optional-guide',
          output: guideMarker,
        },
      },
    );
  const turn = {
    entries,
    events: [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `/bin/zsh -lc 'cat ${target}'`,
          exit_code: 0,
          aggregated_output: `<!-- ${marker} -->\n# Testing\n${outputCore}\n`,
        },
      },
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'node --test',
          exit_code: 0,
          aggregated_output: '# tests 1\n# pass 1\n# fail 0',
        },
      },
    ],
  } as NativeTurn;
  const unit = {
    installed,
    turn,
    core: testingCoreBlock(),
    markers: { testing: marker, guide: guideMarker },
    sequence: 2,
    artifacts: installed,
    save() {},
  } as unknown as CodexWorkflowRuntimeActor;
  return { unit, entries, target, marker, turn };
}

it('accepts correlated current essentials in procedure output without requiring an optional guide read', () => {
  const { entries, target, marker } = observation(testingCoreBlock());
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).not.toThrow();
});

it.each([
  '',
  testingCoreBlock().slice(0, 100),
  testingCoreBlock().replace('State the test-scope', 'OLD scope'),
])(
  'rejects incomplete or old essential output despite current marker, revision, guide read and passing tests',
  output => {
    const { entries, target, marker } = observation(output, true);
    expect(() => {
      resourceLoad(entries, target, marker, true, testingCoreBlock());
    }).toThrow(/current essential/u);
  },
);

function startupObservation(core = testingCoreBlock()) {
  const fixture = observation(testingCoreBlock());
  const root = path.resolve(path.dirname(fixture.target), '../..');
  for (const template of TESTING_CORE_LAYOUT.templates) {
    const file = path.join(root, 'templates', template);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, testingCoreBlock());
  }
  const revision = finalizeWorkflowRevision(root);
  const entry = structuredClone(startupShape.entry);
  const previous = fixture.entries[0];
  const part = entry.payload.content[0];
  assert.ok(previous && part);
  part.text = `${messageText(previous)}\n${core}`.replace(
    /Resource revision: [a-f\d]{64}/u,
    () => `Resource revision: ${revision}`,
  );
  fixture.entries[0] = entry;
  fixture.entries.unshift({
    type: 'turn_context',
    payload: { turn_id: entry.payload.internal_chat_message_metadata_passthrough.turn_id },
  });
  return { ...fixture, entry, part };
}

it('requires actual current startup delivery through the restart caller without a B procedure or guide open', () => {
  const { unit, entries } = startupObservation();
  entries.splice(2); // No file tools; unit Node outcome remains a separate control.
  expect(() => {
    CodexWorkflowRuntimeActor.prototype.assertTesting.call(unit, true);
  }).not.toThrow();
});

it.each([
  'revision',
  'stale-core',
  'duplicate-core',
  'message-id',
  'duplicate-message',
  'duplicate-turn',
  'installed-core',
  'late-tool',
])('rejects %s through the actual startup observation boundary', fault => {
  const { entries, entry, turn, part, target } = startupObservation();
  switch (fault) {
    case 'revision': {
      part.text = part.text.replace(
        /Resource revision: [a-f\d]{64}/u,
        () => `Resource revision: ${'0'.repeat(64)}`,
      );
      break;
    }
    case 'stale-core': {
      part.text = part.text.replace('State the test-scope', 'OLD test-scope');
      break;
    }
    case 'duplicate-core': {
      part.text += testingCoreBlock();
      break;
    }
    case 'message-id': {
      entry.payload.id = '';
      break;
    }
    case 'duplicate-message': {
      entries.push(structuredClone(entry));
      break;
    }
    case 'duplicate-turn': {
      entries.push({ type: 'turn_context', payload: { turn_id: 'extra-turn' } });
      break;
    }
    case 'installed-core': {
      writeFileSync(
        path.resolve(path.dirname(target), '../../templates', TESTING_CORE_LAYOUT.templates[0]),
        'OLD core',
      );
      break;
    }
    case 'late-tool': {
      entries.splice(1, 1);
      entries.push(entry);

      break;
    }
    // No default
  }
  expect(() =>
    startupEssential(turn, path.resolve(path.dirname(target), '../..'), testingCoreBlock()),
  ).toThrow(/INTERNAL_WORKFLOW_UNMET|HOST_CONTRACT_PROOF_UNAVAILABLE/u);
});

it.each([false, true])(
  'preserves actual fresh/initial-A procedure loading with essentials=%s',
  withEssentials => {
    const { unit, entries } = startupObservation();
    Object.assign(unit, { sequence: 1 });
    expect(() => {
      CodexWorkflowRuntimeActor.prototype.assertTesting.call(unit, withEssentials);
    }).not.toThrow();
    entries.splice(2);
    expect(() => {
      CodexWorkflowRuntimeActor.prototype.assertTesting.call(unit, withEssentials);
    }).toThrow(/INTERNAL_WORKFLOW_UNMET/u);
  },
);

it.each([
  'history',
  'user',
  'assistant',
  'tool',
  'wrong-turn',
  'no-provenance',
  'partial',
  'marker-only',
  'late',
  'unknown',
  'no-tests',
])(
  'rejects %s rather than treating a marker, echo or old body as current startup delivery',
  fault => {
    const { unit, entries, entry, turn, part } = startupObservation();
    if (['user', 'assistant', 'tool'].includes(fault)) entry.payload.role = fault;
    switch (fault) {
      case 'history': {
        turn.allEntries = [...entries];
        entries.splice(1, 1);
        break;
      }
      case 'wrong-turn': {
        entry.payload.internal_chat_message_metadata_passthrough.turn_id = 'old-turn';
        break;
      }
      case 'no-provenance': {
        entry.payload.internal_chat_message_metadata_passthrough.content_item_kinds = [];
        break;
      }
      case 'partial': {
        part.text = part.text.replace(testingCoreBlock(), () => testingCoreBlock().slice(0, 100));
        break;
      }
      case 'marker-only': {
        part.text = part.text.replace(testingCoreBlock(), '<!-- SAFEWORD:TESTING_CORE_START -->');
        break;
      }
      case 'late': {
        entries.splice(1, 1);
        entries.push(entry);
        break;
      }
      case 'unknown': {
        part.type = 'encoded_text';
        break;
      }
      case 'no-tests': {
        turn.events = [];
        break;
      }
    }
    expect(() => {
      CodexWorkflowRuntimeActor.prototype.assertTesting.call(unit, true);
    }).toThrow(/INTERNAL_WORKFLOW_UNMET|HOST_CONTRACT_PROOF_UNAVAILABLE/u);
  },
);

function parallelObservation() {
  const fixture = observation(testingCoreBlock());
  const { entries, target } = fixture;
  const call = entries[1]?.payload;
  const output = entries[2]?.payload;
  assert.ok(call && output);
  call.call_id = output.call_id = parallelShape.call_id;
  call.input = parallelShape.input.replaceAll('/UNIT_INSTALLED_ROOT', () =>
    path.resolve(path.dirname(target), '../..'),
  );
  return { ...fixture, call, output };
}

it('recognizes the captured parallel literal read through the actual resourceLoad caller', () => {
  const { entries, target, marker } = parallelObservation();
  expect(resourceLoad(entries, target, marker, true, testingCoreBlock())).toMatchObject({
    method: 'correlated-tool-read',
    callIds: [parallelShape.call_id],
  });
});

it.each([
  { name: 'await-using producer', change: (s: string) => s.replace('const r', 'await using r') },
  {
    name: 'mixed valid and callback elements',
    change: (s: string) => s.replace(']);', ',()=>0]);'),
  },
  { name: 'unawaited batch', change: (s: string) => s.replace('await Promise.all', 'Promise.all') },
  { name: 'conditional producer', change: (s: string) => `if (false) { ${s} }` },
  {
    name: 'conditional awaited elements',
    change: (s: string) =>
      `if (false) { ${s.replace('tools.exec_command(', 'await tools.exec_command(')} }`,
  },
  { name: 'unused function', change: (s: string) => `async function unused() { ${s} }` },
  {
    name: 'callback element',
    change: (s: string) => s.replace('tools.exec_command(', '()=>tools.exec_command('),
  },
  { name: 'quoted fake program', change: (s: string) => JSON.stringify(s) },
  { name: 'commented fake program', change: (s: string) => `/* ${s} */` },
  { name: 'shadowed Promise', change: (s: string) => `const Promise = fake; ${s}` },
  { name: 'spread element', change: (s: string) => s.replace('[tools.', '[...tools.') },
  { name: 'malformed syntax', change: (s: string) => s.replace(']);', '];') },
  { name: 'wrong printer', change: (s: string) => s.replace('x.output', 'x.stderr') },
  { name: 'no emitter', change: (s: string) => s.slice(0, s.indexOf('\ntext')) },
  { name: 'conditional element', change: (s: string) => s.replace('[tools.', '[false && tools.') },
  {
    name: 'computed callee',
    change: (s: string) => s.replace('tools.exec_command', 'tools["exec_command"]'),
  },
  {
    name: 'dynamic argument',
    change: (s: string) => s.replace(/\{"cmd":.*?\}/u, '{"cmd": command}'),
  },
  {
    name: 'duplicate command',
    change: (s: string) => s.replace('"cmd":', '"cmd":"cat /wrong","cmd":'),
  },
  {
    name: 'optional call',
    change: (s: string) => s.replace('tools.exec_command(', 'tools.exec_command?.('),
  },
])('reports $name unavailable instead of crediting an unexecuted parallel read', ({ change }) => {
  const { entries, target, marker, call } = parallelObservation();
  const command = `cat ${target}`;
  const emitter = String.raw`text(r.map(x=>x.output).join("\n\n---\n\n"));`;
  call.input = change(
    `const r = await Promise.all([tools.exec_command(${JSON.stringify({ cmd: command })})]);\n${emitter}`,
  );
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  'wrong-root',
  'echo',
  'dynamic',
  'wrong-id',
  'duplicate-output',
  'missing-marker',
  'partial-core',
  'marker-input',
])('rejects parallel %s without weakening target, identity or content checks', fault => {
  const { entries, target, marker, call, output } = parallelObservation();
  assert.ok(call.input);
  switch (fault) {
    case 'wrong-root': {
      call.input = call.input.replaceAll(path.resolve(path.dirname(target), '../..'), '/wrong');
      break;
    }
    case 'echo': {
      call.input = call.input.replace("sed -n '1,240p'", 'printf');
      break;
    }
    case 'dynamic': {
      call.input = call.input.replace(target, () => `$(printf ${target})`);
      break;
    }
    case 'wrong-id': {
      output.call_id = 'different-call';
      break;
    }
    case 'duplicate-output': {
      entries.push({ type: 'response_item', payload: structuredClone(output) });
      break;
    }
    case 'missing-marker': {
      output.output = testingCoreBlock();
      break;
    }
    case 'partial-core': {
      output.output = marker + testingCoreBlock().slice(0, 100);
      break;
    }
    case 'marker-input': {
      call.input += marker;
      break;
    }
  }
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    /HOST_CONTRACT_PROOF_UNAVAILABLE|INTERNAL_WORKFLOW_UNMET/u,
  );
});

it.each(['function', 'custom'])(
  'retains direct %s reads mentioning Promise.all only as shell data',
  kind => {
    const { entries, target, marker, call, output } = parallelObservation();
    const argument = JSON.stringify({ cmd: `cat ${target} && printf 'Promise.all'` });
    if (kind === 'function') {
      call.type = 'function_call';
      call.arguments = argument;
      output.type = 'function_call_output';
    } else call.input = `await tools.exec_command(${argument})`;
    expect(resourceLoad(entries, target, marker, true, testingCoreBlock()).callIds).toEqual([
      parallelShape.call_id,
    ]);
  },
);

function warningObservation() {
  const fixture = observation(testingCoreBlock());
  const { entries, target } = fixture;
  const call = entries[1]?.payload;
  const output = entries[2]?.payload;
  assert.ok(call && output);
  call.call_id = output.call_id = truncatedShape.call_id;
  const parts = truncatedShape.output.map(part => ({
    ...part,
    text: part.text.replace('UNIT_BODY_PLACEHOLDER', () =>
      JSON.stringify(readFileSync(target, 'utf8')).slice(1, -1),
    ),
  }));
  output.output = parts;
  const part = parts[1];
  assert.ok(part);
  return { ...fixture, call, output, part };
}

it('recognizes current essential content inside the captured warning-prefixed exec envelope', () => {
  const { entries, target, marker } = warningObservation();
  expect(resourceLoad(entries, target, marker, true, testingCoreBlock())).toMatchObject({
    method: 'correlated-tool-read',
    callIds: [truncatedShape.call_id],
  });
});

it.each([
  'partial-notice',
  'line-count',
  'unknown-prefix',
  'repeated-notice',
  'broken-json',
  'bad-schema',
  'plain-body',
  'prose-json',
])('rejects %s without repairing or crediting warning-prefixed output', fault => {
  const { entries, target, marker, part } = warningObservation();
  const split = part.text.indexOf('\n\n') + 2;
  const prefix = part.text.slice(0, split);
  const envelope = JSON.parse(part.text.slice(split)) as { output: unknown };
  switch (fault) {
    case 'partial-notice': {
      part.text = part.text.replace('Total output lines: 1\n\n', '');
      break;
    }
    case 'line-count': {
      part.text = part.text.replace('Total output lines: 1', 'Total output lines: 2');
      break;
    }
    case 'unknown-prefix': {
      part.text = `Other transport notice\n${part.text}`;
      break;
    }
    case 'repeated-notice': {
      part.text = prefix + part.text;
      break;
    }
    case 'broken-json': {
      part.text = part.text.slice(0, -2);
      break;
    }
    case 'bad-schema': {
      envelope.output = 42;
      part.text = prefix + JSON.stringify(envelope);
      break;
    }
    case 'plain-body': {
      part.text = prefix + String(envelope.output);
      break;
    }
    case 'prose-json': {
      part.text = `The command printed this JSON:\n${part.text}`;
      break;
    }
  }
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    /HOST_CONTRACT_PROOF_UNAVAILABLE|INTERNAL_WORKFLOW_UNMET/u,
  );
});

it.each([
  'nested-envelope',
  'partial-core',
  'wrong-id',
  'wrong-target',
  'echo',
  'marker-input',
  'ambiguous-output',
])('rejects %s despite a valid transport notice', fault => {
  const { entries, target, marker, call, output, part } = warningObservation();
  const split = part.text.indexOf('\n\n') + 2;
  const prefix = part.text.slice(0, split);
  const envelope = JSON.parse(part.text.slice(split)) as { output: unknown };
  switch (fault) {
    case 'nested-envelope': {
      envelope.output = JSON.stringify(envelope);
      part.text = prefix + JSON.stringify(envelope);
      break;
    }
    case 'partial-core': {
      envelope.output = marker + testingCoreBlock().slice(0, 100);
      part.text = prefix + JSON.stringify(envelope);
      break;
    }
    case 'wrong-id': {
      output.call_id = 'other-call';
      break;
    }
    case 'wrong-target': {
      call.input = call.input?.replace(target, () => `${target}.old`);
      break;
    }
    case 'echo': {
      const command = `printf '%s' 'cat ${target}'`;
      call.input = `await tools.exec_command(${JSON.stringify({ cmd: command })})`;
      break;
    }
    case 'marker-input': {
      assert.ok(call.input);
      call.input += marker;
      break;
    }
    case 'ambiguous-output': {
      entries.push({ type: 'response_item', payload: structuredClone(output) });
      break;
    }
  }
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    /HOST_CONTRACT_PROOF_UNAVAILABLE|INTERNAL_WORKFLOW_UNMET/u,
  );
});

it('decodes the captured native output envelope once through the real resourceLoad caller', () => {
  const { entries, target, marker } = observation(testingCoreBlock());
  const output = entries[2]?.payload;
  if (!output) throw new Error('Missing unit transport');
  output.output = encoded.output.map(part => ({
    ...part,
    text: part.text.replace('UNIT_BODY_PLACEHOLDER', () =>
      JSON.stringify(readFileSync(target, 'utf8')).slice(1, -1),
    ),
  }));
  expect(resourceLoad(entries, target, marker, true, testingCoreBlock())).toMatchObject({
    method: 'correlated-tool-read',
    callIds: ['current-body'],
  });
  output.output = [{ type: 'input_text', text: '{"chunk_id":"unit","output":42}' }];
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
  output.output = JSON.stringify({
    exit_code: 0,
    output: marker + testingCoreBlock(),
    chunk_id: 'unit',
  });
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
  output.output = `Script completed\nOutput:\n${JSON.stringify({ chunk_id: 'unit', exit_code: 0, output: marker + testingCoreBlock() })}`;
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
  output.output = JSON.stringify(
    JSON.stringify({ chunk_id: 'unit', exit_code: 0, output: marker + testingCoreBlock() }),
  );
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('changes the actual canonical owner A to B before normal generation and retains complete current blocks', () => {
  const source = createContractRepoFixture();
  roots.push(path.dirname(source));
  const original = readFileSync(essentialOwner(source), 'utf8');
  const packageRoot = path.join(source, 'packages/cli/codex-plugin');
  const revisions: string[] = [];
  const blocks: string[] = [];
  for (const marker of ['ESSENTIAL_UNIT_A', 'ESSENTIAL_UNIT_B']) {
    const block = markEssentialCore(source, original, marker);
    blocks.push(block);
    const generated = runWorkflowGenerator(
      source,
      path.join(source, 'owned-unused-profile'),
      false,
    );
    expect(generated.status, generated.output).toBe(0);
    expect(readFileSync(path.join(packageRoot, 'internal/testing/SKILL.md'), 'utf8')).toContain(
      block,
    );
    expect(
      readFileSync(path.join(packageRoot, 'templates/guides/testing-guide.md'), 'utf8'),
    ).toContain(block);
    const index = JSON.parse(
      readFileSync(path.join(packageRoot, 'resources/workflow-index.json'), 'utf8'),
    );
    revisions.push(index.resourceRevision.sha256);
  }
  expect(blocks[0]).not.toBe(blocks[1]);
  expect(blocks[0]).not.toContain('ESSENTIAL_UNIT_B');
  expect(revisions[0]).not.toBe(revisions[1]);
  expect(runWorkflowGenerator(source, path.join(source, 'owned-unused-profile'), true).status).toBe(
    0,
  );
}, 90_000);

it.each(['wrong-path', 'wrong-id', 'other-call-core', 'marker-input', 'quoted-fake-read'])(
  'rejects %s even with a complete current block elsewhere',
  fault => {
    const { entries, target, marker } = observation(testingCoreBlock());
    const call = entries[1]?.payload;
    const output = entries[2]?.payload;
    if (!call || !output) throw new Error('Missing unit transport');
    switch (fault) {
      case 'wrong-id': {
        output.call_id = 'wrong';
        break;
      }
      case 'other-call-core': {
        output.output = marker;
        entries.push({
          type: 'response_item',
          payload: {
            type: 'custom_tool_call_output',
            call_id: 'unrelated',
            output: testingCoreBlock(),
          },
        });

        break;
      }
      case 'wrong-path': {
        call.input = JSON.stringify({ cmd: 'cat /wrong' });
        break;
      }
      case 'marker-input': {
        call.input = JSON.stringify({ cmd: `cat ${target} # ${marker}` });
        break;
      }
      case 'quoted-fake-read': {
        {
          call.input = JSON.stringify({ cmd: `printf 'cat ${target}'` });
          // No default
        }
        break;
      }
    }
    expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow();
  },
);

it('accepts a legitimate current native Skill body and rejects assistant prose or a stale prefix', () => {
  const { target, marker } = observation(testingCoreBlock());
  const body = readFileSync(target, 'utf8');
  const entries: Rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ text: `<skill><path>${target}</path>${body}</skill>` }],
      },
    },
  ];
  expect(resourceLoad(entries, target, marker, true, testingCoreBlock()).method).toBe(
    'native-skill-context',
  );
  const payload = entries[0]?.payload;
  if (!payload) throw new Error('Missing unit Skill');
  payload.role = 'assistant';
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow();
  payload.role = 'user';
  payload.content = [
    { text: `<skill><path>${target}</path><!-- ${marker} -->\n# Testing</skill>` },
  ];
  expect(() => resourceLoad(entries, target, marker, true, testingCoreBlock())).toThrow();
});

it.each([true, false])(
  'real Node control distinguishes module assertions from always-pass tests (%s) and restores bytes',
  discriminating => {
    const root = mkdtempSync(path.join(tmpdir(), 'safeword-node-discrimination-'));
    roots.push(root);
    writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    const module = path.join(root, 'clamp.js');
    const original =
      'export function clamp(v,min,max){if(min>max)throw new RangeError("range");return Math.min(max,Math.max(min,v));}\n';
    writeFileSync(module, original);
    const checks = discriminating
      ? 'assert.equal(clamp(-2,0,1),0);assert.equal(clamp(2,0,1),1);assert.equal(clamp(0.5,0,1),0.5);assert.throws(()=>clamp(0,2,1),RangeError);'
      : 'assert.equal(1,1);';
    CodexWorkflowRuntimeActor.prototype.seedReviewTests.call({
      project: root,
    } as unknown as CodexWorkflowRuntimeActor);
    const seed = readFileSync(path.join(root, 'clamp.test.js'), 'utf8');
    const artifacts = mkdtempSync(path.join(tmpdir(), 'safeword-node-artifacts-'));
    roots.push(artifacts);
    const baseline = captureNodeBaseline(root, artifacts);
    writeFileSync(path.join(root, 'clamp.test.js'), `${seed}test('boundary',()=>{${checks}});`);
    if (discriminating)
      expect(() => {
        discriminateNodeTests(root, artifacts, baseline);
      }).not.toThrow();
    else
      expect(() => {
        discriminateNodeTests(root, artifacts, baseline);
      }).toThrow('did not detect');
    expect(readFileSync(module, 'utf8')).toBe(original);
    const saved = JSON.parse(
      readFileSync(path.join(artifacts, 'node-discrimination.json'), 'utf8'),
    );
    expect(saved).toMatchObject({
      correct: { status: 0 },
      restored: { status: 0 },
      restoredBytes: true,
      lower: { status: discriminating ? 1 : 0 },
    });
  },
);

it.each(['seed-only', 'failing-correct-suite'])(
  'does not certify %s or mask its original classification',
  mode => {
    const root = mkdtempSync(path.join(tmpdir(), 'safeword-node-control-limit-'));
    roots.push(root);
    writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    const module = path.join(root, 'clamp.js');
    const original = 'export function clamp(v,min,max){return Math.min(max,Math.max(min,v));}\n';
    writeFileSync(module, original);
    CodexWorkflowRuntimeActor.prototype.seedReviewTests.call({
      project: root,
    } as unknown as CodexWorkflowRuntimeActor);
    const file = path.join(root, 'clamp.test.js');
    const artifacts = mkdtempSync(path.join(tmpdir(), 'safeword-node-limit-artifacts-'));
    roots.push(artifacts);
    const baseline = captureNodeBaseline(root, artifacts);
    if (mode === 'failing-correct-suite')
      writeFileSync(
        file,
        `${readFileSync(file, 'utf8')}test('valid',()=>assert.equal(clamp(2,0,1),1));test('invalid',()=>assert.equal(clamp(2,0,1),999));`,
      );
    expect(() => {
      discriminateNodeTests(root, artifacts, baseline);
    }).toThrow(
      mode === 'seed-only' ? 'HOST_CONTRACT_PROOF_UNAVAILABLE' : 'INTERNAL_WORKFLOW_UNMET',
    );
    expect(readFileSync(module, 'utf8')).toBe(original);
  },
);
