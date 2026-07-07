// The single shell-command tokenizer shared by every Bash gate predicate
// (process-kill-guard, bash-ledger-writes, dependency-readiness, and the
// cursor gate-adapter — cursor/ imports from lib/, never the reverse).
// Unified from two divergent copies in ticket EDDABK: a change here shifts
// what EVERY gate catches, so behavior is pinned directly in
// tests/hooks/shell-segments.test.ts as well as by each gate's own tests.
//
// This is NOT a shell parser. It splits a command string on unquoted segment
// boundaries (`;`, newline, `&&`, `||`, single `|`) and whitespace-splits
// each segment honoring quotes and backslash escapes. Backslash is literal
// inside single quotes (POSIX); `>|` is a clobbering redirection operator,
// not a pipe boundary. Expansions, substitutions, and redirections are left
// as literal tokens for the caller to classify.

import nodePath from 'node:path';

export function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === undefined) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== "'") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      current += char;
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    const next = command[index + 1];
    if (char === ';' || char === '\n') {
      pushSegment(segments, current);
      current = '';
      continue;
    }
    if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
      pushSegment(segments, current);
      current = '';
      index += 1;
      continue;
    }
    // `>|` is a clobbering redirection operator, not a pipe boundary.
    if (char === '|' && command[index - 1] !== '>') {
      pushSegment(segments, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushSegment(segments, current);
  return segments;
}

function pushSegment(segments: string[], segment: string): void {
  const trimmed = segment.trim();
  if (trimmed.length > 0) segments.push(trimmed);
}

export function parseShellWords(segment: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const char of segment) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    // Backslash is literal inside single quotes (POSIX), an escape elsewhere.
    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && quote === undefined) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = undefined;
      continue;
    }
    if (quote === undefined && /\s/.test(char)) {
      if (current !== '') {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current !== '') words.push(current);
  return words;
}

/** `env` options whose value is a separate following word. */
const ENV_OPTIONS_WITH_VALUES = new Set(['--argv0', '--chdir', '--unset', '-a', '-C', '-u']);

/**
 * Index of the first word that is the actual command name. Skips a leading
 * run of subshell/group openers (`(` / `{`), then loops over execution
 * prefixes until a real word remains: `VAR=val` environment assignments, the
 * `command` builtin, `env` (matched by basename, with its options —
 * value-taking ones via ENV_OPTIONS_WITH_VALUES — interleaved assignments,
 * and a `--` terminator), and the `corepack` launcher (matched by basename).
 * Skipping the opener means `( git commit )` resolves to the real command
 * word, not `(`; looping means `FOO=1 env BAR=2 corepack pnpm install`
 * resolves to `pnpm`.
 *
 * Deliberately NOT skipped (pre-existing behavior, out of EDDABK's scope):
 * `sudo` (the kill-guard skips it itself), `nohup`/`nice`/`time`/`xargs`.
 */
export function commandWordIndex(words: string[]): number {
  let index = 0;
  while (words[index] === '(' || words[index] === '{') index += 1;

  while (index < words.length) {
    index = skipEnvironmentAssignments(words, index);
    const word = words[index];
    if (word === undefined) return index;
    if (word === 'command') {
      index += 1;
      continue;
    }
    const binary = nodePath.basename(word);
    if (binary === 'env') {
      index = skipEnvOptions(words, index + 1);
      continue;
    }
    if (binary === 'corepack') {
      index += 1;
      continue;
    }
    return index;
  }

  return index;
}

function skipEnvOptions(words: string[], start: number): number {
  let index = start;
  while (index < words.length) {
    const word = words[index] ?? '';
    if (isEnvironmentAssignment(word)) {
      index += 1;
      continue;
    }
    if (word === '--') {
      index += 1;
      break;
    }
    if (ENV_OPTIONS_WITH_VALUES.has(word) && !word.includes('=')) {
      index += 2;
      continue;
    }
    if (word.startsWith('-')) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function skipEnvironmentAssignments(words: string[], start: number): number {
  let index = start;
  while (index < words.length && isEnvironmentAssignment(words[index] ?? '')) {
    index += 1;
  }
  return index;
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}
