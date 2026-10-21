import assert from 'node:assert/strict';
import nodePath from 'node:path';

import {
  parseShellCommandList,
  parseShellWords,
} from '../../templates/hooks/lib/shell-segments.js';

export interface ObservedShell {
  args: {
    command: string;
    parsingResult?: { executableCommands?: { name: string; fullText: string }[] };
  };
  result?: { success?: { stdout?: string; exitCode: number }; rejected?: { reason?: string } };
}

function recordAssignments(words: string[], bindings: Record<string, string>): boolean {
  for (const word of words) {
    const separator = word.indexOf('=');
    const name = word.slice(0, separator);
    if (separator < 1 || !['SAFEWORD_PLUGIN_RUNTIME', 'PROJECT_DIR'].includes(name)) return false;
    const value = word.slice(separator + 1);
    if (name === 'SAFEWORD_PLUGIN_RUNTIME' && (!nodePath.isAbsolute(value) || value.includes('$')))
      return false;
    bindings[name] = value;
  }
  return words.length > 0;
}

function prelude(
  words: string[],
  bindings: Record<string, string>,
): 'accepted' | 'invalid' | 'unknown' {
  if (words[0] === 'cd') return words.length === 2 ? 'accepted' : 'invalid';
  if (words[0] === 'export')
    return recordAssignments(words.slice(1), bindings) ? 'accepted' : 'invalid';
  if (words[0]?.includes('=')) return recordAssignments(words, bindings) ? 'accepted' : 'invalid';
  return 'unknown';
}

function resolvedOperand(
  operand: string | undefined,
  bindings: Record<string, string>,
): string | undefined {
  const program =
    operand === '$SAFEWORD_PLUGIN_RUNTIME' || operand === '${SAFEWORD_PLUGIN_RUNTIME}'
      ? bindings.SAFEWORD_PLUGIN_RUNTIME
      : operand;
  return program && nodePath.isAbsolute(program) ? program : undefined;
}

function helperProgram(words: string[], bindings: Record<string, string>): string | undefined {
  if (nodePath.basename(words[0] ?? '') !== 'bun') return undefined;
  if (words.slice(2, 5).join(' ') !== 'project runtime audit-principle-trace') return undefined;
  const supportedArguments =
    words.length === 5 || (words.length === 8 && words[5] === '--cwd' && words[7] === '--');
  if (!supportedArguments) return undefined;
  return resolvedOperand(words[1], bindings);
}

/** Recognize the canonical helper grammar without evaluating any shell input. */
export function observedHelperProgram(command: string): string | undefined {
  if (command.includes('$(') || command.includes('`')) return undefined;
  const bindings: Record<string, string> = {};
  const segments = parseShellCommandList(command);
  for (const [index, segment] of segments.entries()) {
    if (segment.operatorAfter && !['&&', ';'].includes(segment.operatorAfter)) return undefined;
    const words = parseShellWords(segment.command);
    const kind = prelude(words, bindings);
    if (kind === 'invalid') return undefined;
    if (kind === 'accepted') continue;
    if (index !== segments.length - 1) return undefined;
    return helperProgram(words, bindings);
  }
  return undefined;
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
