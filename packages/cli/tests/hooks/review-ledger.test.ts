/**
 * Unit tests for the two-tier review-enforcement decision core (ticket NMSD94).
 * Pure functions over the review-stamp ledger — no I/O. The PreToolUse / phase
 * gates wire these to the real skill-invocation-log.
 */

import { describe, expect, it } from 'vitest';

import {
  detectPhaseAdvance,
  formatReviewStamp,
  gatePhaseAdvance,
  hashArtifact,
  isReviewGateEnabled,
  parseReviewStamps,
  reviewGateForNextAsset,
  reviewScope,
  type ReviewStamp,
} from '../../templates/hooks/lib/review-ledger.js';

describe('reviewGateForNextAsset (TB1.AC1 — per-asset stamp gates the next asset)', () => {
  it('unstamped_prior_blocks_next: denies, naming the unreviewed prior asset', () => {
    const verdict = reviewGateForNextAsset('jtbd', []);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('jtbd');
  });

  it('stamped_prior_allows_next: a real review stamp for the prior asset allows', () => {
    const stamps: ReviewStamp[] = [{ scope: 'jtbd' }];
    expect(reviewGateForNextAsset('jtbd', stamps)).toEqual({ ok: true });
  });

  it('skip_stamp_allows_next: a non-empty skip stamp for the prior asset allows', () => {
    const stamps: ReviewStamp[] = [{ scope: 'jtbd', skipReason: 'trivial — boilerplate' }];
    expect(reviewGateForNextAsset('jtbd', stamps)).toEqual({ ok: true });
  });

  it('first_asset_not_gated: no prior asset (undefined) allows', () => {
    expect(reviewGateForNextAsset(undefined, [])).toEqual({ ok: true });
  });

  it('stamp_for_other_asset_does_not_allow: a stamp keyed to a different asset denies', () => {
    const stamps: ReviewStamp[] = [{ scope: 'acs' }];
    expect(reviewGateForNextAsset('jtbd', stamps).ok).toBe(false);
  });

  it('empty_skip_reason_rejected (SM1.AC2): an empty skip reason does not satisfy the gate', () => {
    const stamps: ReviewStamp[] = [{ scope: 'jtbd', skipReason: ' '.repeat(3) }];
    expect(reviewGateForNextAsset('jtbd', stamps).ok).toBe(false);
  });
});

describe('gatePhaseAdvance (TB2.AC1 — phase advance needs an independent review stamp)', () => {
  it('no_phase_stamp_blocks_advance: no stamp for the phase denies, naming the phase', () => {
    const verdict = gatePhaseAdvance('define-behavior', []);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('define-behavior');
  });

  it('phase_stamp_allows_advance: a review stamp for the phase allows', () => {
    const stamps: ReviewStamp[] = [{ scope: 'define-behavior' }];
    expect(gatePhaseAdvance('define-behavior', stamps)).toEqual({ ok: true });
  });

  it('phase_skip_allows_advance: a non-empty skip stamp for the phase allows', () => {
    const stamps: ReviewStamp[] = [{ scope: 'define-behavior', skipReason: 'docs-only phase' }];
    expect(gatePhaseAdvance('define-behavior', stamps)).toEqual({ ok: true });
  });
});

describe('parseReviewStamps (read stamps from the skill-invocation-log)', () => {
  // Log lines are `<timestamp> <session> <entry>`; review entries are
  // `review:<artifactId>` or `review:<artifactId> skip:<reason>`.
  it('parses a real-review stamp', () => {
    const log = '2026-06-03T00:00:00Z sess-1 review:spec';
    expect(parseReviewStamps(log)).toEqual([{ scope: 'spec' }]);
  });

  it('parses a skip stamp with its reason', () => {
    const log = '2026-06-03T00:00:00Z sess-1 review:scope skip:docs-only change';
    expect(parseReviewStamps(log)).toEqual([{ scope: 'scope', skipReason: 'docs-only change' }]);
  });

  it('ignores non-review log lines (verify/audit invocations)', () => {
    const log = ['2026-06-03T00:00:00Z sess-1 verify', '2026-06-03T00:00:01Z sess-1 audit'].join(
      '\n',
    );
    expect(parseReviewStamps(log)).toEqual([]);
  });

  it('collects multiple stamps in order', () => {
    const log = [
      '2026-06-03T00:00:00Z sess-1 review:spec',
      '2026-06-03T00:00:01Z sess-1 review:scope',
    ].join('\n');
    expect(parseReviewStamps(log)).toEqual([{ scope: 'spec' }, { scope: 'scope' }]);
  });

  it('returns empty for empty input', () => {
    expect(parseReviewStamps('')).toEqual([]);
  });
});

describe('formatReviewStamp (write a stamp the gate will read — inverse of parseReviewStamps)', () => {
  it('formats a real-review stamp as review:<scope>', () => {
    expect(formatReviewStamp('NMSD94:spec@abc123')).toBe('review:NMSD94:spec@abc123');
  });

  it('formats a skip stamp as review:<scope> skip:<reason>', () => {
    expect(formatReviewStamp('NMSD94:spec@abc123', 'docs-only change')).toBe(
      'review:NMSD94:spec@abc123 skip:docs-only change',
    );
  });

  it('round-trips through parseReviewStamps (real review)', () => {
    const scope = reviewScope('NMSD94', 'spec', hashArtifact('spec body'));
    const line = `2026-06-03T00:00:00Z sess ${formatReviewStamp(scope)}`;
    expect(parseReviewStamps(line)).toEqual([{ scope }]);
  });

  it('round-trips through parseReviewStamps (skip)', () => {
    const scope = reviewScope('NMSD94', 'spec', hashArtifact('spec body'));
    const line = `2026-06-03T00:00:00Z sess ${formatReviewStamp(scope, 'trivial spec')}`;
    expect(parseReviewStamps(line)).toEqual([{ scope, skipReason: 'trivial spec' }]);
  });
});

describe('isReviewGateEnabled (default-off rollout guard)', () => {
  it('defaults to off when there is no config', () => {
    expect(isReviewGateEnabled()).toBe(false);
  });

  it('defaults to off when the flag is absent', () => {
    expect(isReviewGateEnabled('{}')).toBe(false);
  });

  it('is on only when reviewGate is explicitly true', () => {
    expect(isReviewGateEnabled('{"reviewGate": true}')).toBe(true);
  });

  it('is off when reviewGate is false', () => {
    expect(isReviewGateEnabled('{"reviewGate": false}')).toBe(false);
  });

  it('is off on malformed config (fail-safe)', () => {
    expect(isReviewGateEnabled('not json {')).toBe(false);
  });
});

describe('reviewScope + hashArtifact (ticket-qualified, content-bound stamps)', () => {
  it('hashArtifact is deterministic for the same content', () => {
    expect(hashArtifact('hello')).toBe(hashArtifact('hello'));
  });

  it('hashArtifact changes when the content changes', () => {
    expect(hashArtifact('v1')).not.toBe(hashArtifact('v2'));
  });

  it('reviewScope ties a stamp to a ticket + artifact + content hash', () => {
    expect(reviewScope('NMSD94', 'spec', 'abc123')).toBe('NMSD94:spec@abc123');
  });

  it('cross-ticket: a stamp from another ticket does not satisfy this ticket', () => {
    const stamps: ReviewStamp[] = [{ scope: reviewScope('OTHER', 'spec', 'h1') }];
    const here = reviewScope('NMSD94', 'spec', 'h1');
    expect(reviewGateForNextAsset(here, stamps).ok).toBe(false);
  });

  it('stale-after-edit: a stamp for an older content hash does not satisfy the new content', () => {
    const oldContent = 'spec v1';
    const newContent = 'spec v2';
    const stamps: ReviewStamp[] = [
      { scope: reviewScope('NMSD94', 'spec', hashArtifact(oldContent)) },
    ];
    const now = reviewScope('NMSD94', 'spec', hashArtifact(newContent));
    expect(reviewGateForNextAsset(now, stamps).ok).toBe(false);
  });

  it('matching ticket + artifact + content hash satisfies the gate', () => {
    const content = 'spec v1';
    const scope = reviewScope('NMSD94', 'spec', hashArtifact(content));
    expect(reviewGateForNextAsset(scope, [{ scope }]).ok).toBe(true);
  });
});

describe('detectPhaseAdvance (Tier 2 — the phase being exited by a ticket.md edit)', () => {
  const withPhase = (phase: string): string => `---\nid: T1\nphase: ${phase}\n---\n# T\n`;

  it('returns the exited phase when the edit changes phase', () => {
    expect(detectPhaseAdvance(withPhase('scenario-gate'), withPhase('implement'))).toBe(
      'scenario-gate',
    );
  });

  it('returns undefined when the phase is unchanged', () => {
    expect(detectPhaseAdvance(withPhase('implement'), withPhase('implement'))).toBeUndefined();
  });

  it('returns undefined when the old content has no phase (nothing to exit)', () => {
    expect(detectPhaseAdvance('---\nid: T1\n---\n', withPhase('intake'))).toBeUndefined();
  });

  it('returns undefined when the new content has no phase', () => {
    expect(detectPhaseAdvance(withPhase('intake'), '---\nid: T1\n---\n')).toBeUndefined();
  });
});
