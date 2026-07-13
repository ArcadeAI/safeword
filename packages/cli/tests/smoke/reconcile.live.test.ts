/**
 * Live smoke of the reconcile sweep's version-provenance path (ticket B9S30R /
 * GitHub #791).
 *
 * The version path (`resolveTagDate`) is the ONE reconcile behavior that never
 * runs in CI or dev/session containers: those cannot reach `api.github.com`
 * (the proxy 403s non-MCP egress), and the path fails closed (any error →
 * `undefined`), so a production regression would be silently invisible — every
 * version-provenance issue skipped with no signal.
 *
 * This test closes that gap by hitting the real API via `resolveTagDate(
 * 'v0.68.0')`, proving the whole ref-lookup → deref → commit-date chain
 * resolves end-to-end against production instead of failing closed. v0.68.0 is
 * an *annotated* tag, so it specifically drives the annotated-tag deref branch
 * (github-rest.ts:212) — the `/git/tags/{sha}` hop a lightweight tag skips.
 *
 * Scope caveat: this proves the current `%2F`-encoded ref (`git/ref/tags%2F…`)
 * works, but does NOT discriminate `%2F` from a raw slash — GitHub's
 * `/git/ref/{ref}` accepts both, so a swap to raw-slash interpolation would
 * still pass here. The regression it truly guards is the fail-closed one: the
 * path silently returning `undefined`.
 *
 * It is token-gated and opt-in: it only runs in the live lane and only when a
 * real GitHub token is resolvable (env `GITHUB_TOKEN` or `gh auth token`). It
 * skips loudly when absent — never failing on a missing token. (One edge: in an
 * environment with `gh` auth but no `api.github.com` egress, the gate passes and
 * the fetch fails closed → the assertion fails rather than skips; that is the
 * right signal for a deliberately-invoked manual lane.)
 *
 *   bun run --cwd packages/cli test:smoke:live
 */

import { describe, expect, it } from 'vitest';

import { createReconcileTransport, resolveGitHubToken } from '../../src/retro/github-rest.js';

// v0.68.0 is a stable, released tag → commit b64b93c. We assert a *plausible*
// ISO date rather than a hardcoded one: the point is that the ref-encoding and
// deref path resolve to a real commit date, not that it equals a fixed string.
const KNOWN_TAG = 'v0.68.0';

const TOKEN = resolveGitHubToken();
const CAN_RUN = TOKEN !== undefined;

if (!CAN_RUN) {
  // Skip loudly (not a silent no-op): make it obvious in the live-lane output
  // that the one path CI can't cover went unverified this run.
  console.warn(
    `[reconcile.live] SKIPPED: no GitHub token resolvable (env GITHUB_TOKEN or \`gh auth token\`). ` +
      `The version-provenance path (resolveTagDate) is NOT verified this run.`,
  );
}

describe.skipIf(!CAN_RUN)('live smoke: reconcile version-provenance path', () => {
  it('resolves a real tag to its real commit date via %2F ref + annotated deref', async () => {
    const transport = createReconcileTransport(TOKEN);
    // With a token present, the transport is always constructed; a missing one
    // is a silent factory regression, so fail rather than skip.
    if (!transport) throw new Error('unreachable: CAN_RUN guards token presence');

    const isoDate = await transport.resolveTagDate(KNOWN_TAG);

    // Failing closed here (undefined) is the exact production regression this
    // test exists to catch — %2F encoding broken, deref branch broken, or the
    // endpoint shape changed. Any of those silently skips every version issue.
    expect(isoDate).toBeDefined();
    if (isoDate === undefined) return; // unreachable after the assertion; narrows the type

    const parsed = new Date(isoDate);
    expect(Number.isNaN(parsed.getTime())).toBe(false);

    // Plausibility, not a hardcoded value: after safeword's first release and
    // not in the future. A wrong-but-parseable date (e.g. the Unix epoch from a
    // mangled response) is still caught by the lower bound.
    expect(parsed.getTime()).toBeGreaterThan(Date.parse('2025-01-01T00:00:00Z'));
    expect(parsed.getTime()).toBeLessThanOrEqual(Date.now());

    // Surface the resolved date in live-lane output so a maintainer sees the
    // path actually reached the API, not just that assertions passed.
    console.info(`[reconcile.live] resolveTagDate(${KNOWN_TAG}) → ${isoDate}`);
  });
});
