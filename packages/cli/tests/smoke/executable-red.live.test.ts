import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { RedExecutionAttestation, ReviewerOutput } from '../../src/review/contract.js';
import { reviewTimeoutMilliseconds } from '../../src/review/runtime.js';
import {
  createRedSemanticFixture,
  matchesRedSemanticExpectation,
  RED_SEMANTIC_CASES,
  RED_SEMANTIC_LEDGER,
  RED_SEMANTIC_SCENARIO,
  type RedSemanticCase,
} from '../fixtures/executable-red-semantic.js';
import { runCliWithLiteralArguments } from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTABLE_RED_LIVE === '1';
const reviewer = process.env.SAFEWORD_EXECUTABLE_RED_LIVE_REVIEWER;
const model = process.env.SAFEWORD_EXECUTABLE_RED_LIVE_MODEL?.trim() || undefined;
const resultsPath = process.env.SAFEWORD_EXECUTABLE_RED_RESULTS_PATH;
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const results: unknown[] = [];
const reviewIds = new Set<string>();

interface ReviewEnvelope {
  data?: {
    status?: string;
    review_id?: string;
    actual_reviewer?: string;
    independence?: string;
    reviewer_output?: ReviewerOutput;
    execution_attestation?: RedExecutionAttestation;
  };
}

function configuredReviewer(): 'claude' | 'codex' {
  if (reviewer !== 'claude' && reviewer !== 'codex') {
    throw new Error('SAFEWORD_EXECUTABLE_RED_LIVE_REVIEWER must be claude or codex');
  }
  return reviewer;
}

function configureReviewer(directory: string, assigned: 'claude' | 'codex') {
  const author = assigned === 'claude' ? 'codex' : 'claude';
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReview: 'require',
      crossAgentReviewRoutes: { [author]: [{ reviewer: assigned, ...(model && { model }) }] },
    }),
  );
  return {
    cwd: directory,
    timeout: 15_000,
    env: {
      SAFEWORD_AGENT_RUNTIME: author,
      SAFEWORD_REVIEW_FOREGROUND_MS: '0',
      SAFEWORD_REVIEW_RUN_BOUND_MS: String(REVIEW_TIMEOUT_MS),
      SAFEWORD_REVIEW_TIMEOUT_MS: String(REVIEW_TIMEOUT_MS),
      ...(assigned === 'claude' && {
        CLAUDE_CONFIG_DIR: process.env.SAFEWORD_LIVE_CLAUDE_CONFIG_DIR || undefined,
      }),
      ...(assigned === 'codex' && {
        CODEX_HOME: process.env.SAFEWORD_LIVE_CODEX_HOME || undefined,
      }),
    },
  };
}

function assertSemanticResult(
  testCase: RedSemanticCase,
  assigned: 'claude' | 'codex',
  fixture: ReturnType<typeof createRedSemanticFixture>,
  envelope: ReviewEnvelope,
  gate: ReviewEnvelope,
): void {
  const data = envelope.data;
  if (!data) throw new Error('Review omitted its typed result');
  expect(data.reviewer_output?.reviewer_agent).toBe(assigned);
  expect(data.execution_attestation).toMatchObject({
    argv: fixture.argv,
    expected_failure: { literal: fixture.expectedFailure, matched: true },
    termination: { exit_code: 1, timed_out: false },
  });
  expect(data.execution_attestation?.termination.signal).toBeNull();
  expect(
    matchesRedSemanticExpectation(testCase.verdict, assigned, {
      reviewer: data.actual_reviewer,
      independence: data.independence,
      verdict: data.reviewer_output?.verdict,
      status: data.status,
      gate: gate.data?.status,
    }),
    JSON.stringify({ envelope, gate }),
  ).toBe(true);
}

async function cancelPendingReview(
  reviewId: string | undefined,
  envelope: ReviewEnvelope,
  options: Parameters<typeof runCliWithLiteralArguments>[1],
): Promise<unknown> {
  if (!reviewId || envelope.data?.status !== 'pending') return undefined;
  try {
    return await runCliWithLiteralArguments(
      ['review', 'cancel', reviewId, '--cwd', options?.cwd ?? '', '--json'],
      options,
    );
  } catch (error) {
    // Record cleanup failure alongside the original outcome, never instead of it.
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

describe.skipIf(!CAN_RUN)('live executable RED semantic conformance', () => {
  beforeAll(() => {
    expect(['claude', 'codex']).toContain(reviewer);
    expect(resultsPath).toBeTypeOf('string');
    if (!resultsPath || !nodePath.isAbsolute(resultsPath)) {
      throw new Error('SAFEWORD_EXECUTABLE_RED_RESULTS_PATH must be an absolute fresh file path');
    }
    expect(existsSync(resultsPath), 'Use a new evidence file for each run').toBe(false);
    mkdirSync(nodePath.dirname(resultsPath), { recursive: true });
    writeFileSync(resultsPath, '[]\n', { mode: 0o600, flag: 'wx' });
  });

  it.each(RED_SEMANTIC_CASES)(
    '$id',
    async testCase => {
      if (!resultsPath) {
        throw new Error('Explicit reviewer identity and evidence path are required');
      }
      const assigned = configuredReviewer();
      const fixture = createRedSemanticFixture(testCase);
      let options: Parameters<typeof runCliWithLiteralArguments>[1] = {
        cwd: fixture.directory,
        timeout: 15_000,
      };
      let envelope: ReviewEnvelope = {};
      let gate: ReviewEnvelope = {};
      let reviewId: string | undefined;
      let passed = false;
      try {
        options = configureReviewer(fixture.directory, assigned);
        const started = await runCliWithLiteralArguments(
          [
            'review',
            'run',
            'executable-red',
            '--agent-handoff',
            '--scenario',
            RED_SEMANTIC_SCENARIO,
            '--ledger',
            RED_SEMANTIC_LEDGER,
            '--proof-cwd',
            '.',
            '--evidence-class',
            'local-live-host',
            '--expected-failure',
            fixture.expectedFailure,
            '--execution-timeout',
            '10000',
            '--execute',
            JSON.stringify(fixture.argv),
            '--cwd',
            fixture.directory,
            '--json',
            '--no-input',
            '--context',
            'case.feature',
            '--context',
            'impl-plan.md',
            '--context',
            RED_SEMANTIC_LEDGER,
            '--',
            'steps.mjs',
            'actor.mjs',
            'helper.mjs',
            'cucumber.mjs',
          ],
          options,
        );
        envelope = JSON.parse(started.stdout) as ReviewEnvelope;
        reviewId = envelope.data?.review_id;
        if (!reviewId) throw new Error(`No durable review was started: ${started.stdout}`);
        const id = reviewId;
        let collected = started;
        await vi.waitFor(
          async () => {
            collected = await runCliWithLiteralArguments(
              ['review', 'status', id, '--cwd', fixture.directory, '--json'],
              options,
            );
            envelope = JSON.parse(collected.stdout) as ReviewEnvelope;
            expect(envelope.data?.status, collected.stdout).not.toBe('pending');
          },
          { timeout: REVIEW_TIMEOUT_MS + 15_000, interval: 1000 },
        );
        const gated = await runCliWithLiteralArguments(
          [
            'review',
            'gate',
            'executable-red',
            '--scenario',
            RED_SEMANTIC_SCENARIO,
            '--ledger',
            RED_SEMANTIC_LEDGER,
            '--cwd',
            fixture.directory,
            '--json',
          ],
          options,
        );
        gate = JSON.parse(gated.stdout) as ReviewEnvelope;
        expect(reviewIds.has(id), 'Every observation must use a fresh review').toBe(false);
        reviewIds.add(id);
        assertSemanticResult(testCase, assigned, fixture, envelope, gate);
        const expectedExit = testCase.verdict === 'approve' ? 0 : 2;
        expect(collected.exitCode).toBe(expectedExit);
        expect(gated.exitCode).toBe(expectedExit);
        passed = true;
      } finally {
        try {
          const cancellation = await cancelPendingReview(reviewId, envelope, options);
          results.push({
            case_id: testCase.id,
            reviewer,
            model,
            review_id: reviewId,
            expected_verdict: testCase.verdict,
            passed,
            review: envelope,
            gate,
            cancellation,
          });
          writeFileSync(resultsPath, `${JSON.stringify(results, undefined, 2)}\n`, { mode: 0o600 });
        } finally {
          rmSync(fixture.directory, { recursive: true, force: true });
        }
      }
    },
    REVIEW_TIMEOUT_MS + 90_000,
  );
});
