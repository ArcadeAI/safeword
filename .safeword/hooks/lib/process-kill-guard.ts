// Broad process-kill detection (ticket K4STDR, issue #773).
//
// `killall node` / `pkill -9 node` match processes by NAME across the whole
// machine — on a multi-project box they kill every project's dev servers,
// test runners, and build processes, not just this project's. This predicate
// detects a killall/pkill invocation whose target is a bare shared-runtime
// name so the Bash gate can deny it and point to the project-scoped
// alternatives in zombie-process-cleanup.md (port-scoped `lsof -ti:<port>`,
// path-scoped `pkill -f "<pattern>.*$(pwd)"`, or cleanup-zombies.sh).
//
// ## Detection limits (deliberate — this is not a shell parser)
//
// The predicate classifies literal tokens, same doctrine as
// bash-ledger-writes.ts: close the low-friction accident path, not every
// adversarial path. Undetected forms include targets materialized at runtime
// (`p=node; killall "$p"`), scripts that embed the kill, `xargs killall`,
// and `sudo -u <user> killall node` (sudo option values are not modeled).
// A quoted regex that anchors a bare name (`pkill '^node$'`) IS detected —
// anchors are stripped before the name comparison. So is a leading
// backslash-escape (`pkill '\java'`): pkill patterns are EREs, where a
// backslash before an ordinary letter is that letter, so the pattern still
// kills every `java` process (EDDABK).

import { commandWordIndex, parseShellWords, splitShellSegments } from './shell-segments.js';

export interface ProcessKillDetection {
  /** The kill command word, used in the denial message. */
  command: string;
  /** The bare runtime name it targets. */
  target: string;
}

/** Commands that match processes by name (machine-wide blast radius). */
const NAME_MATCHING_KILLERS = new Set(['killall', 'pkill']);

/**
 * Interpreter runtimes shared across projects: killing every process with
 * one of these names is never scoped to the current project. Browser/test
 * process names (chromium, playwright) are deliberately absent — the guide
 * sanctions `pkill -f "playwright.*$(pwd)"`, and bare browser kills are rare
 * enough that denying them would mostly produce false positives.
 */
const SHARED_RUNTIMES = new Set(['node', 'bun', 'deno', 'python', 'python3', 'ruby', 'java']);

/**
 * Strip regex anchors and backslash-escapes so `'^node$'`, `'\java'`, and
 * `'n\ode'` are all judged as their bare runtime name. In an ERE a backslash
 * before an ordinary character is that character, so `n\ode` still matches
 * every `node` process; dropping backslashes wherever they appear keeps the
 * comparison from being evaded by one. (POSIX single-quote tokenization now
 * delivers interior backslashes intact, so a leading-only strip would miss
 * `n\ode` — EDDABK.)
 */
function bareName(token: string): string {
  return token.replaceAll('\\', '').replace(/^\^/, '').replace(/\$$/, '');
}

/**
 * pkill/killall flags whose value is a separate following word. The value is
 * a filter, not a kill target — `pkill -u node myapp` kills myapp (filtered
 * to user `node`, a real user in official Node.js Docker images), so the
 * value must not be judged as a runtime name.
 */
const VALUE_TAKING_FLAGS = new Set([
  '-u',
  '-U',
  '-G',
  '-P',
  '-t',
  '-s',
  '-g',
  '--signal',
  '--uid',
  '--euid',
  '--group',
  '--parent',
  '--terminal',
  '--session',
]);

/**
 * Returns a detection when any segment of `command` invokes killall/pkill
 * with a bare shared-runtime name among its arguments, undefined otherwise.
 * Flags are skipped (with their separate values): whatever the signal (`-9`,
 * `-SIGKILL`, plain TERM) or matcher flag (`-x`, `-f`), a bare runtime
 * target is cross-project.
 */
export function detectBroadProcessKill(command: string): ProcessKillDetection | undefined {
  for (const segment of splitShellSegments(command)) {
    const words = parseShellWords(segment);
    let index = commandWordIndex(words);
    while (words[index] === 'sudo') index += 1;
    const commandWord = words[index];
    if (commandWord === undefined || !NAME_MATCHING_KILLERS.has(commandWord)) continue;
    const args = words.slice(index + 1);
    for (let argIndex = 0; argIndex < args.length; argIndex += 1) {
      const word = args[argIndex] ?? '';
      if (VALUE_TAKING_FLAGS.has(word)) {
        argIndex += 1; // skip the flag's value — a filter, never the target
        continue;
      }
      if (word.startsWith('-')) continue;
      const target = bareName(word);
      if (SHARED_RUNTIMES.has(target)) {
        return { command: commandWord, target };
      }
    }
  }
  return undefined;
}
