/**
 * Release gate: the copyable tracker-sync workflow must not pin a Node 24
 * release from before the June 2026 security fixes.
 *
 * Node 24.17.0 fixed two High and several Medium vulnerabilities. Keep the
 * documented workflow on that security floor or newer within the Node 24 LTS
 * line: https://nodejs.org/en/blog/release/v24.17.0
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const NODE_24_SECURITY_FLOOR = [24, 17, 0] as const;

describe('copyable tracker workflow Node version', () => {
  it('uses Node 24 at or above the June 2026 security floor', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
    const guide = readFileSync(
      nodePath.join(
        repoRoot,
        'packages/website/src/content/docs/reference/tracker-integration.mdx',
      ),
      'utf8',
    );
    const match = /node-version:\s*(\d+)\.(\d+)\.(\d+)/.exec(guide);
    expect(match, 'tracker workflow must pin an explicit Node patch release').not.toBeNull();
    if (match === null) return;

    const [, major, minor, patch] = match;
    const version = [Number(major), Number(minor), Number(patch)] as const;
    expect(version[0]).toBe(NODE_24_SECURITY_FLOOR[0]);
    expect(
      version[1] > NODE_24_SECURITY_FLOOR[1] ||
        (version[1] === NODE_24_SECURITY_FLOOR[1] && version[2] >= NODE_24_SECURITY_FLOOR[2]),
      `Node ${version.join('.')} predates the Node 24.17.0 security fixes`,
    ).toBe(true);
  });
});
