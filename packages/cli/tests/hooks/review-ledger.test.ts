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
  readCrossAgentReviewPolicy,
  reviewGateAppliesToPhase,
  reviewGateForNextAsset,
  reviewScope,
  type ReviewStamp,
} from '../../templates/hooks/lib/review-ledger.js';

/** A coordinator review id, as write-review-stamp.ts records it. */
const REVIEW_ID = 'b3f1c2d4-0000-4000-8000-000000000001';

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

  it('hard cross-agent enforcement rejects degraded or opted-out evidence', () => {
    const degraded: ReviewStamp[] = [
      {
        scope: 'scenario-gate',
        author: 'claude',
        reviewer: 'claude',
        independence: 'degraded',
      },
    ];

    expect(gatePhaseAdvance('scenario-gate', degraded, 'require').ok).toBe(false);
    expect(gatePhaseAdvance('scenario-gate', [], 'require').ok).toBe(false);
  });

  it('hard cross-agent enforcement accepts distinct validated provenance', () => {
    const independent: ReviewStamp[] = [
      {
        scope: 'scenario-gate',
        author: 'claude',
        reviewer: 'codex',
        independence: 'cross-agent',
        reviewId: REVIEW_ID,
      },
    ];

    expect(gatePhaseAdvance('scenario-gate', independent, 'require')).toEqual({ ok: true });
  });

  it('hard cross-agent enforcement accepts OpenCode as a distinct reviewer', () => {
    const independent: ReviewStamp[] = [
      {
        scope: 'scenario-gate',
        author: 'claude',
        reviewer: 'opencode',
        independence: 'cross-agent',
        reviewId: REVIEW_ID,
      },
    ];

    expect(gatePhaseAdvance('scenario-gate', independent, 'require')).toEqual({ ok: true });
  });

  it('hard cross-agent enforcement rejects OpenCode reviewing its own work', () => {
    const contradictory: ReviewStamp[] = [
      {
        scope: 'scenario-gate',
        author: 'opencode',
        reviewer: 'opencode',
        independence: 'cross-agent',
      },
    ];

    expect(gatePhaseAdvance('scenario-gate', contradictory, 'require').ok).toBe(false);
  });

  it('hard cross-agent enforcement rejects a same-agent stamp that claims independence', () => {
    const contradictory: ReviewStamp[] = [
      {
        scope: 'scenario-gate',
        author: 'claude',
        reviewer: 'claude',
        independence: 'cross-agent',
      },
    ];

    expect(gatePhaseAdvance('scenario-gate', contradictory, 'require').ok).toBe(false);
  });

  it.each([
    { author: 'claude', independence: 'cross-agent' as const },
    { author: 'claude', reviewer: 'codex', independence: 'none' as const },
    { skipReason: 'review unavailable' },
  ] as const)(
    'hard cross-agent enforcement rejects incomplete or opted-out evidence: %j',
    stamp => {
      expect(
        gatePhaseAdvance('scenario-gate', [{ scope: 'scenario-gate', ...stamp }], 'require').ok,
      ).toBe(false);
    },
  );
});

/**
 * The ledger is a plain text file, so the write-time receipt check can be
 * bypassed by appending a line directly. A claim of coordinator independence
 * must therefore cite a review on the reading side too — otherwise the gate
 * reports coverage for exactly the unproven review this ticket exists to fail
 * closed on (ticket PB1GMZ).
 */
describe('an independence claim must cite a review to satisfy a gate', () => {
  const uncited: ReviewStamp = {
    scope: 'scenario-gate',
    author: 'claude',
    reviewer: 'codex',
    independence: 'cross-agent',
  };

  it('rejects a hand-written cross-agent stamp with no review id', () => {
    expect(gatePhaseAdvance('scenario-gate', [uncited], 'require').ok).toBe(false);
    expect(gatePhaseAdvance('scenario-gate', [uncited], 'prefer').ok).toBe(false);
  });

  it('rejects an uncited degraded claim', () => {
    expect(
      gatePhaseAdvance('scenario-gate', [{ ...uncited, independence: 'degraded' }], 'prefer').ok,
    ).toBe(false);
  });

  it('accepts the same stamp once it cites one', () => {
    expect(
      gatePhaseAdvance('scenario-gate', [{ ...uncited, reviewId: REVIEW_ID }], 'require'),
    ).toEqual({ ok: true });
  });

  it('gates the per-asset path on the same rule', () => {
    const scope = reviewScope('PB1GMZ', 'spec', hashArtifact('spec body'));

    expect(reviewGateForNextAsset(scope, [{ ...uncited, scope }]).ok).toBe(false);
    expect(reviewGateForNextAsset(scope, [{ ...uncited, scope, reviewId: REVIEW_ID }])).toEqual({
      ok: true,
    });
  });

  it('leaves claim-free stamps and deliberate skips alone', () => {
    expect(gatePhaseAdvance('scenario-gate', [{ scope: 'scenario-gate' }])).toEqual({ ok: true });
    expect(
      gatePhaseAdvance('scenario-gate', [
        { scope: 'scenario-gate', independence: 'none', reviewer: 'claude' },
      ]),
    ).toEqual({ ok: true });
    expect(
      gatePhaseAdvance('scenario-gate', [
        { scope: 'scenario-gate', skipReason: 'docs-only phase' },
      ]),
    ).toEqual({ ok: true });
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

  it('round-trips optional cross-agent provenance', () => {
    const line = formatReviewStamp(
      'QZAFT2:phase@scenario-gate',
      undefined,
      'codex-default',
      'claude',
      'codex',
      'cross-agent',
    );

    expect(parseReviewStamps(`ts session ${line}`)).toEqual([
      {
        scope: 'QZAFT2:phase@scenario-gate',
        model: 'codex-default',
        author: 'claude',
        reviewer: 'codex',
        independence: 'cross-agent',
      },
    ]);
  });

  it('round-trips OpenCode reviewer provenance', () => {
    const line = formatReviewStamp(
      'FZTWG0:phase@scenario-gate',
      undefined,
      undefined,
      'claude',
      'opencode',
      'cross-agent',
    );

    expect(parseReviewStamps(`ts session ${line}`)).toEqual([
      {
        scope: 'FZTWG0:phase@scenario-gate',
        author: 'claude',
        reviewer: 'opencode',
        independence: 'cross-agent',
      },
    ]);
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

  it('stays off for a phase list — Tier 1 is all-or-nothing', () => {
    expect(isReviewGateEnabled('{"reviewGate": ["scenario-gate"]}')).toBe(false);
  });
});

describe('reviewGateAppliesToPhase (selective per-phase enforcement)', () => {
  it('applies to every phase when reviewGate is true', () => {
    expect(reviewGateAppliesToPhase('{"reviewGate": true}', 'implement')).toBe(true);
    expect(reviewGateAppliesToPhase('{"reviewGate": true}', 'scenario-gate')).toBe(true);
  });

  it('applies only to the listed phases when reviewGate is a list', () => {
    const config = '{"reviewGate": ["define-behavior", "scenario-gate"]}';
    expect(reviewGateAppliesToPhase(config, 'define-behavior')).toBe(true);
    expect(reviewGateAppliesToPhase(config, 'scenario-gate')).toBe(true);
    expect(reviewGateAppliesToPhase(config, 'implement')).toBe(false);
    expect(reviewGateAppliesToPhase(config, 'done')).toBe(false);
  });

  it('ignores non-string entries rather than failing open on the whole list', () => {
    const config = '{"reviewGate": [7, "scenario-gate", null]}';
    expect(reviewGateAppliesToPhase(config, 'scenario-gate')).toBe(true);
    expect(reviewGateAppliesToPhase(config, '7')).toBe(false);
  });

  it('is off for an empty list, false, absent, and malformed config', () => {
    expect(reviewGateAppliesToPhase('{"reviewGate": []}', 'scenario-gate')).toBe(false);
    expect(reviewGateAppliesToPhase('{"reviewGate": false}', 'scenario-gate')).toBe(false);
    expect(reviewGateAppliesToPhase('{}', 'scenario-gate')).toBe(false);
    expect(reviewGateAppliesToPhase(undefined, 'scenario-gate')).toBe(false);
    expect(reviewGateAppliesToPhase('not json {', 'scenario-gate')).toBe(false);
  });
});

describe('readCrossAgentReviewPolicy', () => {
  it('defaults missing, malformed, and unknown configuration to prefer', () => {
    expect(readCrossAgentReviewPolicy()).toBe('prefer');
    expect(readCrossAgentReviewPolicy('{not json')).toBe('prefer');
    expect(readCrossAgentReviewPolicy('{"crossAgentReview":"future"}')).toBe('prefer');
  });

  it('reads require and off exactly', () => {
    expect(readCrossAgentReviewPolicy('{"crossAgentReview":"require"}')).toBe('require');
    expect(readCrossAgentReviewPolicy('{"crossAgentReview":"off"}')).toBe('off');
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
