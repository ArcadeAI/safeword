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
//   - `dd of=<ledger>`, `ln -f`, and exotic writers not in the shape list below
//   - a redirection glued to the previous token with no space (`echo x>ledger`);
//     only space-separated or fd-prefixed `>`/`>>` operators are tokenized
//   - paths that reach the ledger only after symlink or `cd` resolution
//   - a write following a single `&` (background operator) whose segment's
//     command word is the backgrounded command — `&` is not a segment
//     separator here (only `&&`, `||`, `;`, `|`, newline are)
//
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
import { commandWordIndex, parseShellWords, splitShellSegments } from './shell-segments.js';

export interface LedgerWriteDetection {
  /** Human-readable write shape, used in the denial message. */
  shape: string;
  /** The ledger path token that triggered detection. */
  path: string;
}

/** True when a token has the ledger basename, boundary-anchored so `my-test-definitions.md` isn't one. */
function isTestDefinitionsBasename(token: string): boolean {
  return token === 'test-definitions.md' || token.endsWith('/test-definitions.md');
}

/** True when a token is a literal path to an R/G/R ledger file. */
function isLedgerPath(token: string): boolean {
  return isTestDefinitionsBasename(token) && isNamespacePath(token, 'tickets/');
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

/** Scan a segment's words for a redirection (`>`/`>>`/`&>`/`>|`, fd-prefixed) whose target is a ledger. */
function detectRedirectionWrite(words: string[]): LedgerWriteDetection | undefined {
  for (let index = 0; index < words.length; index += 1) {
    const target = redirectionTarget(words, index);
    if (target !== undefined && isLedgerPath(target)) {
      const shape = /^(?:\d*|&)>>/.test(words[index] ?? '')
        ? 'append redirection'
        : 'output redirection';
      return { shape, path: target };
    }
  }
  return undefined;
}

function detectInSegment(segment: string): LedgerWriteDetection | undefined {
  const words = parseShellWords(segment);

  const redirection = detectRedirectionWrite(words);
  if (redirection !== undefined) return redirection;

  const commandIndex = commandWordIndex(words);
  // Match writers by basename so `/usr/bin/tee` / `/bin/cp` are judged the same
  // as the bare names in the writer sets (consistent with the tokenizer's
  // basename-matching of env/corepack).
  const commandWord = nodePath.basename(words[commandIndex] ?? '');
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
    const targetDirectory = flagTargetDirectory(rest);
    if (targetDirectory !== undefined) {
      // `-t <dir>` form: the destination is the flag's directory and every
      // positional is a SOURCE — so the last positional is NOT a destination
      // (guards the false positive where the ledger is being copied OUT).
      if (isNamespacePath(targetDirectory, 'tickets/')) {
        const ledgerSource = arguments_.find(isTestDefinitionsBasename);
        if (ledgerSource !== undefined) {
          return { shape: `${commandWord} into ticket directory`, path: ledgerSource };
        }
      }
    } else {
      const destination = arguments_.at(-1);
      if (destination !== undefined && isLedgerPath(destination)) {
        return { shape: `${commandWord} destination`, path: destination };
      }
      // Positional directory form (`cp <src…> <ticket-dir>/`): a source named
      // test-definitions.md landing in a tickets-namespace directory becomes a
      // ledger at the destination.
      if (destination !== undefined && isNamespacePath(destination, 'tickets/')) {
        const ledgerSource = arguments_.slice(0, -1).find(isTestDefinitionsBasename);
        if (ledgerSource !== undefined) {
          return { shape: `${commandWord} into ticket directory`, path: ledgerSource };
        }
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
