import { describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { REVIEWER_CAPABILITY_MANIFEST } from '../fixtures/reviewer-capability-corpus.js';

describe('pinned reviewer capability corpus', () => {
  it('pairs an approval and a blocking defect in each planning phase', () => {
    const fixtures = REVIEWER_CAPABILITY_MANIFEST.fixtures;
    expect(fixtures.map(({ label }) => label.id)).toEqual([
      'product-approve',
      'product-reject',
      'implementation-approve',
      'implementation-reject',
      'execution-approve',
      'execution-reject',
    ]);
    for (let index = 0; index < fixtures.length; index += 2) {
      const approval = fixtures[index];
      const rejection = fixtures[index + 1];
      if (approval === undefined || rejection === undefined) throw new Error('Incomplete pair');
      expect(approval.label.verdict).toBe('approve');
      expect(rejection.label.verdict).toBe('request_changes');
      expect(rejection.label.required.length).toBeGreaterThan(0);
      expect(approval.packet.kind).toBe(rejection.packet.kind);
      expect(approval.packet.planning_phase).toBe(rejection.packet.planning_phase);
      expect(approval.packet.context_files).toEqual(rejection.packet.context_files);
      expect(approval.packet.logical_files).not.toEqual(rejection.packet.logical_files);
      expect(approval.packet.dispatch_id).toBe(approval.label.id);
      expect(rejection.packet.dispatch_id).toBe(rejection.label.id);
    }
  });

  it('derives each Execution packet identity and delivery definition from its own plan', () => {
    const executionFixtures = REVIEWER_CAPABILITY_MANIFEST.fixtures.slice(-2);
    for (const { packet } of executionFixtures) {
      const plan = packet.logical_files[0]?.content;
      if (plan === undefined) throw new Error('Missing Execution Plan');
      const parsed = parseDeliveryPlanContract(plan);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(packet.execution_plan_delivery_definition).toEqual(
        createExecutionPlanDeliveryDefinition(parsed, false),
      );
      expect(packet.execution_plan_normalized_digest).toBe(normalizedExecutionPlanDigest(plan));
    }
  });
});
