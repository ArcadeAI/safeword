import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertIsolatedHostProfile, hostProfileSandbox } from './helpers/host-profile-sandbox.ts';

// Safeword's Claude install runs `claude plugin install` against the ambient
// host profile. When a suite runs the real CLI in a $TMPDIR project, that call
// writes a record into ~/.claude/plugins/installed_plugins.json keyed by a
// directory that is deleted seconds later, and Claude Code never prunes it —
// the file grew ~45x over five days of normal development (issue #4776).
describe('host profile isolation (#4776)', () => {
  it('keeps every vitest lane pointed away from the real plugin store', () => {
    // Runtime proof, not a config-shape assertion: this fails in whichever lane
    // loses the wiring, including lanes added after this test was written.
    expect(() => {
      assertIsolatedHostProfile(process.env);
    }).not.toThrow();
  });

  it('keeps one warm sandbox outside the home directory across runs', () => {
    // Stable, not per-process: a fresh directory each run re-clones the
    // marketplace, and that clone already exceeds Claude Code's 120s git
    // timeout on this repository.
    const directory = hostProfileSandbox();
    const temporaryRoot = nodePath.resolve(tmpdir());
    expect(directory).toBe(nodePath.join(tmpdir(), 'safeword-test-host-profile'));
    expect(directory.startsWith(temporaryRoot)).toBe(true);
    expect(existsSync(directory)).toBe(true);
  });

  it('rejects a runner that never set a profile directory', () => {
    expect(() => {
      assertIsolatedHostProfile({});
    }).toThrow(/CLAUDE_CONFIG_DIR is unset/u);
    expect(() => {
      assertIsolatedHostProfile({ CLAUDE_CONFIG_DIR: ' '.repeat(3) });
    }).toThrow(/CLAUDE_CONFIG_DIR is unset/u);
  });

  it('rejects the real home profile and anything nested under it', () => {
    for (const directory of [homedir(), nodePath.join(homedir(), '.claude')]) {
      expect(() => {
        assertIsolatedHostProfile({ CLAUDE_CONFIG_DIR: directory });
      }).toThrow(/inside the home directory/u);
    }
  });

  it('accepts a sibling directory whose path merely starts with the home string', () => {
    // `${home}-scratch` is not under `${home}/`; a prefix check without the
    // separator would reject a legitimate sandbox.
    expect(() => {
      assertIsolatedHostProfile({ CLAUDE_CONFIG_DIR: `${homedir()}-scratch` });
    }).not.toThrow();
  });
});
