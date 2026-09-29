import { describe, expect, it } from 'vitest';

import { parseReviewerOutput, reviewOutputSchema } from '../../src/review/runtime.js';

const evidence = {
  source_identity: 'https://example.org/guide',
  checked_version: '1.2.3',
  source_version: '1.2.3',
  target_version: '1.2.3',
  supported_claim: 'The documented API supports this operation.',
  license_identifier: 'Apache-2.0',
  attribution_notice: 'Credit Example',
  redistribution_limit: 'retain NOTICE',
  security_limit: 'do not execute retrieved code',
  privacy_limit: 'none_declared',
  reuse_limit: 'none_declared',
};

function reviewerOutput(record: Record<string, unknown>) {
  return {
    schema_version: 1,
    dispatch_id: 'evidence-dispatch',
    reviewer_agent: 'claude',
    verdict: 'approve',
    summary: 'The accepted plan is supported by public evidence.',
    findings: [],
    evidence_records: { schema_version: 1, records: [record] },
  };
}

describe('planning review evidence boundary', () => {
  it('retains declared source and reuse limits in a versioned reviewer result', () => {
    const output = reviewerOutput(evidence);
    expect(parseReviewerOutput('claude', JSON.stringify(output), 'plan-implementation')).toEqual(
      output,
    );
    const schema = JSON.parse(reviewOutputSchema('plan-implementation'));
    expect(schema.properties.evidence_records).toBeDefined();
    expect(schema.required).toContain('evidence_records');
  });

  it('rejects a malformed evidence record instead of silently dropping its limits', () => {
    const incomplete = { ...evidence };
    delete (incomplete as Partial<typeof evidence>).redistribution_limit;
    expect(() =>
      parseReviewerOutput(
        'claude',
        JSON.stringify(reviewerOutput(incomplete)),
        'plan-implementation',
      ),
    ).toThrow('invalid reviewer output');
    expect(() =>
      parseReviewerOutput(
        'claude',
        JSON.stringify(reviewerOutput({ ...evidence, license_identifier: '' })),
        'plan-implementation',
      ),
    ).toThrow('invalid reviewer output');
  });

  it('requires evidence records for Product review output without changing ordinary quality review', () => {
    const productSchema = JSON.parse(reviewOutputSchema('quality-review', 'product-plan'));
    const qualitySchema = JSON.parse(reviewOutputSchema('quality-review'));
    expect(productSchema.required).toContain('evidence_records');
    expect(qualitySchema.properties.evidence_records).toBeUndefined();
  });
});
