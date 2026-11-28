// Recognize explicit destinations in the opening simple command or pipeline.
// Do not interpret script text, heredoc bodies, substitutions or a later cwd.
import nodePath from 'node:path';

import { parseShellCommandList } from './shell-segments.js';

function simpleWriteTargets(
  segment: string,
): { targets: string[]; commented: boolean } | undefined {
  // Keep quotes until operators have been distinguished from literal arguments
  // (e.g. rg '>' app.ts). Stop at unsupported shell syntax.
  const token =
    /\s+|(?<descriptor>\d*[<>]&(?:\d+|-)(?=$|[\s<>]))|(?<redirect>\d*>(?:>|\|)?|&>>?)|(?<input>\d*(?:<<-?|<))|(?<word>"(?:[^"\\$`]|\\.)*"|'[^']*'|[\w\p{L}\p{M}\p{N}./:@%+=,#-]+)/guy;
  const args: string[] = [];
  const targets: string[] = [];
  let position = 0;
  let commented = false;
  let next: 'output' | 'input' | undefined;
  while (position < segment.length) {
    if (segment[position] === '#') {
      commented = true;
      break;
    }
    const match = token.exec(segment);
    if (!match) return;
    position = token.lastIndex;
    const { descriptor, redirect, input, word } = match.groups ?? {};
    if (descriptor !== undefined) {
      // Duplicating or closing a descriptor names no filesystem destination.
      if (next !== undefined) return;
    } else if (redirect !== undefined || input !== undefined) {
      if (next !== undefined) return;
      next = redirect === undefined ? 'input' : 'output';
    } else if (word !== undefined) {
      // Adjacent quoted/unquoted fragments and shell expansions are ambiguous.
      if (position < segment.length && !/[\s<>]/u.test(segment[position] ?? '')) return;
      const literal = /^['"]/u.test(word) ? word.slice(1, -1) : word;
      if (next === 'output') targets.push(literal);
      else if (next === undefined) args.push(literal);
      next = undefined;
    }
  }
  if (next !== undefined) return;
  const [program = '', ...operands] = args;
  // A project script can share a utility's basename while doing unrelated work.
  const command = ['/bin', '/usr/bin'].includes(nodePath.dirname(program))
    ? nodePath.basename(program)
    : program;
  const last = operands.at(-1);
  if (
    command === 'tee' &&
    operands.every(arg => !arg.startsWith('-') || arg === '-a' || arg === '--')
  ) {
    targets.push(...operands.filter(arg => !arg.startsWith('-')));
  }
  if (
    (command === 'cp' || command === 'mv') &&
    operands.length === 2 &&
    operands.every(arg => !arg.startsWith('-')) &&
    last
  ) {
    targets.push(last);
    if (command === 'mv') targets.push(operands[0]!);
  }
  if (
    command === 'sed' &&
    operands[0] === '-i' &&
    (operands.length === 3 || (operands.length === 4 && operands[1] === '')) &&
    !operands.at(-2)?.startsWith('-') &&
    last &&
    !last.startsWith('-')
  ) {
    targets.push(last);
  }
  return {
    targets: targets.filter(path => path !== '' && path !== '-' && !/[\\$`]/u.test(path)),
    commented,
  };
}

export function intakeShellWriteTargets(command: string): string[] {
  const firstLine = command.split('\n', 1)[0] ?? '';
  const targets: string[] = [];
  for (const segment of parseShellCommandList(firstLine)) {
    const segmentTargets = simpleWriteTargets(segment.command);
    if (!segmentTargets) break;
    targets.push(...segmentTargets.targets);
    if (segmentTargets.commented) break;
    if (segment.operatorAfter !== '|' && segment.operatorAfter !== '|&') break;
  }
  return targets;
}
