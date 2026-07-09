/**
 * Unit tests for the phase-provenance evaluator (ticket 0KYEBN, #644 G2).
 * Pure functions — no filesystem. Pins each dimensions.md partition of
 * evaluateTicketWrite; the Cucumber lane (features/phase-provenance.feature)
 * proves the same behavior end-to-end through the hook subprocess.
 */

import { describe, expect, it } from 'vitest';

import { evaluateTicketWrite } from '../../templates/hooks/lib/phase-provenance.js';

const CANONICAL_PHASE_ORDER =
  'intake → define-behavior → scenario-gate → plan-implementation → implement → verify → done';

function ticket(options: { type?: string; phase?: string; skips?: string[] }): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== undefined) lines.push(`type: ${options.type}`);
  if (options.phase !== undefined) lines.push(`phase: ${options.phase}`);
  lines.push('status: in_progress');
  if (options.skips !== undefined) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

describe('evaluateTicketWrite — creation (birth)', () => {
  it('denies a feature ticket born past intake', () => {
    const verdict = evaluateTicketWrite(undefined, ticket({ type: 'feature', phase: 'implement' }));
    expect(verdict.ok).toBe(false);
  });

  it('allows a feature ticket born at intake', () => {
    const verdict = evaluateTicketWrite(undefined, ticket({ type: 'feature', phase: 'intake' }));
    expect(verdict.ok).toBe(true);
  });

  it('allows a feature ticket born with no phase field', () => {
    const verdict = evaluateTicketWrite(undefined, ticket({ type: 'feature' }));
    expect(verdict.ok).toBe(true);
  });

  it.each(['task', 'patch', 'epic'])('allows a %s ticket born at any phase', type => {
    const verdict = evaluateTicketWrite(undefined, ticket({ type, phase: 'implement' }));
    expect(verdict.ok).toBe(true);
  });

  it('allows a typeless ticket born at any phase', () => {
    const verdict = evaluateTicketWrite(undefined, ticket({ phase: 'implement' }));
    expect(verdict.ok).toBe(true);
  });
});

describe('evaluateTicketWrite — non-feature tickets in motion', () => {
  it('allows a task ticket to advance freely', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'task', phase: 'intake' }),
      ticket({ type: 'task', phase: 'done' }),
    );
    expect(verdict.ok).toBe(true);
  });
});

describe('evaluateTicketWrite — phase_skips hatch at birth', () => {
  const FULL_SKIPS = [
    'intake: retro-ticketing scoped work',
    'define-behavior: scenarios exist as tests',
    'scenario-gate: reviewed on the PR thread',
    'plan-implementation: retro-ticketed, plan captured in PR description',
  ];

  it('allows a birth past intake when every bypassed phase is justified', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      ticket({ type: 'feature', phase: 'implement', skips: FULL_SKIPS }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('denies a partial justification naming only the unjustified phases', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      ticket({ type: 'feature', phase: 'implement', skips: ['intake: scoped in PR review'] }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      const named = /justification[^:]*:\s*([^.]*)/.exec(verdict.reason)?.[1] ?? '';
      expect(named).toContain('define-behavior');
      expect(named).toContain('scenario-gate');
      expect(named).not.toMatch(/\bintake\b/);
    }
  });

  it('denies an entry with an empty reason', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      ticket({ type: 'feature', phase: 'define-behavior', skips: ['intake:'] }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/non-empty reason/i);
  });

  it('treats a comma-split flow-style artifact (no colon) as an invalid entry', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      ticket({ type: 'feature', phase: 'define-behavior', skips: ['see PR 123'] }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/<phase>: <reason>/);
  });
});

describe('evaluateTicketWrite — CRLF line endings', () => {
  const crlf = (content: string): string => content.replaceAll('\n', '\r\n');

  it('denies a CRLF-authored feature ticket born past intake (not a false "no frontmatter")', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      crlf(ticket({ type: 'feature', phase: 'implement' })),
    );
    expect(verdict.ok).toBe(false);
    // The provenance denial, not the frontmatter-presence fallback.
    if (!verdict.ok) expect(verdict.reason).toMatch(/born at phase: intake/);
  });

  it('honors CRLF-authored phase_skips justifications', () => {
    const verdict = evaluateTicketWrite(
      undefined,
      crlf(
        ticket({
          type: 'feature',
          phase: 'implement',
          skips: ['intake: a', 'define-behavior: b', 'scenario-gate: c', 'plan-implementation: d'],
        }),
      ),
    );
    expect(verdict.ok).toBe(true);
  });
});

describe('evaluateTicketWrite — type flips are births', () => {
  it('denies a task → feature flip past intake without skips', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'task', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('denies a typeless → feature flip past intake without skips', () => {
    const verdict = evaluateTicketWrite(
      ticket({ phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('allows a flip at intake', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'task', phase: 'intake' }),
      ticket({ type: 'feature', phase: 'intake' }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('allows a flip past intake with every bypassed phase justified', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'task', phase: 'implement' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        skips: [
          'intake: retro-ticketing scoped work',
          'define-behavior: scenarios exist as tests',
          'scenario-gate: reviewed on the PR thread',
          'plan-implementation: plan captured in PR description',
        ],
      }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('allows a flip at an off-enum phase (counts as intake)', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'task', phase: 'research' }),
      ticket({ type: 'feature', phase: 'research' }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('denies repairing unparseable frontmatter into a feature past intake', () => {
    const verdict = evaluateTicketWrite(
      '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n',
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('allows repairing unparseable frontmatter into a feature at intake', () => {
    const verdict = evaluateTicketWrite(
      '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n',
      ticket({ type: 'feature', phase: 'intake' }),
    );
    expect(verdict.ok).toBe(true);
  });
});

describe('evaluateTicketWrite — canonical phase enum at creation', () => {
  it('denies a feature born at an off-enum phase, listing the canonical order', () => {
    const verdict = evaluateTicketWrite(undefined, ticket({ type: 'feature', phase: 'shape' }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain(CANONICAL_PHASE_ORDER);
    }
  });
});

describe('evaluateTicketWrite — feature phase transitions', () => {
  it('allows advancing one canonical step', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'intake' }),
      ticket({ type: 'feature', phase: 'define-behavior' }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('denies a forward jump, naming every skipped phase', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'intake' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      const named = /justification[^:]*:\s*([^.]*)/.exec(verdict.reason)?.[1] ?? '';
      expect(named).toContain('define-behavior');
      expect(named).toContain('scenario-gate');
    }
  });

  it('names all four skipped phases on the maximal jump', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'intake' }),
      ticket({ type: 'feature', phase: 'done' }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      const named = /justification[^:]*:\s*([^.]*)/.exec(verdict.reason)?.[1] ?? '';
      for (const phase of [
        'define-behavior',
        'scenario-gate',
        'plan-implementation',
        'implement',
        'verify',
      ]) {
        expect(named).toContain(phase);
      }
    }
  });

  it('accepts the one-step advance scenario-gate -> plan-implementation', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'plan-implementation' }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('denies scenario-gate -> implement as a skip, naming plan-implementation', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('plan-implementation');
  });

  it('accepts scenario-gate -> implement with a justified plan-implementation skip', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        skips: ['plan-implementation: plan captured in PR description'],
      }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('allows a forward jump when every skipped phase is justified', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'intake' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        skips: [
          'define-behavior: scenarios exist as tests',
          'scenario-gate: reviewed on the PR thread',
          'plan-implementation: plan captured in PR description',
        ],
      }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('counts an absent prior phase as intake when a phase is added', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('counts an off-enum prior phase as intake', () => {
    const oneStep = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'research' }),
      ticket({ type: 'feature', phase: 'define-behavior' }),
    );
    expect(oneStep.ok).toBe(true);
    const jump = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'research' }),
      ticket({ type: 'feature', phase: 'implement' }),
    );
    expect(jump.ok).toBe(false);
  });

  it('denies advancing into an off-enum phase, listing the canonical order', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'shipped' }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain(CANONICAL_PHASE_ORDER);
    }
  });

  it('never blocks a backward move', () => {
    const verdict = evaluateTicketWrite(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'define-behavior' }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('ignores an edit that leaves the phase untouched', () => {
    const content = ticket({ type: 'feature', phase: 'implement' });
    const verdict = evaluateTicketWrite(content, `${content}\n- work log appended\n`);
    expect(verdict.ok).toBe(true);
  });
});

describe('evaluateTicketWrite — at-rest tolerance', () => {
  it('ignores an edit that leaves an unparseable frontmatter untouched', () => {
    const raw = '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n';
    const verdict = evaluateTicketWrite(raw, `${raw}\n- work log appended\n`);
    expect(verdict.ok).toBe(true);
  });
});
