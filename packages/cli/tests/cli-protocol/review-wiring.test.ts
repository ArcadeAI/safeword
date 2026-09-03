import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { createTrustedReviewerDirectory } from '../review-fixtures.js';

type ReviewAgent = 'claude' | 'codex' | 'opencode';

const trustedReviewerRoots = new Map<string, string>();
const isolatedUserConfig = createTemporaryDirectory();
const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;

beforeAll(() => {
  process.env.XDG_CONFIG_HOME = isolatedUserConfig;
});

afterAll(() => {
  for (const root of trustedReviewerRoots.values()) rmSync(root, { recursive: true, force: true });
  rmSync(isolatedUserConfig, { recursive: true, force: true });
  if (previousXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
});

function trustedReviewerRoot(directory: string): string {
  const existing = trustedReviewerRoots.get(directory);
  if (existing !== undefined) return existing;
  const created = createTrustedReviewerDirectory(
    `safeword-reviewer-${nodePath.basename(directory)}-`,
  );
  trustedReviewerRoots.set(directory, created);
  return created;
}

function installFakeReviewer(directory: string, agent: ReviewAgent, failureModel = ''): string {
  const bin = nodePath.join(trustedReviewerRoot(directory), 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  let capabilities = '--format --pure';
  if (agent === 'claude') {
    capabilities =
      '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools';
  } else if (agent === 'codex') {
    capabilities =
      '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema';
  }
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then
  printf '${agent} 1.0.0\n'
  exit 0
fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  probe_env_log=$(printenv SAFEWORD_REVIEW_PROBE_ENV_LOG || true)
  if [ -n "$probe_env_log" ]; then
    if printenv ANTHROPIC_API_KEY >/dev/null 2>&1; then printf 'anthropic=present\n' >> "$probe_env_log"; else printf 'anthropic=absent\n' >> "$probe_env_log"; fi
    if printenv OPENAI_API_KEY >/dev/null 2>&1; then printf 'openai=present\n' >> "$probe_env_log"; else printf 'openai=absent\n' >> "$probe_env_log"; fi
  fi
  help_failure=$(printenv SAFEWORD_REVIEW_FAKE_HELP_FAILURE || true)
  if [ "$help_failure" = "unsupported" ]; then printf '%s\n' '--json'; exit 0; fi
  if [ "$help_failure" = "timeout" ]; then /bin/sleep 1; fi
  if [ "$help_failure" = "launch" ]; then printf 'probe failed\n' >&2; exit 7; fi
  help_mutate=$(printenv SAFEWORD_REVIEW_HELP_MUTATE || true)
  if [ "$help_mutate" = "1" ]; then printf 'probe mutation\n' > review-input.md; fi
  swap_alias=$(printenv SAFEWORD_REVIEW_SWAP_ALIAS || true)
  swap_target=$(printenv SAFEWORD_REVIEW_SWAP_TARGET || true)
  if [ -n "$swap_alias" ] && [ -n "$swap_target" ]; then
    /bin/rm -f "$swap_alias"
    /bin/ln -s "$swap_target" "$swap_alias"
  fi
  model_capability=$(printenv SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY || true)
  capabilities='${capabilities}'
  if [ "$model_capability" != "missing" ]; then capabilities="$capabilities --model"; fi
  printf '%s\n' "$capabilities"
  exit 0
fi
printf '%s\n' '${agent}' >> "$SAFEWORD_REVIEW_LOG"
printf '%s\n' "${agent} $*" >> "$SAFEWORD_REVIEW_LOG.args"
failure=$(printenv SAFEWORD_REVIEW_FAKE_FAILURE_${agent.toUpperCase()} || printenv SAFEWORD_REVIEW_FAKE_FAILURE || true)
failure_model='${failureModel}'
if [ -n "$failure_model" ] && ! printf '%s' "$*" | /usr/bin/grep -q -- "$failure_model"; then failure=''; fi
failure_agent=$(printenv SAFEWORD_REVIEW_FAKE_FAILURE_AGENT || true)
failure_path=$(printenv SAFEWORD_REVIEW_FAKE_FAIL_PATH_CONTAINS || true)
delay_agent=$(printenv SAFEWORD_REVIEW_FAKE_DELAY_AGENT || true)
if [ "$failure" = "auth" ] && { [ -z "$failure_agent" ] || [ "$failure_agent" = "${agent}" ]; } && { [ -z "$failure_path" ] || printf '%s' "$0" | /usr/bin/grep -q "$failure_path"; }; then
  printf 'not logged in\n' >&2
  exit 1
fi
payload=$(cat)
prompt_log=$(printenv SAFEWORD_REVIEW_PROMPT_LOG || true)
model_prompt_log=$(printenv SAFEWORD_REVIEW_MODEL_PROMPT_LOG || true)
if [ -n "$model_prompt_log" ] && printf '%s' "$*" | /usr/bin/grep -q -- '--model'; then prompt_log="$model_prompt_log"; fi
if [ -n "$prompt_log" ]; then printf '%s' "$payload" > "$prompt_log"; fi
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
if [ "$delay_agent" = "${agent}" ]; then /bin/sleep 1; fi
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
source_mutate_target=$(printenv SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET || true)
if [ -n "$source_mutate_target" ]; then
  printf 'source mutation\n' > "$source_mutate_target"
fi
verdict=$(printenv SAFEWORD_REVIEW_FAKE_VERDICT || true)
if [ -z "$verdict" ]; then verdict=approve; fi
summary=$(printenv SAFEWORD_REVIEW_FAKE_SUMMARY || true)
if [ -z "$summary" ]; then summary=reviewed; fi
finding=$(printenv SAFEWORD_REVIEW_FAKE_FINDING || true)
env_log=$(printenv SAFEWORD_REVIEW_ENV_LOG || true)
if [ -n "$env_log" ]; then
  if printenv ANTHROPIC_API_KEY >/dev/null 2>&1; then printf 'anthropic=present\n' >> "$env_log"; else printf 'anthropic=absent\n' >> "$env_log"; fi
  if printenv OPENAI_API_KEY >/dev/null 2>&1; then printf 'openai=present\n' >> "$env_log"; else printf 'openai=absent\n' >> "$env_log"; fi
  if printenv SAFEWORD_REVIEW_PROGRESS >/dev/null 2>&1; then printf 'progress=present\n' >> "$env_log"; else printf 'progress=absent\n' >> "$env_log"; fi
fi
if [ "$identity" = "missing" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","verdict":"%s","summary":"%s","findings":[]}\n' "$dispatch_id" "$verdict" "$summary"
elif [ "$identity" = "contradictory" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"other","verdict":"%s","summary":"%s","findings":[]}\n' "$dispatch_id" "$verdict" "$summary"
elif [ "$identity" = "dispatch" ]; then
  result=$(printf '{"schema_version":1,"dispatch_id":"different-dispatch","reviewer_agent":"${agent}","verdict":"%s","summary":"%s","findings":[]}' "$verdict" "$summary")
  if [ "${agent}" = "opencode" ]; then
    printf '{"type":"text","part":{"type":"text","time":{"end":1},"text":"%s"}}\n' "$(printf '%s' "$result" | sed 's/"/\\"/g')"
  else
    printf '%s\n' "$result"
  fi
elif [ -n "$finding" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"%s","summary":"%s","findings":[{"severity":"error","message":"%s"}]}\n' "$dispatch_id" "$verdict" "$summary" "$finding"
elif [ "${agent}" = "opencode" ]; then
  result=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"opencode","verdict":"%s","summary":"%s","findings":[]}' "$dispatch_id" "$verdict" "$summary")
  printf '{"type":"text","part":{"type":"text","time":{"end":1},"text":"%s"}}\n' "$(printf '%s' "$result" | sed 's/"/\\"/g')"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"%s","summary":"%s","findings":[]}\n' "$dispatch_id" "$verdict" "$summary"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installIncompatibleReviewer(directory: string, agent: ReviewAgent, log: string): string {
  const bin = nodePath.join(trustedReviewerRoot(directory), 'bin');
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

async function runManagedJsonReview(
  directory: string,
  options: {
    readonly environmentLog?: string;
    readonly managed?: boolean;
    readonly quiet?: boolean;
    readonly reviewer?: ReviewAgent;
    readonly verdict?: 'approve' | 'request_changes';
  } = {},
) {
  writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
  const log = nodePath.join(directory, 'review.log');
  const reviewer = options.reviewer ?? 'codex';
  const author = reviewer === 'codex' ? 'claude' : 'codex';
  const bin = installFakeReviewer(directory, reviewer);
  const verdictEnvironment: Record<string, string> =
    options.verdict === 'request_changes'
      ? {
          SAFEWORD_REVIEW_FAKE_FINDING: 'Unsafe retry',
          SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
        }
      : {};

  return runCli(
    [
      'review',
      'run',
      'quality-review',
      'review-input.md',
      '--json',
      ...(options.quiet ? ['--quiet'] : []),
      '--no-input',
      '--cwd',
      directory,
    ],
    {
      cwd: directory,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: author,
        SAFEWORD_PROGRESS_HEARTBEAT_MS: '150',
        SAFEWORD_REVIEW_FAKE_DELAY_AGENT: reviewer,
        ...(options.environmentLog !== undefined && {
          SAFEWORD_REVIEW_ENV_LOG: options.environmentLog,
        }),
        SAFEWORD_REVIEW_LOG: log,
        ...(options.managed !== false && { SAFEWORD_REVIEW_PROGRESS: '1' }),
        SAFEWORD_NO_UPDATE_CHECK: '1',
        ...verdictEnvironment,
      },
    },
  );
}

describe('cross-agent review public-command wiring', () => {
  it('rejects starting a detached review offline before creating durable job state', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli([
      'review',
      'run',
      'quality-review',
      'target.md',
      '--offline',
      '--json',
      '--no-input',
      '--cwd',
      directory,
    ]);

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'CLI_ONLINE_REQUIRED' }],
      data: { command: 'review run', offline: true },
    });
    expect(existsSync(nodePath.join(directory, '.safeword', 'state', 'reviews'))).toBe(false);
  });

  it('collects review status offline because durable job state is local', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli([
      'review',
      'status',
      'not-a-uuid',
      '--offline',
      '--json',
      '--no-input',
      '--cwd',
      directory,
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      errors: [{ code: 'REVIEW_JOB_NOT_FOUND' }],
    });
  });

  it('persists malformed detached reviewer output as a terminal blocked result', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    const started = await runCli(
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
          SAFEWORD_REVIEW_FAKE_FAILURE: 'invalid',
          SAFEWORD_REVIEW_FOREGROUND_MS: '0',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
    const pending = JSON.parse(started.stdout) as { data: { review_id: string } };

    await vi.waitFor(
      async () => {
        const collected = await runCli([
          'review',
          'status',
          pending.data.review_id,
          '--json',
          '--no-input',
          '--cwd',
          directory,
        ]);
        expect(collected.exitCode, collected.stdout).toBe(2);
        expect(JSON.parse(collected.stdout)).toMatchObject({
          state: 'action_required',
          findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
          data: {
            status: 'blocked',
            preferred_failure: 'invalid_output',
          },
        });
      },
      { timeout: 10_000 },
    );
  });

  it.each(['status', 'cancel'] as const)(
    'returns a typed JSON failure for review %s through the public CLI',
    async command => {
      const directory = createTemporaryDirectory();

      const result = await runCli([
        'review',
        command,
        'not-a-uuid',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ]);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        errors: [{ code: 'REVIEW_JOB_NOT_FOUND' }],
        data: { command: `review ${command}` },
      });
    },
  );

  it('marks supporting context separately from review targets through the public CLI', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'target.md'), 'review this\n');
    writeFileSync(nodePath.join(directory, 'context.md'), 'supporting evidence\n');
    writeFileSync(nodePath.join(directory, 'other-context.md'), 'contract evidence\n');
    const bin = installFakeReviewer(directory, 'claude');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'target.md',
        '--context',
        'context.md',
        '--context',
        'other-context.md',
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
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const prompt = readFileSync(promptLog, 'utf8');
    expect(prompt).toContain('"logical_files":[{"path":"target.md"');
    expect(prompt).toContain('"context_files":[{"path":"context.md"');
    expect(prompt).toContain('{"path":"other-context.md"');
    expect(prompt).toContain('supporting context, not work under review');
    expect(prompt).toContain('## Shared adversarial-review severity foundation');
    expect(prompt).toContain('supplied proof is non-discriminating');
  });

  it('delivers only the canonical shared rubric to a scenario reviewer', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'behavior.feature'), 'Feature: shared rubric\n');
    writeFileSync(nodePath.join(directory, 'spec.md'), '# Scope\n');
    const bin = installFakeReviewer(directory, 'claude');

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
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const prompt = readFileSync(promptLog, 'utf8');
    expect(prompt).toContain('## Shared scenario-quality rubric');
    expect(prompt).toContain('## Shared adversarial-review severity foundation');
    expect(prompt).toContain('**Must Fix** for correctness or structural');
    expect(prompt).toContain('and `info`, respectively');
    expect(prompt).not.toContain('run-review.ts');
    expect(prompt).not.toContain('Do not launch the independent review coordinator');
    expect(prompt).not.toContain('hand control back to `bdd/SCENARIOS.md`');
  });

  it('composes the shared severity foundation with the plan-review rubric', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'impl-plan.md'), '# Implementation plan\n');
    const bin = installFakeReviewer(directory, 'claude');

    const result = await runCli(
      [
        'review',
        'run',
        'plan-implementation',
        'impl-plan.md',
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
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const prompt = readFileSync(promptLog, 'utf8');
    expect(prompt).toContain('## Shared adversarial-review severity foundation');
    expect(prompt).toContain('## Shared implementation-plan judgment standard');
  });

  it.each([
    { label: 'missing', context: [] },
    { label: 'blank', context: ['--context', 'spec.md'] },
  ])('rejects a $label scenario-gate spec through the public command', async ({ context }) => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'behavior.feature'), 'Feature: grounded review\n');
    writeFileSync(nodePath.join(directory, 'spec.md'), ' \n');

    const result = await runCli(
      [
        'review',
        'run',
        'scenario-gate',
        'behavior.feature',
        ...context,
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_PACKET_INVALID' }],
      data: { status: 'blocked' },
    });
  });

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
            PATH: `${bin}:/usr/bin:/bin`,
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

  it('rejects reviewer approval that also reports an error finding', async () => {
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
          SAFEWORD_REVIEW_FAKE_FINDING: 'CONTRADICTORY_ERROR_FINDING',
          SAFEWORD_REVIEW_FAKE_VERDICT: 'approve',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const output = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(2);
    expect(output).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
      data: { status: 'blocked', independence: 'none' },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
    expect(result.stdout).not.toContain('"state":"healthy"');
  });

  it.each([
    { route: 'independent', failure: '', policy: 'prefer' },
    { route: 'degraded prefer', failure: 'process', policy: 'prefer' },
    { route: 'degraded require', failure: 'process', policy: 'require' },
  ])(
    'renders a real collaborator summary and finding for $route review',
    async ({ failure, policy }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({ crossAgentReview: policy }),
      );
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
            SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: failure,
            SAFEWORD_REVIEW_FAKE_FINDING: String.raw`DISTINCTIVE\u001b[31m\u202eACTIONABLE_FINDING`,
            SAFEWORD_REVIEW_FAKE_SUMMARY: String.raw`DISTINCTIVE\u0007\u2066REVIEW_SUMMARY`,
            SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.stdout).toContain('DISTINCTIVE  REVIEW_SUMMARY');
      expect(result.stdout).toContain('DISTINCTIVE [31m ACTIONABLE_FINDING');
      expect(result.stdout).not.toContain('\u{1B}');
      expect(result.stdout).not.toContain('\u{7}');
      expect(result.stdout).not.toContain('\u{202E}');
      expect(result.stdout).not.toContain('\u{2066}');
    },
  );

  it('bounds reviewer-authored prose projected into terminal findings', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    const oversizedSummary = `SUMMARY_\u{2028}${'s'.repeat(2500)}`;
    const oversizedFinding = `FINDING_\u{2029}${'f'.repeat(2500)}`;

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
          SAFEWORD_REVIEW_FAKE_FINDING: oversizedFinding,
          SAFEWORD_REVIEW_FAKE_SUMMARY: oversizedSummary,
          SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
    };
    const reviewerFindings = payload.findings.filter(({ code }) => code.startsWith('REVIEWER_'));
    for (const finding of reviewerFindings) {
      expect(finding.message.match(/[\s\S]/gu)).toHaveLength(2000);
      expect(finding.message).not.toMatch(/[\u{2028}\u{2029}]/u);
      expect(finding.message).toMatch(/…$/u);
    }
  });

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
          PATH: `${bin}:/usr/bin:/bin`,
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

      expect(result.exitCode, result.stdout).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        data: { status: 'changes_requested', independence },
      });
    },
  );

  it.each(['prefer', 'require'] as const)(
    'returns typed exhaustion for a Cursor author under %s so the host fallback can continue',
    async policy => {
      const directory = createTemporaryDirectory();
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({ crossAgentReview: policy }),
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
        findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
        effects: { network: [] },
        recovery:
          policy === 'require'
            ? [
                {
                  command: 'safeword review run quality-review -- review-input.md',
                  description:
                    'Run this review in an environment with a usable independent reviewer.',
                },
              ]
            : [],
        data: {
          status: 'blocked',
          author_agent: 'cursor',
          review_policy: policy,
          independence: 'none',
        },
      });
    },
  );

  it('delivers route exhaustion as a successful agent handoff without changing the envelope', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--agent-handoff',
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

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
      data: {
        command: 'review run',
        status: 'blocked',
        independence: 'none',
      },
    });
    expect(result.stderr).toBe('');
  });

  it('keeps genuine review command failures nonzero during an agent handoff', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli(
      [
        'review',
        'run',
        'not-a-review-kind',
        'review-input.md',
        '--agent-handoff',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: { SAFEWORD_NO_UPDATE_CHECK: '1' },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_KIND_INVALID' }],
    });
  });

  it.each([
    { identity: 'missing', failure: 'REVIEWER_PROVENANCE_MISSING' },
    { identity: 'contradictory', failure: 'REVIEWER_PROVENANCE_CONTRADICTORY' },
  ])(
    'rejects $identity reviewer provenance and continues through the bounded fallback routes',
    async ({ identity, failure }) => {
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
          preferred_failure: failure,
          review_policy: 'prefer',
          independence: 'none',
        },
      });
      expect(payload.data).not.toHaveProperty('reviewer_output');
    },
  );

  it.each(['prefer', 'require'] as const)(
    'confines reviewer writes to a disposable snapshot under $policy policy',
    async policy => {
      const directory = createTemporaryDirectory();
      const target = nodePath.join(directory, 'review-input.md');
      const log = nodePath.join(directory, 'review.log');
      const original = 'bounded review input\n';
      writeFileSync(target, original);
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({ crossAgentReview: policy }),
      );
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
        data: { review_policy: policy, independence: 'none' },
      });
    },
  );

  it.each(['prefer', 'require'] as const)(
    'marks the completed review stale when the reviewed source changes under $policy policy',
    async policy => {
      const directory = createTemporaryDirectory();
      const target = nodePath.join(directory, 'review-input.md');
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(target, 'bounded review input\n');
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({ crossAgentReview: policy }),
      );
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
            SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET: target,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(2);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        state: 'action_required',
        findings: [{ code: 'REVIEW_STALE' }],
        data: { status: 'stale' },
      });
    },
  );

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
      data: { review_policy: 'prefer', independence: 'none' },
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
      data: { review_policy: 'prefer', independence: 'none' },
    });
  });

  it('keeps author-vendor credentials outside the opposite reviewer boundary', async () => {
    const directory = createTemporaryDirectory();
    const reviewLog = nodePath.join(directory, 'review.log');
    const environmentLog = nodePath.join(directory, 'environment.log');
    const probeEnvironmentLog = nodePath.join(directory, 'probe-environment.log');
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
          PATH: `${bin}:/usr/bin:/bin`,
          ANTHROPIC_API_KEY: authorSecret,
          OPENAI_API_KEY: reviewerSecret,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_ENV_LOG: environmentLog,
          SAFEWORD_REVIEW_PROBE_ENV_LOG: probeEnvironmentLog,
          SAFEWORD_REVIEW_LOG: reviewLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(probeEnvironmentLog, 'utf8')).toBe('anthropic=absent\nopenai=absent\n');
    expect(readFileSync(environmentLog, 'utf8')).toBe(
      'anthropic=absent\nopenai=present\nprogress=absent\n',
    );
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
    expect(readFileSync(environmentLog, 'utf8')).toBe(
      'anthropic=present\nopenai=absent\nprogress=absent\n',
    );
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
      action: 'Reauthenticate Codex, then retry the original independent review.',
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
            SAFEWORD_REVIEW_TIMEOUT_MS: failure === 'timeout' ? '750' : '5000',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        state: 'action_required',
        effects: {
          network:
            classification === 'not_installed'
              ? []
              : [{ kind: 'review', target: 'codex', operation: 'request' }],
        },
        recovery: [{ description: action }],
        data: {
          status: 'blocked',
          preferred_failure: classification,
          review_policy: 'prefer',
          independence: 'none',
        },
      });
      expect(payload.recovery).toHaveLength(1);
    },
  );

  it.each([
    {
      author: 'claude',
      reviewer: 'codex',
      reviewerName: 'Codex',
      loginCommand: 'codex login',
    },
    {
      author: 'codex',
      reviewer: 'claude',
      reviewerName: 'Claude',
      loginCommand: 'claude auth login',
    },
  ] as const)(
    'hands an unauthenticated $reviewer route back for reauthentication before fallback',
    async ({ author, reviewer, reviewerName, loginCommand }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, reviewer);
      installFakeReviewer(directory, author);

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
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_FAKE_FAILURE: 'auth',
            SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: reviewer,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        findings: [
          {
            code: 'REVIEW_AUTHENTICATION_REQUIRED',
            message: expect.stringContaining(
              `The independent ${reviewerName} review needs authentication. Reauthenticate ${reviewerName}`,
            ),
          },
        ],
        effects: {
          network: [{ kind: 'review', target: reviewer, operation: 'request' }],
        },
        recovery: [
          {
            command: loginCommand,
            description: expect.stringMatching(/reauthenticate.*retry/iu),
            requires_human: true,
          },
        ],
        data: {
          status: 'blocked',
          assigned_reviewer: reviewer,
          preferred_failure: 'not_authenticated',
          review_policy: 'prefer',
          independence: 'none',
        },
      });
      expect(readFileSync(log, 'utf8')).toBe(`${reviewer}\n`);
    },
  );

  it.each([
    {
      failure: 'unsupported',
      classification: 'unsupported',
      action: 'Update Codex, then run the review again.',
    },
    {
      failure: 'timeout',
      classification: 'probe_timed_out',
      action: 'Run Codex --help to diagnose it, then retry review.',
    },
    {
      failure: 'launch',
      classification: 'launch_failed',
      action: 'Run Codex --help and fix its launch failure, then retry review.',
    },
  ])(
    'reports a $classification capability failure through the public CLI',
    async ({ failure, classification, action }) => {
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
            SAFEWORD_REVIEW_FAKE_HELP_FAILURE: failure,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_REVIEW_TIMEOUT_MS: failure === 'timeout' ? '750' : '5000',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        effects: { network: [] },
        recovery: [{ description: action }],
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
    const alternatePromptLog = nodePath.join(directory, 'alternate-prompt.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    writeFileSync(nodePath.join(directory, 'context.md'), 'supporting evidence\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--context',
        'context.md',
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
          SAFEWORD_REVIEW_MODEL_PROMPT_LOG: alternatePromptLog,
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
        alternate_model: 'vendor-model-2',
        alternate_model_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\ncodex\nclaude\n');
    expect(readFileSync(alternatePromptLog, 'utf8')).toContain(
      String.raw`"context_files":[{"path":"context.md","content":"supporting evidence\n"}]`,
    );
  });

  it('does not retry the same configured model as both primary and alternate', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewPrimaryModel: { codex: 'vendor-model-1' },
        crossAgentReviewAlternateModel: { codex: 'vendor-model-1' },
      }),
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
          SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: 'codex',
          SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
    expect(JSON.parse(result.stdout).data).not.toHaveProperty('alternate_model_failure');
  });

  it('skips an alternate-model route when the reviewer does not advertise model selection', async () => {
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
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY: 'missing',
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
          { kind: 'review', target: 'claude', operation: 'request' },
        ],
      },
      data: {
        status: 'approved',
        preferred_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(JSON.parse(result.stdout).data).not.toHaveProperty('alternate_model_failure');
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it('retries a configured primary route on the reviewer default model when model selection is unavailable', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    const modelPromptLog = nodePath.join(directory, 'model-prompt.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewPrimaryModel: { codex: 'vendor-model-1' } }),
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
          SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY: 'missing',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_REVIEW_MODEL_PROMPT_LOG: modelPromptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        status: 'approved',
        actual_reviewer: 'codex',
        preferred_model: 'vendor-model-1',
        preferred_model_failure: 'unsupported',
        independence: 'cross-agent',
      },
    });
    expect(JSON.parse(result.stdout).data).not.toHaveProperty('reviewer_model');
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(existsSync(modelPromptLog)).toBe(false);
  });

  it('uses OpenCode as an independent fallback before same-agent degraded review', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'require' }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'opencode');
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
          { kind: 'review', target: 'opencode', operation: 'request' },
        ],
      },
      data: {
        status: 'approved',
        author_agent: 'claude',
        assigned_reviewer: 'opencode',
        actual_reviewer: 'opencode',
        preferred_failure: 'process_failed',
        independence: 'cross-agent',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nopencode\n');
  });

  it('routes OpenCode-authored work to Claude instead of self-review', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'claude');
    installFakeReviewer(directory, 'opencode');

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
          SAFEWORD_AGENT_RUNTIME: 'opencode',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        author_agent: 'opencode',
        assigned_reviewer: 'claude',
        actual_reviewer: 'claude',
        independence: 'cross-agent',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('claude\n');
  });

  it('blocks required review when OpenCode returns a different dispatch identity', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReview: 'require' }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'opencode');
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
          SAFEWORD_REVIEW_FAKE_IDENTITY: 'dispatch',
          SAFEWORD_REVIEW_CLI_PROBE_TIMEOUT_MS: '2000',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      data: {
        status: 'blocked',
        author_agent: 'claude',
        assigned_reviewer: 'codex',
        preferred_failure: 'process_failed',
        independent_fallback_failure: 'REVIEWER_PROVENANCE_CONTRADICTORY',
        independence: 'none',
      },
    });
    expect(JSON.parse(result.stdout).data).not.toHaveProperty('reviewer_output');
    expect(readFileSync(log, 'utf8')).toBe('codex\nopencode\nclaude\n');
  });

  it('reports an OpenCode process failure before returning degraded same-author feedback', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'opencode');
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
          SAFEWORD_REVIEW_FAKE_FAILURE_OPENCODE: 'process',
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
          { kind: 'review', target: 'opencode', operation: 'request' },
          { kind: 'review', target: 'claude', operation: 'request' },
        ],
      },
      data: {
        status: 'approved',
        actual_reviewer: 'claude',
        preferred_failure: 'process_failed',
        independent_fallback_failure: 'process_failed',
        independence: 'degraded',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nopencode\nclaude\n');
  });

  it('preserves the configured-model rejection when the default-model retry needs authentication', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewPrimaryModel: { codex: 'vendor-model-1' } }),
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
          SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY: 'missing',
          SAFEWORD_REVIEW_FAKE_FAILURE: 'auth',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
      recovery: [{ command: 'codex login', requires_human: true }],
      data: {
        status: 'blocked',
        assigned_reviewer: 'codex',
        preferred_model: 'vendor-model-1',
        preferred_model_failure: 'unsupported',
        preferred_failure: 'not_authenticated',
        review_policy: 'prefer',
        independence: 'none',
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
  });

  it.each([
    { author: 'claude', reviewerName: 'Codex' },
    { author: 'codex', reviewerName: 'Claude' },
  ] as const)(
    'presents a missing-reviewer fallback as standard coverage with optional verbose guidance',
    async ({ author, reviewerName }) => {
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
      expect(result.stdout.split('\n', 1)[0]).toBe('Review complete — standard coverage.');
      expect(result.stdout).toContain('not independent');
      expect(result.stdout).not.toContain('To add independent coverage,');

      const verbose = await runCli(
        [
          'review',
          'run',
          'quality-review',
          'review-input.md',
          '--verbose',
          '--no-input',
          '--cwd',
          directory,
        ],
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
      expect(verbose.stdout).toContain(
        `To add independent coverage, install or update ${reviewerName}, then retry review.`,
      );
      expect(readFileSync(log, 'utf8')).toBe(`${author}\n${author}\n`);
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

    const output = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(2);
    expect(output).toMatchObject({
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
    const humanResult = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
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
    expect(humanResult.stdout.split('\n', 1)[0]).toBe(
      'Review blocked — standard coverage achieved; required independent coverage is unsatisfied.',
    );
    expect(humanResult.stdout).toContain(output.findings[0].message);
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\ncodex\nclaude\n');
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
        independent_fallback_failure: 'not_installed',
        fallback_failure: 'not_authenticated',
        review_policy: 'prefer',
        independence: 'none',
      },
    });
    expect(output.findings[0].message).toContain('second independent reviewer (OpenCode)');
    expect(output.data).not.toHaveProperty('reviewer_output');
    const humanResult = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
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
    expect(humanResult.stdout.split('\n', 1)[0]).toBe('Review incomplete.');
    expect(humanResult.stdout).toContain(output.findings[0].message);
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\ncodex\nclaude\n');
  });

  it('reports that a long independent check is running', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const log = nodePath.join(directory, 'review.log');
    const bin = installFakeReviewer(directory, 'codex');

    const result = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_FAKE_DELAY_AGENT: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toContain('Running the independent review in the background…');
  });

  it('keeps reporting progress while an unavailable reviewer moves to a fallback', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const log = nodePath.join(directory, 'review.log');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');

    const result = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_FAKE_DELAY_AGENT: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toContain('Running the independent review in the background…');
  });

  it('repeats a waiting heartbeat while the independent reviewer has not answered', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const log = nodePath.join(directory, 'review.log');
    const bin = installFakeReviewer(directory, 'codex');

    const result = await runCli(
      ['review', 'run', 'quality-review', 'review-input.md', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_FAKE_DELAY_AGENT: 'codex',
          SAFEWORD_PROGRESS_HEARTBEAT_MS: '150',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const heartbeats = result.stderr
      .split('\n')
      .filter(line => line.includes('Still waiting for the independent review…'));
    expect(heartbeats.length).toBeGreaterThan(1);
  });

  it('stays silent on stderr when the caller asked for machine output', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const log = nodePath.join(directory, 'review.log');
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
          SAFEWORD_REVIEW_FAKE_DELAY_AGENT: 'codex',
          SAFEWORD_PROGRESS_HEARTBEAT_MS: '150',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).not.toContain('Running the independent review in the background…');
    expect(result.stderr).not.toContain('Still waiting for the independent review…');
  });

  it.each([
    { reviewer: 'codex' as const, other: 'Claude' },
    { reviewer: 'claude' as const, other: 'Codex' },
  ])(
    'keeps managed machine output typed while identifying the active $reviewer reviewer',
    async ({ reviewer, other }) => {
      const directory = createTemporaryDirectory();
      const result = await runManagedJsonReview(directory, { reviewer });
      const label = reviewer === 'codex' ? 'Codex' : 'Claude';

      expect(result.exitCode, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        schema_version: 1,
        state: 'healthy',
        data: { actual_reviewer: reviewer, reviewer_output: { verdict: 'approve' } },
      });
      expect(result.stderr).toContain(`Requesting an independent ${label} review…`);
      expect(result.stderr).toContain(`Still waiting for a response from ${label}…`);
      expect(result.stderr).not.toContain(`independent ${other} review`);
      expect(result.stderr).not.toContain(`response from ${other}`);
    },
  );

  it('keeps the managed-progress signal out of the spawned reviewer environment', async () => {
    const directory = createTemporaryDirectory();
    const environmentLog = nodePath.join(directory, 'environment.log');
    const result = await runManagedJsonReview(directory, { environmentLog });

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toContain('Requesting an independent Codex review…');
    expect(readFileSync(environmentLog, 'utf8')).toContain('progress=absent\n');
  });

  it('carries managed progress through the wrapper, real CLI, and real coordinator', () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const log = nodePath.join(directory, 'review.log');
    const environmentLog = nodePath.join(directory, 'environment.log');
    const bin = installFakeReviewer(directory, 'codex');
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const result = spawnSync(
      process.execPath,
      [
        nodePath.join(repoRoot, 'packages/cli/templates/hooks/run-review.ts'),
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--agent-handoff',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_PROGRESS_HEARTBEAT_MS: '150',
          SAFEWORD_REVIEW_FAKE_DELAY_AGENT: 'codex',
          SAFEWORD_REVIEW_ENV_LOG: environmentLog,
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
        timeout: 30_000,
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      state: 'healthy',
      data: { actual_reviewer: 'codex', reviewer_output: { verdict: 'approve' } },
    });
    expect(result.stderr).toContain('Requesting an independent Codex review…');
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(readFileSync(environmentLog, 'utf8')).toContain('progress=absent\n');
  });

  it('preserves an action-required result after managed progress', async () => {
    const directory = createTemporaryDirectory();
    const result = await runManagedJsonReview(directory, { verdict: 'request_changes' });

    expect(result.exitCode, result.stdout).toBe(2);
    const output = JSON.parse(result.stdout) as {
      findings: { message: string }[];
    };
    expect(output).toMatchObject({
      schema_version: 1,
      state: 'action_required',
      data: { reviewer_output: { verdict: 'request_changes' } },
    });
    expect(output.findings).toContainEqual(expect.objectContaining({ message: 'Unsafe retry' }));
    expect(result.stderr).toContain('Requesting an independent Codex review…');
    expect(result.stderr).toContain('Still waiting for a response from Codex…');
  });

  it('keeps a direct JSON review silent while its reviewer remains active', async () => {
    const directory = createTemporaryDirectory();
    const result = await runManagedJsonReview(directory, { managed: false });

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ schema_version: 1, state: 'healthy' });
  });

  it.each([
    ['approve', 0, 'healthy'],
    ['request_changes', 2, 'action_required'],
  ] as const)(
    'lets quiet mode suppress managed progress for %s without suppressing the JSON result',
    async (verdict, exitCode, state) => {
      const directory = createTemporaryDirectory();
      const result = await runManagedJsonReview(directory, { quiet: true, verdict });

      expect(result.exitCode, result.stdout).toBe(exitCode);
      expect(JSON.parse(result.stdout)).toMatchObject({ schema_version: 1, state });
      expect(result.stderr).toBe('');
    },
  );

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

  it.each([0o777, 0o775])(
    'rejects a reviewer beneath a group- or world-writable PATH directory (%s)',
    async untrustedMode => {
      const directory = createTemporaryDirectory();
      const reviewLog = nodePath.join(directory, 'review.log');
      const maliciousLog = nodePath.join(directory, 'malicious.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');

      const maliciousRoot = createTemporaryDirectory();
      const maliciousBin = nodePath.join(maliciousRoot, 'bin');
      mkdirSync(maliciousBin);
      writeFileSync(
        nodePath.join(maliciousBin, 'codex'),
        `#!/bin/sh\nprintf 'invoked\\n' >> '${maliciousLog}'\nprintf '%s\\n' '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema --model'\n`,
        { mode: 0o755 },
      );
      chmodSync(maliciousBin, untrustedMode);
      const trustedBin = installFakeReviewer(directory, 'codex');
      chmodSync(trustedBin, 0o755);

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
            PATH: `${maliciousBin}:${trustedBin}:/usr/bin:/bin`,
            OPENAI_API_KEY: 'reviewer-secret',
            SAFEWORD_AGENT_RUNTIME: 'claude',
            SAFEWORD_REVIEW_LOG: reviewLog,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(readFileSync(reviewLog, 'utf8')).toBe('codex\n');
      expect(() => readFileSync(maliciousLog, 'utf8')).toThrow();
    },
  );

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
    machineCode: string;
  }>([
    {
      outcome: 'cross-agent',
      environment: {},
      firstLine: 'Review complete — independent coverage.',
      machineCode: 'REVIEW_INDEPENDENCE',
    },
    {
      outcome: 'degraded',
      environment: {
        SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
      },
      firstLine: 'Review complete — standard coverage.',
      machineCode: 'REVIEW_INDEPENDENCE_DEGRADED',
    },
    {
      outcome: 'blocked',
      environment: {
        SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
        SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE: 'auth',
      },
      firstLine: 'Review incomplete.',
      machineCode: 'REVIEW_ROUTES_EXHAUSTED',
    },
  ])('leads a $outcome human result with its independence status', async testCase => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'claude');
    const env = {
      PATH: `${bin}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'claude',
      SAFEWORD_REVIEW_LOG: log,
      SAFEWORD_NO_UPDATE_CHECK: '1',
      ...testCase.environment,
    };
    const args = [
      'review',
      'run',
      'quality-review',
      'review-input.md',
      '--no-input',
      '--cwd',
      directory,
    ];

    const humanResult = await runCli(args, { cwd: directory, env });
    const jsonResult = await runCli([...args, '--json'], { cwd: directory, env });
    const payload = JSON.parse(jsonResult.stdout) as {
      findings: { code: string }[];
      errors: { code: string }[];
    };
    const firstLine = humanResult.stdout.split('\n', 1)[0];

    expect(firstLine).toBe(testCase.firstLine);
    expect(payload.findings[0]?.code ?? payload.errors[0]?.code).toBe(testCase.machineCode);
  });

  async function expectRankedOrder(
    first: ReviewAgent,
    second: ReviewAgent,
    firstModel: string,
    secondModel: string,
  ) {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [
            { reviewer: first, model: firstModel },
            { reviewer: second, model: secondModel },
          ],
        },
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'opencode');
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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
          SAFEWORD_REVIEW_FAKE_FAILURE_AGENT: first,
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe(`${first}\n${second}\n`);
    const argumentsByRoute = readFileSync(`${log}.args`, 'utf8').trim().split('\n');
    expect(argumentsByRoute).toHaveLength(2);
    expect(argumentsByRoute[0]).toContain(`--model ${firstModel}`);
    expect(argumentsByRoute[1]).toContain(`--model ${secondModel}`);
    expect(JSON.parse(result.stdout)).toMatchObject({
      effects: {
        network: [
          { kind: 'review', target: first, operation: 'request' },
          { kind: 'review', target: second, operation: 'request' },
        ],
      },
      data: {
        assigned_reviewer: second,
        reviewer_model: secondModel,
        independence: 'cross-agent',
        review_routes: [
          { reviewer: first, model: firstModel, failure: 'process_failed' },
          { reviewer: second, model: secondModel, status: 'attempted' },
        ],
      },
    });
  }

  it('executes Codex then OpenCode with their configured models', async () => {
    await expectRankedOrder('codex', 'opencode', 'model-a', 'vendor/model-b');
  });

  it('executes OpenCode then Codex with their configured models', async () => {
    await expectRankedOrder('opencode', 'codex', 'vendor/model-b', 'model-a');
  });

  async function verifyRankedExecution(
    routes: readonly { reviewer: ReviewAgent; model?: string }[],
    options: { failure?: string; failureModel?: string; legacy?: boolean; funded?: boolean } = {},
  ) {
    const { failure = '', failureModel = '' } = options;
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    const argsLog = `${log}.args`;
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: { claude: routes },
        ...(options.legacy && {
          crossAgentReviewPrimaryModel: { codex: 'legacy-primary' },
          crossAgentReviewAlternateModel: { codex: 'legacy-alternate' },
        }),
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex', failureModel);
    installFakeReviewer(directory, 'opencode', failureModel);
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
          SAFEWORD_REVIEW_FAKE_FAILURE: failure,
          ...(options.funded && {
            SAFEWORD_REVIEW_RUN_BOUND_MS: '270000',
            SAFEWORD_REVIEW_TIMEOUT_MS: '120000',
          }),
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
    const exhausted = failure === 'process' && !failureModel;
    expect(result.exitCode, result.stdout).toBe(exhausted ? 2 : 0);
    const payload = JSON.parse(result.stdout);
    let attempts: readonly { readonly reviewer: ReviewAgent; readonly model?: string }[] =
      routes.slice(0, 1);
    if (failureModel) attempts = routes.slice(0, 2);
    if (exhausted) attempts = routes;
    expect(payload.data.review_routes).toEqual(
      attempts.map((route, index) => ({
        ...route,
        independence: 'cross-agent',
        status: 'attempted',
        ...((exhausted || (failureModel && index === 0)) && {
          failure: 'process_failed',
        }),
      })),
    );
    expect(readFileSync(log, 'utf8')).toBe(attempts.map(route => `${route.reviewer}\n`).join(''));
    const args = readFileSync(argsLog, 'utf8').trim().split('\n');
    expect(args).toHaveLength(attempts.length);
    assertModelArguments(attempts, args);
    expect(args.join('\n')).not.toContain('legacy-');
    return payload.data;
  }

  function assertModelArguments(routes: readonly { model?: string }[], args: string[]) {
    for (const [index, route] of routes.entries()) {
      if (route.model === undefined) expect(args[index]).not.toContain('--model');
      else expect(args[index]).toContain(`--model ${route.model}`);
    }
  }

  it('keeps a runtime-default route first in the configured chain', async () => {
    const data = await verifyRankedExecution([
      { reviewer: 'codex' },
      { reviewer: 'opencode', model: 'vendor/model-b' },
    ]);
    expect(data.actual_reviewer).toBe('codex');
  });

  it('stops ranked execution at the first independent success', async () => {
    const data = await verifyRankedExecution([
      { reviewer: 'codex', model: 'model-a' },
      { reviewer: 'opencode' },
    ]);
    expect(data.actual_reviewer).toBe('codex');
  });

  it('tries the next model after an attempt-only failure', async () => {
    const data = await verifyRankedExecution(
      [
        { reviewer: 'codex', model: 'model-a' },
        { reviewer: 'codex', model: 'model-b' },
        { reviewer: 'opencode' },
      ],
      { failure: 'process', failureModel: 'model-a' },
    );
    expect(data.actual_reviewer).toBe('codex');
  });

  it('blocks after every configured independent route fails', async () => {
    const data = await verifyRankedExecution(
      [
        { reviewer: 'codex', model: 'model-a' },
        { reviewer: 'opencode', model: 'vendor/model-b' },
      ],
      { failure: 'process' },
    );
    expect(data.independence).toBe('none');
  });

  it('launches a valid route with an explicitly funded run budget', async () => {
    const data = await verifyRankedExecution([{ reviewer: 'codex', model: 'model-a' }], {
      funded: true,
    });
    expect(data.actual_reviewer).toBe('codex');
  });

  it('never falls back to legacy models after configured routes exhaust', async () => {
    const data = await verifyRankedExecution(
      [
        { reviewer: 'codex', model: 'model-a' },
        { reviewer: 'opencode', model: 'vendor/model-b' },
      ],
      { failure: 'process', legacy: true },
    );
    expect(data.independence).toBe('none');
  });

  it('reports every unfunded ranked route without launching it', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    const clock = nodePath.join(directory, 'clock.cjs');
    // Advance the detached worker's clock only after the first real process launches.
    writeFileSync(
      clock,
      `const fs = require('node:fs');\nif (process.env.SAFEWORD_REVIEW_WORKER === '1') {\n const base = Date.now();\n Date.now = () => base + (fs.existsSync(${JSON.stringify(log)}) ? 210001 : 0);\n}\n`,
    );
    const routes = [
      { reviewer: 'codex', model: 'model-a' },
      { reviewer: 'opencode', model: 'vendor/model-b' },
      { reviewer: 'claude' },
    ];
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { claude: routes } }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'opencode');
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
          NODE_OPTIONS: `--require=${clock}`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '270000',
          SAFEWORD_REVIEW_TIMEOUT_MS: '120000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
    expect(result.exitCode, result.stdout).toBe(2);
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        independence: 'none',
        review_routes: [
          { ...routes[0], status: 'attempted', failure: 'process_failed' },
          { ...routes[1], status: 'unattempted' },
          { ...routes[2], status: 'unattempted' },
        ],
      },
    });
  });

  it.each([
    { author: 'claude', chain: ['codex', 'opencode', 'claude'] },
    { author: 'codex', chain: ['claude', 'opencode', 'codex'] },
    { author: 'opencode', chain: ['claude', 'codex', 'opencode'] },
  ] as const)(
    'preserves legacy route order for $author without an ordered list',
    async ({ author, chain }) => {
      const directory = createTemporaryDirectory();
      const log = nodePath.join(directory, 'review.log');
      const argsLog = `${log}.args`;
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, '.safeword', 'config.json'),
        JSON.stringify({
          crossAgentReviewPrimaryModel: { [chain[0]]: 'legacy-model' },
        }),
      );
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, 'codex');
      installFakeReviewer(directory, 'opencode');
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
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_REVIEW_FAKE_FAILURE: 'process',
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );
      expect(result.exitCode, result.stdout).toBe(2);
      const attempts = author === 'claude' ? chain : [chain[0], ...chain];
      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(attempts);
      expect(readFileSync(argsLog, 'utf8').split('\n', 1)[0]).toContain('--model legacy-model');
      expect(JSON.parse(result.stdout).data.independence).toBe('none');
    },
  );

  it('keeps a runtime-default route eligible after model selection is unsupported', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex', model: 'model-a' }, { reviewer: 'codex' }],
        },
      }),
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
          SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY: 'missing',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'codex',
        independence: 'cross-agent',
        review_routes: [
          { reviewer: 'codex', model: 'model-a', failure: 'unsupported' },
          { reviewer: 'codex', status: 'attempted' },
        ],
      },
    });
  });

  it.each([
    { projectOverride: false, reviewer: 'opencode' },
    { projectOverride: true, reviewer: 'codex' },
  ])(
    'executes only $reviewer with project override=$projectOverride',
    async ({ projectOverride, reviewer }) => {
      const directory = createTemporaryDirectory();
      const profile = nodePath.join(directory, 'profile');
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
      const bin = installFakeReviewer(directory, 'opencode');
      installFakeReviewer(directory, 'codex');
      const environment = {
        XDG_CONFIG_HOME: profile,
        SAFEWORD_AGENT_RUNTIME: 'claude',
        SAFEWORD_NO_UPDATE_CHECK: '1',
      };

      const configured = await runCli(
        [
          'review',
          'routes',
          'set',
          '--author',
          'claude',
          '--route',
          'opencode',
          '--json',
          '--no-input',
          '--cwd',
          directory,
        ],
        { cwd: directory, env: environment },
      );
      expect(configured.exitCode, configured.stdout).toBe(0);
      if (projectOverride) {
        const projectConfigured = await runCli(
          [
            'review',
            'routes',
            'set',
            '--scope',
            'project',
            '--author',
            'claude',
            '--route',
            'codex',
            '--json',
            '--no-input',
            '--cwd',
            directory,
          ],
          { cwd: directory, env: environment },
        );
        expect(projectConfigured.exitCode, projectConfigured.stdout).toBe(0);
      }

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
            ...environment,
            PATH: `${bin}:/usr/bin:/bin`,
            SAFEWORD_REVIEW_LOG: log,
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(readFileSync(log, 'utf8')).toBe(`${reviewer}\n`);
      expect(JSON.parse(result.stdout)).toMatchObject({
        data: {
          assigned_reviewer: reviewer,
          review_routes: [{ reviewer, independence: 'cross-agent', status: 'attempted' }],
        },
      });
    },
  );

  it('reports every attempted request when a ranked review completes degraded', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex' }, { reviewer: 'claude' }],
        },
      }),
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
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'process',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      effects: {
        network: [
          { kind: 'review', target: 'codex', operation: 'request' },
          { kind: 'review', target: 'claude', operation: 'request' },
        ],
      },
      data: {
        actual_reviewer: 'claude',
        independence: 'degraded',
        review_routes: [
          {
            reviewer: 'codex',
            independence: 'cross-agent',
            status: 'attempted',
            failure: 'process_failed',
          },
          { reviewer: 'claude', independence: 'degraded', status: 'attempted' },
        ],
      },
    });
    expect(readFileSync(log, 'utf8')).toBe('codex\nclaude\n');
  });

  it('continues past a same-author success to the next independent route', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'claude' }, { reviewer: 'codex' }],
        },
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('claude\ncodex\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'codex',
        independence: 'cross-agent',
        review_routes: [
          { reviewer: 'claude', independence: 'degraded', status: 'attempted' },
          { reviewer: 'codex', independence: 'cross-agent', status: 'attempted' },
        ],
      },
    });
  });

  it('keeps the first degraded success without running later same-author routes', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [
            { reviewer: 'claude', model: 'model-a' },
            { reviewer: 'claude', model: 'model-b' },
          ],
        },
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'claude');

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
    expect(readFileSync(log, 'utf8')).toBe('claude\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        reviewer_model: 'model-a',
        independence: 'degraded',
        review_routes: [
          { reviewer: 'claude', model: 'model-a', status: 'attempted' },
          { reviewer: 'claude', model: 'model-b', status: 'skipped' },
        ],
      },
    });
  });

  it('skips later models after a runtime-wide ranked-route failure', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [
            { reviewer: 'codex', model: 'model-a' },
            { reviewer: 'codex', model: 'model-b' },
            { reviewer: 'opencode' },
          ],
        },
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'opencode');
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
    expect(readFileSync(log, 'utf8')).toBe('opencode\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        actual_reviewer: 'opencode',
        independence: 'cross-agent',
        review_routes: [
          { reviewer: 'codex', model: 'model-a', status: 'unavailable', failure: 'not_installed' },
          { reviewer: 'codex', model: 'model-b', status: 'skipped' },
          { reviewer: 'opencode', status: 'attempted' },
        ],
      },
    });
  });

  it('hands ranked-route authentication back before any fallback runs', async () => {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [
            { reviewer: 'codex', model: 'model-a' },
            { reviewer: 'codex', model: 'model-b' },
            { reviewer: 'opencode', model: 'vendor/model-c' },
          ],
        },
      }),
    );
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'codex');
    installFakeReviewer(directory, 'opencode');

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
          SAFEWORD_REVIEW_FAKE_FAILURE_CODEX: 'auth',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(2);
    expect(readFileSync(log, 'utf8')).toBe('codex\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
      recovery: [{ command: 'codex login', requires_human: true }],
      data: {
        assigned_reviewer: 'codex',
        preferred_model: 'model-a',
        preferred_failure: 'not_authenticated',
        independence: 'none',
        review_routes: [
          {
            reviewer: 'codex',
            model: 'model-a',
            status: 'attempted',
            failure: 'not_authenticated',
          },
        ],
      },
    });
  });

  it.each([
    { name: 'empty author routes', routes: { claude: [] } },
    { name: 'terminal controls in an unknown author', routes: { ['bad\u{1B}\u{7}\u{202E}']: [] } },
  ])('rejects $name safely without launching a reviewer', async ({ routes }) => {
    await expectInvalidRoutes(routes);
  });

  it('rejects an option-shaped model before launching any reviewer', async () => {
    await expectInvalidRoutes({ claude: [{ reviewer: 'codex', model: '--unsafe' }] });
  });

  async function expectInvalidRoutes(routes: unknown) {
    const directory = createTemporaryDirectory();
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: routes }),
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

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      findings: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
      recovery: [{ command: 'safeword review routes list --author claude' }],
      data: { author_agent: 'claude', independence: 'none' },
    });
    const output = JSON.parse(result.stdout) as { findings: { message: string }[] };
    for (const control of ['\u{1B}', '\u{7}', '\u{202E}']) {
      expect(output.findings[0]?.message).not.toContain(control);
    }
    expect(existsSync(log)).toBe(false);
  }
});
