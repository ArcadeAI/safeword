// Bash-channel R/G/R ledger write detection (ticket W42G34, issue #644 G3).
//
// The SHA-or-skip annotation gate validates checkbox transitions on the
// Edit/Write/MultiEdit path only — it inspects tool payloads, which a shell
// command doesn't have. This predicate closes the Bash channel: a command that
// names a ledger file (test-definitions.md under the tickets namespace) as a
// WRITE TARGET is denied at PreToolUse, forcing the mutation onto the Edit
// channel where the transition gate can see it. Read-only references pass.
//
// ## Detection limits (deliberate — this is not a shell parser)
//
// The predicate classifies literal tokens. It CANNOT see a ledger path that
// only materializes at runtime, so the following forms pass undetected:
//
//   - shell variables and parameter expansion (`f=<ledger>; sed -i … "$f"`)
//   - `eval`, command substitution (`$(…)`), and arithmetic/brace expansion
//   - script files (`bash tick-boxes.sh`) and functions that embed the path
//     (script code an interpreter reads from stdin — a heredoc, here-string,
//     or pipe into `python3 -` — IS scanned, like `-c` inline code)
//   - `dd of=<ledger>`, `ln -f`, and exotic writers not in the shape list below
//   - a redirection glued to the previous token with no space (`echo x>ledger`);
//     only space-separated or fd-prefixed `>`/`>>` operators are tokenized
//   - paths that reach the ledger only after symlink or `cd` resolution
// Known over-denials (fail-closed, accepted): heredoc body lines are parsed
// as command segments, so a body line that looks like a ledger write denies.
//
// That is accepted: the gate closes the low-friction accident path (#644's
// one-line `sed -i`), not every adversarial path. The done-gate's distinct-SHA
// ledger validation (ledger-validation.ts) remains the backstop that catches
// whatever detection misses. Silence from this predicate means "nothing
// detectable", never "nothing happened".

import nodePath from 'node:path';

import { isNamespacePath } from './namespace-root.js';
import {
  commandWordIndex,
  parseShellCommandList,
  parseShellWords,
  type ShellCommandSegment,
} from './shell-segments.js';

export interface ProtectedWriteDetection {
  /** Human-readable write shape, used in the denial message. */
  shape: string;
  /** The ledger path token that triggered detection. */
  path: string;
}

interface ProtectedWriteDescriptor {
  isPath: (token: string) => boolean;
  isBasename: (token: string) => boolean;
  embeddedPath: (word: string) => string | undefined;
  inlineSubject: string;
}

/** True when a token has the ledger basename, boundary-anchored so `my-test-definitions.md` isn't one. */
function isTestDefinitionsBasename(token: string): boolean {
  return token === 'test-definitions.md' || token.endsWith('/test-definitions.md');
}

/** True when a token is a literal path to an R/G/R ledger file. */
function isLedgerPath(token: string): boolean {
  return isTestDefinitionsBasename(token) && isNamespacePath(token, 'tickets/');
}

function isInspirationArtifactBasename(token: string): boolean {
  const basename = nodePath.basename(token);
  return basename === 'ticket.md' || basename === 'spec.md';
}

function isInspirationArtifactPath(token: string): boolean {
  return isInspirationArtifactBasename(token) && isNamespacePath(token, 'tickets/');
}

const IN_PLACE_EDITORS = new Set(['sed', 'perl', 'gsed']);

function isInPlaceFlag(word: string): boolean {
  return /^-i/.test(word) || word === '--in-place' || word.startsWith('--in-place=');
}

/** Commands whose last argument is the file being (over)written (`install` mirrors `cp`). */
const DESTINATION_WRITERS = new Set(['mv', 'cp', 'install']);

/** Commands whose ledger argument is mutated regardless of position. */
const ARGUMENT_WRITERS = new Set(['tee', 'truncate']);

/**
 * Interpreters (and shells) that execute inline code passed via a flag. When
 * one names a ledger path anywhere in its words, the predicate denies WITHOUT
 * judging read vs write — classifying the inline code would be simulation,
 * which this design rejects (see dimensions.md baked decision, W42G34). A
 * read-only inline script naming the ledger is a deliberate false positive.
 */
const INLINE_INTERPRETERS = new Set([
  'bash',
  'bun',
  'deno',
  'node',
  'perl',
  'python',
  'python3',
  'ruby',
  'sh',
  'zsh',
]);

/**
 * An inline-code flag: `-c` / `-e` alone or in a short perl-style bundle
 * (`-pe`, `-ne`, `-nE`), or `--eval`. Bounded length so ordinary long flags
 * like `-check` or `-nice` don't count as inline-code carriers.
 */
function isInlineCodeFlag(word: string): boolean {
  return /^-[a-z]{0,2}[ce]$/i.test(word) || word.startsWith('--eval');
}

/**
 * A redirection whose target is a ledger path: standalone `>`/`>>`/`&>`/`>|`
 * (with an optional fd prefix) followed by the target word, or the fused
 * `>target` form.
 */
function redirectionTarget(words: string[], index: number): string | undefined {
  const word = words[index] ?? '';
  if (/^(?:\d*|&)>>?\|?$/.test(word)) return words[index + 1];
  const fused = /^(?:\d*|&)>(?:>|\|)?(?<target>[^>|&].*)$/.exec(word);
  return fused?.groups?.target;
}

/** The directory value of a `-t` / `--target-directory` flag, if present. */
function flagTargetDirectory(words: string[]): string | undefined {
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    if (word === '-t' || word === '--target-directory') return words[index + 1];
    if (word.startsWith('-t') && word.length > 2 && !word.startsWith('--')) return word.slice(2);
    if (word.startsWith('--target-directory=')) return word.slice('--target-directory='.length);
  }
  return undefined;
}

/** Extract a literal path candidate embedded in a word (e.g. inside inline code). */
function embeddedLedgerPath(word: string): string | undefined {
  const match = /[\w./-]*test-definitions\.md/.exec(word);
  return match !== null && isLedgerPath(match[0]) ? match[0] : undefined;
}

function embeddedInspirationArtifactPath(word: string): string | undefined {
  const match = /[\w./-]*(?:ticket|spec)\.md/.exec(word);
  return match !== null && isInspirationArtifactPath(match[0]) ? match[0] : undefined;
}

/** Scan a segment for a redirection whose target matches the protected descriptor. */
function detectRedirectionWrite(
  words: string[],
  descriptor: ProtectedWriteDescriptor,
): ProtectedWriteDetection | undefined {
  for (let index = 0; index < words.length; index += 1) {
    const target = redirectionTarget(words, index);
    if (target !== undefined && descriptor.isPath(target)) {
      const shape = /^(?:\d*|&)>>/.test(words[index] ?? '')
        ? 'append redirection'
        : 'output redirection';
      return { shape, path: target };
    }
  }
  return undefined;
}

function detectProtectedWriteInSegment(
  segment: string,
  descriptor: ProtectedWriteDescriptor,
): ProtectedWriteDetection | undefined {
  const words = parseShellWords(segment);

  const redirection = detectRedirectionWrite(words, descriptor);
  if (redirection !== undefined) return redirection;

  const commandIndex = commandWordIndex(words);
  // Match writers by basename so `/usr/bin/tee` / `/bin/cp` are judged the same
  // as the bare names in the writer sets (consistent with the tokenizer's
  // basename-matching of env/corepack).
  const commandWord = nodePath.basename(words[commandIndex] ?? '');
  const rest = words.slice(commandIndex + 1);
  const arguments_ = rest.filter(word => !word.startsWith('-'));

  if (IN_PLACE_EDITORS.has(commandWord) && rest.some(isInPlaceFlag)) {
    const protectedArgument = rest.find(descriptor.isPath);
    if (protectedArgument !== undefined) {
      return { shape: `${commandWord} in-place edit`, path: protectedArgument };
    }
  }

  if (ARGUMENT_WRITERS.has(commandWord)) {
    const protectedArgument = arguments_.find(descriptor.isPath);
    if (protectedArgument !== undefined) {
      return { shape: commandWord, path: protectedArgument };
    }
  }

  if (DESTINATION_WRITERS.has(commandWord)) {
    const targetDirectory = flagTargetDirectory(rest);
    if (targetDirectory !== undefined) {
      // `-t <dir>` form: the destination is the flag's directory and every
      // positional is a SOURCE — so the last positional is NOT a destination
      // (guards the false positive where the protected file is copied OUT).
      if (isNamespacePath(targetDirectory, 'tickets/')) {
        const protectedSource = arguments_.find(descriptor.isBasename);
        if (protectedSource !== undefined) {
          return { shape: `${commandWord} into ticket directory`, path: protectedSource };
        }
      }
    } else {
      const destination = arguments_.at(-1);
      if (destination !== undefined && descriptor.isPath(destination)) {
        return { shape: `${commandWord} destination`, path: destination };
      }
      // Positional directory form (`cp <src…> <ticket-dir>/`): a source named
      // protected basename landing in a tickets-namespace directory becomes a
      // protected file at the destination.
      if (destination !== undefined && isNamespacePath(destination, 'tickets/')) {
        const protectedSource = arguments_.slice(0, -1).find(descriptor.isBasename);
        if (protectedSource !== undefined) {
          return { shape: `${commandWord} into ticket directory`, path: protectedSource };
        }
      }
    }
  }

  if (INLINE_INTERPRETERS.has(commandWord) && rest.some(isInlineCodeFlag)) {
    for (const word of rest) {
      const embedded = descriptor.embeddedPath(word);
      if (embedded !== undefined) {
        return {
          shape: `inline ${commandWord} code naming the ${descriptor.inlineSubject}`,
          path: embedded,
        };
      }
    }
  }

  return undefined;
}

/** Shells whose `-s` flag reads commands from stdin and passes later words as `$@`. */
const STDIN_FLAG_SHELLS = new Set(['bash', 'sh', 'zsh']);

/** A heredoc operator (`<<`, `<<-`) and its delimiter, standalone or fused (`<<EOF`). */
function heredocDelimiter(words: string[]): string | undefined {
  for (let index = 0; index < words.length; index += 1) {
    const match = /^<<-?(?!<)(?<fused>.*)$/.exec(words[index] ?? '');
    if (match === null) continue;
    const delimiter = match.groups?.fused === '' ? words[index + 1] : match.groups?.fused;
    if (delimiter !== undefined && delimiter !== '') return delimiter;
  }
  return undefined;
}

const REDIRECTION_OPERATOR = /^(?:<<-?|<<<|\d*[<>]|&>)$/;
const FUSED_REDIRECTION = /^(?:\d*[<>]|&>)/;

/**
 * True when an interpreter's argv names no script file, so it executes code
 * from stdin. An explicit stdin selector (`python3 -`, `bash -s`) ends the
 * scan: later words are the stdin script's own argv. `python3 report.py <<EOF`
 * (stdin as data) is therefore not treated as code.
 */
function readsScriptFromStdin(commandWord: string, rest: string[]): boolean {
  for (let wordIndex = 0; wordIndex < rest.length; wordIndex += 1) {
    const word = rest[wordIndex] ?? '';
    if (REDIRECTION_OPERATOR.test(word)) {
      wordIndex += 1; // the operator's separate target/delimiter word
      continue;
    }
    if (word === '-' || (word === '-s' && STDIN_FLAG_SHELLS.has(commandWord))) return true;
    if (!word.startsWith('-') && !FUSED_REDIRECTION.test(word)) return false;
  }
  return true;
}

/**
 * The heredoc body that follows `segmentText`, read from the raw command: the
 * segment splitter tracks quotes across lines, so an apostrophe in the body
 * would blur segment edges. Ends at the delimiter line (leading tabs allowed
 * for `<<-`); an unterminated or unlocatable body falls back to the rest.
 */
function heredocBody(
  command: string,
  segmentText: string,
  searchFrom: number,
  delimiter: string,
): string {
  const start = command.indexOf(segmentText, searchFrom);
  const bodyStart = start === -1 ? -1 : command.indexOf('\n', start);
  if (bodyStart === -1) return command;
  const lines = command.slice(bodyStart + 1).split('\n');
  const end = lines.findIndex(line => line.replace(/^\t+/, '').trimEnd() === delimiter);
  return (end === -1 ? lines : lines.slice(0, end)).join('\n');
}

/**
 * The script source of an interpreter that reads its code from stdin: the
 * here-string, the heredoc body, or the upstream pipeline segment.
 */
function stdinScriptSource(
  segment: ShellCommandSegment,
  upstream: ShellCommandSegment | undefined,
  command: string,
  searchFrom: number,
): string | undefined {
  const words = parseShellWords(segment.command);
  const commandIndex = commandWordIndex(words);
  const commandWord = nodePath.basename(words[commandIndex] ?? '');
  const rest = words.slice(commandIndex + 1);
  if (!INLINE_INTERPRETERS.has(commandWord) || !readsScriptFromStdin(commandWord, rest)) {
    return undefined;
  }

  if (rest.some(word => word.startsWith('<<<'))) return segment.command;
  const delimiter = heredocDelimiter(rest);
  if (delimiter !== undefined) return heredocBody(command, segment.command, searchFrom, delimiter);
  return upstream?.operatorAfter === '|' || upstream?.operatorAfter === '|&'
    ? upstream.command
    : undefined;
}

function detectStdinScriptWrite(
  source: string,
  commandWord: string,
  descriptor: ProtectedWriteDescriptor,
): ProtectedWriteDetection | undefined {
  for (const token of source.split(/[^\w./-]+/)) {
    const embedded = descriptor.embeddedPath(token);
    if (embedded !== undefined) {
      return {
        shape: `stdin ${commandWord} code naming the ${descriptor.inlineSubject}`,
        path: embedded,
      };
    }
  }
  return undefined;
}

function detectProtectedWrite(
  command: string,
  descriptor: ProtectedWriteDescriptor,
): ProtectedWriteDetection | undefined {
  const segments = parseShellCommandList(command);
  let searchFrom = 0;
  for (const [index, segment] of segments.entries()) {
    const detection = detectProtectedWriteInSegment(segment.command, descriptor);
    if (detection !== undefined) return detection;

    const source = stdinScriptSource(segment, segments[index - 1], command, searchFrom);
    if (source !== undefined) {
      const words = parseShellWords(segment.command);
      const commandWord = nodePath.basename(words[commandWordIndex(words)] ?? '');
      const stdinWrite = detectStdinScriptWrite(source, commandWord, descriptor);
      if (stdinWrite !== undefined) return stdinWrite;
    }
    const found = command.indexOf(segment.command, searchFrom);
    if (found !== -1) searchFrom = found + segment.command.length;
  }
  return undefined;
}

const LEDGER_DESCRIPTOR: ProtectedWriteDescriptor = {
  isPath: isLedgerPath,
  isBasename: isTestDefinitionsBasename,
  embeddedPath: embeddedLedgerPath,
  inlineSubject: 'ledger',
};

const INSPIRATION_DESCRIPTOR: ProtectedWriteDescriptor = {
  isPath: isInspirationArtifactPath,
  isBasename: isInspirationArtifactBasename,
  embeddedPath: embeddedInspirationArtifactPath,
  inlineSubject: 'artifact',
};

/**
 * Detect a write-shaped reference to a ledger file in a Bash command.
 * Returns the first detection, or undefined when nothing detectable writes
 * to a ledger. Pure over the command string — no filesystem access.
 */
export function detectLedgerWrite(command: string): ProtectedWriteDetection | undefined {
  return detectProtectedWrite(command, LEDGER_DESCRIPTOR);
}

/**
 * Detect a shell write targeting ticket.md or spec.md in the ticket namespace.
 * These activation-bearing artifacts must be edited through a reconstructable
 * Edit/Write payload so the downgrade guard can compare prior and proposed content.
 */
export function detectInspirationArtifactWrite(
  command: string,
): ProtectedWriteDetection | undefined {
  return detectProtectedWrite(command, INSPIRATION_DESCRIPTOR);
}
