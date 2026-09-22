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
  const directory = nodePath.join(tmpdir(), 'safeword-test-host-profile');
  mkdirSync(directory, { recursive: true });
  return directory;
}

/**
 * Fails loudly when a runner reaches test execution still pointed at the
 * developer's real profile. This assertion is what keeps the sandbox wired up:
 * drop the wiring from a runner and a test fails, rather than the leak
 * resuming silently.
 * @param environment
 */
export function assertIsolatedHostProfile(environment: NodeJS.ProcessEnv): void {
  const configured = (environment.CLAUDE_CONFIG_DIR ?? '').trim();
  if (configured === '') {
    throw new Error(
      'CLAUDE_CONFIG_DIR is unset, so `claude plugin install` would write into the real ~/.claude plugin store (#4776). Wire hostProfileSandbox() into this test runner.',
    );
  }
  if (isInsideHome(configured)) {
    throw new Error(
      `CLAUDE_CONFIG_DIR points inside the home directory (${configured}), so test installs would pollute the developer's real plugin store (#4776).`,
    );
  }
}

function isInsideHome(directory: string): boolean {
  const home = nodePath.resolve(homedir());
  const resolved = nodePath.resolve(directory);
  return resolved === home || resolved.startsWith(home + nodePath.sep);
}
