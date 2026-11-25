import assert from 'node:assert/strict';
import nodePath from 'node:path';

import { observedHelperProgram } from './native-helper-command.js';
export { observedHelperProgram } from './native-helper-command.js';

export interface ObservedShell {
  args: {
    command: string;
    parsingResult?: { executableCommands?: { name: string; fullText: string }[] };
  };
  result?: { success?: { stdout?: string; exitCode: number }; rejected?: { reason?: string } };
}

/** Actual completed native Shell events, not model text or expected commands. */
export function observedNativeShellResults(stdout: string): ObservedShell[] {
  const events = stdout
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          type: string;
          subtype?: string;
          tool_call?: { shellToolCall?: ObservedShell };
        },
    );
  return events
    .filter(row => row.type === 'tool_call' && row.subtype === 'completed')
    .flatMap(row => (row.tool_call?.shellToolCall ? [row.tool_call.shellToolCall] : []));
}

/** A model answer or rejected permission is never an executed-helper RED. */
export function requireNativeHelperExecution(stdout: string): ObservedShell[] {
  const attempts = observedNativeShellResults(stdout).filter(
    shell =>
      shell.args.parsingResult?.executableCommands?.some(
        program =>
          nodePath.basename(program.name) === 'bun' &&
          program.fullText.includes('project runtime audit-principle-trace'),
      ) && observedHelperProgram(shell.args.command) !== undefined,
  );
  assert.ok(attempts.length, 'CURSOR_CLI_UNAVAILABLE: no unambiguous helper Shell attempt');
  const executed = attempts.filter(shell => shell.result?.success);
  assert.ok(
    executed.length,
    'CURSOR_CLI_UNAVAILABLE: host refused helper execution before dispatch',
  );
  return executed;
}

/** Current create-file Write or existing-file Edit pair, not a Shell or Stop projection. */
export function observedNativeWrite(
  raw: string,
  workspace: string,
  file: string,
  content: string,
  session: string,
) {
  interface FileOperation {
    args?: { path: string; fileText?: string; streamContent?: string };
    result?: Record<string, unknown>;
  }
  interface WriteEvent {
    type: string;
    subtype: string;
    call_id?: string;
    session_id?: string;
    tool_call?: {
      writeToolCall?: FileOperation;
      editToolCall?: FileOperation;
    };
  }
  const events = raw
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as WriteEvent);
  const calls = events.filter(row => row.type === 'tool_call');
  assert.equal(calls.length, 2, 'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write pair cardinality');
  const [start, complete] = calls;
  assert.ok(start && complete);
  assert.equal(start.subtype, 'started');
  assert.equal(complete.subtype, 'completed');
  assert.ok(typeof start.call_id === 'string' && start.call_id.length > 0);
  assert.equal(complete.call_id, start.call_id);
  for (const row of calls) assert.equal(row.session_id, session);
  const operation = (row: WriteEvent) => {
    const forms = (['writeToolCall', 'editToolCall'] as const).filter(
      kind => row.tool_call?.[kind] !== undefined,
    );
    assert.equal(
      forms.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write operation ambiguous or missing',
    );
    const kind = forms[0];
    assert.ok(kind);
    return { kind, value: row.tool_call?.[kind] };
  };
  const first = operation(start);
  const last = operation(complete);
  assert.equal(
    first.kind,
    last.kind,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write operation mismatch',
  );
  const request = first.value?.args;
  assert.ok(request, 'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write request absent');
  assert.equal(nodePath.resolve(workspace, request.path), file);
  assert.equal(first.kind === 'editToolCall' ? request.streamContent : request.fileText, content);
  const completed = last.value;
  assert.ok(
    completed?.result && Object.keys(completed.result).length > 0,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write completion absent',
  );
  return { start, complete }; // Preserve native result fields without guessing rejection schemas.
}
