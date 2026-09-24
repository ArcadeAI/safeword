import { describe, expect, it } from 'vitest';

import * as quality from '../../templates/hooks/lib/quality.js';

const decisionRoles = [
  'concrete choice',
  'recommendation',
  'controlling reason',
  'material tradeoff or consequences',
  'exact reply',
].map(name => ({ name }));

function contractFixture() {
  return {
    version: 'terminal-handoff/v1',
    decision: { Next: decisionRoles, Need: decisionRoles },
    action: { role: 'Action', objectRole: 'Object', optionalReasonPrefix: 'Required because' },
  };
}

describe('terminal handoff contract', () => {
  it('rejects an unversioned contract', () => {
    expect(quality.validateTerminalHandoffContract({})).toEqual({
      valid: false,
      requirements: ['version', 'symmetric decision roles', 'no-decision action form'],
    });
  });

  it('rejects an asymmetric decision contract', () => {
    const contract = contractFixture();
    expect(
      quality.validateTerminalHandoffContract({
        ...contract,
        decision: {
          ...contract.decision,
          Need: contract.decision.Need.slice(1),
        },
      }),
    ).toEqual({ valid: false, requirements: ['symmetric decision roles'] });
  });

  it('rejects a contract without a no-decision action form', () => {
    const { action: _action, ...contract } = contractFixture();
    expect(quality.validateTerminalHandoffContract(contract)).toEqual({
      valid: false,
      requirements: ['no-decision action form'],
    });
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
    expect(evaluation.examinedCharacters).toBeLessThanOrEqual(
      reply.length * quality.DECISION_BRIEF_MAX_WORK_FACTOR,
    );
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
        'canonical Open route',
      ],
    });
  });

  it('distinguishes an explained marked term from an unexplained one', () => {
    const terminal =
      'Choice: release to beta or stable. Recommendation: choose beta. Reason: beta limits exposure. Impact: beta delays stable; stable increases rollback risk. Reply: `beta` or `stable`.';
    const reply = (term: string) =>
      [
        '**CONFIDENT** — The release channel requires a human choice.',
        '**Decided:** Keep the release scoped to one channel.',
        '**Open:** human: choose the release channel.',
        `**Next:** ${terminal} ${term}`,
      ].join('\n\n');

    expect(
      quality.evaluateDecisionBriefCompliance(
        reply('Term: soak = observe the release without changing it for one hour.'),
      ),
    ).toMatchObject({ compliant: true });
    expect(quality.evaluateDecisionBriefCompliance(reply('Term: soak = TBD.'))).toMatchObject({
      compliant: false,
      requirements: ['plain-language meaning'],
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

  it('accepts concrete imperative verbs without a hidden allowlist', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Merge. Object: the release branch.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: true,
      form: 'action',
    });
  });

  it('accepts a multi-word imperative containing an article', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Run the focused tests. Object: the terminal-handoff contract.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: true,
      form: 'action',
    });
  });

  it('rejects a noun phrase that does not declare a specific Object', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Release branch ready.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'action',
      requirements: ['one concrete action'],
    });
  });

  it('rejects a noncanonical Open route even when every decision role is complete', () => {
    const reply = [
      '**CONFIDENT** — The release channel requires a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** Choose a release channel.',
      '**Next:** Choice: beta or stable. Recommendation: choose beta. Reason: beta limits exposure. Impact: beta delays stable by one day. Reply: `beta` or `stable`.',
    ].join('\n\n');

    const evaluation = quality.evaluateDecisionBriefCompliance(reply);
    expect(evaluation).toMatchObject({
      compliant: false,
      form: 'decision',
      requirements: ['canonical Open route'],
    });
    const correction = quality.renderDecisionBriefCorrection(evaluation, 'Evidence stays intact.');
    expect(correction).toContain('rewrite the Open and terminal paragraphs');
    expect(correction).toContain('**Open:**');
    expect(correction).toContain('human: <one choice>');
  });

  it('accepts a canonical human Open route across a soft line break', () => {
    const reply = [
      '**CONFIDENT** — The release channel requires a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the\nrelease channel.',
      '**Next:** Choice: beta or stable. Recommendation: choose beta. Reason: beta limits exposure. Impact: beta delays stable by one day. Reply: `beta` or `stable`.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: true,
      form: 'decision',
    });
  });

  it('rejects content-free back-references with trailing filler', () => {
    const reply = [
      '**CONFIDENT** — The release channel requires a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Choice: beta or stable. Recommendation: see analysis for details. Reason: beta limits exposure. Impact: beta delays stable by one day. Reply: `beta` or `stable`.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'decision',
      requirements: ['recommendation'],
    });
  });

  it('reports leading decision prose as extra context instead of a missing choice', () => {
    const reply = [
      '**CONFIDENT** — The release channel requires a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Here is the situation. Choice: beta or stable. Recommendation: choose beta. Reason: beta limits exposure. Impact: beta delays stable by one day. Reply: `beta` or `stable`.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'decision',
      requirements: ['no extra context'],
    });
  });

  it('reports leading prose alongside missing roles and an unexplained marked term', () => {
    const reply = [
      '**CONFIDENT** — The release channel requires a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Here is the situation. Choice: beta or stable. Term: soak = TBD.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'decision',
      requirements: [
        'recommendation',
        'controlling reason',
        'material tradeoff or consequences',
        'exact reply',
        'no extra context',
        'plain-language meaning',
      ],
    });
  });

  it('rejects decision roles mixed into an otherwise complete action form', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Run. Object: the focused tests. Reply: yes.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'action',
      requirements: ['concise action form'],
    });
  });

  it('ships only evaluator-supported Open routes', () => {
    const rendered = quality.renderDecisionBriefContract();

    expect(rendered).toContain('**Open:** <human: <one choice> | none>.');
    expect(rendered).not.toContain('resolved this turn');
    expect(rendered).not.toContain('deferred to');
  });

  it('requires marked action-form terms to have a plain-language meaning', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Run. Object: the RPO checks. Term: RPO = TBD.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'action',
      requirements: ['plain-language meaning'],
    });
  });

  it('rejects extra prose after the one essential action reason', () => {
    const reply = [
      '**CONFIDENT** — The implementation is ready.',
      '**Decided:** Keep the focused patch.',
      '**Open:** none.',
      '**Next:** Action: Run. Object: the focused tests. Reason: Required because CI is blocked. Here is background the reader does not need.',
    ].join('\n\n');

    expect(quality.evaluateDecisionBriefCompliance(reply)).toMatchObject({
      compliant: false,
      form: 'action',
      requirements: ['no extra context'],
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
    expect(correction).toContain('Missing: one concrete action, no extra context.');
    expect(correction).toContain('**Next:** Action: <imperative>. Object: <specific object>.');
    expect(correction).toContain('Reason: Required because <essential reason>.');
    expect(correction).not.toContain('Choice:');
  });
});
