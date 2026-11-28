import assert from 'node:assert/strict';

import { expect, it } from 'vitest';

import { observedNativeWrite } from '../helpers/cursor-cli-observations.js';

// Sanitized current-target wire shapes: actual existing-file Edit and documented
// create-file Write. These pure decoder replays are not a new native execution.
const workspace = '/owned/workspace';
const file = `${workspace}/ticket.md`;
const content = 'Synthetic phase: plan-execution\n';
const session = 'sanitized-session';
type Kind = 'writeToolCall' | 'editToolCall';
interface Operation {
  args: { path: string; fileText?: string; streamContent?: string };
  result?: Record<string, unknown>;
}
interface Event {
  type: string;
  subtype: string;
  call_id: string;
  session_id: string;
  tool_call: Partial<Record<Kind, Operation>> & {
    hookAdditionalContexts: unknown[];
    toolCallId: string;
    startedAtMs: string;
    completedAtMs?: string;
  };
}
function pair(kind: Kind): Event[] {
  const args =
    kind === 'editToolCall'
      ? { path: file, streamContent: content }
      : { path: file, fileText: content };
  const success =
    kind === 'editToolCall'
      ? {
          path: file,
          linesAdded: 1,
          linesRemoved: 1,
          diffString: 'synthetic diff',
          beforeFullFileContent: 'Synthetic phase: plan-implementation\n',
          afterFullFileContent: content,
          message: 'Applied edit',
        }
      : { path: file, linesCreated: 1, fileSize: content.length };
  return [
    {
      type: 'tool_call',
      subtype: 'started',
      call_id: 'sanitized-call',
      session_id: session,
      tool_call: {
        [kind]: { args },
        hookAdditionalContexts: [],
        toolCallId: 'sanitized-call',
        startedAtMs: '1',
      },
    },
    {
      type: 'tool_call',
      subtype: 'completed',
      call_id: 'sanitized-call',
      session_id: session,
      tool_call: {
        [kind]: { args: { ...args }, result: { success } },
        hookAdditionalContexts: [],
        toolCallId: 'sanitized-call',
        startedAtMs: '1',
        completedAtMs: '2',
      },
    },
  ];
}
const decode = (events: ReturnType<typeof pair>) =>
  observedNativeWrite(
    events.map(row => JSON.stringify(row)).join('\n'),
    workspace,
    file,
    content,
    session,
  );
it.each(['editToolCall', 'writeToolCall'] as const)(
  'preserves a current %s operation and its original result',
  kind => {
    const events = pair(kind);
    const actual = decode(events);
    expect(actual.start).toEqual(events[0]);
    expect(actual.complete).toEqual(events[1]);
  },
);

const faults = [
  'missing-completion',
  'missing-kind',
  'mismatched-kind',
  'ambiguous-start',
  'ambiguous-complete',
  'foreign-session',
  'mismatched-call',
  'missing-call',
  'path',
  'content',
  'missing-result',
  'empty-result',
] as const;
it.each(
  (['editToolCall', 'writeToolCall'] as const).flatMap(kind =>
    faults.map(fault => ({ kind, fault })),
  ),
)('refuses $kind $fault', ({ kind, fault }) => {
  const events = pair(kind);
  const [start, complete] = events;
  assert.ok(start && complete);
  const other: Kind = kind === 'editToolCall' ? 'writeToolCall' : 'editToolCall';
  // Test-owned decoded transport records only; never a policy decision or receipt.
  const startOperation = start.tool_call[kind];
  const endOperation = complete.tool_call[kind];
  assert.ok(startOperation && endOperation);
  const mutations: Record<typeof fault, () => void> = {
    'missing-completion': () => {
      events.splice(1, 1);
    },
    'missing-kind': () => {
      start.tool_call[kind] = undefined;
    },
    'mismatched-kind': () => {
      complete.tool_call = { ...complete.tool_call, [kind]: undefined, [other]: endOperation };
    },
    'ambiguous-start': () => {
      start.tool_call[other] = startOperation;
    },
    'ambiguous-complete': () => {
      complete.tool_call[other] = endOperation;
    },
    'foreign-session': () => {
      complete.session_id = 'foreign';
    },
    'mismatched-call': () => {
      complete.call_id = 'other';
    },
    'missing-call': () => {
      start.call_id = '';
    },
    path: () => {
      startOperation.args.path = '/foreign';
    },
    content: () => {
      Object.assign(
        startOperation.args,
        kind === 'editToolCall' ? { streamContent: 'unrelated' } : { fileText: 'unrelated' },
      );
    },
    'missing-result': () => {
      endOperation.result = undefined;
    },
    'empty-result': () => {
      endOperation.result = {};
    },
  };
  mutations[fault]();
  expect(() => decode(events)).toThrow();
});
