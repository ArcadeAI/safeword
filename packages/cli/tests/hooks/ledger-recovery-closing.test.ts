// Simulated local closing boundary; actual current acceptance remains required.
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { checkFeatureScenarios } from '../../templates/hooks/lib/done-gate.js';
import { simulatedRecoveryFixture } from '../review/ledger-recovery-fixture.js';

const fixtures: Awaited<ReturnType<typeof simulatedRecoveryFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  vi.unstubAllEnvs();
});

it('credits authenticated active proof at supported local closing boundaries without rewriting history', async () => {
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
  for (const host of ['claude', 'codex', 'cursor']) {
    const verdict = checkFeatureScenarios(fixture.root, ticket, host);
    expect(
      verdict.ok,
      `Authenticated current proof must permit ${host} closing: ${verdict.reason}`,
    ).toBe(true);
  }
  expect(checkFeatureScenarios(fixture.root, ticket, 'opencode').ok).toBe(false);
  expect(checkFeatureScenarios(fixture.root, ticket).ok).toBe(false);
  const job = nodePath.join(fixture.root, '.safeword/state/reviews', `${fixture.id}.json`);
  const jobBytes = readFileSync(job, 'utf8');
  writeFileSync(job, '{}');
  expect(checkFeatureScenarios(fixture.root, ticket, 'codex').ok).toBe(false);
  writeFileSync(job, jobBytes);
  expect(checkFeatureScenarios(fixture.root, ticket, 'codex').ok).toBe(true);
  expect(readFileSync(ledger, 'utf8')).toBe(before);
}, 60_000);
