import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolvePrReviewConfig } from '../../src/pr-review/config.js';
import { resolveIntent, shouldReadTracker } from '../../src/pr-review/intent.js';

/** A tracker seam that counts reads instead of calling arcade. */
function countingTracker(answer?: string) {
  let calls = 0;
  return {
    calls: () => calls,
    read: (_identifier: string) => {
      calls += 1;
      return Promise.resolve(answer);
    },
  };
}

describe('autonomous-pr-review.TB1.R6 — intent, and what it costs to get it (36EEMY slice 5)', () => {
  it('autonomous-pr-review.TB1.R6.intent_falls_through_to_a_brokered_read_when_the_linkback_is_bare [carries the body]', async () => {
    const tracker = countingTracker('should not be needed');
    const intent = await resolveIntent(
      { identifier: 'PLT-2398', body: 'Count assets upserted, to gate the qwen3 cutover.' },
      tracker.read,
    );

    // The linkback already carries the contract, so the broker is never called.
    // This is the free path and must stay free — a tracker read per PR is the
    // cost R6's ladder exists to avoid.
    expect(tracker.calls()).toBe(0);
    expect(intent.kind).toBe('linkback-body');
    expect(intent.text).toContain('qwen3');
  });

  it('autonomous-pr-review.TB1.R6.intent_falls_through_to_a_brokered_read_when_the_linkback_is_bare [bare identifier]', async () => {
    const tracker = countingTracker('Acceptance: the counter reports assets, not batches.');
    const intent = await resolveIntent({ identifier: 'PLT-2398' }, tracker.read);

    // Exactly once — not zero (we would be reviewing against nothing) and not
    // repeatedly (arcade's private-team case is the expensive path).
    expect(tracker.calls()).toBe(1);
    expect(intent.kind).toBe('brokered');
    expect(intent.text).toContain('assets, not batches');
  });

  it('degrades to the bare identifier when the broker cannot answer', async () => {
    // The common case, not an edge: an author who never authorized the tracker
    // raises an OAuth interrupt that CI cannot satisfy, since no human is there
    // to complete it. That must not fail the review — it lowers what the
    // review may claim (R7).
    const unauthorized = countingTracker();
    const intent = await resolveIntent({ identifier: 'PLT-2398' }, unauthorized.read);

    expect(unauthorized.calls()).toBe(1);
    expect(intent.kind).toBe('bare-identifier');
  });

  it('survives a broker that throws rather than failing the review', async () => {
    const intent = await resolveIntent({ identifier: 'PLT-2398' }, () =>
      Promise.reject(new Error('arcade unreachable')),
    );
    expect(intent.kind).toBe('bare-identifier');
  });

  it('reports no intent when there is no linkback at all', async () => {
    const intent = await resolveIntent({}, countingTracker('x').read);
    expect(intent.kind).toBe('none');
  });
});

describe('a shared tracker identity is never used on a fork', () => {
  // While the reviewer reads the tracker through ONE service account rather
  // than as each PR author, its findings quote ticket contents into a PR
  // comment. On a fork that is a disclosure channel: someone who cannot read
  // the ticket opens a PR and the reviewer prints it for them. Gate the read,
  // and let R6's bare-linkback fallback cover those PRs.
  it('refuses the tracker on a fork while the identity is shared', () => {
    expect(shouldReadTracker({ isFork: true, identityMode: 'shared' })).toBe(false);
  });

  it('allows it on a same-repo pull request, where readers already have access', () => {
    expect(shouldReadTracker({ isFork: false, identityMode: 'shared' })).toBe(true);
  });

  it('allows it on a fork once identity is brokered per author', () => {
    // Per-author brokering closes the hole by construction: the reviewer reads
    // exactly what the author could, so it can disclose nothing new to them.
    expect(shouldReadTracker({ isFork: true, identityMode: 'per-author' })).toBe(true);
  });
});

describe('prReview config — default-off, and unreadable config never enables it', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'pr-review-config-'));
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const writeConfig = (config: unknown) => {
    writeFileSync(nodePath.join(directory, '.safeword', 'config.json'), JSON.stringify(config));
  };

  it('defaults to disabled when no config exists', () => {
    const config = resolvePrReviewConfig(directory);
    expect(config.enabled).toBe(false);
    expect(config.post).toBe(false);
  });

  it('fails CLOSED on malformed config rather than assuming enabled', () => {
    writeFileSync(nodePath.join(directory, '.safeword', 'config.json'), '{ not json');
    expect(resolvePrReviewConfig(directory).enabled).toBe(false);
  });

  it('reads the switch, the arcade identity, and the required-check override', () => {
    writeConfig({
      prReview: {
        enabled: true,
        post: true,
        arcade: { userId: 'safeword-pr-reviewer' },
        requiredChecks: ['ci/build'],
      },
    });

    const config = resolvePrReviewConfig(directory);
    expect(config.enabled).toBe(true);
    expect(config.post).toBe(true);
    expect(config.arcadeUserId).toBe('safeword-pr-reviewer');
    expect(config.requiredChecks).toEqual(['ci/build']);
  });

  it('treats a configured arcade user id as the SHARED identity mode', () => {
    writeConfig({ prReview: { enabled: true, arcade: { userId: 'safeword-pr-reviewer' } } });
    expect(resolvePrReviewConfig(directory).identityMode).toBe('shared');
  });

  it('assumes SHARED identity when none is configured — the safe default', () => {
    // Corrected 2026-07-20 (independent review). An earlier version of this test
    // pinned `per-author` here, which failed OPEN on the security-relevant field:
    // per-author brokering is not implemented yet, so the runtime identity is a
    // shared service account no matter what this says — and `per-author` is what
    // re-enables tracker reads on forks. Absence of config must not be read as
    // the more permissive mode.
    writeConfig({ prReview: { enabled: true } });
    expect(resolvePrReviewConfig(directory).identityMode).toBe('shared');
  });

  it('is shared even when the reviewer is disabled entirely', () => {
    expect(resolvePrReviewConfig(directory).identityMode).toBe('shared');
  });
});
