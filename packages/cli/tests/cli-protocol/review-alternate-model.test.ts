import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

type ReviewAgent = 'claude' | 'codex';

/**
 * A reviewer that refuses to answer unless it is asked to run on a specific
 * model — the shape of a reviewer whose default model is unavailable. It
 * records the model it was given so the test can prove the configured value
 * reached the executable as a real argument rather than as routing metadata.
 */
function installModelDependentReviewer(directory: string, agent: ReviewAgent): string {
  const bin = nodePath.join(
    tmpdir(),
    `safeword-altmodel-${Buffer.from(directory).toString('hex')}`,
    'bin',
  );
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES[agent]}'
  exit 0
fi
model=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--model" ] || [ "$previous" = "-m" ]; then model="$argument"; fi
  previous="$argument"
done
if [ -z "$model" ]; then
  printf 'default model unavailable\n' >&2
  exit 7
fi
printf '%s\n' "$model" >> "$SAFEWORD_REVIEW_MODEL_LOG"
accepted_model=$(printenv SAFEWORD_REVIEW_ACCEPTED_MODEL || true)
if [ -n "$accepted_model" ] && [ "$model" != "$accepted_model" ]; then
  rejected_model_behaviour=$(printenv SAFEWORD_REVIEW_REJECTED_MODEL_BEHAVIOUR || true)
  if [ "$rejected_model_behaviour" = "timeout" ]; then exec /bin/sleep 3600; fi
  printf 'model unavailable\n' >&2
  exit 7
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installAlwaysAnsweringReviewer(directory: string, agent: ReviewAgent): string {
  const bin = nodePath.join(
    tmpdir(),
    `safeword-answering-${Buffer.from(directory).toString('hex')}`,
    'bin',
  );
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES[agent]}'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function writeConfig(directory: string, config: Record<string, unknown>): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify(config, undefined, 2),
  );
}

describe('alternate-model review route', () => {
  it.each([
    { author: 'claude', reviewer: 'codex' },
    { author: 'codex', reviewer: 'claude' },
  ] as const)(
    'retries $reviewer on its configured model for $author-authored work and still reports a full cross-agent check',
    async ({ author, reviewer }) => {
      const directory = createTemporaryDirectory();
      const modelLog = nodePath.join(directory, 'model.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      writeConfig(directory, {
        crossAgentReview: 'require',
        crossAgentReviewAlternateModel: { [reviewer]: 'vendor-model-2' },
      });
      const bin = installModelDependentReviewer(directory, reviewer);

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
            // Hermetic PATH: a real reviewer on the developer PATH would otherwise
            // be tried as a later candidate and answer for real.
            PATH: `${bin}:/usr/bin:/bin`,
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_MODEL_LOG: modelLog,
            SAFEWORD_REVIEW_ACCEPTED_MODEL: 'vendor-model-2',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'healthy',
        effects: {
          network: [
            { kind: 'review', target: reviewer, operation: 'request' },
            { kind: 'review', target: reviewer, operation: 'request' },
          ],
        },
        data: {
          status: 'approved',
          author_agent: author,
          assigned_reviewer: reviewer,
          // Provenance the reviewer itself asserted, not a label the coordinator wrote.
          reviewer_output: { reviewer_agent: reviewer },
          independence: 'cross-agent',
          reviewer_model: 'vendor-model-2',
        },
      });
      // The required cross-agent check is satisfied by the alternate model.
      expect(readFileSync(modelLog, 'utf8').trim().split('\n')).toEqual(
        reviewer === 'claude' ? ['opus', 'vendor-model-2'] : ['vendor-model-2'],
      );
    },
  );

  it('uses Opus for the primary Claude review when no model is configured', async () => {
    const directory = createTemporaryDirectory();
    const modelLog = nodePath.join(directory, 'model.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    writeConfig(directory, { crossAgentReview: 'require' });
    const bin = installModelDependentReviewer(directory, 'claude');

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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_MODEL_LOG: modelLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        actual_reviewer: 'claude',
        reviewer_model: 'opus',
        independence: 'cross-agent',
      },
    });
    expect(readFileSync(modelLog, 'utf8').trim()).toBe('opus');
  });

  it('falls back from Opus to Sonnet without project configuration', async () => {
    const directory = createTemporaryDirectory();
    const modelLog = nodePath.join(directory, 'model.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    writeConfig(directory, { crossAgentReview: 'require' });
    const bin = installModelDependentReviewer(directory, 'claude');

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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_MODEL_LOG: modelLog,
          SAFEWORD_REVIEW_ACCEPTED_MODEL: 'sonnet',
          SAFEWORD_REVIEW_REJECTED_MODEL_BEHAVIOUR: 'timeout',
          SAFEWORD_REVIEW_TIMEOUT_MS: '1500',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '5000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'claude',
        actual_reviewer: 'claude',
        reviewer_model: 'sonnet',
        preferred_model: 'opus',
        preferred_failure: 'timed_out',
        independence: 'cross-agent',
      },
    });
    expect(readFileSync(modelLog, 'utf8').trim().split('\n')).toEqual(['opus', 'sonnet']);
  });

  it('refuses to let the author reviewing itself satisfy a required check', async () => {
    const directory = createTemporaryDirectory();
    const modelLog = nodePath.join(directory, 'model.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    writeConfig(directory, { crossAgentReview: 'require' });
    // Only the author's own runtime is installed, and it answers happily.
    const bin = installAlwaysAnsweringReviewer(directory, 'claude');

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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_MODEL_LOG: modelLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const payload = JSON.parse(result.stdout) as {
      findings: readonly { code: string }[];
      data: Record<string, unknown>;
    };
    expect(payload.data).toMatchObject({
      status: 'blocked',
      actual_reviewer: 'claude',
      independence: 'degraded',
    });
    expect(payload.findings.map(finding => finding.code)).toContain('REVIEW_INDEPENDENCE_REQUIRED');
  });

  it('passes no model at all when none is configured', async () => {
    const directory = createTemporaryDirectory();
    const modelLog = nodePath.join(directory, 'model.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    writeConfig(directory, { crossAgentReview: 'prefer' });
    const bin = installModelDependentReviewer(directory, 'codex');

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
          // Hermetic PATH: a real reviewer on the developer PATH would otherwise
          // be tried as a later candidate and answer for real.
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_MODEL_LOG: modelLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    // The reviewer refuses without a model, so the exhausted result and absent
    // model log together prove the real executable ran without `--model`.
    const payload = JSON.parse(result.stdout) as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({ status: 'blocked', independence: 'none' });
    expect(payload.data.preferred_failure).toBe('process_failed');
    expect(payload.data).not.toHaveProperty('reviewer_model');
    expect(() => readFileSync(modelLog, 'utf8')).toThrow();
  });
});
