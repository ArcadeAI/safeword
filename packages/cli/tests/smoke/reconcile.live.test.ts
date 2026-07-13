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
 * This test closes that gap by hitting the real API. It exercises two otherwise
 * unverified behaviors at once via `resolveTagDate('v0.68.0')`:
 *   1. the `%2F`-encoded ref path (`git/ref/tags%2Fv0.68.0`), and
 *   2. the annotated-vs-lightweight tag deref branch (github-rest.ts:212).
 *
 * It is token-gated and opt-in: it only runs in the live lane and only when a
 * real GitHub token is resolvable (env `GITHUB_TOKEN` or `gh auth token`). It
 * skips loudly when absent — it must never fail on missing egress or a missing
 * token, only when the live path itself regresses.
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
