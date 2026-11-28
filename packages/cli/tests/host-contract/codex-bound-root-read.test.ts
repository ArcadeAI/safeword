import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import shapes from '../fixtures/host-contract/codex-bound-command-shapes.json';
import { type NativeTurn, resourceLoad } from '../helpers/codex-workflow-observation.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Real current installed bytes and caller; only the host transcript boundary is substituted.
function control(change: (command: string, root: string) => string = command => command) {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-bound-root-'));
  roots.push(root);
  const target = path.join(root, 'internal/testing/SKILL.md');
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(
    path.join(import.meta.dirname, '../../codex-plugin/internal/testing/SKILL.md'),
    target,
  );
  const body = readFileSync(target, 'utf8');
  const command = change(
    shapes.read.command.replaceAll('/UNIT_INSTALLED_ROOT', () => root),
    root,
  );
  const shell = command;
  const callId = shapes.read.call_id;
  const entries = [
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: callId,
        input: `const r = await tools.exec_command(${JSON.stringify({ cmd: shell })}); text(r.output);`,
      },
    },
    {
      type: 'response_item',
      payload: { type: 'custom_tool_call_output', call_id: callId, output: body },
    },
  ];
  const events = [
    {
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: `/bin/zsh -lc ${JSON.stringify(shell)}`,
        exit_code: 0,
        aggregated_output: body,
      },
    },
  ];
  return {
    target,
    entries,
    events,
    marker: 'SAFEWORD:TESTING_CORE_START',
    callId,
  };
}

it.each(["'", '"', ''])(
  'loads complete current body through a lowercase %s literal root and read-only tail',
  quote => {
    const c = control((command, root) =>
      command.replace(`base='${root}'`, () => `base=${quote}${root}${quote}`),
    );
    expect(
      resourceLoad(c as Pick<NativeTurn, 'entries' | 'events'>, c.target, c.marker),
    ).toMatchObject({ completeBody: true, callIds: [c.callId] });
  },
);

it.each([
  ['foreign', (s: string) => s.replace(/base='[^']+'/u, "base='/foreign'")],
  ['reassigned', (s: string) => s.replace('; find', '; base=/foreign; find')],
  [
    'attached printf reassignment',
    (s: string) => s.replace('; find', '; printf -vbase /foreign; find'),
  ],
  ['unknown verb suffix', (s: string) => s.replace('; find', '; cat-x; find')],
  ['unbound', (s: string) => s.slice(s.indexOf(';') + 1)],
  ['dynamic', (s: string) => s.replace(/base='[^']+'/u, 'base=$(pwd)')],
  ['mutation tail', (s: string) => s.replace('git status --short', 'git reset --hard')],
  ['conditional tail', (s: string) => s.replace('; git status', ' && git status')],
  ['pipeline tail', (s: string) => s.replace('; git status', ' | git status')],
] as const)('rejects %s root even with exact full body and successful SDK', (_label, change) => {
  const c = control(change);
  expect(() => resourceLoad(c, c.target, c.marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
});

function groupedControl(open: string, close: string, alias = 'base') {
  return control(command =>
    command
      .replaceAll(/\bbase\b/gu, () => alias)
      .replace(
        /find [^;]+/u,
        () => `find "$${alias}" ${open} -iname '*guide*' -o -iname 'SAFEWORD.md' ${close}`,
      ),
  );
}

// Synthetic NONRECEIPT controls: current installed bytes through the actual caller.
it.each([
  [String.raw`\(`, String.raw`\)`, 'SKILL_PATH'],
  ["'('", "')'", 'contentRoot'],
  ['"("', '")"', 'base'],
  [String.raw`"\("`, String.raw`"\)"`, 'root_2'],
  [String.raw`\\\(`, String.raw`\\\)`, 'assetRoot'],
])('loads complete current body with literal find arguments %s %s (%s)', (open, close, alias) => {
  const c = groupedControl(open, close, alias);
  expect(resourceLoad(c, c.target, c.marker)).toMatchObject({
    completeBody: true,
    callIds: [c.callId],
  });
});

it.each([
  ['active grouping', '(', ')'],
  ['only opening escaped', String.raw`\(`, ')'],
  ['only closing escaped', '(', String.raw`\)`],
  ['even backslashes before active opening', String.raw`\\(`, String.raw`\)`],
  ['command substitution', '$(pwd)', String.raw`\)`],
  ['backtick substitution', '`pwd`', String.raw`\)`],
  ['dollar single quotes', "$'('", "$')'"],
  ['dollar double quotes', '$"("', '$")"'],
  ['unquoted glob qualifier', '*(.)', ''],
  ['unterminated single quote', "'(", String.raw`\)`],
  ['unterminated double quote', '"(', String.raw`\)`],
])('rejects %s with the same complete raw/SDK body', (_label, open, close) => {
  const c = groupedControl(open, close);
  expect(() => resourceLoad(c, c.target, c.marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it('rejects a terminal escape after an otherwise complete grouped read', () => {
  const c = control(command => {
    const grouped = command.replace(
      /find [^;]+/u,
      () => String.raw`find "$base" \( -name 'SAFEWORD.md' \)`,
    );
    const inspected = grouped.replace('; git status --short', '');
    return `${inspected}; cat "$base/internal/testing/SKILL.md"\\`;
  });
  expect(() => resourceLoad(c, c.target, c.marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it.each(["'", '"'])('rejects an unterminated %s quote after a complete grouped read', quote => {
  const c = control(command => {
    const grouped = command.replace(
      /find [^;]+/u,
      () => String.raw`find "$base" \( -name 'SAFEWORD.md' \)`,
    );
    const inspected = grouped.replace('; git status --short', '');
    return `${inspected}; printf ${quote}unterminated`;
  });
  expect(() => resourceLoad(c, c.target, c.marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
});

it.each(['marker-only', 'partial', 'stale', 'failed SDK', 'wrong call', 'duplicate call'])(
  'literal grouping does not waive %s authority',
  fault => {
    const c = groupedControl(String.raw`\(`, String.raw`\)`);
    const [call, output] = c.entries;
    const [event] = c.events;
    if (!call || !output || !event) throw new Error('Missing controlled transcript fixture');
    const body = readFileSync(c.target, 'utf8');
    const outputs: Record<string, string> = {
      'marker-only': c.marker,
      partial: body.slice(0, -20),
      stale: body.replace(
        'Before writing or reviewing tests',
        'Previously writing or reviewing tests',
      ),
    };
    const changed = outputs[fault];
    if (changed !== undefined) {
      expect(changed).not.toBe(body);
      output.payload.output = changed;
      event.item.aggregated_output = changed;
    }
    switch (fault) {
      case 'failed SDK': {
        event.item.exit_code = 1;
        break;
      }
      case 'wrong call': {
        output.payload.call_id = 'foreign-read-call';
        break;
      }
      case 'duplicate call': {
        {
          c.entries.push(call);
          // No default
        }
        break;
      }
    }
    const expected =
      fault === 'wrong call' || fault === 'duplicate call'
        ? 'HOST_CONTRACT_PROOF_UNAVAILABLE: missing/ambiguous correlated tool output'
        : 'INTERNAL_WORKFLOW_UNMET';
    expect(() => resourceLoad(c, c.target, c.marker)).toThrow(expected);
  },
);
