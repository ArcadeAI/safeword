import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { assertTestCliFresh, runCli } from '../helpers.js';

const REVIEW_KEY = Buffer.alloc(32, 7);

function writeApprovedReview(
  root: string,
  kind: 'scenario-gate' | 'plan-implementation',
  target: string,
  reviewId: string,
): void {
  const result = {
    schema_version: 1,
    ok: true,
    state: 'healthy',
    changed: false,
    findings: [],
    effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
    errors: [],
    recovery: [],
    next_actions: [],
    data: {
      command: 'review run',
      status: 'approved',
      review_kind: kind,
      review_targets: [target],
      author_agent: 'codex',
      actual_reviewer: 'claude',
      independence: 'cross-agent',
    },
  };
  const record = {
    schema_version: 1,
    id: reviewId,
    state: 'completed',
    kind,
    targets: [target],
    context: [],
    source_fingerprint: 'a'.repeat(64),
    started_at: '2026-09-18T00:00:00.000Z',
    updated_at: '2026-09-18T00:00:01.000Z',
    result,
  };
  const integrity = createHmac('sha256', REVIEW_KEY)
    .update(realpathSync.native(root))
    .update('\0')
    .update(JSON.stringify(record))
    .digest('hex');
  const reviewDirectory = nodePath.join(root, '.safeword', 'state', 'reviews');
  mkdirSync(reviewDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(reviewDirectory, `${reviewId}.json`),
    `${JSON.stringify({ ...record, integrity })}\n`,
  );
}

function featureFixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-coding-authorization-'));
  const ticketFolder = 'ABC123-feature';
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', ticketFolder);
  const featureTarget = 'features/feature.feature';
  const implementationTarget = `.project/tickets/${ticketFolder}/impl-plan.md`;
  const scenarioReviewId = '11111111-1111-4111-8111-111111111111';
  const implementationReviewId = '22222222-2222-4222-8222-222222222222';
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  mkdirSync(nodePath.join(root, '.claude', 'plans'), { recursive: true });
  mkdirSync(nodePath.join(root, '.review-keys', 'safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    '---\ntype: feature\nphase: implement\n---\n',
  );
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), '# Implementation Plan\n');
  writeFileSync(nodePath.join(root, featureTarget), 'Feature: Accepted behavior\n');
  writeFileSync(
    nodePath.join(root, '.claude', 'plans', 'execution.md'),
    '# Host-local execution notes\n',
  );
  writeFileSync(
    nodePath.join(root, '.review-keys', 'safeword', 'review-integrity.key'),
    `${REVIEW_KEY.toString('hex')}\n`,
  );
  writeApprovedReview(root, 'scenario-gate', featureTarget, scenarioReviewId);
  writeApprovedReview(root, 'plan-implementation', implementationTarget, implementationReviewId);
  writeFileSync(
    nodePath.join(root, '.project', 'skill-invocations.log'),
    [
      `2026-09-18T00:00:02.000Z fixture review:${ticketFolder}:phase@scenario-gate author:codex reviewer:claude independence:cross-agent review-id:${scenarioReviewId}`,
      `2026-09-18T00:00:03.000Z fixture review:${ticketFolder}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${implementationReviewId}`,
      '',
    ].join('\n'),
  );
  return root;
}

describe('coding authorization', () => {
  beforeAll(assertTestCliFresh);

  it('rejects host-local notes when the project-local Execution Plan is missing', async () => {
    const root = featureFixture();

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(
      invoked.exitCode,
      'coding authorization should return the typed missing project-local Execution Plan denial',
    ).toBe(2);
    expect(() => JSON.parse(invoked.stdout)).not.toThrow();
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data: { command: string; coding_authorization: string; grants_authority: boolean };
    };
    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'denied',
        grants_authority: false,
      },
    });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
    expect(readFileSync(nodePath.join(root, '.claude', 'plans', 'execution.md'), 'utf8')).toBe(
      '# Host-local execution notes\n',
    );
  });
});
