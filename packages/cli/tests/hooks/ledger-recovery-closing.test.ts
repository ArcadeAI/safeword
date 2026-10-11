// Simulated local closing boundary; actual current acceptance remains required.
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { evaluateDoneEvidence } from '../../templates/hooks/lib/done-gate.js';
import { simulatedRecoveryFixture } from '../review/ledger-recovery-fixture.js';

vi.mock('../../templates/hooks/lib/dependency-readiness.js', () => ({
  getDependencyReadiness: () => ({ status: 'ready' }),
  formatDependencyRecovery: () => 'Dependencies are missing.',
}));
vi.mock('../../templates/hooks/lib/test-runner.js', () => ({
  runTests: () => ({ passed: true, skipped: false, output: 'Simulated prerequisite: tests pass.' }),
}));

const fixtures: Awaited<ReturnType<typeof simulatedRecoveryFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  vi.unstubAllEnvs();
});

it('credits authenticated active proof in the completion composite without rewriting history', async () => {
  const fixture = await simulatedRecoveryFixture();
  fixtures.push(fixture);
  // Built runtime outside this detached project models installed runtime ownership.
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', nodePath.resolve(import.meta.dirname, '../../dist/cli.js'));
  const ticket = nodePath.join(
    fixture.root,
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy',
  );
  const ledger = nodePath.join(ticket, 'test-definitions.md');
  const before = readFileSync(ledger, 'utf8');
  writeFileSync(
    nodePath.join(ticket, 'verify.md'),
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  const check = (host?: string) =>
    evaluateDoneEvidence({
      projectDir: fixture.root,
      ticketDir: ticket,
      ticketType: 'feature',
      host,
    });
  for (const host of ['claude', 'codex', 'cursor']) {
    const verdict = check(host);
    expect(
      verdict.ok,
      `Authenticated current proof must permit ${host} closing: ${verdict.reason}`,
    ).toBe(true);
    expect(verdict.deferredCases).toHaveLength(33);
    expect(verdict.deferredCases?.every(item => item.status === 'deferred-unverified')).toBe(true);
  }
  expect(check('opencode').ok).toBe(false);
  expect(check('unknown').ok).toBe(false);
  expect(check().ok).toBe(false);
  writeFileSync(nodePath.join(ticket, 'verify.md'), '**PR Scope:** ❌ Out of scope\n');
  expect(check('codex')).toMatchObject({
    ok: false,
    reason: expect.stringContaining('PR scope failed'),
  });
  writeFileSync(
    nodePath.join(ticket, 'verify.md'),
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  const job = nodePath.join(fixture.root, '.safeword/state/reviews', `${fixture.id}.json`);
  const jobBytes = readFileSync(job, 'utf8');
  writeFileSync(job, '{}');
  expect(check('codex')).toMatchObject({
    ok: false,
    reason: expect.stringContaining('Not all scenarios are complete'),
  });
  writeFileSync(job, jobBytes);
  expect(check('codex').ok).toBe(true);
  expect(readFileSync(ledger, 'utf8')).toBe(before);
}, 60_000);
