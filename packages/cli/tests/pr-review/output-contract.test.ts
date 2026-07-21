import { describe, expect, it } from 'vitest';

import { createReviewJob } from '../../src/pr-review/invoke.js';

// The contract between the review PROMPT and the RUNNER.
//
// These two artifacts are written in different places by different tickets, and
// nothing but this file makes them agree. When they drifted, the failure was
// silent in the worst possible way: `verdict` parsed fine while every finding
// was filtered out, so a pull request nobody actually reviewed came back
// `reviewed` with zero findings — a clean bill of health from a broken pipe.
//
// The payload below is exactly what the skill instructs the model to emit.

const JOB = createReviewJob('a prompt');

/** A full review, in the shape the skill's Output section specifies. */
const SKILL_PAYLOAD = {
  verdict: 'needs-a-human',
  verdict_reason: 'An auth change drops a validation nothing else covers.',
  cross_model: true,
  intent_source: 'linked issue PLT-2489 (contract — predates the branch)',
  work_type: 'logic change',
  decision: 'push back',
  findings: [
    {
      dimension: 'blast-radius',
      blocking: true,
      path: 'src/auth.ts',
      line: 12,
      claim: 'The token comparison is not constant-time.',
      consequence: 'A prefix match authenticates, so a guessed prefix gets in.',
      why_it_matters: 'Any caller can escalate to an authenticated session.',
      evidence: 'src/auth.ts:12 — `if (token == expected)`',
      suggestedFix: 'timingSafeEqual(Buffer.from(token), Buffer.from(expected))',
      counter_evidence: 'none found',
      confidence: 'verified',
    },
  ],
};

describe('the prompt/runner output contract', () => {
  it('accepts every field the skill is told to emit', () => {
    const parsed = JOB.parseCodexOutput(JSON.stringify(SKILL_PAYLOAD));

    expect(parsed).toBeDefined();
    expect(parsed?.verdict).toBe('needs-a-human');
    // The finding SURVIVES. Before this contract was reconciled the skill
    // emitted `file` and `plain_language` while the parser required `path` and
    // `consequence`, so this array came back empty on every single review.
    expect(parsed?.findings).toHaveLength(1);
  });

  it('keeps the fields the gates depend on', () => {
    const parsed = JOB.parseCodexOutput(JSON.stringify(SKILL_PAYLOAD));
    const [finding] = parsed?.findings ?? [];
    if (!finding) throw new Error('the finding must survive parsing');

    // Each of these carries a rule. Dropping them silently disarms it:
    expect(finding.path).toBe('src/auth.ts'); // inline anchoring (R12)
    expect(finding.consequence).toMatch(/prefix match/); // plain language (NTB1.R1)
    expect(finding.suggestedFix).toMatch(/timingSafeEqual/); // the fix gate (R13)
  });

  it('lets the schema carry every property the payload uses', () => {
    // `additionalProperties: false` means codex's constrained decoding REJECTS
    // any field the schema omits — the model could not emit the skill's shape
    // at all, however well it followed the prompt.
    const schema = JOB.schema as {
      properties: Record<string, unknown>;
      items?: unknown;
    };
    for (const key of Object.keys(SKILL_PAYLOAD)) {
      expect(Object.keys(schema.properties)).toContain(key);
    }

    const findingSchema = (
      schema.properties.findings as { items: { properties: Record<string, unknown> } }
    ).items;
    const [firstFinding] = SKILL_PAYLOAD.findings;
    const findingKeys = Object.keys(firstFinding ?? {});
    for (const key of findingKeys) {
      expect(Object.keys(findingSchema.properties)).toContain(key);
    }
  });

  it('still rejects a verdict outside the closed set', () => {
    // Widening the schema must not widen what counts as a valid verdict — that
    // is what routes human attention.
    expect(
      JOB.parseCodexOutput(JSON.stringify({ ...SKILL_PAYLOAD, verdict: 'looks-good' })),
    ).toBeUndefined();
  });

  it('drops a finding that cannot be anchored or read', () => {
    const unusable = {
      ...SKILL_PAYLOAD,
      findings: [{ dimension: 'scope', claim: 'something', blocking: false }],
    };

    expect(JOB.parseCodexOutput(JSON.stringify(unusable))?.findings).toHaveLength(0);
  });
});
