import { describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { reviewTimeoutMilliseconds, runBoundMs } from '../../src/review/runtime.js';
import { REVIEWER_CAPABILITY_MANIFEST } from '../fixtures/reviewer-capability-corpus.js';

describe('pinned reviewer capability corpus', () => {
  it('uses the production background-worker review deadline', () => {
    const settings = REVIEWER_CAPABILITY_MANIFEST.settings;
    const environment = {
      SAFEWORD_REVIEW_WORKER: '1',
      SAFEWORD_REVIEW_TIMEOUT_MS: settings.review_timeout_ms,
      SAFEWORD_REVIEW_RUN_BOUND_MS: settings.review_run_bound_ms,
    };
    expect(reviewTimeoutMilliseconds(environment)).toBe(600_000);
    expect(runBoundMs(environment)).toBe(1_800_000);
  });

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

  it('requires the approved Execution proof to exercise accepted failure boundaries', () => {
    const plan = REVIEWER_CAPABILITY_MANIFEST.fixtures.find(
      fixture => fixture.label.id === 'execution-approve',
    )?.packet.logical_files[0]?.content;
    expect(plan).toContain('crash before retry binding');
    expect(plan).toContain('interrupted review');
    expect(plan).toContain('failed status read');
    expect(plan).toContain('actual error state');
    expect(plan).toContain('receipt for another job');
    expect(plan).toContain('different plan digest under the current job');
    expect(plan).toContain('unauthenticated approval verdict');
    expect(plan).toContain('CLI process exit codes');
    expect(plan).toContain('coordinator records');
  });
});
