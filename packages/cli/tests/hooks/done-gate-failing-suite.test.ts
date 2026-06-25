/**
 * Pins the headline premise of AKNWZK: the done gate runs the test suite on the
 * close edit, and a FAILING suite blocks the close. The other done-gate tests use
 * temp projects with no package.json (suite skipped), so this is the only place
 * the "tests are the one artifact prose can't fake" path is exercised. The runner
 * and dependency check are mocked so the assertion is fast and deterministic — the
 * real spawn/timeout behaviour is covered by test-runner's own suite.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../templates/hooks/lib/dependency-readiness.js', () => ({
  getDependencyReadiness: () => ({ status: 'ready', reason: 'install_artifact_current' }),
  formatDependencyRecovery: () => 'install dependencies',
}));

vi.mock('../../templates/hooks/lib/test-runner.js', () => ({
  runTests: () => ({ passed: false, skipped: false, output: 'FAIL src/x.test.ts\n  1 failed' }),
}));

import { evaluateDoneEvidence } from '../../templates/hooks/lib/done-gate.js';

describe('evaluateDoneEvidence — failing suite (AKNWZK)', () => {
  it('blocks the close when the test suite fails, before verify.md is even read', () => {
    // Dependencies mock "ready"; tests mock "failed". The test gate runs before the
    // verify.md check, so the dummy paths are never touched — the verdict is the
    // failure reason, proving the suite gates the close.
    const verdict = evaluateDoneEvidence({
      projectDir: '/tmp/does-not-exist',
      ticketDir: '/tmp/does-not-exist/ticket',
      ticketType: 'task',
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('Tests failed');
  });
});
