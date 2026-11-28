import assert from 'node:assert/strict';
import nodePath from 'node:path';

import {
  parseShellCommandList,
  parseShellWords,
} from '../../templates/hooks/lib/shell-segments.js';

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

/** Resolve only the declared packaged runtime and the installed workflow command. */
export function catalogueHelperRuntime(
  skill: string,
  skillFile: string,
  expectedRuntime: string,
): string {
  const link = /\[the bundled Safeword runtime\]\(([^)]+)\)/u.exec(skill)?.[1];
  assert.ok(link, 'NATIVE_HELPER_ORIGIN_MISMATCH: no declared bundled runtime');
  const runtime = nodePath.resolve(nodePath.dirname(skillFile), link);
  assert.equal(runtime, expectedRuntime, 'NATIVE_HELPER_ORIGIN_MISMATCH: declared runtime changed');
  const script = /```bash\n([\s\S]*?)```/u.exec(skill)?.[1];
  assert.ok(script, 'NATIVE_HELPER_ORIGIN_MISMATCH: no workflow helper block');
  const resolved = observedHelperProgram(`SAFEWORD_PLUGIN_RUNTIME="${runtime}"; ${script}`);
  assert.equal(resolved, runtime, 'NATIVE_HELPER_ORIGIN_MISMATCH: broken workflow command');
  return runtime;
}
