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
 *
 * What a green result means: no chmod removing owner read or write, through
 * any fs binding or import rename, as a spawned `chmod`, or in a shell fixture,
 * with a mode written literally.
 *
 * What it does not mean. A mode held in a variable is not evaluable from source
 * and is skipped rather than guessed; a callee whose name is computed at
 * runtime is not resolvable either. Both are reachable by someone working
 * around the guard, and neither is a shape anyone writes by accident, which is
 * what this catches.
 *
 * A mis-tracked literal is not merely noisy, either. The scan removes comment
 * spans, so mistaking code for a comment deletes a real call — the URL case in
 * the tripwire is exactly that, reached through a regex literal the tracker had
 * wrong. Every literal form this gets wrong is a potential false clean, so each
 * one found gets a case rather than an argument for why it is harmless.
 */

/** Owner read+write. A mode missing either bit removes access. */
export const OWNER_READ_WRITE = 0o600;

/**
 * A `chmod` in a shell fixture, with its mode token.
 *
 * Flags are skipped rather than assumed absent: `chmod -R a-w` is the ordinary
 * way to strip a tree, and a pattern expecting the mode immediately after the
 * word does not see it.
 */
const SHELL_CHMOD_CALL = /chmod\s+(?:-[A-Za-z-]+\s+)*(?<mode>[^\s;&|)'"]+)/gu;

/** After these, a `/` opens a regex literal rather than dividing. */
const REGEX_MAY_FOLLOW = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '>',
]);

/**
 * Keywords a regex literal may directly follow.
 *
 * `return /…/` and `=> /…/` are what the single-character check cannot see: the
 * character before the slash is `n` or `>`, so the literal reads as division
 * and a quote inside it opens a "string" that runs to the next quote anywhere
 * later in the file. `>` is handled above; the rest need the word.
 */
const KEYWORD_BEFORE_REGEX =
  /\b(?:return|typeof|instanceof|case|yield|await|new|delete|void|in|of|do|else)\s*$/u;

/** Longest keyword above, plus room for the whitespace after it. */
const KEYWORD_LOOKBEHIND = 16;

const QUOTES = new Set(['"', "'", '`']);

/** Index just past a `//` or block comment starting at `from`, or -1. */
function endOfComment(source: string, from: number): number {
  if (source[from] !== '/') return -1;
  const following = source[from + 1];
  if (following === '/') {
    if (source[from - 1] === ':') return -1;
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

/** Whether the `/` at `index` opens a regex literal rather than dividing. */
function opensRegexLiteral(source: string, index: number, previous: string): boolean {
  if (REGEX_MAY_FOLLOW.has(previous)) return true;
  return KEYWORD_BEFORE_REGEX.test(source.slice(Math.max(0, index - KEYWORD_LOOKBEHIND), index));
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

    const isRegex = character === '/' && opensRegexLiteral(source, index, previous);
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
 * Every name a chmod reaches this file under: the fs spellings, plus whatever
 * an import renamed one to.
 *
 * `chmodSync` is not the only door. `fs.promises.chmod` and
 * `import { chmodSync as lockDown }` remove exactly the same bits, and a
 * detector that knows one spelling reports clean on the others.
 */
function chmodCallNames(source: string): Set<string> {
  const names = new Set(['chmod', 'chmodSync', 'lchmod', 'lchmodSync', 'fchmod', 'fchmodSync']);
  const renames = source.matchAll(/\b[lf]?chmod(?:Sync)?\s+as\s+([A-Za-z_$][\w$]*)/gu);
  for (const rename of renames) if (rename[1] !== undefined) names.add(rename[1]);
  return names;
}

/** Any identifier in call position. The member prefix of `fs.promises.chmod(` is not one. */
const CALL_SITE = /(?<![\w$])([A-Za-z_$][\w$]*)\s*\(/gu;

/** Index of the `)` closing an argument list that opens at `open`, or -1. */
function endOfArguments(source: string, open: number): number {
  let depth = 1;
  let index = open;
  while (index < source.length && depth > 0) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') depth -= 1;
    index += 1;
  }
  return depth === 0 ? index - 1 : -1;
}

/**
 * The mode argument of every chmod call, found by scanning to the matching
 * close paren rather than matching a shape.
 *
 * A regex anchored on `)` right after the literal misses a call Prettier
 * wrapped with a trailing comma, and a path argument carrying its own comma —
 * `chmodSync(nodePath.join(a, b), 0o000)` — defeats a `[^,]+` path match.
 *
 * The mode is read by position, not as the last argument: every fs chmod takes
 * it second, and the async form puts a callback after it.
 */
export function chmodModeArguments(
  source: string,
): { mode: string; name: string; offset: number }[] {
  const modes: { mode: string; name: string; offset: number }[] = [];
  const names = chmodCallNames(source);
  const calls = source.matchAll(CALL_SITE);
  for (const match of calls) {
    const name = match[1] ?? '';
    if (!names.has(name)) continue;
    const open = (match.index ?? 0) + match[0].length;
    const close = endOfArguments(source, open);
    if (close === -1) continue;
    const mode = topLevelArguments(source.slice(open, close))[1];
    if (mode !== undefined) modes.push({ mode, name, offset: match.index ?? 0 });
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
 * Whether a chmod mode as written on a command line removes owner read or
 * write.
 *
 * Symbolic modes are the half a numeric-only check misses. `chmod u=r` never
 * mentions write and takes it away regardless, so an assignment is judged by
 * what it omits, not by what it strikes out.
 */
export function shellModeRemovesAccess(mode: string): boolean {
  const numeric = /^0?([0-7]{3})$/u.exec(mode);
  if (numeric?.[1] !== undefined) {
    return (Number.parseInt(numeric[1], 8) & OWNER_READ_WRITE) !== OWNER_READ_WRITE;
  }
  const symbolic = /^[augo]*([-+=])([rwxXst]*)$/u.exec(mode);
  const [, operator, permissions = ''] = symbolic ?? [];
  if (operator === '-') return /[rw]/u.test(permissions);
  if (operator === '=') return !permissions.includes('r') || !permissions.includes('w');
  return false;
}

/**
 * Modes handed to a chmod spawned as a subprocess — `execFileSync('chmod',
 * ['000', path])`.
 *
 * Nothing about this reaches the fs binding, and the mode never sits next to
 * the word `chmod`, so neither of the other two scans sees it. The bits it
 * removes are the same ones.
 */
export function argvChmodModes(source: string): { mode: string; offset: number }[] {
  const modes: { mode: string; offset: number }[] = [];
  for (const match of source.matchAll(/(['"`])chmod\1\s*,\s*\[([^\]]*)\]/gu)) {
    const argv = topLevelArguments(match[2] ?? '')
      .map(argument => argument.replaceAll(/^['"`]|['"`]$/gu, ''))
      .find(argument => !argument.startsWith('-'));
    const mode = argv;
    if (mode !== undefined) modes.push({ mode, offset: match.index ?? 0 });
  }
  return modes;
}

/** The established waiver: the test does not run as root, so nothing is faked. */
const ROOT_GUARD = 'process.getuid';

/** Start of a Vitest test declaration, including modifiers such as `it.skipIf`. */
const TEST_DECLARATION = /\b(?:it|test)(?:\.[A-Za-z_$][\w$]*)*\s*(?=[.(])/gu;

/**
 * Whether a root guard covers the call at `offset` in the RAW source.
 *
 * Removing permissions is legitimate when the test refuses to run as root —
 * the simulation is then never relied upon. That waiver has to be read from the
 * raw text, since the guard usually sits in the comment and `it.skipIf(...)`
 * line above the call.
 */
function guardedAsNonRoot(source: string, offset: number): boolean {
  const beforeCall = source.slice(0, offset);
  const declarations = beforeCall.matchAll(TEST_DECLARATION);
  let currentTestStart = 0;
  for (const declaration of declarations) currentTestStart = declaration.index;
  return beforeCall.slice(currentTestStart).includes(ROOT_GUARD);
}

/**
 * Every permission-removing simulation in one file's source that no root guard
 * covers.
 *
 * The rule is not "never chmod" — it is "never let a chmod stand in for a
 * failure that root will not produce". A test that skips as root has said so.
 */
function bindingSimulations(code: string): { label: string; offset: number }[] {
  return chmodModeArguments(code)
    .filter(call => {
      const mode = literalMode(call.mode);
      return mode !== undefined && (mode & OWNER_READ_WRITE) !== OWNER_READ_WRITE;
    })
    .map(call => ({ label: `${call.name}(…, ${call.mode})`, offset: call.offset }));
}

function spawnedSimulations(code: string): { label: string; offset: number }[] {
  return argvChmodModes(code)
    .filter(call => shellModeRemovesAccess(call.mode))
    .map(call => ({ label: `chmod ${call.mode} (spawned)`, offset: call.offset }));
}

function shellSimulations(code: string): { label: string; offset: number }[] {
  return code
    .matchAll(SHELL_CHMOD_CALL)
    .filter(match => shellModeRemovesAccess(match.groups?.mode ?? ''))
    .map(match => ({ label: match[0], offset: match.index ?? 0 }))
    .toArray();
}

export function permissionSimulations(source: string): string[] {
  const code = withoutComments(source);
  const found = [
    ...bindingSimulations(code),
    ...spawnedSimulations(code),
    ...shellSimulations(code),
  ];
  return found
    .filter(simulation => !guardedAsNonRoot(code, simulation.offset))
    .map(simulation => simulation.label);
}
