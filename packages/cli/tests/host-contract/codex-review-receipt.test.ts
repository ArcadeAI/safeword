import { createHash } from 'node:crypto';

import { expect, it } from 'vitest';

import { createResult, renderJsonResult } from '../../src/cli-protocol/result.js';
import callback from '../fixtures/host-contract/codex-agent-message.json' with { type: 'json' };
import boundShapes from '../fixtures/host-contract/codex-bound-command-shapes.json';
import commandShapes from '../fixtures/host-contract/codex-review-command-shapes.json';
import { directExecWorkdir } from '../helpers/codex-parallel-read.js';
import {
  correlatedReview,
  correlatedToolCommands,
  preparationLanguageNames,
} from '../helpers/codex-review-receipt.js';
import type { NativeTurn } from '../helpers/codex-workflow-observation.js';

// Synthetic protocol controls, NOT authenticated coordinator receipts or native evidence.
const runtime = '/owned/installed/runtime/cli.js';
const id = '11111111-1111-4111-a111-111111111111';
function control(approved = false) {
  const data = {
    command: 'review run',
    review_id: id,
    review_kind: 'quality-review',
    review_targets: ['clamp.js', 'clamp.test.js'],
    status: approved ? 'approved' : 'changes_requested',
    actual_reviewer: 'claude',
    reviewer_model: 'opus',
    reviewer_output: {
      schema_version: 1,
      dispatch_id: 'dispatch',
      reviewer_agent: 'claude',
      verdict: approved ? 'approve' : 'request_changes',
      summary: 'control',
      findings: [],
    },
  };
  const status = createResult({ state: approved ? 'healthy' : 'action_required', data });
  const shell = `SAFEWORD_PLUGIN_RUNTIME=${runtime};\nSAFEWORD_REVIEW_PROGRESS=1 bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review --context package.json --json -- clamp.js clamp.test.js`;
  const output = `Requesting an independent Claude review…\n${JSON.stringify(status)}`;
  const call = {
    type: 'custom_tool_call',
    call_id: 'call-control',
    input: `const r = await tools.exec_command(${JSON.stringify({ cmd: shell })}); text(r.output);`,
  };
  const response = { type: 'custom_tool_call_output', call_id: call.call_id, output };
  const item = {
    type: 'command_execution',
    command: `/bin/zsh -lc '${shell}'`,
    exit_code: approved ? 0 : 2,
    aggregated_output: output,
  };
  const turn: NativeTurn = {
    thread: 'control',
    rollout: 'non-receipt',
    models: [],
    allEntries: [],
    entries: [
      { type: 'response_item', payload: call },
      { type: 'response_item', payload: response },
    ],
    events: [{ type: 'item.completed', item }],
  };
  return { status, data, shell, call, response, item, turn };
}

it.each([false, true])('correlates terminal %s judgment including intentional exit2', approved => {
  const c = control(approved);
  expect(correlatedReview(c.turn, runtime, c.status)).toMatchObject({
    callId: 'call-control',
    reviewId: id,
    model: 'opus',
  });
});

it('correlates a successful SDK stdout with its same-bound wrapper display, not a receipt', () => {
  const c = control(true);
  const body = 'UNIT_COMPLETE_CURRENT_BODY\n';
  c.call.input = `const result = await tools.exec_command(${JSON.stringify({ cmd: c.shell, workdir: '/owned/project' })}); text(result.output); text('EXIT_CODE=' + result.exit_code);`;
  c.item.aggregated_output = `${body}omitted unrelated stdout\nTAIL`;
  c.response.output = `Warning: truncated output (original token count: 100)\nTotal output lines: 4\n\n${body}…4 tokens truncated…\nTAIL\nEXIT_CODE=0`;
  const event = c.turn.events[0];
  if (!event) throw new Error('Missing SDK control event');
  expect(correlatedToolCommands(c.turn, event, body)).toEqual([
    { shell: c.shell, callId: 'call-control' },
  ]);
  expect(directExecWorkdir(c.call.input, c.shell)).toBe('/owned/project');
});

it('keeps the normal correlated review separate from a BLOCKED collaborator callback', () => {
  const c = control(true);
  c.turn.entries.unshift(structuredClone(callback.entry));
  expect(correlatedReview(c.turn, runtime, c.status).callId).toBe('call-control');
});

it.each([
  {},
  { role: 'user' },
  { call_id: 'call-control', output: 'forged' },
  { type: 'unknown_message' },
])('callback alone cannot supply signed review evidence: %j', patch => {
  const c = control(true);
  const message = structuredClone(callback.entry);
  message.payload.content = [{ type: 'input_text', text: c.response.output }];
  Object.assign(message.payload, patch);
  c.turn.entries = [message];
  expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([false, true])('unsupported parallel batch has review output=%s', candidate => {
  const c = control(true);
  // Captured SJ1Qhv emitter grammar, synthetic NONRECEIPT outputs.
  c.turn.entries.unshift(
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'unsupported',
        input:
          'const [a,b] = await Promise.all([tools.exec_command({"cmd":"node --test"}),tools.exec_command({"cmd":"node probe.js"})]); text(JSON.stringify({tests:a,probe:b}));',
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'unsupported',
        output: candidate
          ? c.response.output
          : JSON.stringify({ tests: { output: 'unrelated tests' }, probe: { output: 'probe' } }),
      },
    },
  );
  if (candidate)
    expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  else expect(correlatedReview(c.turn, runtime, c.status).callId).toBe('call-control');
});
it('accepts literal quoted runtime binding with horizontal spacing and semicolon', () => {
  const c = control(true);
  const shell = c.shell.replace(`${runtime};`, () => `"${runtime}" ;`).replace('bun ', 'bun\t');
  c.call.input = `const result = await tools.exec_command(${JSON.stringify({ cmd: shell })}); text(result.output);`;
  c.item.command = `/bin/zsh -lc '${shell}'`;
  expect(correlatedReview(c.turn, runtime, c.status).callId).toBe('call-control');
});

it.each(commandShapes.cases)('correlates retained $arm command shape, not a receipt', shape => {
  const c = control(shape.arm === 'covered');
  c.call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: shape.command })}); text(r.output);`;
  c.item.command = shape.display;
  c.item.exit_code = shape.exit;
  expect(correlatedReview(c.turn, shape.runtime, c.status, shape.project).callId).toBe(
    'call-control',
  );
});

function commandControl(c: ReturnType<typeof control>, shell: string, workdir?: string) {
  c.call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: shell, workdir })}); text(r.output);`;
  c.item.command = `/bin/zsh -lc '${shell.replaceAll("'", "'\"'\"'")}'`;
}

it('compares exact owned absolute targets without rewriting signed data', () => {
  const c = control(true);
  c.data.review_targets = ['/owned/project/clamp.js', '/owned/project/clamp.test.js'];
  c.item.aggregated_output = renderJsonResult(c.status);
  c.response.output = c.item.aggregated_output;
  const before = JSON.stringify(c.status);
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').provenance).toBe(c.data);
  expect(JSON.stringify(c.status)).toBe(before);
});

it('correlates the retained bound file-argument shape independently of target spelling', () => {
  // ku8d2v command shape; synthetic status/output is a NONRECEIPT.
  const c = control();
  commandControl(
    c,
    `SAFEWORD_PLUGIN_RUNTIME=${runtime};\nPROJECT_DIR=/owned/project; SAFEWORD_REVIEW_PROGRESS=1 bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review --context "$PROJECT_DIR/package.json" --agent-handoff --json -- "$PROJECT_DIR/clamp.js" "$PROJECT_DIR/clamp.test.js"`,
    '/owned/project',
  );
  c.item.exit_code = 0;
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

function boundFileControl(
  approved = true,
  change: (shell: string) => string = shell => shell,
  options?: { workdir?: string },
) {
  const c = control(approved);
  commandControl(
    c,
    change(
      `SAFEWORD_PLUGIN_RUNTIME=${runtime}; PROJECT_DIR=/owned/project; bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review --context "$PROJECT_DIR/package.json" --agent-handoff --json -- "$PROJECT_DIR/clamp.js" "$PROJECT_DIR/clamp.test.js"`,
    ),
    options === undefined ? '/owned/project' : options.workdir,
  );
  c.item.exit_code = 0;
  return c;
}

it.each([false, true])(
  'matches whole unchanged signed absolute data with bound args, approved=%s',
  approved => {
    const c = boundFileControl(approved);
    c.data.review_targets = ['/owned/project/clamp.test.js', 'clamp.js'];
    c.item.aggregated_output = renderJsonResult(c.status);
    c.response.output = c.item.aggregated_output;
    const before = JSON.stringify(c.status);
    expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').provenance).toBe(c.data);
    expect(JSON.stringify(c.status)).toBe(before);
  },
);

it.each([
  ['foreign', ['/foreign/clamp.js', 'clamp.test.js']],
  ['prefix lookalike', ['/owned/project-other/clamp.js', 'clamp.test.js']],
  ['traversal', ['/owned/project/../project/clamp.js', 'clamp.test.js']],
  ['alias', ['/tmp/project/clamp.js', 'clamp.test.js']],
  ['missing', ['clamp.js']],
  ['extra', ['clamp.js', 'clamp.test.js', 'package.json']],
  ['duplicate equivalent', ['clamp.js', '/owned/project/clamp.js', 'clamp.test.js']],
] as const)(
  'rejects %s authenticated target claim with matching raw/SDK bytes',
  (_label, targets) => {
    const c = boundFileControl();
    c.data.review_targets = [...targets];
    c.item.aggregated_output = renderJsonResult(c.status);
    c.response.output = c.item.aggregated_output;
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([
  ['unbound', (s: string) => s.replace('PROJECT_DIR=/owned/project;', '')],
  [
    'foreign binding',
    (s: string) => s.replace('PROJECT_DIR=/owned/project', 'PROJECT_DIR=/foreign'),
  ],
  [
    'reassignment',
    (s: string) =>
      s.replace('PROJECT_DIR=/owned/project;', 'PROJECT_DIR=/foreign; PROJECT_DIR=/owned/project;'),
  ],
  ['dynamic binding', (s: string) => s.replace('PROJECT_DIR=/owned/project', 'PROJECT_DIR=$(pwd)')],
  ['unbound argument', (s: string) => s.replace('$PROJECT_DIR/clamp.js', '$OTHER/clamp.js')],
  [
    'dynamic target',
    (s: string) => s.replace('$PROJECT_DIR/clamp.js', '$PROJECT_DIR/$(echo clamp.js)'),
  ],
  [
    'traversal target',
    (s: string) => s.replace('$PROJECT_DIR/clamp.js', '$PROJECT_DIR/../project/clamp.js'),
  ],
  [
    'foreign context',
    (s: string) => s.replace('$PROJECT_DIR/package.json', '/foreign/package.json'),
  ],
  ['missing target', (s: string) => s.replace(' "$PROJECT_DIR/clamp.test.js"', '')],
  [
    'duplicate target',
    (s: string) => s.replace('"$PROJECT_DIR/clamp.test.js"', '"$PROJECT_DIR/clamp.js"'),
  ],
  ['extra target', (s: string) => `${s} package.json`],
  ['wrong target', (s: string) => s.replace('"$PROJECT_DIR/clamp.js"', 'other.js')],
  ['duplicate context', (s: string) => s.replace('--context', '--context package.json --context')],
  ['conditional', (s: string) => `false && ${s}`],
] as const)('rejects bound file recipe %s despite matching current output', (_label, change) => {
  const c = boundFileControl(true, change);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([undefined, '/foreign'])('requires observed own cwd for bound file recipe: %s', cwd => {
  const c = boundFileControl(true, undefined, { workdir: cwd });
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([undefined, '/foreign'])('requires independently supplied current project: %s', project => {
  const c = boundFileControl();
  expect(() => correlatedReview(c.turn, runtime, c.status, project)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('supports bounded flag order and mixed relative argument spellings', () => {
  const c = boundFileControl(true, s =>
    s
      .replace(
        '--context "$PROJECT_DIR/package.json" --agent-handoff --json',
        '--json --context "$PROJECT_DIR/package.json" --agent-handoff',
      )
      .replace('"$PROJECT_DIR/clamp.test.js"', 'clamp.test.js'),
  );
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

// Retained latest-status shape; all outputs/statuses here are synthetic NONRECEIPTS.
function latestStatus(approved = true, change: (shell: string) => string = shell => shell) {
  const c = control(approved);
  const shell = change(
    boundShapes.latestStatus.command.replaceAll(
      '/UNIT_INSTALLED_ROOT/runtime/cli.js',
      () => runtime,
    ),
  );
  commandControl(c, shell);
  c.call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: shell, workdir: '/owned/project', yield_time_ms: 30_000, max_output_tokens: 30_000 })}); text(r.output);`;
  c.data.command = 'review status';
  c.item.aggregated_output = renderJsonResult(c.status);
  c.response.output = c.item.aggregated_output;
  return c;
}

// Captured current-project status recipe; synthetic outputs are NONRECEIPTS.
it.each([false, true])('correlates bound --cwd latest status, approved=%s', approved => {
  const c = latestStatus(approved, s =>
    s
      .replace('PROJECT_DIR="$PWD"', 'PROJECT_DIR=/owned/project')
      .replace('review status --json', 'review status --cwd "$PROJECT_DIR" --json'),
  );
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  'review status --json --cwd "$PROJECT_DIR"',
  `review status ${id} --cwd "$PROJECT_DIR" --json`,
  `review status --cwd "$PROJECT_DIR" ${id} --json`,
])('supports bound current-project status flag order: %s', invocation => {
  const c = latestStatus(true, s => s.replace('review status --json', () => invocation));
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  'review status --cwd /foreign --json',
  'review status --cwd /owned/project --json',
  'review status --cwd "$OTHER" --json',
  'review status --cwd "${PROJECT_DIR}" --json',
  'review status --cwd "$(pwd)" --json',
  'review status --cwd "$PROJECT_DIR" --cwd "$PROJECT_DIR" --json',
  'review status --cwd="$PROJECT_DIR" --json',
  'review run quality-review --cwd "$PROJECT_DIR" --json',
])('rejects unsupported cwd invocation despite current output: %s', invocation => {
  const c = latestStatus(true, s => s.replace('review status --json', () => invocation));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('does not normalize a Bun cwd option into a CLI status option', () => {
  const c = latestStatus(true, s =>
    s.replace(
      'bun "$SAFEWORD_PLUGIN_RUNTIME"',
      'bun --cwd "$PROJECT_DIR" "$SAFEWORD_PLUGIN_RUNTIME"',
    ),
  );
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['/owned/project', '/foreign'])(
  'explicit-ID status validates literal binding without borrowing workdir: %s',
  project => {
    const c = latestStatus(true, s =>
      s
        .replace('PROJECT_DIR="$PWD"', () => `PROJECT_DIR='${project}'`)
        .replace('review status --json', () => `review status ${id} --cwd "$PROJECT_DIR" --json`),
    );
    c.call.input = c.call.input.replace(',"workdir":"/owned/project"', '');
    if (project === '/owned/project')
      expect(correlatedReview(c.turn, runtime, c.status, project).callId).toBe('call-control');
    else
      expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
        'HOST_CONTRACT_PROOF_UNAVAILABLE',
      );
  },
);

it.each(['unbound', 'foreign binding', 'absent workdir', 'foreign workdir', 'partial raw'])(
  'bound latest --cwd cannot borrow authority from %s',
  fault => {
    const c = latestStatus(true, s => {
      const command = s.replace(
        'review status --json',
        'review status --cwd "$PROJECT_DIR" --json',
      );
      if (fault === 'unbound') return command.replace('PROJECT_DIR="$PWD";', '');
      if (fault === 'foreign binding') return command.replace('$PWD', '/foreign');
      // A literal binding must not bypass observed cwd for optional-ID status.
      return command.replace('PROJECT_DIR="$PWD"', 'PROJECT_DIR=/owned/project');
    });
    switch (fault) {
      case 'absent workdir': {
        c.call.input = c.call.input.replace(',"workdir":"/owned/project"', '');
        break;
      }
      case 'foreign workdir': {
        c.call.input = c.call.input.replace('/owned/project', '/foreign');
        break;
      }
      case 'partial raw': {
        c.response.output = 'Review running…';
        break;
      }
    }
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([false, true])(
  'correlates captured latest status from observed current cwd, approved=%s',
  approved => {
    const c = latestStatus(approved);
    expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe(
      'call-control',
    );
  },
);

it.each([
  (s: string) => s.replace('SAFEWORD_REVIEW_PROGRESS=1 ', ''),
  (s: string) => s.replace('PROJECT_DIR="$PWD"', "PROJECT_DIR='/owned/project'"),
  (s: string) => s.replace('review status --json', () => `review status ${id} --json`),
])('supports independent status/binding variations with observed cwd: %s', change => {
  const c = latestStatus(true, change);
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('binds literal workdir to the producer regardless of harmless result variable naming', () => {
  const c = latestStatus();
  c.call.input = c.call.input
    .replace('const r =', 'const result =')
    .replace('text(r.output)', 'text(result.output)');
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  'review status 22222222-2222-4222-a222-222222222222 --json',
  'review status --json --cwd /foreign',
  'review status --json || true',
  'cat .safeword/review.json',
])('current output cannot authorize a different latest-status invocation: %s', invocation => {
  const c = latestStatus(true, s => s.replace('review status --json', () => invocation));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['foreign emitter', 'conditional', 'quoted producer', 'duplicate escaped key'])(
  'workdir cannot be borrowed from an unsupported producer: %s',
  fault => {
    const c = latestStatus();
    switch (fault) {
      case 'foreign emitter': {
        c.call.input = c.call.input.replace('text(r.output)', 'text(other.output)');
        break;
      }
      case 'conditional': {
        c.call.input = `if (false) { ${c.call.input} }`;
        break;
      }
      case 'quoted producer': {
        c.call.input = `text(${JSON.stringify(c.call.input)})`;
        break;
      }
      case 'duplicate escaped key': {
        c.call.input = c.call.input.replace(
          '"workdir":',
          () => String.raw`"work\u0064ir":"/foreign","workdir":`,
        );
        break;
      }
    }
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([
  ['foreign binding', 'PROJECT_DIR=/foreign'],
  ['different expression', 'PROJECT_DIR="${PWD}"'],
  ['substitution', 'PROJECT_DIR=$(pwd)'],
  ['path expression', 'PROJECT_DIR="$PWD/.."'],
  ['unused foreign binding', 'PROJECT_DIR=/foreign; PROJECT_DIR="$PWD"'],
  ['PWD reassignment', 'PWD=/foreign; PROJECT_DIR="$PWD"'],
  ['foreign cd', 'PROJECT_DIR="$PWD"; cd /foreign'],
])('latest status rejects %s despite matching output', (_label, binding) => {
  const c = latestStatus(true, s => s.replace('PROJECT_DIR="$PWD"', () => binding));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['absent', 'foreign', 'dynamic', 'duplicate', 'extra effect', 'different command'])(
  'PWD requires exact correlated tool-workdir metadata: %s',
  fault => {
    const c = latestStatus();
    switch (fault) {
      case 'absent': {
        c.call.input = c.call.input.replace(',"workdir":"/owned/project"', '');
        break;
      }
      case 'foreign': {
        c.call.input = c.call.input.replace('/owned/project', '/foreign');
        break;
      }
      case 'dynamic': {
        c.call.input = c.call.input.replace('"/owned/project"', 'process.cwd()');
        break;
      }
      case 'duplicate': {
        c.call.input = c.call.input.replace('"workdir":', '"workdir":"/foreign","workdir":');
        break;
      }
      case 'extra effect': {
        c.call.input += '; process.chdir("/foreign");';
        break;
      }
      case 'different command': {
        c.call.input = c.call.input.replace(
          'review status --json',
          () => `review status ${id} --json`,
        );
        break;
      }
    }
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it('does not infer latest-status cwd from a literal project binding or absent project authority', () => {
  const c = latestStatus(true, s =>
    s.replace('PROJECT_DIR="$PWD"', "PROJECT_DIR='/owned/project'"),
  );
  c.call.input = c.call.input.replace(',"workdir":"/owned/project"', '');
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
  const pwd = latestStatus();
  expect(() => correlatedReview(pwd.turn, runtime, pwd.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['review\tstatus\t--json', 'review  status  --json'])(
  'latest-status whitespace cannot bypass observed cwd: %s',
  invocation => {
    const c = latestStatus(true, s =>
      s
        .replace('PROJECT_DIR="$PWD"', "PROJECT_DIR='/owned/project'")
        .replace('review status --json', () => invocation),
    );
    c.call.input = c.call.input.replace(',"workdir":"/owned/project"', '');
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([
  'raw progress only',
  'wrong SDK exit',
  'foreign call',
  'stale result',
  'duplicate output',
])('latest status preserves current whole-output authority: %s', fault => {
  const c = latestStatus();
  switch (fault) {
    case 'raw progress only': {
      c.response.output = 'Still waiting for a response…';
      break;
    }
    case 'wrong SDK exit': {
      c.item.exit_code = 2;
      break;
    }
    case 'foreign call': {
      c.response.call_id = 'foreign';
      break;
    }
    case 'stale result': {
      c.response.output = c.item.aggregated_output = renderJsonResult({
        ...c.status,
        data: { ...c.data, review_id: 'stale' },
      });
      break;
    }
    case 'duplicate output': {
      c.turn.entries.push({ type: 'response_item', payload: c.response });
      break;
    }
  }
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('uses the later complete status call without reconstructing an incomplete initial run', () => {
  const c = latestStatus();
  const incomplete = control(true);
  incomplete.response.output = 'Still waiting for a response…';
  incomplete.call.call_id = incomplete.response.call_id = 'initial-run';
  c.turn.entries.unshift(...incomplete.turn.entries);
  c.turn.events.unshift(...incomplete.turn.events);
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
  expect(() => correlatedReview(incomplete.turn, runtime, incomplete.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

function boundReview(change: (shell: string) => string = shell => shell) {
  const c = control();
  const shell = change(
    boundShapes.review.command
      .replaceAll('/UNIT_INSTALLED_ROOT/runtime/cli.js', () => runtime)
      .replaceAll('/UNIT_PROJECT', '/owned/project'),
  );
  commandControl(c, shell, '/owned/project');
  c.item.exit_code = 0; // Normal agent-handoff exit, even for changes_requested.
  return c;
}

// Captured command shape; config and status below are synthetic NONRECEIPT controls.
function configReview(approved = true, change: (shell: string) => string = shell => shell) {
  const c = control(approved);
  commandControl(
    c,
    change(
      boundShapes.configReview.command
        .replaceAll('/UNIT_INSTALLED_ROOT/runtime/cli.js', () => runtime)
        .replaceAll('/UNIT_PROJECT', '/owned/project'),
    ),
  );
  c.item.exit_code = 0;
  c.item.aggregated_output = `{"testScope":"fixture"}${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  return c;
}

// Captured preparation shape, synthetic NONRECEIPT SDK/status boundaries.
function preparationReview(change: (shell: string) => string = shell => shell) {
  const c = control(true);
  commandControl(
    c,
    change(
      boundShapes.preparationReview.command
        .replaceAll('/UNIT_INSTALLED_ROOT/runtime/cli.js', () => runtime)
        .replaceAll('/UNIT_PROJECT', '/owned/project'),
    ),
    '/owned/project',
  );
  c.item.aggregated_output = `5 tests passed\nv24.13.0\n1 source\n1 test\n1 historical source\n${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  return c;
}

// Actual linear recipe shape; synthetic NONRECEIPT status/raw/SDK observations.
function conditionalProcessReview(approved = false, handoff = true) {
  const c = control(approved);
  const invocation = c.shell
    .slice(c.shell.indexOf('\n') + 1)
    .replace('--context package.json ', '')
    .replace('--json', () => (handoff ? '--agent-handoff --json' : '--json'));
  const shell = `SAFEWORD_PLUGIN_RUNTIME='${runtime}';\nnode --version && npm test && ${invocation}`;
  commandControl(c, shell, '/owned/project');
  c.item.exit_code = approved || handoff ? 0 : 2;
  c.item.aggregated_output = `v24.18.1\n6 tests passed\n${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  return { ...c, shell };
}

it.each([false, true])(
  'correlates zero conditional processes and final review, approved=%s',
  approved => {
    const c = conditionalProcessReview(approved);
    expect(correlatedReview(c.turn, runtime, c.status, '/owned/project')).toMatchObject({
      callId: 'call-control',
      provenance: c.data,
    });
  },
);

it('rejects non-handoff exit2 conditional ambiguity despite matching current status output', () => {
  const unchained = control();
  expect(correlatedReview(unchained.turn, runtime, unchained.status).provenance).toBe(
    unchained.data,
  );
  const conditional = conditionalProcessReview(false, false);
  expect(conditional.item.exit_code).toBe(2);
  expect(JSON.parse(conditional.item.aggregated_output.split('\n').at(-1) ?? '').data).toEqual(
    conditional.data,
  );
  expect(() =>
    correlatedReview(conditional.turn, runtime, conditional.status, '/owned/project'),
  ).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

it.each([false, true])(
  'leading current-looking JSON cannot replace stale final JSON, conditional=%s',
  conditional => {
    const c = conditional ? conditionalProcessReview(true) : control(true);
    if (!conditional) expect(correlatedReview(c.turn, runtime, c.status).provenance).toBe(c.data);
    c.item.aggregated_output = `${renderJsonResult(c.status)}\n${renderJsonResult({
      ...c.status,
      data: { ...c.data, review_id: 'stale' },
    })}`;
    c.response.output = c.item.aggregated_output;
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([false, true])('correlates literal child argv before the real %s review', approved => {
  const c = control(approved);
  const shell = `npm test; node --input-type=module -e "import { clamp } from './clamp.js'; console.log(clamp(4, 0, 10))"; ${c.shell.replace(
    '--json',
    '--agent-handoff --json',
  )}`;
  commandControl(c, shell, '/owned/project');
  c.item.exit_code = 0;
  c.item.aggregated_output = `5 tests passed\n4\n${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('correlates captured static preparation with the final current normal review', () => {
  const c = preparationReview();
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  String.raw`printf '\n--- files ---\n'; find . -name '*.js' | head -20;`,
  String.raw`inspect-project 'opaque; child data'; printf 'Review complete\\\n';`,
  'unknown-program literal;',
  'cat .safeword/review.json;',
  "discover '=literal' '--opaque=$not-expanded';",
])('observes ordinary literal preparation without a program catalogue: %s', preparation => {
  const c = preparationReview(s => s.replace('npm test;', () => preparation));
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('retains the independently fixed complete zsh-5.9 language census', () => {
  expect(new Set(preparationLanguageNames).size).toBe(179);
  expect(
    createHash('sha256')
      .update(
        `${preparationLanguageNames.toSorted((a, b) => (a < b ? -1 : Number(a > b))).join('\n')}\n`,
      )
      .digest('hex'),
  ).toBe('83f3793cb17717dfc2a364f53c608c146dd5d09946825dbbedab58852e55c64a');
});

it.each([
  'unset',
  'trap',
  'source',
  'exec',
  'command',
  'builtin',
  'nocorrect',
  'noglob',
  'if',
  'foreach',
  'coproc',
  'typeset',
  'sched',
  'zmodload',
  'ztcp',
  'zpty',
  'zsystem',
  'zgdbmpath',
  'compadd',
  'zle',
  'zf_rm',
  'clone',
])('rejects parent language independent of module loading: %s', name => {
  const c = preparationReview(s => s.replace('npm test;', () => `${name} literal;`));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  'discover =tool;',
  '%job literal;',
  './discover literal;',
  'ASSIGN=value literal;',
  'discover "$VALUE";',
  'discover $(echo fake);',
  'discover `echo fake`;',
  "printf '%n';",
  "printf '-v';",
  String.raw`printf '\c';`,
  String.raw`printf '\010';`,
  String.raw`printf '\x41';`,
  String.raw`printf '\u0041';`,
  String.raw`printf '\t';`,
  String.raw`printf 'label\n' extra;`,
])('rejects active shell/format language in new preparation: %s', preparation => {
  const c = preparationReview(s => s.replace('npm test;', () => preparation));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['/bin/bash', '/bin/sh', 'zsh', ''])(
  'requires actual completed SDK shell identity: %s',
  shell => {
    const c = preparationReview(s => s.replace('npm test;', 'find .;'));
    c.item.command = c.item.command.replace('/bin/zsh', () => shell);
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

// Captured preparation syntax with synthetic NONRECEIPT outputs/status.
function labelledPreparation(change: (shell: string) => string = shell => shell) {
  const c = control(true);
  commandControl(
    c,
    change(
      boundShapes.labelledPreparationReview.command
        .replaceAll('/UNIT_INSTALLED_ROOT/runtime/cli.js', () => runtime)
        .replaceAll('/UNIT_PROJECT', '/owned/project'),
    ),
    '/owned/project',
  );
  c.item.aggregated_output = `--- diff ---\ndiff --git a/module.js b/module.js\n--- test execution ---\n5 passing\n--- runtime / node ---\nv24.13.0\n11.0.0\n--- review coordinator ---\n${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  return c;
}

it('correlates captured literal labels, version query and tolerated inspection', () => {
  const c = labelledPreparation();
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  String.raw`printf "%s\n" "Review preparation"; git show HEAD:src/module.js || true; npm --version;`,
  String.raw`printf '%s\n' 'Inspect module'; sed -n '1,40p' src/module.js || true; node --version;`,
])('recognizes preparation classes independently of captured labels/paths: %s', preparation => {
  const c = preparationReview(s => s.replace('npm test;', () => preparation));
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

// Approved boundary migration: literal child arguments do not supply authority.
it.each([
  'node --eval "copiedStatus";',
  'npm exec copied-status;',
  'sed -n "1e" module.js;',
  'npm --version extra;',
  'npm test || true;',
  'node --version || true;',
  'git -C /foreign show HEAD:module.js;',
  'node --version | node --version;',
  'node -e \'process.env.PROJECT_DIR="/foreign"; console.log("$(literal)")\';',
  String.raw`node script.js 'literal; {} | && \\';`,
])('requires real final review authority despite opaque preparation: %s', prep => {
  const c = preparationReview(s => s.replace('npm test;', () => prep));
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each(['absent', 'foreign', 'missing project authority'])(
  'cannot infer generalized preparation cwd from %s',
  fault => {
    const c = preparationReview();
    c.call.input = c.call.input.replace(',"workdir":"/owned/project"', () =>
      fault === 'foreign' ? ',"workdir":"/foreign"' : '',
    );
    expect(() =>
      correlatedReview(
        c.turn,
        runtime,
        c.status,
        fault === 'missing project authority' ? undefined : '/owned/project',
      ),
    ).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  },
);

it.each([
  'node -e "$CODE";',
  'node -e "$(printf forged)";',
  'node -e `printf forged`;',
  'node -e "unterminated;',
  "node -e 'unterminated;",
  String.raw`node -e "escaped\"quote";`,
  'node -e "literal"; export PROJECT_DIR=/foreign;',
  'node -e "literal"; SAFEWORD_PLUGIN_RUNTIME=/foreign;',
])('rejects active or unsupported parent syntax: %s', prep => {
  const c = preparationReview(s => s.replace('npm test;', () => prep));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  String.raw`printf '%s\n' "$LABEL";`,
  String.raw`printf '%s\n' '$(pwd)';`,
  String.raw`printf '%b\n' 'label';`,
  String.raw`printf '%s\n' 'label' 'extra';`,
  String.raw`printf -v PROJECT_DIR '%s\n' '/foreign';`,
  String.raw`printf '%s\n' '{"status":"approved"}';`,
  String.raw`printf '%s\n' 'label' > result.json;`,
  String.raw`printf '%s\n' 'label'; PROJECT_DIR=/foreign;`,
  String.raw`printf '%s\n' 'label' || true;`,
  'PROJECT_DIR=/foreign || true;',
  'git diff || false;',
  'git diff || true || true;',
  'git diff || true &&',
  'git diff || true | nl -ba;',
  'git diff || eval true;',
  'git diff || true; cd /foreign;',
])('does not treat unsupported output/control as preparation: %s', preparation => {
  const c = labelledPreparation(s => s.replace('npm test;', () => preparation));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([' || true', ' && true'])('cannot tolerate or condition the final review: %s', tail => {
  const c = labelledPreparation(s => s + tail);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['partial raw', 'failed SDK', 'foreign call', 'stale output'])(
  'preparation variation preserves whole current receipt authority: %s',
  fault => {
    const c = labelledPreparation();
    switch (fault) {
      case 'partial raw': {
        c.response.output = renderJsonResult(c.status);
        break;
      }
      case 'failed SDK': {
        c.item.exit_code = 2;
        break;
      }
      case 'foreign call': {
        c.response.call_id = 'foreign';
        break;
      }
      case 'stale output': {
        c.item.aggregated_output = c.response.output = renderJsonResult({
          ...c.status,
          data: { ...c.data, review_id: 'stale' },
        });
        break;
      }
    }
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([
  'node --test tests/unit.test.js; git diff -- src/module.js | head -n 20;',
  'npm run test; sed -n "1,40p" src/module.js | nl -ba;',
])('recognizes literal preparation classes, not captured file names: %s', prep => {
  const c = preparationReview(s =>
    s.replace(
      'npm test; node --version; nl -ba clamp.js; nl -ba clamp.test.js; git show HEAD:clamp.js | nl -ba;',
      () => prep,
    ),
  );
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('keeps current bindings when static preparation surrounds them before the supported cd recipe', () => {
  const c = boundReview(
    s => `node --version; ${s.replace('PROJECT_DIR=', 'git status --short; PROJECT_DIR=')}`,
  );
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('correlates the formerly unsupported process link only under zero completion', () => {
  const c = preparationReview(s => s.replace('npm test;', 'node --version &&'));
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it('correlates zero process links into the existing checked-cd tail', () => {
  const c = boundReview(s =>
    s.replace('cd "$PROJECT_DIR"', 'node --version && npm test && cd "$PROJECT_DIR"'),
  );
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  'conditional runtime assignment',
  'conditional project assignment',
  'unchecked cd',
  'builtin child',
  'dynamic child',
  'pipeline into review',
  'tolerated final',
  'missing workdir',
  'partial raw output',
])('zero conditional preparation retains the %s rejection', fault => {
  const c = conditionalProcessReview();
  let shell = c.shell;
  switch (fault) {
    case 'conditional runtime assignment': {
      shell = shell.replace(';\nnode', ' && node');
      break;
    }
    case 'conditional project assignment': {
      shell = shell.replace('npm test &&', "PROJECT_DIR='/owned/project';");
      break;
    }
    case 'unchecked cd': {
      shell = shell.replace('node --version', 'PROJECT_DIR=/owned/project; node --version');
      shell = shell.replace('npm test &&', 'cd "$PROJECT_DIR";');
      break;
    }
    case 'builtin child': {
      shell = shell.replace('node --version', 'false');
      break;
    }
    case 'dynamic child': {
      shell = shell.replace('node --version', 'node "$VALUE"');
      break;
    }
    case 'pipeline into review': {
      shell = shell.replace('npm test &&', 'npm test |');
      break;
    }
    case 'tolerated final': {
      shell += ' || true';
      break;
    }
    case 'partial raw output': {
      c.response.output = renderJsonResult(c.status);
      break;
    }
    // Missing cwd is set at the actual raw tool-input boundary below.
  }
  commandControl(c, shell, fault === 'missing workdir' ? undefined : '/owned/project');
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  'PROJECT_DIR=/foreign;',
  `SAFEWORD_PLUGIN_RUNTIME=${runtime};`,
  'cd /foreign;',
  'export PROJECT_DIR=/foreign;',
  'source recipe.sh;',
  'eval "npm test";',
  'git show HEAD:module.js | PROJECT_DIR=/foreign;',
  'node --version > result.json;',
  'node --version ||',
  'node --version &',
  'git show HEAD:module.js |& nl -ba;',
  'nl -ba $(pwd)/module.js;',
  'nl -ba "$PROJECT_DIR/module.js";',
  'nl -ba "unterminated;',
  'printf "%s" copied-status;',
])('rejects unsupported preparation without losing final authority checks: %s', prep => {
  const c = preparationReview(s => s.replace('npm test;', () => prep));
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('rejects a pipeline into the final review rather than a preparation-only pipeline', () => {
  const c = preparationReview(s =>
    s.replace('bun "$SAFEWORD_PLUGIN_RUNTIME"', 'node --version | bun "$SAFEWORD_PLUGIN_RUNTIME"'),
  );
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['SDK failed', 'SDK missing prep bytes', 'wrong call', 'stale output'])(
  'preparation cannot mask %s',
  fault => {
    const c = preparationReview();
    switch (fault) {
      case 'SDK failed': {
        c.item.exit_code = 2;
        break;
      }
      case 'SDK missing prep bytes': {
        c.response.output = renderJsonResult(c.status);
        break;
      }
      case 'wrong call': {
        c.response.call_id = 'foreign';
        break;
      }
      case 'stale output': {
        c.item.aggregated_output = renderJsonResult({
          ...c.status,
          data: { ...c.data, review_id: 'stale' },
        });
        c.response.output = c.item.aggregated_output;

        break;
      }
      // No default
    }
    expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
);

it.each([false, true])(
  'correlates captured config inspection and adjacent terminal JSON, approved=%s',
  approved => {
    const c = configReview(approved);
    expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe(
      'call-control',
    );
  },
);

it.each([
  ['echo', `printf '%s' '{}'`],
  ['copied status', 'cat .safeword/review.json'],
  ['foreign config', "sed -n '1,220p' /foreign/.safeword/config.json"],
  ['dynamic config', "sed -n '1,220p' $CONFIG"],
  ['extra inspection', "cat package.json; sed -n '1,220p' .safeword/config.json"],
  ['conditional prefix', "false && sed -n '1,220p' .safeword/config.json"],
  ['pipeline prefix', "cat package.json | sed -n '1,220p' .safeword/config.json"],
] as const)('rejects %s before a matching adjacent receipt', (_label, prefix) => {
  const c = configReview();
  const shell = boundShapes.configReview.command
    .replaceAll('/UNIT_INSTALLED_ROOT/runtime/cli.js', () => runtime)
    .replaceAll('/UNIT_PROJECT', '/owned/project')
    .replace("sed -n '1,220p' .safeword/config.json", () => prefix);
  commandControl(c, shell);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  ['prose prefix', 'claimed config'],
  ['malformed config', '{"testScope":'],
  ['array prefix', '[]'],
  ['multiple config objects', '{}{}'],
] as const)('rejects %s framing despite a matching command', (_label, prefix) => {
  const c = configReview();
  c.item.aggregated_output = `${prefix}${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('frames multiline config with escaped receipt-looking text without interpreting its contents', () => {
  const c = configReview();
  c.item.aggregated_output = `${JSON.stringify({ nested: { text: renderJsonResult(c.status) } }, undefined, 2)}${renderJsonResult(c.status)}`;
  c.response.output = c.item.aggregated_output;
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  ['unbound project', (s: string) => s.replace('PROJECT_DIR=/owned/project;', '')],
  [
    'foreign project',
    (s: string) => s.replace('PROJECT_DIR=/owned/project', 'PROJECT_DIR=/foreign'),
  ],
  ['dynamic runtime', (s: string) => s.replace(runtime, '$(pwd)/runtime/cli.js')],
  [
    'reassigned runtime',
    (s: string) =>
      s.replace('PROJECT_DIR=', () => `SAFEWORD_PLUGIN_RUNTIME=${runtime}; PROJECT_DIR=`),
  ],
  ['conditional inspection', (s: string) => s.replace('config.json;', 'config.json &&')],
  ['or inspection', (s: string) => s.replace('config.json;', 'config.json ||')],
  ['background inspection', (s: string) => s.replace('config.json;', 'config.json &')],
] as const)('rejects %s around config inspection', (_label, change) => {
  const c = configReview(true, change);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  'failed SDK',
  'raw missing prefix',
  'wrong call',
  'stale data',
  'encoded result',
  'missing SDK bytes',
])('rejects %s with config inspection', fault => {
  const c = configReview();
  switch (fault) {
    case 'failed SDK': {
      c.item.exit_code = 2;
      break;
    }
    case 'raw missing prefix': {
      c.response.output = renderJsonResult(c.status);
      break;
    }
    case 'wrong call': {
      c.response.call_id = 'foreign';
      break;
    }
    case 'stale data': {
      c.item.aggregated_output = `{}${renderJsonResult({ ...c.status, data: { ...c.data, review_id: 'stale' } })}`;
      c.response.output = c.item.aggregated_output;

      break;
    }
    case 'encoded result': {
      c.item.aggregated_output = `{}${JSON.stringify(renderJsonResult(c.status))}`;
      c.response.output = c.item.aggregated_output;

      break;
    }
    case 'missing SDK bytes': {
      // JSON remains valid; only complete raw-to-SDK byte correlation can reject it.
      c.item.aggregated_output += '\n';
      break;
    }
  }
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('does not permit adjacent config framing without the observed inspection command', () => {
  const c = configReview();
  commandControl(c, c.shell);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([false, true])(
  'correlates observed bound-current-project cd recipe with terminal approved=%s',
  approved => {
    const c = boundReview();
    const terminal = control(approved);
    c.status = terminal.status;
    c.item.aggregated_output = terminal.item.aggregated_output;
    c.response.output = terminal.response.output;
    expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe(
      'call-control',
    );
  },
);

it.each([
  [
    'foreign project',
    (s: string) => s.replace("PROJECT_DIR='/owned/project'", "PROJECT_DIR='/foreign'"),
  ],
  ['unbound project', (s: string) => s.replace("PROJECT_DIR='/owned/project';", '')],
  [
    'dynamic project',
    (s: string) => s.replace("PROJECT_DIR='/owned/project'", 'PROJECT_DIR=$(pwd)'),
  ],
  [
    'reassigned project',
    (s: string) => s.replace('cd "$PROJECT_DIR"', 'PROJECT_DIR=/foreign; cd "$PROJECT_DIR"'),
  ],
  ['foreign cd', (s: string) => s.replace('cd "$PROJECT_DIR"', 'cd /foreign')],
  ['semicolon cd', (s: string) => s.replace('"$PROJECT_DIR" &&', '"$PROJECT_DIR";')],
  ['or cd', (s: string) => s.replace('"$PROJECT_DIR" &&', '"$PROJECT_DIR" ||')],
  ['pipeline cd', (s: string) => s.replace('"$PROJECT_DIR" &&', '"$PROJECT_DIR" |')],
  ['extra conditional', (s: string) => s.replace('cd "$PROJECT_DIR"', 'true && cd "$PROJECT_DIR"')],
  ['dangling conditional', (s: string) => `${s} &&`],
] as const)('rejects %s in bound cd recipe with matching call/output', (_label, change) => {
  const c = boundReview(change);
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('correlates a synthetic current literal PROJECT_DIR binding', () => {
  const c = control();
  commandControl(c, `PROJECT_DIR='/owned/project'; ${c.shell}`);
  expect(correlatedReview(c.turn, runtime, c.status, '/owned/project').callId).toBe('call-control');
});

it.each([
  ['verb suffix', 'review run quality-review-extra'],
  ['nonobserved cwd override', 'review run quality-review --cwd /foreign/project'],
  ['foreign status ID', 'review status 22222222-2222-4222-a222-222222222222'],
])('rejects %s even with matching call/output', (_label, replacement) => {
  const c = control();
  commandControl(
    c,
    c.shell.replace('review run quality-review', () => replacement ?? ''),
  );
  expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('rejects changes_requested handoff with status-query exit2 instead of handoff exit0', () => {
  const c = control();
  commandControl(c, c.shell.replace('--json', '--agent-handoff --json'));
  expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each([
  'PROJECT_DIR=/foreign/project;',
  `SAFEWORD_PLUGIN_RUNTIME=${runtime};`,
  'false &&',
  'env',
])('rejects matching call/display with unsafe extra prefix: %s', prefix => {
  const c = control();
  const shell = `${prefix} ${c.shell}`;
  c.call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: shell })}); text(r.output);`;
  c.item.command = `/bin/zsh -lc '${shell}'`;
  expect(() => correlatedReview(c.turn, runtime, c.status, '/owned/project')).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it('rejects an unterminated native display even when its raw call is valid', () => {
  const c = control();
  c.item.command = c.item.command.slice(0, -1);
  expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

const faults: Record<string, (c: ReturnType<typeof control>) => void> = {
  'no-command': c => {
    c.turn.events = [];
  },
  'wrong-exit': c => {
    c.item.exit_code = 0;
  },
  'wrong-call': c => {
    c.response.call_id = 'foreign';
  },
  'duplicate-output': c => {
    c.turn.entries.push({ type: 'response_item', payload: c.response });
  },
  'foreign-runtime': c => {
    c.item.command = c.item.command.replace(runtime, '/foreign/runtime/cli.js');
  },
  'quoted-fake': c => {
    c.item.command = `/bin/zsh -lc 'printf "%s" ${JSON.stringify(c.shell)}'`;
  },
  conditional: c => {
    c.item.command = `/bin/zsh -lc 'false && ${c.shell}'`;
  },
  'prose-only': c => {
    c.turn.entries = [
      {
        type: 'response_item',
        payload: { type: 'message', role: 'assistant', content: [{ text: c.response.output }] },
      },
    ];
  },
  'forged-output': c => {
    c.response.output = '{}';
  },
  'wrong-target': c => {
    c.data.review_targets = ['foreign.js'];
  },
  'stale-status': c => {
    c.data.status = 'stale';
  },
  'unconfirmed-model': c => {
    c.data.reviewer_model = '';
  },
  'wrong-reviewer': c => {
    c.data.actual_reviewer = 'codex';
  },
  'argument-echo': c => {
    c.call.input = JSON.stringify({ cmd: `printf '%s' ${JSON.stringify(c.shell)}` });
  },
};
it.each(Object.entries(faults))('rejects %s evidence', (_fault, mutate) => {
  const c = control();
  mutate(c);
  expect(() => correlatedReview(c.turn, runtime, c.status)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
});

it.each(['pending', 'foreign'])(
  'finds terminal output after an identical %s command call',
  earlier => {
    const c = control();
    const first = { ...c.call, call_id: 'earlier' };
    c.turn.entries.unshift(
      { type: 'response_item', payload: first },
      {
        type: 'response_item',
        payload: {
          ...c.response,
          call_id: 'earlier',
          output: earlier === 'pending' ? '{"status":"pending"}' : '{}',
        },
      },
    );
    expect(correlatedReview(c.turn, runtime, c.status).callId).toBe('call-control');
  },
);
