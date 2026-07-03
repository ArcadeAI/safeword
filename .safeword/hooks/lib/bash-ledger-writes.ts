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
  return token.endsWith('test-definitions.md') && isNamespacePath(token, 'tickets/');
}

const IN_PLACE_EDITORS = new Set(['sed', 'perl', 'gsed']);

function isInPlaceFlag(word: string): boolean {
  return /^-i/.test(word) || word === '--in-place' || word.startsWith('--in-place=');
}

/**
 * Detect a write-shaped reference to a ledger file in a Bash command.
 * Returns the first detection, or undefined when nothing detectable writes
 * to a ledger. Pure over the command string — no filesystem access.
 */
export function detectLedgerWrite(command: string): LedgerWriteDetection | undefined {
  for (const segment of splitShellSegments(command)) {
    const words = parseShellWords(segment);
    const commandIndex = commandWordIndex(words);
    const commandWord = words[commandIndex] ?? '';
    const rest = words.slice(commandIndex + 1);

    if (IN_PLACE_EDITORS.has(commandWord) && rest.some(isInPlaceFlag)) {
      const ledgerArgument = rest.find(isLedgerPath);
      if (ledgerArgument !== undefined) {
        return { shape: `${commandWord} in-place edit`, path: ledgerArgument };
      }
    }
  }
  return undefined;
}
