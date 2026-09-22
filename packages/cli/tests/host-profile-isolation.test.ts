import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it, vi } from 'vitest';

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

  it('resolves the same sandbox in a freshly loaded module, not a per-run directory', async () => {
    // The contract is stability ACROSS processes, so re-resolving inside one
    // process proves nothing. Load the module again with a clean registry: a
    // `mkdtemp`-style sandbox would hand back a different directory here, and
    // that regression is what re-clones the marketplace on every run — a clone
    // that already exceeds Claude Code's 120s git timeout on this repository.
    vi.resetModules();
    const reloaded = await import('./helpers/host-profile-sandbox.ts');

    expect(reloaded.hostProfileSandbox()).toBe(hostProfileSandbox());
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
