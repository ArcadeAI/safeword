import { mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

/**
 * The throwaway `CLAUDE_CONFIG_DIR` every Safeword test runner points at.
 *
 * Safeword's Claude install ends in `claude plugin install` (`convergePlugin`
 * in `src/claude-plugin/profile.ts`), and `runClaude` spawns the host with the
 * ambient environment. Any suite that runs the real CLI in a temporary project
 * therefore records an install in the developer's real
 * `~/.claude/plugins/installed_plugins.json`, keyed by a `$TMPDIR` directory
 * that is deleted seconds later. Claude Code never prunes those records, so the
 * file grows without bound — ~45x over five days of ordinary development — and
 * `claude plugin list` prints the same plugin dozens of times (issue #4776).
 *
 * `CLAUDE_CONFIG_DIR` relocates settings, session history AND plugins, so
 * setting it at the runner boundary makes the whole class of leak impossible
 * rather than asking every future suite to remember.
 *
 * The path is STABLE rather than per-process on purpose. A fresh directory per
 * run would re-clone the marketplace on every invocation; that clone already
 * exceeds Claude Code's 120s git timeout on this repository, so an ephemeral
 * sandbox trades a pollution bug for a flaky, minutes-slower suite. One shared
 * sandbox keeps the marketplace cache warm exactly as the real profile did,
 * while keeping every write outside the developer's home directory. Suites that
 * need a pristine profile per test still use `useIsolatedClaudePluginState()`;
 * this is the floor beneath them, not a replacement for it.
 */
export function hostProfileSandbox(): string {
  return sandboxDirectory('safeword-test-host-profile');
}

/**
 * The throwaway `CODEX_HOME` for the same reason, with a distinct failure to
 * show for it. `codex status` reports a proof record whose `recorded_at`
 * timestamp is rewritten every time a real Codex hook fires. A suite reading
 * the developer's own ~/.codex therefore sees that field change underneath it:
 * `machine-contract` runs each public command twice and asserts identical
 * stdout, so a hook firing between the two runs failed the suite with two
 * byte-identical envelopes apart from that timestamp. Nothing was wrong with
 * the command — the test was reading the developer's live machine.
 */
export function codexHomeSandbox(): string {
  return sandboxDirectory('safeword-test-codex-home');
}

function sandboxDirectory(name: string): string {
  const directory = nodePath.join(tmpdir(), name);
  mkdirSync(directory, { recursive: true });
  return directory;
}

/** Host-profile variables a test runner must never leave pointed at the real home. */
const GUARDED_HOST_VARIABLES = [
  {
    variable: 'CLAUDE_CONFIG_DIR',
    consequence: '`claude plugin install` would write into the real ~/.claude plugin store',
    wiring: 'hostProfileSandbox()',
  },
  {
    variable: 'CODEX_HOME',
    consequence: "`codex status` would read the developer's live ~/.codex proof records",
    wiring: 'codexHomeSandbox()',
  },
] as const;

/**
 * Fails loudly when a runner reaches test execution still pointed at the
 * developer's real profile. This assertion is what keeps the sandboxes wired
 * up: drop the wiring from a runner and a test fails, rather than the leak
 * resuming silently.
 * @param environment
 */
export function assertIsolatedHostProfile(environment: NodeJS.ProcessEnv): void {
  for (const { variable, consequence, wiring } of GUARDED_HOST_VARIABLES) {
    const configured = (environment[variable] ?? '').trim();
    if (configured === '') {
      throw new Error(
        `${variable} is unset, so ${consequence} (#4776). Wire ${wiring} into this test runner.`,
      );
    }
    if (isInsideHome(configured)) {
      throw new Error(
        `${variable} points inside the home directory (${configured}), so tests would read or write the developer's real state (#4776).`,
      );
    }
  }
}

function isInsideHome(directory: string): boolean {
  const home = nodePath.resolve(homedir());
  const resolved = nodePath.resolve(directory);
  return resolved === home || resolved.startsWith(home + nodePath.sep);
}
