import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

describe('executable RED public CLI wiring', () => {
  it('executes structured argv and reports trusted evidence', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{"crossAgentReview":"off"}\n');
    writeFileSync(nodePath.join(cwd, 'proof.md'), 'actor-boundary proof\n');

    const result = await runCli(
      [
        '--json',
        '--no-input',
        '--cwd',
        cwd,
        'review',
        'run',
        'executable-red',
        'proof.md',
        '--proof-cwd',
        '.',
        '--evidence-class',
        'pure-contract',
        '--expected-failure',
        'expected actor assertion',
        '--execution-timeout',
        '1000',
        '--execute',
        JSON.stringify([
          process.execPath,
          '-e',
          "console.error('expected actor assertion'); process.exit(1)",
        ]),
      ],
      { cwd },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    const output = JSON.parse(result.stdout) as { data: Record<string, unknown> };
    expect(output.data).toMatchObject({
      status: 'existing_route',
      execution_attestation: {
        expected_failure: { matched: true },
        termination: { exit_code: 1, timed_out: false },
      },
    });
  });
});
