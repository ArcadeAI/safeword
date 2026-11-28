import assert from 'node:assert/strict';
import nodePath from 'node:path';

import {
  parseShellCommandList,
  parseShellWords,
} from '../../templates/hooks/lib/shell-segments.js';

interface NativeInput {
  hook_event_name?: string;
  command?: string;
  tool_name?: string;
  tool_input?: { command?: string; file_path?: string; content?: string };
  file_path?: string;
  conversation_id?: string;
  generation_id?: string;
  tool_use_id?: string;
  session_id?: string;
  cursor_version?: string;
  workspace_roots?: string[];
  status?: string;
  loop_count?: number;
  text?: string;
}

export interface CursorArchitectureBinding {
  path: string;
  bytes: string;
  command: string;
  loopLimit: number;
}

/** Read the host's skip and readonly completion, never invent a second managed decision. */
export function nativeArchitectureCap(
  windows: { path: string; text: string }[],
  args: string[],
  observer: string[],
  context: { workspace: string; version: string; conversation: string },
  binding: CursorArchitectureBinding,
) {
  const matching = windows.filter(window =>
    nativeHookRecords(window.text).some(
      row => nativeHookCommand(row, args) && row.input.conversation_id === context.conversation,
    ),
  );
  assert.equal(
    matching.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous architecture window',
  );
  const window = matching[0];
  assert.ok(window);
  const rows = nativeHookRecords(window.text);
  const initial = rows.filter(row => nativeHookCommand(row, args));
  assert.equal(initial.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: managed Stop cardinality');
  const first = initial[0];
  assert.ok(first);
  const managed = nativeArchitectureStops(window.text, args, context);
  assert.ok(
    managed[0]?.input.loop_count === 0 && managed[0].followup,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: initial correction missing',
  );
  const offset = window.text.indexOf(first.raw);
  const execution = window.text
    .slice(0, offset)
    .matchAll(/Executing hook (\d+)\/\d+ from ([^\n]+)/gu)
    .toArray()
    .at(-1);
  assert.ok(execution, 'HOST_CONTRACT_PROOF_UNAVAILABLE: managed execution origin missing');
  const skipped = window.text
    .slice(offset + first.raw.length)
    .matchAll(
      /Executing hook (\d+)\/\d+ from ([^\n]+)\n[^\n]*Hook (\d+) skipped due to loop limit \(loop_count=(\d+), limit=(\d+)\)/gu,
    )
    .filter(
      match => match[1] === execution[1] && match[2] === execution[2] && match[3] === execution[1],
    )
    .toArray();
  assert.equal(skipped.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: exact managed cap missing');
  const skip = skipped[0];
  assert.ok(skip);
  assert.ok(
    binding.loopLimit === 1 && skip[4] === '1' && skip[5] === '1',
    'HOST_CONTRACT_PROOF_UNAVAILABLE: wrong host cap',
  );
  const responses = rows.filter(
    row =>
      nativeHookCommand(row, observer) && row.input.generation_id !== first.input.generation_id,
  );
  assert.equal(responses.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: automatic response missing');
  const response = responses[0];
  assert.ok(response);
  assertAutomaticResponse(response, context);
  assert.ok(
    window.text.indexOf(response.raw) > offset,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: automatic response order',
  );
  return {
    binding,
    window: window.path,
    skip: { raw: skip[0], loop: Number(skip[4]), limit: Number(skip[5]) },
    response,
  };
}

function assertAutomaticResponse(
  row: ReturnType<typeof nativeHookRecords>[number],
  context: { workspace: string; version: string; conversation: string },
) {
  const input = row.input;
  assert.ok(
    row.exit === 0 &&
      input.hook_event_name === 'afterAgentResponse' &&
      input.conversation_id === context.conversation &&
      input.cursor_version === context.version &&
      input.text?.trim() &&
      typeof input.generation_id === 'string' &&
      input.generation_id.length > 0,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign or incomplete automatic response',
  );
  assert.deepEqual(
    input.workspace_roots,
    [context.workspace],
    'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign automatic response workspace',
  );
}

export type CursorArchitectureCap = ReturnType<typeof nativeArchitectureCap>;

/** Decode only complete native Hooks log blocks; never synthesize observations. */
export function nativeHookRecords(log: string) {
  return Array.from(
    log.matchAll(/Command: ([^\n]+)\n\nINPUT:\n([\s\S]*?)\n\nOUTPUT:\n([\s\S]*?)\n═+\r?\n/gu),
    block => {
      const header = /^(.*?) \(\d+ms\) exit code: (\d+)$/u.exec(block[1] ?? '');
      const words = nativeCommandWords(header?.[1] ?? '');
      return {
        raw: block[0],
        words,
        exit: Number(header?.[2] ?? -1),
        input: JSON.parse(block[2] ?? '{}') as NativeInput,
        output: block[3]?.trim() ?? '',
      };
    },
  );
}

export function nativeCommandWords(command: string) {
  const segments = parseShellCommandList(command);
  return segments.length === 1 && !segments[0]?.operatorAfter
    ? parseShellWords(segments[0]?.command ?? '')
    : [];
}

export function nativeHookCommand(
  row: ReturnType<typeof nativeHookRecords>[number],
  args: string[],
) {
  return (
    nodePath.basename(row.words[0] ?? '') === 'bun' &&
    row.words.length === args.length + 1 &&
    row.words.slice(1).every((word, index) => word === args[index])
  );
}

/** Exact registered Stop transport and actual host identities; no policy verdict translation. */
export function nativeArchitectureStops(
  log: string,
  args: string[],
  context: { workspace: string; version: string; conversation: string },
) {
  const rows = nativeHookRecords(log).filter(row => nativeHookCommand(row, args));
  assert.ok(rows.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native Stop missing');
  assert.ok(context.conversation, 'HOST_CONTRACT_PROOF_UNAVAILABLE: conversation missing');
  const generations = new Set<string>();
  return rows.map(row => {
    const input = row.input;
    assert.ok(
      row.exit === 0 &&
        input.hook_event_name === 'stop' &&
        input.status === 'completed' &&
        input.conversation_id === context.conversation &&
        input.cursor_version === context.version &&
        Number.isSafeInteger(input.loop_count) &&
        Number(input.loop_count) >= 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign or incomplete native Stop',
    );
    assert.deepEqual(
      input.workspace_roots,
      [context.workspace],
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign Stop workspace',
    );
    assert.ok(
      typeof input.generation_id === 'string' &&
        input.generation_id.length > 0 &&
        !generations.has(input.generation_id),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: missing or duplicate generation',
    );
    generations.add(input.generation_id);
    const output = JSON.parse(row.output) as { followup_message?: unknown };
    assert.ok(
      output.followup_message === undefined || typeof output.followup_message === 'string',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed native followup',
    );
    return { input, followup: output.followup_message };
  });
}

/** Existing Write actor API, with exact program/binding identity rather than substring origin. */
export function nativeCandidateDecisions(
  log: string,
  candidate: string,
  shellCommand: string,
): { permission?: string; user_message?: string }[] {
  return nativeHookRecords(log)
    .filter(row => {
      const event = row.input.hook_event_name ?? '';
      return (
        [0, 2].includes(row.exit) &&
        ['preToolUse', 'beforeShellExecution'].includes(event) &&
        (row.input.command ?? row.input.tool_input?.command) === shellCommand &&
        (nativeHookCommand(row, [nodePath.join(candidate, 'runtime/dispatch.js'), `${event}:0`]) ||
          nativeHookCommand(row, [
            nodePath.join(candidate, 'runtime/cli.js'),
            'hook',
            'cursor',
            'pre-tool-use',
          ]))
      );
    })
    .filter(row => row.output && row.output !== '(empty)')
    .map(row => JSON.parse(row.output));
}

/** Correlate one completed native action, retaining observed policy/effect facts for the grader. */
export function nativeVerificationObservation(
  log: string,
  context: {
    workspace: string;
    version: string;
    command: string;
    observer: string;
  } & (
    | { extension: string; projectBindings?: never }
    | {
        extension?: never;
        projectBindings: Record<'beforeShellExecution' | 'stop', string[]>;
      }
  ),
) {
  const { extension, workspace, version, command, observer } = context;
  const rows = nativeHookRecords(log);
  const binding = (event: 'beforeShellExecution' | 'stop') => {
    if (context.projectBindings) return context.projectBindings[event];
    assert.ok(extension, 'HOST_CONTRACT_PROOF_UNAVAILABLE: verification binding missing');
    return [nodePath.join(extension, 'runtime/dispatch.js'), `${event}:0`];
  };
  const actions = rows.filter(row => nativeHookCommand(row, binding('beforeShellExecution')));
  assert.equal(actions.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous native action');
  const action = actions[0];
  assert.ok(action);
  const input = action.input;
  assert.equal(input.command, command, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native command mismatch');
  for (const id of [
    input.conversation_id,
    input.generation_id,
    input.tool_use_id,
    input.session_id,
  ])
    assert.ok(
      typeof id === 'string' && id.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native identity missing',
    );
  const sameAction = (row: typeof action) =>
    row.input.conversation_id === input.conversation_id &&
    row.input.generation_id === input.generation_id &&
    row.input.session_id === input.session_id;
  const stops = rows.filter(
    row =>
      nativeHookCommand(row, binding('stop')) &&
      sameAction(row) &&
      row.input.status === 'completed',
  );
  const after = rows.filter(
    row => row.input.hook_event_name === 'afterShellExecution' && sameAction(row),
  );
  assert.equal(
    stops.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: completed native Stop missing or ambiguous',
  );
  assert.ok(after.length <= 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous native Shell result');
  for (const row of [action, ...stops, ...after]) {
    assert.equal(row.exit, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native callback failed');
    assert.equal(
      row.input.cursor_version,
      version,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign native version',
    );
    assert.deepEqual(
      row.input.workspace_roots,
      [workspace],
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign workspace',
    );
  }
  assert.equal(input.hook_event_name, 'beforeShellExecution');
  assert.equal(stops[0]?.input.hook_event_name, 'stop');
  for (const row of after) {
    assert.ok(
      nativeHookCommand(row, [observer, 'afterShellExecution', ':']),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign Shell observer',
    );
    assert.equal(
      row.input.tool_use_id,
      input.tool_use_id,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign native tool',
    );
    assert.equal(
      row.input.command,
      command,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign Shell command',
    );
  }
  const decision = JSON.parse(action.output) as {
    permission?: string;
    user_message?: string;
    agent_message?: string;
  };
  assert.ok(
    ['allow', 'deny'].includes(decision.permission ?? ''),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: invalid native decision',
  );
  if (decision.permission === 'allow')
    assert.equal(
      after.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Shell completion missing',
    );
  else {
    const reason = decision.user_message ?? decision.agent_message;
    assert.ok(
      typeof reason === 'string' && reason.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native denial reason missing',
    );
  }
  return {
    decision,
    conversation: input.conversation_id,
    generation: input.generation_id,
    tool: input.tool_use_id,
    session: input.session_id,
    origin: action.words[1],
    afterShellCount: after.length,
  };
}

/** A real Write request and completed same-action Stop, without translating permission JSON. */
export function nativeDesignObservation(
  log: string,
  context: {
    action: string[];
    stop: string[];
    workspace: string;
    version: string;
    file: string;
    content: string;
  },
) {
  const rows = nativeHookRecords(log);
  const actions = rows.filter(row => nativeHookCommand(row, context.action));
  assert.equal(actions.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: design Write cardinality');
  const action = actions[0];
  assert.ok(action);
  const input = action.input;
  assert.equal(input.hook_event_name, 'preToolUse');
  assert.equal(input.tool_name, 'Write');
  assert.equal(input.tool_input?.file_path, context.file);
  assert.equal(input.tool_input?.content, context.content);
  for (const id of [
    input.conversation_id,
    input.generation_id,
    input.session_id,
    input.tool_use_id,
  ])
    assert.ok(
      typeof id === 'string' && id.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: design identity missing',
    );
  const stops = rows.filter(
    row =>
      nativeHookCommand(row, context.stop) &&
      row.input.conversation_id === input.conversation_id &&
      row.input.generation_id === input.generation_id &&
      row.input.session_id === input.session_id,
  );
  assert.equal(stops.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: design completion missing');
  assert.equal(stops[0]?.input.hook_event_name, 'stop');
  assert.equal(stops[0]?.input.status, 'completed');
  for (const row of [action, ...stops]) {
    assert.equal(row.exit, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: design callback failed');
    assert.equal(row.input.cursor_version, context.version);
    assert.deepEqual(row.input.workspace_roots, [context.workspace]);
  }
  const decision = JSON.parse(action.output) as {
    permission?: string;
    user_message?: string;
    agent_message?: string;
  };
  assert.ok(
    ['allow', 'deny'].includes(decision.permission ?? ''),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: design decision missing',
  );
  return {
    decision,
    conversation: input.conversation_id,
    generation: input.generation_id,
    session: input.session_id,
    tool: input.tool_use_id,
    origin: action.words[1],
  };
}

/** Real Write request/completion plus the registered edit notification of that same action. */
export function nativeHandoffEdit(
  log: string,
  context: Parameters<typeof nativeDesignObservation>[1] & { edit: string[] },
) {
  const request = nativeDesignObservation(log, context);
  const rows = nativeHookRecords(log).filter(row => nativeHookCommand(row, context.edit));
  assert.equal(rows.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: edit callback cardinality');
  const callback = rows[0];
  assert.ok(callback);
  assert.equal(callback.exit, 0);
  assert.equal(callback.input.hook_event_name, 'afterFileEdit');
  assert.equal(callback.input.file_path, context.file);
  assert.equal(callback.input.conversation_id, request.conversation);
  assert.equal(callback.input.generation_id, request.generation);
  assert.equal(callback.input.cursor_version, context.version);
  assert.deepEqual(callback.input.workspace_roots, [context.workspace]);
  const action = nativeHookRecords(log).find(row => nativeHookCommand(row, context.action));
  const stop = nativeHookRecords(log).find(row => nativeHookCommand(row, context.stop));
  assert.ok(action && stop);
  assert.ok(
    log.indexOf(callback.raw) > log.indexOf(action.raw) &&
      log.indexOf(callback.raw) < log.indexOf(stop.raw),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: edit callback order',
  );
  return { request, callback };
}
