/**
 * Unit tests for the Acceptance Criteria gate (ticket 31W8M3). ACs are
 * `#### <jtbd-id>.AC<n>` headings nested under each `### JTBD` block in spec.md;
 * the gate requires ≥1 AC under each JTBD, with a per-JTBD `skip: <reason>`
 * valve. Mirrors the JTBD gate's parse + HTML-comment-skip discipline.
 */

import { describe, expect, it } from 'vitest';

import { evaluateAcGate } from '../../templates/hooks/lib/jtbd.js';

/** Wrap a Jobs-To-Be-Done body in a minimal spec.md. */
function spec(jtbdBody: string): string {
  return `## Intent\n\nx\n\n## Jobs To Be Done\n\n${jtbdBody}\n\n## Outcomes\n\ny\n`;
}

const JTBD1 =
  '### demo.PO1 — rotate keys\n**Persona:** Platform Operator (PO)\n> When I…, I want…, so I can…\n';

describe('evaluateAcGate', () => {
  it('passes a JTBD that has at least one AC (S1.1)', () => {
    expect(
      evaluateAcGate(spec(`${JTBD1}\n#### demo.PO1.AC1 — old key keeps working briefly\n`)).ok,
    ).toBe(true);
  });

  it('denies a JTBD with zero ACs and no skip, naming the JTBD (S1.2)', () => {
    const verdict = evaluateAcGate(spec(JTBD1));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('demo.PO1');
  });

  it('passes a JTBD whose AC skip has a non-empty reason (S1.3)', () => {
    expect(
      evaluateAcGate(spec(`${JTBD1}\nskip: internal plumbing — no user-observable capability\n`))
        .ok,
    ).toBe(true);
  });

  it('denies a JTBD whose AC skip reason is empty (S1.4)', () => {
    const verdict = evaluateAcGate(spec(`${JTBD1}\nskip:\n`));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/reason/i);
  });

  it('denies when one of two JTBDs is missing ACs (S1.5)', () => {
    const body = `${JTBD1}\n#### demo.PO1.AC1 — cap\n\n### demo.PO2 — audit keys\n**Persona:** Platform Operator (PO)\n> When I…, I want…, so I can…\n`;
    const verdict = evaluateAcGate(spec(body));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('demo.PO2');
  });

  it('does not count an AC heading inside an HTML comment (S1.6)', () => {
    const body = `${JTBD1}\n<!--\n#### demo.PO1.AC1 — commented example\n-->\n`;
    expect(evaluateAcGate(spec(body)).ok).toBe(false);
  });

  it('passes vacuously when the whole JTBD section is skipped (S2.1)', () => {
    expect(evaluateAcGate(spec('skip: internal plumbing — no persona-facing job\n')).ok).toBe(true);
  });
});

describe('evaluateAcGate (rule tier — V0NHT6)', () => {
  it('rule-tier.TB1.AC1.r_only_jtbd_passes_the_gate', () => {
    expect(
      evaluateAcGate(
        spec(`${JTBD1}\n#### demo.PO1.R1 — a delivery that fails retries on backoff\n`),
      ).ok,
    ).toBe(true);
  });

  it('rule-tier-convergence.SM1.R3.denial_names_rule_not_ac', () => {
    const verdict = evaluateAcGate(spec(JTBD1));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain('demo.PO1');
      expect(verdict.reason).toContain('#### <id>.R<n>');
      // Converged: the denial names only the Rule tier, never Acceptance Criteria.
      expect(verdict.reason).not.toMatch(/acceptance criteria/i);
    }
  });

  it('rule-tier.TB1.AC1.skip_line_still_passes_the_gate', () => {
    expect(
      evaluateAcGate(spec(`${JTBD1}\nskip: internal plumbing — no user-observable capability\n`))
        .ok,
    ).toBe(true);
  });

  it('rule-tier.TB1.AC4.mixed_jtbd_still_passes_the_gate', () => {
    expect(
      evaluateAcGate(
        spec(
          `${JTBD1}\n#### demo.PO1.AC1 — old key keeps working briefly\n\n#### demo.PO1.R1 — an invariant beside the AC\n`,
        ),
      ).ok,
    ).toBe(true);
  });
});
