import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import { PACKAGED_CAPABILITY_PAIRS } from '../../src/review/capability-catalogue.js';
import { reviewTimeoutMilliseconds } from '../../src/review/runtime.js';
import {
  assertTestCliFresh,
  createConfiguredProject,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const CAN_RUN = process.env.SAFEWORD_RUN_PLANNING_MODEL_LIVE === '1';
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const LIVE_TIMEOUT_MS = REVIEW_TIMEOUT_MS + 90_000;

describe.skipIf(!CAN_RUN)('live packaged planning reviewer model confirmation', () => {
  it.each([
    { author: 'claude', reviewer: 'codex', provider: 'openai' },
    { author: 'codex', reviewer: 'claude', provider: 'anthropic' },
  ] as const)(
    'confirms the exact packaged $reviewer selector through the public coordinator',
    async ({ author, reviewer, provider }) => {
      assertTestCliFresh();
      const pairs = PACKAGED_CAPABILITY_PAIRS.filter(
        record =>
          record.reviewer_provider === provider &&
          record.author_provider === (provider === 'openai' ? 'anthropic' : 'openai') &&
          record.qualification !== 'unqualified',
      );
      expect(pairs, 'The packaged reviewer must have one exact qualified selector').toHaveLength(1);
      const pair = pairs[0];
      if (pair === undefined) throw new Error('Packaged reviewer selector is missing');
      const profile =
        reviewer === 'codex'
          ? process.env.SAFEWORD_PLANNING_MODEL_LIVE_CODEX_HOME
          : process.env.SAFEWORD_PLANNING_MODEL_LIVE_CLAUDE_CONFIG_DIR;
      expect(
        profile,
        'Live proof requires an explicitly authenticated reviewer profile',
      ).toBeTruthy();
      if (!profile) throw new Error('Live reviewer profile is missing');
      const profileEnvironment: Record<string, string> = {};
      if (reviewer === 'codex') profileEnvironment.CODEX_HOME = profile;
      else if (profile !== 'default') profileEnvironment.CLAUDE_CONFIG_DIR = profile;

      const directory = createTemporaryDirectory();
      try {
        await createConfiguredProject(directory);
        writePlanningInventories(directory);
        const configPath = nodePath.join(directory, '.safeword/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        writeFileSync(
          configPath,
          JSON.stringify({
            ...config,
            crossAgentReview: 'require',
            crossAgentReviewRoutes: {
              [author]: [{ reviewer, model: pair.reviewer_model }],
            },
          }),
        );
        writeFileSync(
          nodePath.join(directory, 'spec.md'),
          '# Preserve review authority\n\nPersona: Builder (BU).\n\nWhen no authenticated review receipt exists, the builder needs advancement denied so unreviewed work cannot advance.\n\nRule: advancement requires an authenticated review receipt.\n',
        );
        writeFileSync(
          nodePath.join(directory, 'behavior.feature'),
          'Feature: Preserve review authority\n\n  Scenario: Deny an unauthenticated approval\n    Given no authenticated review receipt exists\n    When the builder requests advancement\n    Then advancement is denied\n',
        );
        const result = await runCli(
          [
            'review',
            'run',
            'scenario-gate',
            'behavior.feature',
            '--context',
            'spec.md',
            '--json',
            '--no-input',
          ],
          {
            cwd: directory,
            timeout: LIVE_TIMEOUT_MS,
            env: {
              SAFEWORD_AGENT_RUNTIME: author,
              SAFEWORD_NO_UPDATE_CHECK: '1',
              SAFEWORD_REVIEW_TIMEOUT_MS: String(REVIEW_TIMEOUT_MS),
              SAFEWORD_REVIEW_RUN_BOUND_MS: String(REVIEW_TIMEOUT_MS + 60_000),
              ...profileEnvironment,
            },
            unsetEnv: reviewer === 'claude' && profile === 'default' ? ['CLAUDE_CONFIG_DIR'] : [],
          },
        );
        expect(result.timedOut, result.stderr).toBe(false);
        expect([0, 2], result.stderr).toContain(result.exitCode);
        const output = JSON.parse(result.stdout);
        // Model confirmation is separate from author qualification and plan approval.
        expect(output.data, result.stdout).toMatchObject({
          actual_reviewer: reviewer,
          reviewer_model: pair.reviewer_model,
          confirmed_reviewer_model: { provider, model: pair.reviewer_model },
        });
        expect(output.data.status, result.stdout).not.toBe('pending');
      } finally {
        removeTemporaryDirectory(directory);
      }
    },
    LIVE_TIMEOUT_MS,
  );
});
