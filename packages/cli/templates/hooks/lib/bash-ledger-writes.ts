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
//   - `dd of=<ledger>` and exotic writers not in the shape list below
//   - paths that reach the ledger only after symlink or `cd` resolution
//   - a write following a single `&` (background operator) whose segment's
//     command word is the backgrounded command — `&` is not a segment
//     separator here (only `&&`, `;`, `|`, newline are)
//
// Known over-denials (fail-closed, accepted): heredoc body lines are parsed
// as command segments, so a body line that looks like a ledger write denies.
//
// That is accepted: the gate closes the low-friction accident path (#644's
// one-line `sed -i`), not every adversarial path. The done-gate's distinct-SHA
// ledger validation (ledger-validation.ts) remains the backstop that catches
// whatever detection misses. Silence from this predicate means "nothing
// detectable", never "nothing happened".

import { isNamespacePath } from './namespace-root.js';
import { commandWordIndex, parseShellWords, splitShellSegments } from './shell-segments.js';

export interface LedgerWriteDetection {
  /** Human-readable write shape, used in the denial message. */
  shape: string;
  /** The ledger path token that triggered detection. */
  path: string;
}

/** True when a token is a literal path to an R/G/R ledger file. */
function isLedgerPath(token: string): boolean {
  // Boundary-anchored basename so `my-test-definitions.md` is not a ledger.
  return (
    (token === 'test-definitions.md' || token.endsWith('/test-definitions.md')) &&
    isNamespacePath(token, 'tickets/')
  );
}

const IN_PLACE_EDITORS = new Set(['sed', 'perl', 'gsed']);

function isInPlaceFlag(word: string): boolean {
  return /^-i/.test(word) || word === '--in-place' || word.startsWith('--in-place=');
}

/** Commands whose last argument is the file being (over)written. */
const DESTINATION_WRITERS = new Set(['mv', 'cp']);

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

/** An inline-code flag: -e / -c alone or in a bundle (-pe, -ne), or --eval=…. */
function isInlineCodeFlag(word: string): boolean {
  return /^-\w*[ce]/.test(word) || word.startsWith('--eval');
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

function detectInSegment(segment: string): LedgerWriteDetection | undefined {
  const words = parseShellWords(segment);

  for (let index = 0; index < words.length; index += 1) {
    const target = redirectionTarget(words, index);
    if (target !== undefined && isLedgerPath(target)) {
      const shape = /^(?:\d*|&)>>/.test(words[index] ?? '')
        ? 'append redirection'
        : 'output redirection';
      return { shape, path: target };
    }
  }

  const commandIndex = commandWordIndex(words);
  const commandWord = words[commandIndex] ?? '';
  const rest = words.slice(commandIndex + 1);
  const arguments_ = rest.filter(word => !word.startsWith('-'));

  if (IN_PLACE_EDITORS.has(commandWord) && rest.some(isInPlaceFlag)) {
    const ledgerArgument = rest.find(isLedgerPath);
    if (ledgerArgument !== undefined) {
      return { shape: `${commandWord} in-place edit`, path: ledgerArgument };
    }
  }

  if (ARGUMENT_WRITERS.has(commandWord)) {
    const ledgerArgument = arguments_.find(isLedgerPath);
    if (ledgerArgument !== undefined) {
      return { shape: commandWord, path: ledgerArgument };
    }
  }

  if (DESTINATION_WRITERS.has(commandWord)) {
    const destination = arguments_.at(-1);
    if (destination !== undefined && isLedgerPath(destination)) {
      return { shape: `${commandWord} destination`, path: destination };
    }
    // `-t <dir>` form: a source named test-definitions.md landing in a
    // tickets-namespace directory becomes a ledger at the destination.
    const targetDirectory = flagTargetDirectory(rest);
    if (targetDirectory !== undefined && isNamespacePath(targetDirectory, 'tickets/')) {
      const ledgerSource = arguments_.find(
        word => word === 'test-definitions.md' || word.endsWith('/test-definitions.md'),
      );
      if (ledgerSource !== undefined) {
        return { shape: `${commandWord} into ticket directory`, path: ledgerSource };
      }
    }
  }

  if (INLINE_INTERPRETERS.has(commandWord) && rest.some(isInlineCodeFlag)) {
    for (const word of rest) {
      const embedded = embeddedLedgerPath(word);
      if (embedded !== undefined) {
        return { shape: `inline ${commandWord} code naming the ledger`, path: embedded };
      }
    }
  }

  return undefined;
}

/**
 * Detect a write-shaped reference to a ledger file in a Bash command.
 * Returns the first detection, or undefined when nothing detectable writes
 * to a ledger. Pure over the command string — no filesystem access.
 */
export function detectLedgerWrite(command: string): LedgerWriteDetection | undefined {
  for (const segment of splitShellSegments(command)) {
    const detection = detectInSegment(segment);
    if (detection !== undefined) return detection;
  }
  return undefined;
}
