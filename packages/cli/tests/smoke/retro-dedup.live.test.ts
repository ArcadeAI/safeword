/**
 * Live smoke of retro dedup's marker round trip (GitHub #1453).
 *
 * Dedup reads issue bodies from the REST listing endpoint and string-matches the
 * `<!-- safeword-retro-signature: ... -->` marker locally. That rests on one
 * assumption nothing in CI can reach: **the REST listing returns raw bodies with
 * HTML comments intact.** Unit tests mock `fetch`, so they pin our parsing, never
 * GitHub's actual payload — and CI/dev containers cannot reach `api.github.com`
 * (the proxy 403s non-MCP egress).
 *
 * The assumption is not idle. Some API wrappers DO strip HTML comments: the
 * GitHub MCP server's `issue_read` and `list_issues` return retro issue bodies
 * with the rendered `<sub>` attribution intact and the marker gone. If the REST
 * listing ever behaved that way, every lookup would return no match, and triage
 * would read that as "no duplicate" and re-file every finding — the exact silent
 * duplication #1453 exists to prevent.
 *
 * This is the self-test #1453 asked for ("file a marker, query it back, fail
 * loudly if the round trip returns nothing"), pointed at already-filed markers
 * rather than writing a new issue to the tracker on every run.
 *
 * It locates its own fixture — the newest open `retro` issue carrying a marker —
 * so no pinned issue number goes stale when an issue is closed.
 *
 * Token-gated and opt-in, like reconcile.live.test.ts: it runs only in the live
 * lane and only when a real GitHub token resolves, skipping loudly otherwise.
 *
 *   bun run --cwd packages/cli test:smoke:live
 */

import { describe, expect, it } from 'vitest';

import { RETRO_LABEL, signatureMarker } from '../../src/retro/draft.js';
import {
  createReconcileTransport,
  createRestTransport,
  resolveGitHubToken,
} from '../../src/retro/github-rest.js';

// The marker shape buildDraft embeds. Captures the signature so the round trip
// can be driven by a real filed value instead of a hardcoded one.
const SIGNATURE_IN_BODY = /<!-- safeword-retro-signature: (retro:[\da-f]{12}) -->/;

const TOKEN = resolveGitHubToken();
const CAN_RUN = TOKEN !== undefined;

if (!CAN_RUN) {
  // Skip loudly (not a silent no-op): make it obvious in the live-lane output
  // that the one assumption CI cannot cover went unverified this run.
  console.warn(
    `[retro-dedup.live] SKIPPED: no GitHub token resolvable (env GITHUB_TOKEN or \`gh auth token\`). ` +
      `The dedup marker round trip is NOT verified this run.`,
  );
}

describe.skipIf(!CAN_RUN)('live smoke: retro dedup marker round trip', () => {
  it('finds a real filed signature through the listing endpoint', async () => {
    const reconcile = createReconcileTransport(TOKEN);
    const transport = createRestTransport(TOKEN);
    // With a token present both factories always build; a missing one is a silent
    // factory regression, so fail rather than skip.
    if (!reconcile || !transport) throw new Error('unreachable: CAN_RUN guards token presence');

    const issues = await reconcile.listIssues({ state: 'open', labels: [RETRO_LABEL] });
    expect(issues.length).toBeGreaterThan(0);

    // THE assertion this file exists for. Retro issues always carry the marker
    // (buildDraft embeds it unconditionally), so zero of them showing one means
    // the payload dropped HTML comments — dedup is blind and files duplicates.
    const carrier = issues.find(issue => SIGNATURE_IN_BODY.test(issue.body));
    expect(
      carrier,
      `No open ${RETRO_LABEL} issue body contained a signature marker. ` +
        `Every retro issue is filed with one, so the REST listing is stripping HTML ` +
        `comments — dedup cannot see prior work and will re-file every finding (#1453).`,
    ).toBeDefined();
    if (!carrier) return; // unreachable after the assertion; narrows the type

    const [, signature = ''] = SIGNATURE_IN_BODY.exec(carrier.body) ?? [];
    expect(carrier.body).toContain(signatureMarker(signature));

    // Round trip: the same signature, through the real dedup path triage calls.
    const matches = await transport.searchBySignature(signature);
    expect(matches.map(match => match.number)).toContain(carrier.number);

    console.info(
      `[retro-dedup.live] ${signature} → #${carrier.number} ` +
        `(${issues.length} open ${RETRO_LABEL} issues enumerated)`,
    );
  });

  it('returns no match for a signature nobody has filed', async () => {
    const transport = createRestTransport(TOKEN);
    if (!transport) throw new Error('unreachable: CAN_RUN guards token presence');

    // Negative control. Without it, a lookup that matched everything — or one
    // whose marker check silently degraded to "any issue" — would pass the test
    // above while making dedup meaningless in the opposite direction.
    const matches = await transport.searchBySignature(`retro:${'f'.repeat(12)}`);

    expect(matches).toEqual([]);
  });
});
