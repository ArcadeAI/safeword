import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { testingCoreBlock } from '../../src/testing/shared-core.js';
import {
  captureNodeBaseline,
  discriminateNodeTests,
  RESTART_SEED_TEST_NAME,
} from '../helpers/codex-workflow-essential.js';
import {
  type NativeTurn,
  resourceLoad,
  type Rollout,
} from '../helpers/codex-workflow-observation.js';

// Counterexample controls, not native receipts or model judgments.
const roots: string[] = [];
const temporary = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-proof-quality-'));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function procedure() {
  const target = path.join(temporary(), 'SKILL.md');
  const marker = 'UNIT_CURRENT_PROCEDURE';
  const body = `<!-- ${marker} -->\n# Testing\n${testingCoreBlock()}\nRequired procedure after the core.\n`;
  writeFileSync(target, body);
  const entries = (input: string, output: string): Rollout => [
    { type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'read', input } },
    {
      type: 'response_item',
      payload: { type: 'custom_tool_call_output', call_id: 'read', output },
    },
  ];
  const argument = JSON.stringify({ cmd: `cat ${target}` });
  const call = `await tools.exec_command(${argument})`;
  return { target, marker, body, entries, call };
}

it.each(['marker-only', 'core-only', 'truncated', 'stale'])(
  'does not claim a complete procedure from %s output',
  fault => {
    const { target, marker, body, entries, call } = procedure();
    const output = {
      'marker-only': `<!-- ${marker} -->`,
      'core-only': `<!-- ${marker} -->\n${testingCoreBlock()}`,
      truncated: body.slice(0, -20),
      stale: body.replace('Required procedure', 'OLD procedure'),
    }[fault];
    const input = fault === 'marker-only' ? call.replace('cat ', 'sed -n 1p ') : call;
    expect(() => resourceLoad(entries(input, output ?? ''), target, marker)).toThrow(
      'INTERNAL_WORKFLOW_UNMET',
    );
  },
);

it.each([false, true])(
  'credits the complete current procedure in combined output (%s)',
  combined => {
    const { target, marker, body, entries, call } = procedure();
    expect(
      resourceLoad(
        entries(call, combined ? `Other output\n${body}\nMore output` : body),
        target,
        marker,
      ),
    ).toMatchObject({ method: 'correlated-tool-read', callIds: ['read'] });
  },
);

it.each([
  ['batch', 'item', 'Promise.all', String.raw`"\n\n---\n\n"`],
  ['results', 'value', 'Promise . all', String.raw`'\n\n---\n\n'`],
])('accepts a structurally bound %s producer and %s emitter', (binding, parameter, all, join) => {
  const { target, marker, body, entries } = procedure();
  const argument = JSON.stringify({ cmd: `cat ${target}` });
  const input = `const ${binding} = await ${all}([tools.exec_command(${argument})]);
text( ${binding} . map( (${parameter}) => ${parameter}.output ).join( ${join} ) );`;
  expect(resourceLoad(entries(input, body), target, marker).callIds).toEqual(['read']);
});

it.each([
  String.raw`text(other.map(x=>x.output).join("\n\n---\n\n"));`,
  String.raw`text(r.map(x=>other.output).join("\n\n---\n\n"));`,
  String.raw`text(r.map(async x=>x.output).join("\n\n---\n\n"));`,
  String.raw`text(r.map(x=>(effect(),x.output)).join("\n\n---\n\n"));`,
  String.raw`text(r.map(x=>x.stderr).join("\n\n---\n\n"));`,
])('rejects unbound or effectful emission: %s', emitter => {
  const { target, marker, body, entries } = procedure();
  const argument = JSON.stringify({ cmd: `cat ${target}` });
  const input = `const r = await Promise.all([tools.exec_command(${argument})]);${emitter}`;
  expect(() => resourceLoad(entries(input, body), target, marker)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['Promise', 'tools', 'text'])('rejects a producer that shadows %s', binding => {
  const { target, marker, body, entries } = procedure();
  const argument = JSON.stringify({ cmd: `cat ${target}` });
  const input = String.raw`const ${binding} = await Promise.all([tools.exec_command(${argument})]);text(${binding}.map(x=>x.output).join("\n\n---\n\n"));`;
  expect(() => resourceLoad(entries(input, body), target, marker)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

// Retained Fj7fI6 join shape; host transcript only is synthetic NONRECEIPT.
// Real generated procedure + SDK caller proves separators cannot supply read authority.
function parallelProcedure(separator: string) {
  const target = path.join(temporary(), 'SKILL.md');
  copyFileSync(
    path.join(import.meta.dirname, '../../codex-plugin/internal/testing/SKILL.md'),
    target,
  );
  const body = readFileSync(target, 'utf8');
  const marker = 'SAFEWORD:TESTING_CORE_START';
  const command = `cat ${target}`;
  const call = {
    type: 'custom_tool_call',
    call_id: 'parallel-read',
    input: `const r = await Promise.all([tools.exec_command(${JSON.stringify({ cmd: 'node --version' })}), tools.exec_command(${JSON.stringify({ cmd: command })})]); text(r.map(x=>x.output).join(${separator}));`,
  };
  const response = {
    type: 'custom_tool_call_output',
    call_id: call.call_id,
    output: `v22.0.0\n---RESULT---\n${body}`,
  };
  const item = {
    type: 'command_execution',
    command: `/bin/zsh -lc '${command}'`,
    exit_code: 0,
    aggregated_output: body,
  };
  const turn: Pick<NativeTurn, 'entries' | 'events'> = {
    entries: [
      { type: 'response_item', payload: call },
      { type: 'response_item', payload: response },
    ],
    events: [{ type: 'item.completed', item }],
  };
  return { target, marker, body, call, response, item, turn };
}

// Retained XeYQgF direct wrapper; transcript is synthetic NONRECEIPT.
// Current generated bytes are real; only the native process boundary is faked.
function wrapperProcedure(finalNewlines = '\n') {
  const target = path.join(temporary(), 'SKILL.md');
  copyFileSync(
    path.join(import.meta.dirname, '../../codex-plugin/internal/testing/SKILL.md'),
    target,
  );
  const body = readFileSync(target, 'utf8');
  const command = `cat "${target}" && cat testing-guide.md && node --test clamp.test.js`;
  const head = `${body}\nUnrelated guide start\n`,
    tail = `\nTests passed${finalNewlines}`;
  const stdout = `${head}Unrelated guide middle\n${tail}`;
  const call = {
    type: 'custom_tool_call',
    call_id: 'wrapper-read',
    input: `const r = await tools.exec_command(${JSON.stringify({ cmd: command, workdir: path.dirname(target) })}); text(r.output); text("EXIT_CODE=" + r.exit_code);`,
  };
  const display = {
    type: 'input_text',
    text: `Warning: truncated output (original token count: 10001)\nTotal output lines: 1032\n\n${head}…177 tokens truncated…${tail}\nEXIT_CODE=0`,
  };
  const response = {
    type: 'custom_tool_call_output',
    call_id: call.call_id,
    output: [{ type: 'input_text', text: 'Script completed\nOutput:\n' }, display],
  };
  const item = {
    type: 'command_execution',
    command: `/bin/zsh -lc '${command}'`,
    exit_code: 0,
    aggregated_output: stdout,
  };
  const turn: Pick<NativeTurn, 'entries' | 'events'> = {
    entries: [
      { type: 'response_item', payload: call },
      { type: 'response_item', payload: response },
    ],
    events: [{ type: 'item.completed', item }],
  };
  return {
    target,
    marker: 'SAFEWORD:TESTING_CORE_START',
    body,
    command,
    head,
    tail,
    call,
    response,
    display,
    item,
    turn,
  };
}

it.each(['', '\n', '\n\n'])(
  'preserves stdout trailing newlines %j plus one observed print separator',
  newlines => {
    const c = wrapperProcedure(newlines);
    const original = JSON.stringify(c.turn);
    expect(resourceLoad(c.turn, c.target, c.marker)).toMatchObject({
      completeBody: true,
      callIds: ['wrapper-read'],
    });
    expect(JSON.stringify(c.turn)).toBe(original);
  },
);

it('accepts only structural binding/quote/whitespace variation of the direct wrapper', () => {
  const c = wrapperProcedure();
  c.call.input = c.call.input
    .replace('const r =', 'const result =')
    .replace('r.output', 'result . output')
    .replace('"EXIT_CODE=" + r.exit_code', "'EXIT_CODE=' + result . exit_code");
  expect(resourceLoad(c.turn, c.target, c.marker).callIds).toEqual(['wrapper-read']);
});

it.each(['function', 'custom'])(
  'isolates an earlier different %s command carrying the same body',
  kind => {
    const c = wrapperProcedure();
    const argument = JSON.stringify({ cmd: `cat "${c.target}"` });
    c.turn.entries.unshift(
      {
        type: 'response_item',
        payload:
          kind === 'function'
            ? { type: 'function_call', call_id: 'earlier', arguments: argument }
            : {
                type: 'custom_tool_call',
                call_id: 'earlier',
                input: `const other = await tools.exec_command(${argument}); text(other.output); text("other metadata"); effect();`,
              },
      },
      {
        type: 'response_item',
        payload: {
          type: kind === 'function' ? 'function_call_output' : 'custom_tool_call_output',
          call_id: 'earlier',
          output: c.body,
        },
      },
    );
    expect(resourceLoad(c.turn, c.target, c.marker).callIds).toEqual(['wrapper-read']);
  },
);

it.each([
  'text("EXIT_CODE=" + other.exit_code);',
  'text("EXIT_CODE=" + r.output);',
  'text("EXIT_CODE=" + 0);',
  'text(prefix + r.exit_code);',
  'text(`EXIT_CODE=${r.exit_code}`);',
  'if (false) text("EXIT_CODE=" + r.exit_code);',
  'r.exit_code=0; text("EXIT_CODE=" + r.exit_code);',
  'text("EXIT_CODE=" + r.exit_code); effect();',
  'text("EXIT_CODE=", r.exit_code);',
])('rejects unsupported relevant wrapper emission: %s', emitter => {
  const c = wrapperProcedure();
  c.call.input = c.call.input.replace('text("EXIT_CODE=" + r.exit_code);', () => emitter);
  expect(() => resourceLoad(c.turn, c.target, c.marker)).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

it.each([
  ['foreign output', (s: string) => s.replace('text(r.output)', 'text(other.output)')],
  ['shadow', (s: string) => s.replaceAll(/\br\b/gu, 'text')],
  ['unexecuted call', (s: string) => s.replace('await tools.', 'false && await tools.')],
])('rejects %s direct producer with matching raw/SDK body', (_label, change) => {
  const c = wrapperProcedure();
  c.call.input = change(c.call.input);
  expect(() => resourceLoad(c.turn, c.target, c.marker)).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

type WrapperControl = ReturnType<typeof wrapperProcedure>;
it.each([
  [
    'wrong trailer',
    (c: WrapperControl) => {
      c.display.text = c.display.text.replace('EXIT_CODE=0', 'EXIT_CODE=1');
    },
  ],
  [
    'partial raw',
    (c: WrapperControl) => {
      c.display.text = c.display.text.replace(c.body, () => c.body.slice(0, -30));
    },
  ],
  [
    'partial SDK',
    (c: WrapperControl) => {
      c.item.aggregated_output = c.item.aggregated_output.replace(c.body, () =>
        c.body.slice(0, -30),
      );
    },
  ],
  [
    'failed SDK',
    (c: WrapperControl) => {
      c.item.exit_code = 1;
    },
  ],
  [
    'missing SDK exit',
    (c: WrapperControl) => {
      delete (c.item as Partial<typeof c.item>).exit_code;
    },
  ],
  [
    'wrong head',
    (c: WrapperControl) => {
      c.item.aggregated_output = `foreign\n${c.item.aggregated_output}`;
    },
  ],
  [
    'wrong tail',
    (c: WrapperControl) => {
      c.item.aggregated_output += 'foreign';
    },
  ],
  [
    'no omitted middle',
    (c: WrapperControl) => {
      c.item.aggregated_output = c.head + c.tail;
    },
  ],
  [
    'clipped SDK',
    (c: WrapperControl) => {
      c.item.aggregated_output = `${c.head}…177 tokens truncated…${c.tail}`;
    },
  ],
  [
    'wrong call',
    (c: WrapperControl) => {
      c.response.call_id = 'foreign';
    },
  ],
  [
    'duplicate output',
    (c: WrapperControl) => {
      c.turn.entries.push({ type: 'response_item', payload: { ...c.response } });
    },
  ],
] as const)('wrapper rendering cannot replace %s evidence', (_label, poison) => {
  const c = wrapperProcedure();
  poison(c);
  expect(() => resourceLoad(c.turn, c.target, c.marker)).toThrow();
});

it.each([String.raw`"\n---RESULT---\n"`, "'other separator'", '""', '`static template`'])(
  'credits complete current generated procedure with static separator %s',
  separator => {
    const c = parallelProcedure(separator);
    expect(resourceLoad(c.turn, c.target, c.marker)).toMatchObject({
      completeBody: true,
      callIds: ['parallel-read'],
    });
  },
);

it.each(['separator', 'effect()', '"a" + "b"', '`dynamic ${value}`', '"a", "b"', ''])(
  'rejects nonliteral or non-single join argument %s',
  separator => {
    const c = parallelProcedure(separator);
    expect(() => resourceLoad(c.turn, c.target, c.marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each(['partial raw', 'partial SDK', 'failed SDK', 'wrong path', 'wrong call'])(
  'literal separator cannot replace %s evidence',
  fault => {
    const c = parallelProcedure(String.raw`"\n---RESULT---\n"`);
    switch (fault) {
      case 'partial raw': {
        c.response.output = c.body.slice(0, -40);
        break;
      }
      case 'partial SDK': {
        c.item.aggregated_output = c.body.slice(0, -40);
        break;
      }
      case 'failed SDK': {
        c.item.exit_code = 1;
        break;
      }
      case 'wrong path': {
        c.call.input = c.call.input.replace(c.target, '/foreign/SKILL.md');
        break;
      }
      case 'wrong call': {
        c.response.call_id = 'foreign-call';
        break;
      }
    }
    expect(() => resourceLoad(c.turn, c.target, c.marker)).toThrow();
  },
);

it.each(['heading-only', 'partial-paragraph', 'complete-paragraph'])(
  'labels bounded public Skill delivery honestly: %s',
  mode => {
    const { target, marker } = procedure();
    const header = `<!-- ${marker} -->\n# Public\n\n`;
    const paragraph = 'Run the required public procedure.';
    writeFileSync(target, `${header}${paragraph}\n\nMore canonical instructions.\n`);
    const prefixes = {
      'heading-only': '',
      'partial-paragraph': paragraph.slice(0, 10),
      'complete-paragraph': paragraph,
    };
    const prefix = header + prefixes[mode as keyof typeof prefixes];
    const entries: Rollout = [
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ text: `<skill><path>${target}</path>${prefix}</skill>` }],
        },
      },
    ];
    if (mode === 'complete-paragraph')
      expect(resourceLoad(entries, target, marker, true)).toMatchObject({
        method: 'native-skill-context',
        completeBody: false,
      });
    else
      expect(() => resourceLoad(entries, target, marker, true)).toThrow('INTERNAL_WORKFLOW_UNMET');
  },
);

const correct =
  'export function clamp(v,min,max){if(min>max)throw new RangeError("min exceeds max");return Math.min(max,Math.max(min,v));}\n';
const assertions = [
  'assert.equal(clamp(-7,-2,8),-2)',
  'assert.equal(clamp(12,-2,8),8)',
  'assert.equal(clamp(3,-2,8),3)',
  'assert.throws(()=>clamp(3,8,-2),RangeError)',
];

it.each([false, true])('whole suite gains coverage with same test identity=%s', sameIdentity => {
  const project = realpathSync(temporary());
  const artifacts = realpathSync(temporary());
  writeFileSync(path.join(project, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(project, 'clamp.js'), correct);
  const imports =
    'import {test} from "node:test"; import assert from "node:assert/strict"; import {clamp} from "./clamp.js";\n';
  const seed = `test(${JSON.stringify(RESTART_SEED_TEST_NAME)},()=>{${assertions[1]};});\n`;
  writeFileSync(path.join(project, 'clamp.test.js'), imports + seed);
  // Actual pre-turn file bytes, never derived from the final tests or name filtering.
  const baseline = captureNodeBaseline(project, artifacts);
  const additions = [assertions[0], assertions[2], assertions[3]].join(';');
  writeFileSync(
    path.join(project, 'clamp.test.js'),
    imports +
      (sameIdentity
        ? `test(${JSON.stringify(RESTART_SEED_TEST_NAME)},()=>{${assertions[1]};${additions};});\n`
        : `${seed}test('fill gaps',()=>{${additions};});\n`),
  );
  expect(() => {
    discriminateNodeTests(project, artifacts, baseline);
  }).not.toThrow();
  expect(readFileSync(path.join(project, 'clamp.js'), 'utf8')).toBe(correct);
});

it.each([
  'absent',
  'malformed',
  'foreign',
  'corrupt',
  'changed-module',
  'changed-package',
  'already-complete',
  'failing-baseline',
  'unchanged',
  'no-executed-tests',
  'tautology',
  'wrong-module',
])('rejects %s coverage attribution and preserves the actual module', mode => {
  const project = temporary();
  const artifacts = temporary();
  const file = path.join(project, 'clamp.test.js');
  writeFileSync(path.join(project, 'clamp.js'), correct);
  writeFileSync(path.join(project, 'package.json'), '{"type":"module"}');
  const imports =
    'import {test} from "node:test";import assert from "node:assert/strict";import {clamp} from "./clamp.js";';
  const seed = `test(${JSON.stringify(RESTART_SEED_TEST_NAME)},()=>{${assertions[1]};});`;
  const complete = `test('all partitions',()=>{${assertions.join(';')};});`;
  const initialByMode: Record<string, string> = {
    'already-complete': complete,
    'failing-baseline': "test('bad baseline',()=>assert.equal(1,2));",
  };
  const original = imports + (initialByMode[mode] ?? seed);
  writeFileSync(file, original);
  let baseline: ReturnType<typeof captureNodeBaseline> | undefined = captureNodeBaseline(
    project,
    artifacts,
  );
  expect(() => captureNodeBaseline(project, artifacts)).toThrow();
  writeFileSync(file, imports + seed + complete);
  const captured = baseline;
  const captureFaults: Record<string, () => void> = {
    absent: () => {
      baseline = undefined;
    },
    malformed: () => {
      captured.hashes = {};
    },
    foreign: () => {
      captured.project = realpathSync(temporary());
    },
    corrupt: () => {
      writeFileSync(path.join(captured.directory, 'clamp.test.js'), 'corrupt');
    },
    'changed-module': () => {
      writeFileSync(path.join(project, 'clamp.js'), `${correct}// changed`);
    },
    'changed-package': () => {
      writeFileSync(path.join(project, 'package.json'), '{"type":"module","name":"changed"}');
    },
  };
  captureFaults[mode]?.();
  switch (mode) {
    case 'already-complete': {
      writeFileSync(file, `${original}test('extra',()=>assert.ok(true));`);
      break;
    }
    case 'unchanged': {
      writeFileSync(file, original);
      break;
    }
    case 'no-executed-tests': {
      writeFileSync(file, `${imports}test.skip('not executed',()=>assert.ok(true));`);
      break;
    }
    case 'tautology': {
      writeFileSync(file, `${original}test('extra',()=>assert.ok(true));`);
      break;
    }
    case 'wrong-module': {
      writeFileSync(path.join(project, 'other.js'), correct);
      writeFileSync(file, (imports + complete).replace('./clamp.js', './other.js'));
      break;
    }
  }
  const moduleBefore = readFileSync(path.join(project, 'clamp.js'), 'utf8');
  expect(() => {
    discriminateNodeTests(project, artifacts, baseline);
  }).toThrow(
    ['tautology', 'wrong-module'].includes(mode)
      ? 'INTERNAL_WORKFLOW_UNMET'
      : 'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
  expect(readFileSync(path.join(project, 'clamp.js'), 'utf8')).toBe(moduleBefore);
});

it.each([-1, 0, 1, 2, 3, 4, 5])(
  'real Node controls discriminate semantic omission %s and restore bytes',
  omitted => {
    const root = temporary();
    const module = path.join(root, 'clamp.js');
    writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(module, correct);
    const artifacts = temporary();
    writeFileSync(
      path.join(root, 'clamp.test.js'),
      "import {test} from 'node:test';import assert from 'node:assert/strict';import {clamp} from './clamp.js';test('baseline',()=>assert.equal(clamp(12,-2,8),8));",
    );
    const baseline = captureNodeBaseline(root, artifacts);
    const counterexamples: Record<number, string[]> = {
      4: ['assert.equal(typeof clamp(3,-2,8),"number")'],
      5: ['assert.throws(()=>clamp(3,8,-2),{name:"RangeError",message:"min exceeds max"})'],
    };
    const cases = counterexamples[omitted] ?? assertions.filter((_, index) => index !== omitted);
    const tests = cases
      .map((code, index) => `test('independent ${index}',()=>{${code};});`)
      .join('\n');
    writeFileSync(
      path.join(root, 'clamp.test.js'),
      `import {test} from "node:test";import assert from "node:assert/strict";import { clamp } from "./clamp.js";\n${tests}`,
    );
    if (omitted === -1)
      expect(() => {
        discriminateNodeTests(root, artifacts, baseline);
      }).not.toThrow();
    else
      expect(() => {
        discriminateNodeTests(root, artifacts, baseline);
      }).toThrow('did not detect');
    expect(readFileSync(module, 'utf8')).toBe(correct);
    const receipt = JSON.parse(
      readFileSync(path.join(artifacts, 'node-discrimination.json'), 'utf8'),
    );
    expect(receipt).toMatchObject({
      correct: { status: 0 },
      restored: { status: 0 },
      restoredBytes: true,
    });
    if (omitted === 4) {
      writeFileSync(module, 'export function clamp(){return 42;}');
      const control = spawnSync(
        path.resolve(import.meta.dirname, '../../../../scripts/dev'),
        [
          'node',
          path.resolve(import.meta.dirname, '../fixtures/host-contract/codex-node-control.mjs'),
          '(?!)',
        ],
        { cwd: root, encoding: 'utf8' },
      );
      expect(control.status, control.stderr).toBe(0);
      expect(JSON.parse(control.stdout)).toMatchObject({ success: true, passed: 1, failed: 0 });
      writeFileSync(module, correct);
    }
  },
);
