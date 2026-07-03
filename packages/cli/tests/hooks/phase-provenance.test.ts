/**
 * Unit tests for the phase-provenance evaluator (ticket 0KYEBN, #644 G2).
 * Pure functions — no filesystem. Pins each dimensions.md partition of
 * evaluateTicketWrite; the Cucumber lane (features/phase-provenance.feature)
 * proves the same behavior end-to-end through the hook subprocess.
 */

import { describe, expect, it } from 'vitest';

import { evaluateTicketWrite } from '../../templates/hooks/lib/phase-provenance.js';

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
