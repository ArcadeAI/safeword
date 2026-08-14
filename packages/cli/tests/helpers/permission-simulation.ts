/**
 * Detects tests that simulate an I/O failure by removing permissions.
 *
 * Root holds CAP_DAC_OVERRIDE and bypasses every permission bit, so such a
 * simulation silently does not happen under uid 0: the code under test takes
 * the SUCCESS path and the test fails asserting on that success output. CI runs
 * as uid 1001, so the test is green there and red in every root container.
 *
 * The detector is separated from the tripwire that applies it so its own
 * evasions can be tested directly. A guard nobody can prove is a guard nobody
 * should trust — and the evasions below were all found by review, not by the
 * guard.
 */

/** Owner read+write. A mode missing either bit removes access. */
export const OWNER_READ_WRITE = 0o600;

/** `chmod a-w`, `chmod -w`, `chmod 000`, `chmod u-w` inside shell fixtures. */
export const SHELL_CHMOD_REMOVING_ACCESS = /chmod\s+(?:[augo]*-[rw]|0?[0-5][0-7][0-7]\b)/gu;

/** After these, a `/` opens a regex literal rather than dividing. */
const REGEX_MAY_FOLLOW = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';']);

const QUOTES = new Set(['"', "'", '`']);

/** Index just past a `//` or block comment starting at `from`, or -1. */
function endOfComment(source: string, from: number): number {
  if (source[from] !== '/') return -1;
  const following = source[from + 1];
  if (following === '/') {
    const newline = source.indexOf('\n', from);
    return newline === -1 ? source.length : newline;
  }
  if (following !== '*') return -1;
  const close = source.indexOf('*/', from + 2);
  return close === -1 ? source.length : close + 2;
}

/** Index just past the literal opening at `from`, treating `[...]` as a regex class. */
function endOfDelimited(source: string, from: number, isRegex: boolean): number {
  const closer = source[from];
  let index = from + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (isRegex && character === '[') inCharacterClass = true;
    else if (isRegex && character === ']') inCharacterClass = false;
    index += 1;
    if (character === closer && !inCharacterClass) break;
  }
  return index;
}

/**
 * Drops comments, leaving string literals intact and offsets aligned with the
 * input (removed spans become spaces, so a reported offset still points at the
 * original line).
 *
 * Scans left to right rather than pattern-matching, because neither half of
 * this survives a regex:
 *
 * - Stripping `//` to end-of-line without knowing what is a string deletes the
 *   rest of any line holding a URL, so a call sharing a line with one reports
 *   clean — a guard passing for the wrong reason, the exact failure this
 *   exists to catch.
 * - Masking strings first to avoid that then breaks on a regex literal
 *   containing a quote, which starts a "string" running to the next quote
 *   anywhere in the file and desynchronizes every comment boundary after it.
 *   This module's own source contains such a literal.
 */
export function withoutComments(source: string): string {
  let output = '';
  let index = 0;
  let previous = '';

  while (index < source.length) {
    const character = source[index] ?? '';

    const commentEnd = endOfComment(source, index);
    if (commentEnd !== -1) {
      output += source.slice(index, commentEnd).replaceAll(/[^\n]/gu, ' ');
      index = commentEnd;
      continue;
    }

    const isRegex = character === '/' && REGEX_MAY_FOLLOW.has(previous);
    if (QUOTES.has(character) || isRegex) {
      const literalEnd = endOfDelimited(source, index, isRegex);
      output += source.slice(index, literalEnd);
      index = literalEnd;
      previous = character;
      continue;
    }

    output += character;
    if (character.trim() !== '') previous = character;
    index += 1;
  }
  return output;
}

/** Splits on commas that are not nested inside brackets; drops empty entries. */
function topLevelArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if ('([{'.includes(character)) depth += 1;
    if (')]}'.includes(character)) depth -= 1;
    current += character;
  }
  args.push(current.trim());
  return args.filter(argument => argument !== '');
}

/**
 * The mode argument of every `chmodSync` call, found by scanning to the
 * matching close paren rather than matching a shape.
 *
 * A regex anchored on `)` right after the literal misses a call Prettier
 * wrapped with a trailing comma, and a path argument carrying its own comma —
 * `chmodSync(nodePath.join(a, b), 0o000)` — defeats a `[^,]+` path match.
 */
export function chmodModeArguments(source: string): { mode: string; offset: number }[] {
  const modes: { mode: string; offset: number }[] = [];
  for (const match of source.matchAll(/chmodSync\s*\(/gu)) {
    const open = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let index = open;
    while (index < source.length && depth > 0) {
      if (source[index] === '(') depth += 1;
      else if (source[index] === ')') depth -= 1;
      index += 1;
    }
    if (depth !== 0) continue;
    const last = topLevelArguments(source.slice(open, index - 1)).at(-1);
    if (last !== undefined) modes.push({ mode: last, offset: match.index ?? 0 });
  }
  return modes;
}

/**
 * The numeric value of a literal mode, or undefined for a variable this cannot
 * evaluate.
 *
 * `0o600` is not the only spelling that reaches chmod: `0` and a quoted `'600'`
 * are equally valid and equally capable of removing access.
 */
export function literalMode(argument: string): number | undefined {
  const octal = /^0o([0-7]{3,4})$/u.exec(argument);
  if (octal?.[1] !== undefined) return Number.parseInt(octal[1], 8);
  const quoted = /^(['"])([0-7]{1,4})\1$/u.exec(argument);
  if (quoted?.[2] !== undefined) return Number.parseInt(quoted[2], 8);
  return argument === '0' ? 0 : undefined;
}

/**
 * How far above a call a root guard may sit and still cover it. Wide enough for
 * `it.skipIf(...)` plus a title and a few setup lines, narrow enough that an
 * unrelated guard elsewhere in the file does not waive it.
 */
const GUARD_LOOKBEHIND_LINES = 20;

/** The established waiver: the test does not run as root, so nothing is faked. */
const ROOT_GUARD = 'process.getuid';

/**
 * Whether a root guard covers the call at `offset` in the RAW source.
 *
 * Removing permissions is legitimate when the test refuses to run as root —
 * the simulation is then never relied upon. That waiver has to be read from the
 * raw text, since the guard usually sits in the comment and `it.skipIf(...)`
 * line above the call.
 */
function guardedAsNonRoot(source: string, offset: number): boolean {
  const upto = source.slice(0, offset).split('\n');
  return upto.slice(-GUARD_LOOKBEHIND_LINES).join('\n').includes(ROOT_GUARD);
}

/**
 * Every permission-removing simulation in one file's source that no root guard
 * covers.
 *
 * The rule is not "never chmod" — it is "never let a chmod stand in for a
 * failure that root will not produce". A test that skips as root has said so.
 */
export function permissionSimulations(source: string): string[] {
  const code = withoutComments(source);
  const offenders: string[] = [];
  for (const call of chmodModeArguments(code)) {
    const mode = literalMode(call.mode);
    if (mode === undefined || (mode & OWNER_READ_WRITE) === OWNER_READ_WRITE) continue;
    if (guardedAsNonRoot(code, call.offset)) continue;
    offenders.push(`chmodSync(…, ${call.mode})`);
  }
  for (const match of code.matchAll(SHELL_CHMOD_REMOVING_ACCESS)) {
    if (!guardedAsNonRoot(code, match.index ?? 0)) offenders.push(match[0]);
  }
  return offenders;
}
