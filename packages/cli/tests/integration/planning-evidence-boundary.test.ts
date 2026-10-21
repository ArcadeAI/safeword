import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { parseReviewerOutput, reviewOutputSchema } from '../../src/review/runtime.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';

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

  it('refuses a new planning verdict that omits evidence records', () => {
    const { evidence_records: _ignored, ...missing } = reviewerOutput(evidence);
    expect(() =>
      parseReviewerOutput(
        'claude',
        JSON.stringify(missing),
        'plan-implementation',
        'plan-implementation',
      ),
    ).toThrow('invalid reviewer output');
    expect(() =>
      parseReviewerOutput('claude', JSON.stringify(missing), 'quality-review', 'product-plan'),
    ).toThrow('invalid reviewer output');
    expect(parseReviewerOutput('claude', JSON.stringify(missing), 'quality-review')).toEqual(
      missing,
    );
  });
});

it('names missing source limits after a complete owned plan can prepare for dispatch', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-evidence-admission-'));
  try {
    const ticket = '.project/tickets/EVID42-evidence';
    const target = `${ticket}/impl-plan.md`;
    mkdirSync(nodePath.join(root, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(root, ticket, 'ticket.md'),
      '---\nid: EVID42\ntype: feature\nproduct_plan_contract: v1\n---\n# Ticket\n',
    );
    writeFileSync(nodePath.join(root, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    writePlanningInventories(root);
    const writePlan = (record: Record<string, unknown>) => {
      writeFileSync(
        nodePath.join(root, target),
        [
          '# Implementation Plan',
          '## Decisions',
          '### Recorded Decisions',
          '#### PlanEvidenceRecordV1',
          '```json',
          JSON.stringify({ schema_version: 1, ...record }),
          '```',
        ].join('\n'),
      );
      writeImplementationRoleInputs(root, target, 'evidence.feature');
    };
    writePlan(evidence);
    const prepared = prepareReviewPacket(root, 'plan-implementation', [target]);
    expect(prepared.packet.logical_files).toContainEqual(expect.objectContaining({ path: target }));
    prepared.cleanup();
    const { security_limit: _omitted, ...incomplete } = evidence;
    writePlan(incomplete);
    expect(() => prepareReviewPacket(root, 'plan-implementation', [target])).toThrow(
      /PlanEvidenceRecordV1.*security_limit/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
