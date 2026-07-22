import { describe, expect, it } from 'vitest';

import {
  type BddPhase,
  getDisqualificationMessage,
  getQualityMessage,
  hasCompleteDecisionBrief,
  QUALITY_REVIEW_MESSAGE,
} from '../templates/hooks/lib/quality.js';

describe('getQualityMessage — universal binary terminal (143 + F14BG2 + QSNKBB)', () => {
  describe('Rule: Every Stop emits the binary terminal across phases', () => {
    it('intake includes the universal header with bolded verdict tokens', () => {
      const message = getQualityMessage('intake');
      expect(message).toContain('**CONFIDENT**');
      expect(message).toContain('**BLOCKED**');
      expect(message).toContain('**Tried:**');
      expect(message).toContain('**Need:**');
    });

    it('implement GREEN includes universal header AND test-pass evidence', () => {
      const message = getQualityMessage('implement', 'green');
      expect(message).toContain('**CONFIDENT**');
      expect(message).toContain('**BLOCKED**');
      expect(message.toLowerCase()).toMatch(/test|pass/);
    });

    it('verify is a valid BddPhase and emits binary header', () => {
      const phase: BddPhase = 'verify';
      const message = getQualityMessage(phase);
      expect(message).toContain('**CONFIDENT**');
      expect(message).toContain('**BLOCKED**');
    });

    it('done includes universal header AND cites /audit and /verify', () => {
      const message = getQualityMessage('done');
      expect(message).toContain('**CONFIDENT**');
      expect(message).toContain('/audit');
      expect(message).toContain('/verify');
    });

    it('no phase emits the legacy free-form list-style review prompt', () => {
      for (const phase of [
        'intake',
        'define-behavior',
        'scenario-gate',
        'implement',
        'verify',
        'done',
      ] as BddPhase[]) {
        const message = getQualityMessage(phase);
        expect(message).not.toContain('State what remains uncertain');
      }
    });

    it('unknown phase falls back to default (implement-style) binary form', () => {
      const message = getQualityMessage('unknown-phase');
      expect(message).toContain('**CONFIDENT**');
      expect(message).toContain('**BLOCKED**');
      expect(message).toBe(QUALITY_REVIEW_MESSAGE);
    });
  });

  describe('Rule: CONFIDENT carries a decision brief (Decided / Open / Next; Rejected optional)', () => {
    it('template includes bolded Decided label', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Decided:**');
    });

    it('template includes bolded Open label constrained to three terminal states', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Open:**');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('resolved this turn');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('deferred');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('none');
    });

    it('template includes bolded Next label framed as "what you\'ll do or recommend"', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Next:**');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toMatch(
        /what you'll do or recommend|do or recommend/,
      );
    });

    it('template includes bolded Rejected label as omit-when-empty', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Rejected:**');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toMatch(/omit.*if no real alternatives/);
    });
  });

  describe('Rule: BLOCKED has required structure (bolded Tried + Need; falsifiable)', () => {
    it('BLOCKED template uses bolded Tried label', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Tried:**');
    });

    it('BLOCKED template uses bolded Need label', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Need:**');
    });

    it('BLOCKED unknown must be falsifiable', () => {
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('falsifiable answer');
    });

    it('BLOCKED template includes optional parallel-action escape hatch', () => {
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('parallel action');
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toMatch(/optional/);
    });
  });

  describe('Rule: Spec-vs-implementation ambiguity contract', () => {
    it("header states implementation choices are agent's to own", () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('implementation choices are yours');
    });

    it('header states BLOCKED is for spec/scope/value decisions that need human input', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toMatch(/blocked is for.*spec/);
      expect(message.toLowerCase()).toContain('human input');
    });

    it('header includes the multiple-unknowns triage rule', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('multiple unknowns');
      expect(message.toLowerCase()).toMatch(/resolve.*small.*block.*largest/);
    });
  });

  describe('Rule: SAFEWORD.md "Talking to the user" pointer (68SRC8)', () => {
    it('header includes a pointer that re-anchors the user-facing comms rules per Stop fire', () => {
      const message = getQualityMessage('intake');
      expect(message).toMatch(/SAFEWORD\.md.*Talking to the user/i);
      expect(message.toLowerCase()).toContain('scan-not-read');
    });

    it('pointer references the load-bearing pieces (lead with the answer, end with **Next:**)', () => {
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('lead with the answer');
      expect(QUALITY_REVIEW_MESSAGE).toContain('**Next:**');
    });
  });

  describe('Rule: Decision-brief framing (F14BG2)', () => {
    it('header frames the verdict as a scannable decision brief for a time-pressed reader', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('scannable decision brief');
      expect(message.toLowerCase()).toMatch(/continue.*redirect.*intervene|reader.*choosing/);
    });

    it('header instructs to reproduce the shape exactly (Opus 4.7 literalism)', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('reproduce the shape');
    });

    it('verdict line and sub-field labels are blank-line-separated in source (renders as stacked paragraphs)', () => {
      // Structural: **CONFIDENT** line is followed by a blank line, then **Decided:** on the next paragraph.
      expect(QUALITY_REVIEW_MESSAGE).toMatch(/\*\*CONFIDENT\*\*[^\n]*\n\n\*\*Decided:\*\*/);
      // Same for BLOCKED → Tried.
      expect(QUALITY_REVIEW_MESSAGE).toMatch(/\*\*BLOCKED\*\*[^\n]*\n\n\*\*Tried:\*\*/);
    });
  });

  describe('Rule: Brevity discipline (QSNKBB) — no duplication of SAFEWORD.md', () => {
    it('header does NOT duplicate the "Authority: docs and research" rules from SAFEWORD.md:146-158', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).not.toContain('research depth');
      expect(message.toLowerCase()).not.toContain('claim weight');
      expect(message.toLowerCase()).not.toContain('primary literature');
      expect(message.toLowerCase()).not.toContain('blog posts');
      expect(message.toLowerCase()).not.toContain('investigate primary sources');
      expect(message.toLowerCase()).not.toContain('correctness/elegance/no-bloat');
    });

    it('header does NOT carry the prose-blob trigger ("not a list" / "End with a single verdict")', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).not.toContain('not a list');
      expect(message.toLowerCase()).not.toContain('end with a single verdict');
    });
  });

  describe('Rule: Universal header applies to ALL phase variants (regression guard)', () => {
    const phaseVariants: [string, string | undefined][] = [
      ['intake', undefined],
      ['define-behavior', undefined],
      ['scenario-gate', undefined],
      ['implement', undefined],
      ['implement', 'red'],
      ['implement', 'green'],
      ['implement', 'refactor'],
      ['verify', undefined],
      ['done', undefined],
      ['unknown-phase', undefined],
    ];

    it.each(phaseVariants)(
      'getQualityMessage(%s, %s) emits the full universal header',
      (phase, tddStep) => {
        const message = getQualityMessage(phase, tddStep);
        // Bolded verdict tokens
        expect(message).toContain('**CONFIDENT**');
        expect(message).toContain('**BLOCKED**');
        // CONFIDENT sub-fields (Decided/Open/Next required; Rejected present as optional label)
        expect(message).toContain('**Decided:**');
        expect(message).toContain('**Rejected:**');
        expect(message).toContain('**Open:**');
        expect(message).toContain('**Next:**');
        // BLOCKED sub-fields
        expect(message).toContain('**Tried:**');
        expect(message).toContain('**Need:**');
        // Sharpening + escape hatch
        expect(message.toLowerCase()).toContain('falsifiable answer');
        expect(message.toLowerCase()).toContain('parallel action');
        // No legacy free-form prompt leaked through
        expect(message).not.toContain('State what remains uncertain');
        // No cut prose
        expect(message.toLowerCase()).not.toContain('research depth');
        expect(message.toLowerCase()).not.toContain('investigate primary sources');
        expect(message.toLowerCase()).not.toContain('not a list');
      },
    );
  });

  describe('Rule: Per-phase criteria fully restored', () => {
    it('intake evidence cites scope/out_of_scope/done_when AND failure modes AND open questions', () => {
      const message = getQualityMessage('intake');
      expect(message).toContain('scope');
      expect(message).toContain('out_of_scope');
      expect(message).toContain('done_when');
      expect(message.toLowerCase()).toContain('failure modes');
      expect(message.toLowerCase()).toContain('open questions');
    });

    it('define-behavior evidence cites AODI AND coverage AND behaviors-not-implementation', () => {
      const message = getQualityMessage('define-behavior');
      expect(message).toContain('AODI');
      expect(message.toLowerCase()).toMatch(/happy.*failure.*edge|coverage/);
      expect(message.toLowerCase()).toContain('behaviors not implementation');
    });

    it('REFACTOR evidence cites one refactoring (not batched) AND smell-named AND no behavior change AND tests still pass', () => {
      const message = getQualityMessage('implement', 'refactor');
      expect(message.toLowerCase()).toContain('one refactoring');
      expect(message.toLowerCase()).toContain('not batched');
      expect(message.toLowerCase()).toContain('smell');
      expect(message.toLowerCase()).toContain('no behavior change');
      expect(message.toLowerCase()).toMatch(/tests.*pass/);
    });

    it('done evidence cites /audit AND /verify AND verify.md AND PR scope AND scenario coverage AND refactoring', () => {
      const message = getQualityMessage('done');
      expect(message).toContain('/audit');
      expect(message).toContain('/verify');
      expect(message).toContain('verify.md');
      expect(message.toLowerCase()).toContain('pr scope');
      expect(message.toLowerCase()).toContain('no piggybacked work');
      expect(message.toLowerCase()).toContain('scenario coverage');
      expect(message.toLowerCase()).toContain('refactoring');
    });
  });

  describe('Rule: Disqualification flags block CONFIDENT explicitly', () => {
    it('surfaces filenames when learnings nudges are pending', () => {
      const result = getDisqualificationMessage({
        pendingLearningsNudges: [
          '.safeword-project/learnings/eslint-disable-fragility.md',
          '.safeword-project/learnings/foo-bar.md',
        ],
      });
      expect(result).toContain('eslint-disable-fragility.md');
      expect(result).toContain('foo-bar.md');
      expect(result).toMatch(/next user prompt/i);
      expect(result).toContain('/quality-review');
      expect(result).not.toContain('requires /quality-review first');
    });

    it('returns explicit message naming the failure pattern when recentRelevantFailure is set', () => {
      const result = getDisqualificationMessage({
        pendingLearningsNudges: [],
        recentRelevantFailure: 'loc-exceeded',
      });
      expect(result).toContain('loc-exceeded');
      expect(result).toContain('CONFIDENT');
    });

    it('returns undefined when nudges are empty and no failure pattern is set', () => {
      const result = getDisqualificationMessage({
        pendingLearningsNudges: [],
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when the pendingLearningsNudges field is omitted entirely', () => {
      const result = getDisqualificationMessage({});
      expect(result).toBeUndefined();
    });
  });
});

describe('hasCompleteDecisionBrief (P0D33P)', () => {
  it.each([
    [
      'CONFIDENT',
      `**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.

**Next:** Review the change.`,
    ],
    [
      'BLOCKED',
      `**BLOCKED** — The required service behavior is unknown.

**Tried:** Read the current hook contract.

**Need:** A decision about the desired behavior.`,
    ],
  ])('recognizes a complete %s terminal brief', (_verdict, brief) => {
    expect(hasCompleteDecisionBrief(brief)).toBe(true);
  });

  it('rejects a CONFIDENT brief with the required paragraphs out of order', () => {
    expect(
      hasCompleteDecisionBrief(`**CONFIDENT** — The change is ready.

**Next:** Review the change.

**Decided:** Added the requested behavior.

**Open:** none.`),
    ).toBe(false);
  });

  it('rejects a CONFIDENT brief missing its Next paragraph', () => {
    expect(
      hasCompleteDecisionBrief(`**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.`),
    ).toBe(false);
  });

  it('rejects a complete brief followed by substantive prose', () => {
    expect(
      hasCompleteDecisionBrief(`**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.

**Next:** Review the change.

One more thing: this response is not terminal.`),
    ).toBe(false);
  });

  it('rejects two complete terminal briefs in one response', () => {
    expect(
      hasCompleteDecisionBrief(`**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.

**Next:** Review the change.

**BLOCKED** — A later concern remains.

**Tried:** Read the current hook contract.

**Need:** A decision about the desired behavior.`),
    ).toBe(false);
  });
});
