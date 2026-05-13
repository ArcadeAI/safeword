/**
 * Release gate: no install lifecycle scripts.
 *
 * Why this matters: the session-auto-upgrade hook runs
 * `bunx safeword@${exactVersion} upgrade` at every session start.
 * `bunx` does not support `--ignore-scripts` (verified against Bun docs
 * 2026-05-13: https://bun.com/docs/cli/bunx), so any install lifecycle
 * script added to safeword's package.json would execute silently on
 * every user's machine on first auto-upgrade.
 *
 * 2026 npm supply-chain attacks (Shai-Hulud on @bitwarden/cli, the SAP
 * CAP stealer campaign) used preinstall/postinstall hooks to exfiltrate
 * credentials. This test ensures safeword can never inadvertently become
 * such a vector by adding a lifecycle script during normal development.
 *
 * If you need to run code at install time, reconsider:
 *   - Move logic to the CLI binary (runs only on user invocation)
 *   - Use a postpublish guard (runs in CI, not on user machines)
 *   - If truly necessary, coordinate with the auto-upgrade hook design
 *     to switch off `bunx` for an install path that supports
 *     `--ignore-scripts` (e.g. `bun install --ignore-scripts ...` +
 *     explicit binary invocation).
 *
 * Excluded from `bun run test` (release-gate only).
 * Run with: bun run test:release
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const FORBIDDEN_SCRIPT_KEYS = ['preinstall', 'install', 'postinstall'] as const;

describe('package.json install scripts', () => {
  it('should not define preinstall, install, or postinstall (supply-chain hardening)', () => {
    const packagePath = nodePath.join(import.meta.dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const offenders = FORBIDDEN_SCRIPT_KEYS.filter(key => pkg.scripts?.[key] !== undefined);

    expect(
      offenders,
      `safeword's package.json must not define install lifecycle scripts. ` +
        `Found: ${offenders.join(', ')}. ` +
        `See this test's JSDoc for rationale and alternatives.`,
    ).toEqual([]);
  });
});
