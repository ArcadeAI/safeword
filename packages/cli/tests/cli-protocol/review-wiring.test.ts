import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

type ReviewAgent = 'claude' | 'codex';

function installFakeReviewer(directory: string, agent: ReviewAgent): string {
  const fixture = Buffer.from(directory).toString('hex');
  const bin = nodePath.join(
    tmpdir(),
    `safeword-reviewer-${fixture}-${nodePath.basename(directory)}`,
    'bin',
  );
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
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  help_mutate=$(printenv SAFEWORD_REVIEW_HELP_MUTATE || true)
  if [ "$help_mutate" = "1" ]; then printf 'probe mutation\n' > review-input.md; fi
  swap_alias=$(printenv SAFEWORD_REVIEW_SWAP_ALIAS || true)
  swap_target=$(printenv SAFEWORD_REVIEW_SWAP_TARGET || true)
  if [ -n "$swap_alias" ] && [ -n "$swap_target" ]; then
    /bin/rm -f "$swap_alias"
    /bin/ln -s "$swap_target" "$swap_alias"
  fi
  printf '%s\n' '${agent === 'claude' ? '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools' : '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema'}'
  exit 0
fi
printf '%s\n' '${agent}' >> "$SAFEWORD_REVIEW_LOG"
failure=$(printenv SAFEWORD_REVIEW_FAKE_FAILURE_${agent.toUpperCase()} || printenv SAFEWORD_REVIEW_FAKE_FAILURE || true)
failure_agent=$(printenv SAFEWORD_REVIEW_FAKE_FAILURE_AGENT || true)
failure_path=$(printenv SAFEWORD_REVIEW_FAKE_FAIL_PATH_CONTAINS || true)
if [ "$failure" = "auth" ] && { [ -z "$failure_agent" ] || [ "$failure_agent" = "${agent}" ]; } && { [ -z "$failure_path" ] || printf '%s' "$0" | /usr/bin/grep -q "$failure_path"; }; then
  printf 'not logged in\n' >&2
  exit 1
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
if { [ -z "$failure_agent" ] || [ "$failure_agent" = "${agent}" ]; } && { [ -z "$failure_path" ] || printf '%s' "$0" | /usr/bin/grep -q "$failure_path"; }; then
  if [ "$failure" = "process" ]; then printf 'review crashed\n' >&2; exit 7; fi
  if [ "$failure" = "timeout" ]; then /bin/sleep 1; fi
  if [ "$failure" = "invalid" ]; then printf 'not-json\n'; exit 0; fi
fi
identity=$(printenv SAFEWORD_REVIEW_FAKE_IDENTITY || true)
mutate=$(printenv SAFEWORD_REVIEW_FAKE_MUTATE || true)
mutate_agent=$(printenv SAFEWORD_REVIEW_FAKE_MUTATE_AGENT || true)
if [ "$mutate" = "1" ] && { [ -z "$mutate_agent" ] || [ "$mutate_agent" = "${agent}" ]; }; then
  printf 'reviewer mutation\n' > review-input.md
fi
verdict=$(printenv SAFEWORD_REVIEW_FAKE_VERDICT || true)
if [ -z "$verdict" ]; then verdict=approve; fi
env_log=$(printenv SAFEWORD_REVIEW_ENV_LOG || true)
if [ -n "$env_log" ]; then
  if printenv ANTHROPIC_API_KEY >/dev/null 2>&1; then printf 'anthropic=present\n' >> "$env_log"; else printf 'anthropic=absent\n' >> "$env_log"; fi
  if printenv OPENAI_API_KEY >/dev/null 2>&1; then printf 'openai=present\n' >> "$env_log"; else printf 'openai=absent\n' >> "$env_log"; fi
fi
if [ "$identity" = "missing" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","verdict":"%s","summary":"reviewed","findings":[]}\n' "$dispatch_id" "$verdict"
elif [ "$identity" = "contradictory" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"other","verdict":"%s","summary":"reviewed","findings":[]}\n' "$dispatch_id" "$verdict"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"%s","summary":"reviewed","findings":[]}\n' "$dispatch_id" "$verdict"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installIncompatibleReviewer(directory: string, agent: ReviewAgent, log: string): string {
  const fixture = Buffer.from(directory).toString('hex');
  const bin = nodePath.join(
    tmpdir(),
    `safeword-reviewer-${fixture}-${nodePath.basename(directory)}`,
    'bin',
  );
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '--json'; exit 0; fi\nprintf 'launched\\n' >> '${log}'\nexit 9\n`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('cross-agent review public-command wiring', () => {
  it.each([
    { author: 'claude', reviewer: 'codex' },
    { author: 'codex', reviewer: 'claude' },
  ] as const)(
    'routes $author-authored work to headless $reviewer',
    async ({ author, reviewer }) => {
      const directory = createTemporaryDirectory();
      const target = nodePath.join(directory, 'review-input.md');
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(target, 'bounded review input\n');
      const bin = installFakeReviewer(directory, reviewer);

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
    const bin = installFakeReviewer(directory, 'claude');
    installFakeReviewer(directory, 'codex');

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

  it.each([
    { preferredFailure: false, independence: 'cross-agent' },
    { preferredFailure: true, independence: 'degraded' },
  ])(
    'surfaces a real collaborator request_changes verdict ($independence)',
    async ({ preferredFailure, independence }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, 'codex');
      installFakeReviewer(directory, 'claude');

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
            SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: preferredFailure ? 'process' : '',
            SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        data: { status: 'changes_requested', independence },
      });
    },
  );

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

  it('fails closed for an unsupported author when cross-agent review is required', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'require' }),
    );
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
          PATH: '/usr/bin:/bin',
          SAFEWORD_AGENT_RUNTIME: 'cursor',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      recovery: [{ description: 'Run this review from Claude or Codex.' }],
      data: {
        status: 'blocked',
        author_agent: 'cursor',
        independence: 'none',
      },
    });
  });

  it.each([{ identity: 'missing' }, { identity: 'contradictory' }])(
    'rejects $identity reviewer provenance and continues through the bounded fallback routes',
    async ({ identity }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, 'codex');

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
            SAFEWORD_REVIEW_FAKE_IDENTITY: identity,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        state: 'action_required',
        findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
        data: {
          preferred_failure: 'invalid_output',
          review_policy: 'prefer',
          independence: 'none',
        },
      });
      expect(payload.data).not.toHaveProperty('reviewer_output');
    },
  );

  it('confines reviewer writes to a disposable snapshot and denies passing evidence', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    const original = 'bounded review input\n';
    writeFileSync(target, original);
    const bin = installFakeReviewer(directory, 'codex');

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
          SAFEWORD_REVIEW_FAKE_MUTATE: '1',
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

  it('confines capability-probe writes to the disposable snapshot', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    const original = 'bounded review input\n';
    writeFileSync(target, original);
    const bin = installFakeReviewer(directory, 'codex');

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
          SAFEWORD_REVIEW_HELP_MUTATE: '1',
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

  it('classifies a degraded fallback write as a reviewer write attempt', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(target, 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

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
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_FAKE_MUTATE: '1',
          SAFEWORD_REVIEW_FAKE_MUTATE_AGENT: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

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
    const bin = installFakeReviewer(directory, 'codex');
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

  it('uses a managed Claude credential for a Codex-authored cloud review', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const environmentLog = nodePath.join(directory, 'environment.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'claude');
    const reviewerSecret = `sk-ant-${'c'.repeat(24)}`;
    const authorSecret = `sk-openai-${'d'.repeat(24)}`;

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
          ANTHROPIC_API_KEY: reviewerSecret,
          OPENAI_API_KEY: authorSecret,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_ENV_LOG: environmentLog,
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(environmentLog, 'utf8')).toBe('anthropic=present\nopenai=absent\n');
    expect(result.stdout).not.toContain(authorSecret);
    expect(result.stdout).not.toContain(reviewerSecret);
  });

  it.each([
    {
      failure: 'not-installed',
      classification: 'not_installed',
      action: 'Install or update Codex, then run the review again.',
    },
    {
      failure: 'auth',
      classification: 'not_authenticated',
      action: 'Sign in to Codex, then run the review again.',
    },
    {
      failure: 'process',
      classification: 'process_failed',
      action: 'Run the review again.',
    },
    {
      failure: 'timeout',
      classification: 'timed_out',
      action: 'Run the review again.',
    },
    {
      failure: 'invalid',
      classification: 'invalid_output',
      action: 'Run the review again.',
    },
  ])(
    'preserves the $classification preferred-route failure',
    async ({ failure, classification, action }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(
        nodePath.join(directory, 'review-input.md'),
        failure === 'auth' ? 'x'.repeat(200 * 1024) : 'bounded review input\n',
      );
      let bin = nodePath.join(directory, 'bin');
      mkdirSync(bin, { recursive: true });
      if (failure !== 'not-installed') bin = installFakeReviewer(directory, 'codex');

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
            SAFEWORD_REVIEW_FAKE_FAILURE: failure,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_REVIEW_TIMEOUT_MS: failure === 'timeout' ? '250' : '5000',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        recovery: [{ description: action }],
        data: {
          status: 'blocked',
          preferred_failure: classification,
          review_policy: 'prefer',
          independence: 'none',
        },
      });
      expect(JSON.parse(result.stdout).recovery).toHaveLength(1);
    },
  );

  it('records a permitted host-native fallback as degraded', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

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
          SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
          SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: 'codex',
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

  it('records an attempted alternate-model failure before a degraded fallback', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

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
          SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
          SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      effects: {
        network: [
          { kind: 'review', target: 'codex', operation: 'request' },
          { kind: 'review', target: 'codex', operation: 'request' },
          { kind: 'review', target: 'claude', operation: 'request' },
        ],
      },
      data: {
        status: 'approved',
        preferred_failure: 'process_failed',
        alternate_model_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\ncodex\nclaude\n');
  });

  it.each([
    { author: 'claude', authorName: 'Claude', reviewerName: 'Codex' },
    { author: 'codex', authorName: 'Codex', reviewerName: 'Claude' },
  ] as const)(
    'suggests installing missing $reviewerName without blocking the $authorName fallback',
    async ({ author, authorName, reviewerName }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, author);

      const result = await runCli(
        ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
        {
          cwd: directory,
          env: {
            PATH: `${bin}:/usr/bin:/bin`,
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.stdout).toContain(
        `${reviewerName} is not installed. This review was not independent: the same agent (${authorName}) checked its own work in a separate headless process. Install ${reviewerName} for an independent review.`,
      );
      expect(readFileSync(log, 'utf8')).toBe(`${author}\n`);
    },
  );

  it('does not let a degraded fallback satisfy hard cross-agent enforcement', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'require' }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

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
          SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
          SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: 'codex',
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
          command: 'safeword review run quality-review -- review-input.md',
          description: 'Restore the Codex reviewer, then retry the independent review.',
        },
      ],
      data: {
        status: 'blocked',
        assigned_reviewer: 'codex',
        actual_reviewer: 'claude',
        preferred_failure: 'process_failed',
        review_policy: 'require',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it('blocks with one recovery action after exhausting safe review routes', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');
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
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE: 'auth',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const output = JSON.parse(result.stdout);
    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(result.exitCode).toBe(2);
    expect(output).toMatchObject({
      state: 'action_required',
      recovery: [
        {
          command: 'safeword review run quality-review -- review-input.md',
          description: 'Run the review again.',
        },
      ],
      data: {
        status: 'blocked',
        preferred_failure: 'process_failed',
        fallback_failure: 'not_authenticated',
        review_policy: 'prefer',
        independence: 'none',
      },
    });
    expect(output.data).not.toHaveProperty('reviewer_output');
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it.each(['process', 'auth'])(
    'skips a reviewer candidate that fails with %s and runs the next compatible installation',
    async failure => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const staleBin = installFakeReviewer(nodePath.join(directory, 'stale'), 'codex');
      const currentBin = installFakeReviewer(nodePath.join(directory, 'current'), 'codex');

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
            PATH: `${staleBin}:${currentBin}:/usr/bin:/bin`,
            SAFEWORD_AGENT_RUNTIME: 'claude',
            SAFEWORD_REVIEW_FAKE_FAILURE: failure,
            SAFEWORD_REVIEW_FAKE_FAIL_PATH_CONTAINS: 'stale',
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).data).toMatchObject({
        assigned_reviewer: 'codex',
        actual_reviewer: 'codex',
        independence: 'cross-agent',
      });
      expect(readFileSync(log, 'utf8')).toBe('codex\ncodex\n');
    },
  );

  it('skips an incompatible reviewer installation without launching it', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    const incompatibleLog = nodePath.join(directory, 'incompatible.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const incompatibleBin = installIncompatibleReviewer(
      nodePath.join(directory, 'incompatible'),
      'codex',
      incompatibleLog,
    );
    const compatibleBin = installFakeReviewer(nodePath.join(directory, 'current'), 'codex');

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
          PATH: `${incompatibleBin}:${compatibleBin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(() => readFileSync(incompatibleLog, 'utf8')).toThrow();
  });

  it('does not probe or launch a project-controlled reviewer executable', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const maliciousLog = nodePath.join(directory, 'malicious.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const projectBin = nodePath.join(directory, 'bin');
    mkdirSync(projectBin, { recursive: true });
    writeFileSync(
      nodePath.join(projectBin, 'codex'),
      `#!/bin/sh\nprintf 'launched\\n' >> '${maliciousLog}'\nprintf '%s\\n' '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config'\n`,
      { mode: 0o755 },
    );
    const trustedBin = installFakeReviewer(directory, 'codex');

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
          PATH: `${projectBin}:${trustedBin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(reviewLog, 'utf8')).toBe('codex\n');
    expect(() => readFileSync(maliciousLog, 'utf8')).toThrow();
  });

  it('launches the canonical reviewer after a PATH symlink is replaced', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const maliciousLog = nodePath.join(directory, 'malicious.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');

    const projectBin = nodePath.join(directory, 'bin');
    mkdirSync(projectBin, { recursive: true });
    const malicious = nodePath.join(projectBin, 'codex');
    writeFileSync(malicious, `#!/bin/sh\nprintf 'launched\\n' >> '${maliciousLog}'\nexit 9\n`, {
      mode: 0o755,
    });

    const trustedBin = installFakeReviewer(directory, 'codex');
    const aliasBin = nodePath.join(createTemporaryDirectory(), 'bin');
    mkdirSync(aliasBin, { recursive: true });
    const alias = nodePath.join(aliasBin, 'codex');
    symlinkSync(nodePath.join(trustedBin, 'codex'), alias);

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
          PATH: `${aliasBin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_REVIEW_SWAP_ALIAS: alias,
          SAFEWORD_REVIEW_SWAP_TARGET: malicious,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(reviewLog, 'utf8')).toBe('codex\n');
    expect(() => readFileSync(maliciousLog, 'utf8')).toThrow();
  });

  it('retains the existing route without launching a reviewer after explicit opt-out', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'off' }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');

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
          SAFEWORD_REVIEW_LOG: log,
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
        author_agent: 'claude',
        independence: 'none',
        cross_agent_review: 'not_requested',
      },
    });
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it.each<{
    outcome: string;
    environment: Record<string, string>;
    firstLine: string;
  }>([
    {
      outcome: 'cross-agent',
      environment: {},
      firstLine: 'A different agent (Codex) checked the work in a separate headless process.',
    },
    {
      outcome: 'degraded',
      environment: {
        SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
      },
      firstLine:
        'This review was not independent: the same agent (Claude) checked its own work in a separate headless process.',
    },
    {
      outcome: 'blocked',
      environment: {
        SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
        SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE: 'auth',
      },
      firstLine: 'The independent check did not run.',
    },
  ])('leads a $outcome human result with its independence status', async testCase => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

    const result = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
          ...testCase.environment,
        },
      },
    );

    expect(result.stdout.split('\n', 1)[0]).toBe(testCase.firstLine);
  });
});
