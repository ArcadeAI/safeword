import { describe, expect, it } from 'vitest';

import * as quality from '../../templates/hooks/lib/quality.js';

describe('terminal handoff contract', () => {
  it('rejects incompatible contract shapes with stable requirements', () => {
    expect(quality.validateTerminalHandoffContract({})).toEqual({
      valid: false,
      requirements: ['version', 'symmetric decision roles', 'no-decision action form'],
    });
    expect(
      quality.validateTerminalHandoffContract({
        ...quality.TERMINAL_HANDOFF_CONTRACT,
        decision: {
          ...quality.TERMINAL_HANDOFF_CONTRACT.decision,
          Need: quality.TERMINAL_HANDOFF_CONTRACT.decision.Need.slice(1),
        },
      }),
    ).toEqual({ valid: false, requirements: ['symmetric decision roles'] });
    expect(
      quality.validateTerminalHandoffContract({
        version: quality.TERMINAL_HANDOFF_CONTRACT.version,
        decision: quality.TERMINAL_HANDOFF_CONTRACT.decision,
      }),
    ).toEqual({ valid: false, requirements: ['no-decision action form'] });
  });

  it('accepts one self-contained Next decision under the versioned contract', () => {
    const reply = [
      'The implementation and focused tests are complete. Production rollout remains intentionally separate.',
      '**CONFIDENT** — The implementation is ready, but the release target needs a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Choice: release to the beta channel or the stable channel. Recommendation: choose beta. Reason: beta limits exposure while we verify production telemetry. Impact: beta delays the stable release by one day; stable reaches everyone immediately with more rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');

    const evaluation = quality.evaluateDecisionBriefCompliance(reply) as ReturnType<
      typeof quality.evaluateDecisionBriefCompliance
    > & { contractVersion?: string; form?: string };

    expect(evaluation).toEqual({
      compliant: true,
      contractVersion: 'terminal-handoff/v1',
      form: 'decision',
      examinedCharacters: expect.any(Number),
    });
  });

  it('rejects the observed Next omission with every absent decision role named', () => {
    const reply = [
      'Verification is available now. I can run it, or I can scaffold the next feature first.',
      '**CONFIDENT** — The implementation is complete and needs a direction for the next step.',
      '**Decided:** Keep the current change intact.',
      '**Open:** Choose whether to verify or scaffold next.',
      '**Next:** Choose the intended target.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      contractVersion: 'terminal-handoff/v1',
      form: 'decision',
      requirements: [
        'concrete choice',
        'recommendation',
        'controlling reason',
        'material tradeoff or consequences',
        'exact reply',
      ],
    });
  });

  it('accepts the same complete decision form in Need', () => {
    const reply = [
      '**BLOCKED** — The release channel requires a human choice.',
      '**Tried:** Verified both release channels are available.',
      '**Need:** Choice: release to beta or stable. Recommendation: choose beta. Reason: beta limits exposure while telemetry is verified. Impact: beta delays the stable release by one day; stable reaches everyone immediately with greater rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: true,
      contractVersion: 'terminal-handoff/v1',
      form: 'decision',
    });
  });

  it('renders a versioned correction naming only the missing requirements', () => {
    const evaluation = quality.evaluateDecisionBriefCompliance(
      [
        '**CONFIDENT** — A release choice is required.',
        '**Decided:** Keep the current build.',
        '**Open:** human: choose a release channel.',
        '**Next:** Choice: beta or stable.',
      ].join('\n\n'),
    );

    const correction = quality.renderDecisionBriefCorrection(evaluation, 'Evidence stays intact.');

    expect(correction).toContain('terminal-handoff/v1');
    expect(correction).toContain(
      'Missing: recommendation, controlling reason, material tradeoff or consequences, exact reply.',
    );
    expect(correction).toContain('Choice:');
    expect(correction).toContain('Recommendation:');
    expect(correction).toContain('Reason:');
    expect(correction).toContain('Impact:');
    expect(correction).toContain('Reply:');
    expect(correction).toContain('Evidence stays intact.');
  });

  it('renders the concise action form when no human decision is open', () => {
    const evaluation = quality.evaluateDecisionBriefCompliance(
      [
        '**CONFIDENT** — The change is ready.',
        '**Decided:** Keep the focused patch.',
        '**Open:** none.',
        '**Next:** Continue.',
      ].join('\n\n'),
    );

    const correction = quality.renderDecisionBriefCorrection(evaluation, 'Evidence stays intact.');

    expect(correction).toContain('terminal-handoff/v1');
    expect(correction).toContain('Missing: one concrete action.');
    expect(correction).toContain('**Next:** Action: <imperative + specific object>.');
    expect(correction).toContain('Reason: Required because <essential reason>.');
    expect(correction).not.toContain('Choice:');
  });
});
