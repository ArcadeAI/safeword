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

/** A model answer or rejected permission is never an executed-helper RED. */
export function requireNativeHelperExecution(stdout: string): ObservedShell[] {
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
  const attempts = events
    .filter(row => row.type === 'tool_call' && row.subtype === 'completed')
    .flatMap(row => (row.tool_call?.shellToolCall ? [row.tool_call.shellToolCall] : []))
    .filter(
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
