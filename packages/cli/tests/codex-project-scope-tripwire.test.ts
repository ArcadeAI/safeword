import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, test } from 'vitest';

/**
 * TRIPWIRE — Safeword works around Codex having no project-scoped plugin
 * activation (https://github.com/openai/codex/issues/18115). This test fails
 * when that workaround may have become removable.
 *
 * The bug: Codex plugins install into the user's profile (`codex plugin add`,
 * resolved under `CODEX_HOME` / `~/.codex`), never into a repository. A profile
 * plugin's lifecycle hooks therefore fire in EVERY repository on the machine,
 * including repositories that never installed Safeword. Nothing about this is
 * loud — the hooks simply run where they were never invited and write state
 * into projects nobody enrolled.
 *
 * The workaround: `.safeword/SAFEWORD.md`, created by explicit `safeword
 * setup`, is a synthetic project-enrollment marker. Every Codex project gate
 * checks `hasSafewordProjectMarker()` first and fails open when it is absent.
 * ADR: ARCHITECTURE.md → "Explicit Project Enrollment for Profile-Scoped Codex
 * Hooks".
 *
 * When this test fails, someone changed the `@openai/codex` pin. Check
 * openai/codex#18115:
 *   - Project-scoped activation shipped → the enrollment marker is no longer
 *     load-bearing as a scope substitute. Reassess, in this order: the
 *     `hasSafewordProjectMarker` guards in
 *     `packages/cli/src/commands/codex-hook.ts`; the standalone copies in
 *     `packages/cli/templates/hooks/lib/namespace-root.ts` and
 *     `plugin/runtime/hooks/lib/namespace-root.ts`; the ADR's "Reassess when"
 *     row. Then delete this file.
 *   - Not shipped yet → re-pin `@openai/codex` to the newest version that
 *     still lacks it and bump `PINNED_VERSION` below. A red test here is the
 *     check working, not friction.
 *
 * Do NOT delete the enrollment-marker check as redundant while Codex plugins
 * remain profile-scoped. It reads as defensive dead weight from inside a
 * repository that HAS run setup — the one vantage point from which it never
 * fires. Removing it makes Safeword's Codex hooks run in every unrelated
 * repository on the user's machine.
 *
 * Scope limit, stated so nobody over-trusts this test: the pin it guards is
 * Safeword's own devDependency, exercised by the live Codex smoke — not the
 * Codex build a user runs. It fires when WE upgrade Codex, which is the moment
 * someone is already reading Codex's changelog. It does not fire on the day
 * upstream ships the fix.
 */

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

/** Newest @openai/codex known to still lack project-scoped plugin activation. */
const PINNED_VERSION = '0.149.1';

function codexPin(): unknown {
  const manifest = JSON.parse(readFileSync(nodePath.join(repoRoot, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  return manifest.devDependencies?.['@openai/codex'];
}

describe('Codex project-scope workaround (openai/codex#18115)', () => {
  test(`@openai/codex is still pinned to ${PINNED_VERSION} — read this file's header before changing`, () => {
    expect(codexPin()).toBe(PINNED_VERSION);
  });
});
