/**
 * Pins the done-gate decision for an unavailable required runner. The test runner's
 * suite proves how `toolchainMissing` is detected; this test proves the consumer
 * turns that result into a blocking verdict rather than an advisory skip.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../templates/hooks/lib/dependency-readiness.js', () => ({
  getDependencyReadiness: () => ({ status: 'ready', reason: 'install_artifact_current' }),
  formatDependencyRecovery: () => 'install dependencies',
}));

vi.mock('../../templates/hooks/lib/test-runner.js', () => ({
  runTests: () => ({
    passed: false,
    skipped: false,
    toolchainMissing: true,
    output: 'Go test lane skipped: go is not installed.',
  }),
}));

import { evaluateDoneEvidence } from '../../templates/hooks/lib/done-gate.js';

describe('evaluateDoneEvidence — unavailable required runner', () => {
  it('blocks completion with the missing-toolchain recovery', () => {
    const verdict = evaluateDoneEvidence({
      projectDir: '/tmp/does-not-exist',
      ticketDir: '/tmp/does-not-exist/ticket',
      ticketType: 'task',
    });

    expect(verdict).toEqual({
      ok: false,
      reason:
        'Test toolchain not found — dependencies are likely not installed. Install them, then retry.\n\nGo test lane skipped: go is not installed.',
    });
  });
});
