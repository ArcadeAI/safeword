// Conservative shell-command tokenization shared by the gate predicates
// (extracted from cursor/gate-adapter.ts so lib modules can use it without
// importing from an adapter — cursor/ imports from lib/, never the reverse).
//
// This is NOT a shell parser. It splits a command string on unquoted segment
// boundaries (;, |, &&, newline) and whitespace-splits each segment honoring
// quotes and backslash escapes. Expansions, substitutions, and redirections
// are left as literal tokens for the caller to classify.

export function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let segmentStart = 0;
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
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
    if (quote !== undefined) continue;

    const next = command[index + 1];
    // `>|` is a clobbering redirection operator, not a pipe boundary.
    const isPipe = char === '|' && command[index - 1] !== '>';
    if (char === ';' || char === '\n' || isPipe || (char === '&' && next === '&')) {
      segments.push(command.slice(segmentStart, index));
      segmentStart = char === '&' && next === '&' ? index + 2 : index + 1;
      if (char === '&' && next === '&') index += 1;
    }
  }

  segments.push(command.slice(segmentStart));
  return segments;
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
    if (char === '\\') {
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

/**
 * Index of the first word that is the actual command name — skipping a leading
 * subshell/group opener (`(` / `{`), a run of `VAR=val` environment
 * assignments, a `command` prefix, and an `env [NAME=value ...]` prefix (with
 * env's own assignments). Skipping the opener means `( git commit )` and
 * `( sed -i … <ledger> )` resolve to the real command word, not `(`.
 */
export function commandWordIndex(words: string[]): number {
  let index = 0;
  while (words[index] === '(' || words[index] === '{') index += 1;
  index = skipEnvironmentAssignments(words, index);
  if (words[index] === 'command') index += 1;
  if (words[index] !== 'env') return index;

  index += 1;
  return skipEnvironmentAssignments(words, index);
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
