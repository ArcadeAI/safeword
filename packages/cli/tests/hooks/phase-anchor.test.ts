/**
 * Unit tests for the phase-transition anchor detector (ticket RM84M8, #809).
 * Pure function — no filesystem. Pins each dimensions.md partition of
 * detectUnanchoredPhaseTransition; the Cucumber lane
 * (features/evidence-anchored-phase-transitions.feature) proves the same
 * behavior end-to-end. Reachability partitions inject a stub ShaResolver,
 * mirroring ledger-validation.test.ts — the detector never touches git.
 */

import { describe, expect, it } from 'vitest';

import { detectUnanchoredPhaseTransition } from '../../templates/hooks/lib/phase-provenance.js';

/** A well-formed 7-hex abbreviated SHA. */
const SHA = 'a1b2c3d';

function ticket(options: { type?: string; phase?: string; anchors?: string[] }): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== undefined) lines.push(`type: ${options.type}`);
  if (options.phase !== undefined) lines.push(`phase: ${options.phase}`);
  lines.push('status: in_progress');
  if (options.anchors !== undefined) {
    lines.push('phase_anchors:');
    for (const entry of options.anchors) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

describe('detectUnanchoredPhaseTransition — a valid anchor for the entered phase is anchored', () => {
  it('a well-formed anchor for the entered phase is anchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${SHA}`] }),
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('only the entered phase needs an anchor on a multi-step advance', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'verify', anchors: [`verify: ${SHA}`] }),
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('a rebased anchor that canonicalizes to a reachable commit is anchored', () => {
    const resolveToCanonical = () => 'f00dcafe';
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${SHA}`] }),
      resolveToCanonical,
    );
    expect(verdict.kind).toBe('anchored');
  });
});

describe('detectUnanchoredPhaseTransition — no valid anchor for the entered phase is unanchored', () => {
  it('no phase_anchors block at all is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('a phase_anchors block naming only an earlier phase is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`define-behavior: ${SHA}`] }),
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('a non-hex anchor is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: ['implement: zzzzzzz'] }),
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('an empty anchor value is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: ['implement:'] }),
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('an anchor unreachable from HEAD is unanchored under git resolution', () => {
    const resolveUnreachable = () => false;
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${SHA}`] }),
      resolveUnreachable,
    );
    expect(verdict.kind).toBe('unanchored');
  });
});

describe('detectUnanchoredPhaseTransition — fires only on a feature forward advance', () => {
  it('a backward phase move is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'define-behavior' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('re-declaring the same phase is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it.each(['task', 'patch', 'epic'])('a %s ticket advancing is not flagged', type => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type, phase: 'define-behavior' }),
      ticket({ type, phase: 'implement' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a typeless ticket advancing is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ phase: 'define-behavior' }),
      ticket({ phase: 'implement' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a ticket becoming a feature past intake is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'task', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('an edit that leaves the phase unchanged is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      `${ticket({ type: 'feature', phase: 'implement' })}\nan extra body line\n`,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a creation (no prior) is not flagged — a birth is not a transition', () => {
    const verdict = detectUnanchoredPhaseTransition(
      undefined,
      ticket({ type: 'feature', phase: 'intake' }),
    );
    expect(verdict.kind).toBe('not-applicable');
  });
});
