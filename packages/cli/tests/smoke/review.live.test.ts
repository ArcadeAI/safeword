import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_REVIEW_TIMEOUT_MS } from '../../src/review/runtime.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_CROSS_AGENT_LIVE === '1';
const SKIP_ACKNOWLEDGED = process.env.SAFEWORD_LIVE_ALLOW_SKIP === '1';
const LIVE_TEST_TIMEOUT_MS = DEFAULT_REVIEW_TIMEOUT_MS + 60_000;

describe('live smoke: opposite headless reviewer routing', () => {
  it('gate: both live reviewer routes run, or the omission is explicit', () => {
    expect(
      CAN_RUN || SKIP_ACKNOWLEDGED,
      'Cross-agent live review was NOT verified. Install and sign in to Claude and Codex, ' +
        'then set SAFEWORD_RUN_CROSS_AGENT_LIVE=1, or explicitly acknowledge the skip with ' +
        'SAFEWORD_LIVE_ALLOW_SKIP=1.',
    ).toBe(true);
  });

  describe.skipIf(!CAN_RUN)('real collaborators', () => {
    it.each([
      { author: 'claude', reviewer: 'codex' },
      { author: 'codex', reviewer: 'claude' },
    ] as const)(
      'routes $author work through real headless $reviewer',
      async ({ author, reviewer }) => {
        const directory = createTemporaryDirectory();
        mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
        writeFileSync(
          nodePath.join(directory, '.safeword', 'config.json'),
          JSON.stringify({ crossAgentReview: 'require' }),
        );
        writeFileSync(
          nodePath.join(directory, 'review-input.md'),
          '# Review input\n\nA bounded documentation-only change with no executable behavior.\n',
        );

        const result = await runCli(
          [
            'review',
            'run',
            'quality-review',
            'review-input.md',
            '--json',
            '--no-input',
            '--cwd',
            directory,
          ],
          {
            cwd: directory,
            env: {
              SAFEWORD_AGENT_RUNTIME: author,
              SAFEWORD_REVIEW_TIMEOUT_MS: String(DEFAULT_REVIEW_TIMEOUT_MS),
              SAFEWORD_NO_UPDATE_CHECK: '1',
            },
            timeout: LIVE_TEST_TIMEOUT_MS,
          },
        );

        expect(result.exitCode, result.stdout).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
          state: 'healthy',
          data: {
            status: 'approved',
            author_agent: author,
            assigned_reviewer: reviewer,
            actual_reviewer: reviewer,
            independence: 'cross-agent',
          },
        });
      },
      LIVE_TEST_TIMEOUT_MS,
    );
  });
});
