import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertIsolatedHostProfile, hostProfileSandbox } from './helpers/host-profile-sandbox.ts';

// Safeword's Claude install runs `claude plugin install` against the ambient
// host profile. When a suite runs the real CLI in a $TMPDIR project, that call
// writes a record into ~/.claude/plugins/installed_plugins.json keyed by a
// directory that is deleted seconds later, and Claude Code never prunes it —
// the file grew ~45x over five days of normal development (issue #4776).
describe('host profile isolation (#4776)', () => {
  it('keeps every vitest lane pointed at the sandbox, not the real plugin store', () => {
    // Runtime proof, not a config-shape assertion: this fails in whichever lane
    // loses the wiring, including lanes added after this test was written.
    // Asserting the exact directory rather than `not.toThrow()` also catches a
    // lane wired to some other profile that merely happens to sit outside home.
    expect(process.env.CLAUDE_CONFIG_DIR).toBe(hostProfileSandbox());
  });

  it('resolves the same sandbox from two separate processes', () => {
    // Genuinely separate processes, not `vi.resetModules()`: a clean module
    // registry still shares this process, so a per-run sandbox keyed on
    // something process-stable — `safeword-test-host-profile-${process.pid}`
    // being the obvious one — would pass a reload comparison while handing every
    // runner invocation a fresh profile. That regression re-clones the
    // marketplace on each run, and that clone already exceeds Claude Code's
    // 120s git timeout on this repository.
    const [first, second] = [resolveSandboxInChildProcess(), resolveSandboxInChildProcess()];

    expect(first.pid).not.toBe(second.pid);
    expect(first.directory).toBe(second.directory);
    expect(first.directory).toBe(hostProfileSandbox());
  });

  it('creates the sandbox inside the temp root so the host can write to it', () => {
    const directory = hostProfileSandbox();

    expect(existsSync(directory)).toBe(true);
    expect(nodePath.dirname(directory)).toBe(nodePath.resolve(tmpdir()));
  });

  it.each([
    ['an unset profile directory', {}, /CLAUDE_CONFIG_DIR is unset/u],
    ['a whitespace-only profile directory', { CLAUDE_CONFIG_DIR: ' ' }, /is unset/u],
    ['the home directory itself', { CLAUDE_CONFIG_DIR: homedir() }, /inside the home directory/u],
    [
      'the real profile nested under home',
      { CLAUDE_CONFIG_DIR: nodePath.join(homedir(), '.claude') },
      /inside the home directory/u,
    ],
  ])('rejects %s', (_label, environment, expected) => {
    expect(() => {
      assertIsolatedHostProfile(environment);
    }).toThrow(expected);
  });

  it('accepts a sibling directory whose path merely starts with the home string', () => {
    // `${home}-scratch` is not under `${home}/`; a prefix check without the
    // separator would reject a legitimate sandbox, so this pins the separator.
    expect(() => {
      assertIsolatedHostProfile({ CLAUDE_CONFIG_DIR: `${homedir()}-scratch` });
    }).not.toThrow();
  });
});

/**
 * Resolves the sandbox in a child process, reporting its pid so the caller can
 * prove the two resolutions really did come from different processes.
 */
function resolveSandboxInChildProcess(): { directory: string; pid: string } {
  const moduleUrl = pathToFileURL(
    nodePath.join(import.meta.dirname, 'helpers/host-profile-sandbox.ts'),
  ).href;
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `import { hostProfileSandbox } from ${JSON.stringify(moduleUrl)};
       process.stdout.write(hostProfileSandbox() + '|' + process.pid);`,
    ],
    { encoding: 'utf8' },
  );
  const [directory, pid] = output.trim().split('|', 2);
  return { directory: directory ?? '', pid: pid ?? '' };
}
