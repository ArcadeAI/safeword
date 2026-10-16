import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ReviewAgent } from '../../src/review/contract.js';

export const RED_SEMANTIC_CASES = [
  {
    id: 'actor-assertion',
    verdict: 'approve',
    steps: ['passed', 'passed', 'failed'],
    error: 'status: pending',
  },
  { id: 'undefined-step', verdict: 'request_changes', steps: ['passed', 'undefined', 'skipped'] },
  { id: 'pending-step', verdict: 'request_changes', steps: ['passed', 'pending', 'skipped'] },
  { id: 'setup-failure', verdict: 'request_changes', steps: ['skipped', 'skipped', 'skipped'] },
  {
    id: 'unrelated-assertion',
    verdict: 'request_changes',
    steps: ['passed', 'passed', 'failed'],
    error: 'unrelated actual',
  },
] as const;

export type RedSemanticCase = (typeof RED_SEMANTIC_CASES)[number];
export const RED_SEMANTIC_SCENARIO = 'Scenario: Builder reads readiness';
export const RED_SEMANTIC_LEDGER = '.project/tickets/CASE01/test-definitions.md';
export const ACTOR_FAILURE = 'Expected actor output status: ready';

/** Labels and expectations stay in this harness, outside the bounded review packet. */
export function createRedSemanticFixture(testCase: RedSemanticCase) {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-case-'));
  const cucumberModule = import.meta.resolve('@cucumber/cucumber');
  mkdirSync(nodePath.join(directory, '.project/tickets/CASE01'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, RED_SEMANTIC_LEDGER),
    `### ${RED_SEMANTIC_SCENARIO}\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n`,
  );
  writeFileSync(
    nodePath.join(directory, 'case.feature'),
    'Feature: Read readiness\n  Scenario: Builder reads readiness\n' +
      '    Given the readiness CLI is available\n' +
      '    When the builder asks for readiness\n' +
      '    Then the builder sees status ready\n',
  );
  writeFileSync(
    nodePath.join(directory, 'impl-plan.md'),
    '# Proof plan\n\nThe primary proof invokes actor.mjs through Cucumber and asserts its stdout ' +
      'equals status: ready. Only the CLI output establishes the promised outcome. ' +
      'The missing behavior emits status: pending instead of status: ready.\n',
  );
  writeFileSync(
    nodePath.join(directory, 'actor.mjs'),
    "import { writeFileSync } from 'node:fs';\n" +
      "writeFileSync('actor-invoked', 'yes');\nprocess.stdout.write('status: pending\\n');\n",
  );
  const when = {
    'actor-assertion': 'this.output = readReadiness();',
    'undefined-step': '',
    'pending-step': "return 'pending';",
    'setup-failure': 'this.output = readReadiness();',
    'unrelated-assertion': 'this.output = readReadiness();',
  }[testCase.id];
  const assertion =
    testCase.id === 'unrelated-assertion'
      ? `assert.equal('unrelated actual', 'unrelated expected', '${ACTOR_FAILURE}');`
      : `assert.equal(this.output, 'status: ready', '${ACTOR_FAILURE}');`;
  writeFileSync(
    nodePath.join(directory, 'helper.mjs'),
    "import { spawnSync } from 'node:child_process';\n" +
      'export function readReadiness() {\n' +
      "  const result = spawnSync(process.execPath, ['actor.mjs'], { encoding: 'utf8' });\n" +
      '  if (result.error) throw result.error;\n' +
      "  if (result.status !== 0) throw new Error('CLI execution failed');\n" +
      '  return result.stdout.trim();\n}\n',
  );
  writeFileSync(
    nodePath.join(directory, 'steps.mjs'),
    `import { Given, When, Then, Before } from ${JSON.stringify(cucumberModule)};\n` +
      `import assert from 'node:assert/strict';\n` +
      `import { readReadiness } from './helper.mjs';\n${
        testCase.id === 'setup-failure'
          ? `Before(function () { throw new Error('${ACTOR_FAILURE}'); });\n`
          : ''
      }Given('the readiness CLI is available', function () { this.available = true; });\n${
        when ? `When('the builder asks for readiness', function () { ${when} });\n` : ''
      }Then('the builder sees status ready', function () { ${assertion} });\n`,
  );
  writeFileSync(nodePath.join(directory, 'cucumber.mjs'), 'export default {};\n');
  const argv = [
    process.execPath,
    fileURLToPath(new URL('../bin/cucumber.js', cucumberModule)),
    '--config',
    'cucumber.mjs',
    '--import',
    'steps.mjs',
    '--format',
    'progress',
    '--format',
    'json:run-report.json',
    'case.feature',
  ];
  const expectedFailure = {
    'actor-assertion': ACTOR_FAILURE,
    'undefined-step': 'undefined',
    'pending-step': 'pending',
    'setup-failure': ACTOR_FAILURE,
    'unrelated-assertion': ACTOR_FAILURE,
  }[testCase.id];
  return { directory, argv, expectedFailure };
}

export interface RedSemanticObservation {
  readonly reviewer?: string;
  readonly independence?: string;
  readonly verdict?: string;
  readonly status?: string;
  readonly gate?: string;
}

/** Deterministic reference scorer; it cannot substitute a gate denial for a reviewer verdict. */
export function matchesRedSemanticExpectation(
  expected: RedSemanticCase['verdict'],
  reviewer: ReviewAgent,
  observed: RedSemanticObservation,
): boolean {
  const approved = expected === 'approve';
  return (
    observed.reviewer === reviewer &&
    observed.independence === 'cross-agent' &&
    observed.verdict === expected &&
    observed.status === (approved ? 'approved' : 'changes_requested') &&
    observed.gate === (approved ? 'approved' : 'blocked')
  );
}
