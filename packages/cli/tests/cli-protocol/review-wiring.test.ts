import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

type ReviewAgent = 'claude' | 'codex';

function installFakeReviewer(directory: string, agent: ReviewAgent, log: string): string {
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then
  printf '${agent} 1.0.0\n'
  exit 0
fi
payload=$(cat)
printf '%s\n' '${agent}' >> "$SAFEWORD_REVIEW_LOG"
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
failure=$(printenv SAFEWORD_FAKE_FAILURE_${agent.toUpperCase()} || printenv SAFEWORD_FAKE_FAILURE || true)
failure_agent=$(printenv SAFEWORD_FAKE_FAILURE_AGENT || true)
if [ -z "$failure_agent" ] || [ "$failure_agent" = "${agent}" ]; then
  if [ "$failure" = "auth" ]; then printf 'not logged in\n' >&2; exit 1; fi
  if [ "$failure" = "process" ]; then printf 'review crashed\n' >&2; exit 7; fi
  if [ "$failure" = "timeout" ]; then /bin/sleep 1; fi
  if [ "$failure" = "invalid" ]; then printf 'not-json\n'; exit 0; fi
fi
identity=$(printenv SAFEWORD_FAKE_IDENTITY || true)
mutate=$(printenv SAFEWORD_FAKE_MUTATE || true)
if [ "$mutate" = "1" ]; then
  printf 'reviewer mutation\n' > review-input.md
fi
env_log=$(printenv SAFEWORD_REVIEW_ENV_LOG || true)
if [ -n "$env_log" ]; then
  if printenv ANTHROPIC_API_KEY >/dev/null 2>&1; then printf 'anthropic=present\n' >> "$env_log"; else printf 'anthropic=absent\n' >> "$env_log"; fi
  if printenv OPENAI_API_KEY >/dev/null 2>&1; then printf 'openai=present\n' >> "$env_log"; else printf 'openai=absent\n' >> "$env_log"; fi
fi
if [ "$identity" = "missing" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
elif [ "$identity" = "contradictory" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"other","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('cross-agent review public-command wiring', () => {
  it.each([
    { author: 'claude', reviewer: 'codex', model: 'codex-default' },
    { author: 'codex', reviewer: 'claude', model: 'claude-default' },
  ] as const)(
    'routes $author-authored work to headless $reviewer',
    async ({ author, reviewer, model }) => {
      const directory = createTemporaryDirectory();
      const target = nodePath.join(directory, 'review-input.md');
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(target, 'bounded review input\n');
      const bin = installFakeReviewer(directory, reviewer, log);

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
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'healthy',
        data: {
          command: 'review run',
          status: 'approved',
          author_agent: author,
          assigned_reviewer: reviewer,
          actual_reviewer: reviewer,
          assigned_model: model,
          independence: 'cross-agent',
          reviewer_output: {
            dispatch_id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
          },
        },
      });
      expect(readFileSync(log, 'utf8')).toBe(`${reviewer}\n`);
    },
  );

  it('does not launch a same-agent candidate when the opposite reviewer is available', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(target, 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'claude', log);
    installFakeReviewer(directory, 'codex', log);

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
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout).data).toMatchObject({
      assigned_reviewer: 'claude',
      actual_reviewer: 'claude',
    });
    expect(readFileSync(log, 'utf8')).toBe('claude\n');
  });

  it('retains the existing route for an author outside the Claude and Codex pairing', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');

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
          PATH: process.env.PATH ?? '',
          SAFEWORD_AGENT_RUNTIME: 'cursor',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      effects: { network: [] },
      data: {
        status: 'existing_route',
        author_agent: 'cursor',
        independence: 'none',
      },
    });
  });

  it.each([
    { identity: 'missing', code: 'REVIEWER_PROVENANCE_MISSING' },
    { identity: 'contradictory', code: 'REVIEWER_PROVENANCE_CONTRADICTORY' },
  ])(
    'rejects $identity reviewer provenance without passing evidence',
    async ({ identity, code }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, 'codex', log);

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
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SAFEWORD_AGENT_RUNTIME: 'claude',
            SAFEWORD_FAKE_IDENTITY: identity,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        errors: [{ code }],
        effects: { files: [] },
      });
    },
  );

  it('confines reviewer writes to a disposable snapshot and denies passing evidence', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    const original = 'bounded review input\n';
    writeFileSync(target, original);
    const bin = installFakeReviewer(directory, 'codex', log);

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
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_FAKE_MUTATE: '1',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(readFileSync(target, 'utf8')).toBe(original);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEWER_WRITE_ATTEMPT' }],
      data: { independence: 'none' },
    });
  });

  it('keeps author-vendor credentials outside the opposite reviewer boundary', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const environmentLog = nodePath.join(directory, 'environment.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex', reviewLog);
    const authorSecret = `sk-ant-${'a'.repeat(24)}`;
    const reviewerSecret = `sk-openai-${'b'.repeat(24)}`;

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
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          ANTHROPIC_API_KEY: authorSecret,
          OPENAI_API_KEY: reviewerSecret,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_ENV_LOG: environmentLog,
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(environmentLog, 'utf8')).toBe('anthropic=absent\nopenai=present\n');
    expect(result.stdout).not.toContain(authorSecret);
    expect(result.stdout).not.toContain(reviewerSecret);
  });

  it.each([
    { failure: 'not-installed', classification: 'not_installed' },
    { failure: 'auth', classification: 'not_authenticated' },
    { failure: 'process', classification: 'process_failed' },
    { failure: 'timeout', classification: 'timed_out' },
    { failure: 'invalid', classification: 'invalid_output' },
  ])(
    'preserves the $classification preferred-route failure',
    async ({ failure, classification }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = nodePath.join(directory, 'bin');
      mkdirSync(bin, { recursive: true });
      if (failure !== 'not-installed') installFakeReviewer(directory, 'codex', log);

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
            SAFEWORD_FAKE_FAILURE: failure,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_REVIEW_TIMEOUT_MS: failure === 'timeout' ? '50' : '1000',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        data: {
          status: 'blocked',
          preferred_failure: classification,
          independence: 'none',
        },
      });
    },
  );

  it('records a permitted host-native fallback as degraded', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex', log);
    installFakeReviewer(directory, 'claude', log);

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
          SAFEWORD_FAKE_FAILURE: 'process',
          SAFEWORD_FAKE_FAILURE_AGENT: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        status: 'approved',
        author_agent: 'claude',
        assigned_reviewer: 'codex',
        actual_reviewer: 'claude',
        preferred_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it('does not let a degraded fallback satisfy hard cross-agent enforcement', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'require' }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex', log);
    installFakeReviewer(directory, 'claude', log);

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
          SAFEWORD_FAKE_FAILURE: 'process',
          SAFEWORD_FAKE_FAILURE_AGENT: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      recovery: [
        {
          command: 'safeword review run quality-review review-input.md',
          description: 'Restore the Codex reviewer, then retry the independent review.',
        },
      ],
      data: {
        status: 'blocked',
        assigned_reviewer: 'codex',
        actual_reviewer: 'claude',
        preferred_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it('blocks with one recovery action after exhausting safe review routes', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex', log);
    installFakeReviewer(directory, 'claude', log);
    const startedAt = Date.now();

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
          SAFEWORD_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_FAKE_FAILURE_CLAUDE: 'auth',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const output = JSON.parse(result.stdout);
    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(result.exitCode).toBe(2);
    expect(output).toMatchObject({
      state: 'action_required',
      recovery: [
        {
          command: 'safeword review run quality-review review-input.md',
          description: 'Retry the independent review.',
        },
      ],
      data: {
        status: 'blocked',
        preferred_failure: 'process_failed',
        fallback_failure: 'not_authenticated',
        independence: 'none',
      },
    });
    expect(output.data).not.toHaveProperty('reviewer_output');
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });
});
