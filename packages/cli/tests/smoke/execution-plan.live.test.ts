import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { reviewTimeoutMilliseconds } from '../../src/review/runtime.js';
import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE === '1';
const MISSING_KIND_ERROR =
  'Review kind must be quality-review, scenario-gate, plan-implementation, or executable-red.';
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const LIVE_TEST_TIMEOUT_MS = REVIEW_TIMEOUT_MS + 60_000;
const temporaryDirectories: string[] = [];

const IMPLEMENTATION_PLAN = `# Implementation Plan

## Recorded decisions

- Keep the existing CLI command boundary.
- Use one generated contract for authoring and review.
`;

const CASES = [
  {
    label: 'one coherent change',
    plan: `# Execution Plan

## Pull-request slicing

Decision: one pull request.
Rationale: every edit replaces the same generated banner and one integration test proves the shared outcome; another split would add no independent review value.

### PR 1 — Replace the generated banner

- Purpose: replace the generated banner across every installed host.
- Boundary: generated banner assets and their generator only.
- Prerequisites: none.
- Proof: the installed-host integration test observes the new banner on every host.
- Completion signal: every generated host asset contains the new banner and the repository remains supported.
`,
    expected: ['Slicing decision: one pull request', 'PR 1', 'Proof'],
  },
  {
    label: 'two independent changes',
    plan: `# Execution Plan

## Pull-request slicing

Decision: multiple pull requests.
Rationale: contract delivery and command routing are independently reviewable and have separate proof.

### PR 1 — Deliver the contract

- Purpose: install the canonical Execution Plan contract.
- Boundary: contract template, schema registration, and generated assets.
- Prerequisites: none.
- Proof: installation tests compare the shipped contract bytes.
- Completion signal: every supported package contains the contract and the repository remains supported.

### PR 2 — Route review

- Purpose: route Execution Plan review through the shared coordinator.
- Boundary: review kind, packet validation, and CLI presentation.
- Prerequisites: PR 1.
- Proof: a CLI integration test observes the canonical contract at the reviewer boundary.
- Completion signal: Execution Plan review returns a typed result and the repository remains supported.
`,
    expected: ['Slicing decision: multiple pull requests', 'PR 1', 'PR 2', 'Proof'],
  },
] as const;

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe.skipIf(!CAN_RUN)('live Execution Plan review', () => {
  it.each(CASES)(
    'records the explicit slicing decision for $label',
    async testCase => {
      const directory = createTemporaryDirectory();
      temporaryDirectories.push(directory);
      const ticketDirectory = nodePath.join(
        directory,
        '.project',
        'tickets',
        'EXEC01-reviewable-delivery',
      );
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      mkdirSync(ticketDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({ crossAgentReview: 'require' }),
      );
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        '---\nid: EXEC01\ntype: feature\nphase: plan-execution\nstatus: in_progress\n---\n',
      );
      writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), IMPLEMENTATION_PLAN);
      writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), testCase.plan);

      const result = await runCli(
        [
          '--json',
          '--no-input',
          '--cwd',
          directory,
          'review',
          'run',
          'plan-execution',
          '--context',
          nodePath.join(ticketDirectory, 'impl-plan.md'),
          '--',
          nodePath.join(ticketDirectory, 'execution-plan.md'),
        ],
        {
          cwd: directory,
          env: {
            SAFEWORD_AGENT_RUNTIME: 'codex',
            SAFEWORD_NO_UPDATE_CHECK: '1',
            SAFEWORD_REVIEW_TIMEOUT_MS: String(REVIEW_TIMEOUT_MS),
          },
          timeout: LIVE_TEST_TIMEOUT_MS,
        },
      );

      const processOutput = `${result.stdout}\n${result.stderr}`;
      if (result.exitCode !== 0) {
        expect(processOutput).toContain(MISSING_KIND_ERROR);
        throw new Error(MISSING_KIND_ERROR);
      }
      const output = JSON.parse(result.stdout) as {
        data: { status: string; reviewer_output: { summary: string } };
      };
      expect(output.data.status).toBe('approved');
      for (const expected of testCase.expected) {
        expect(output.data.reviewer_output.summary).toContain(expected);
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});
