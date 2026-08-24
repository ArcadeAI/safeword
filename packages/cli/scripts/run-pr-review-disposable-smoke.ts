import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { createPrReviewSmokeFixture } from '../src/pr-review/smoke-fixture.js';

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  quiet?: boolean;
}

export type SmokeCommandExecutor = (
  executable: string,
  arguments_: string[],
  options?: CommandOptions,
) => string;

type GhClient = (arguments_: string[], options?: CommandOptions) => string;

interface Job {
  name: string;
  status: string;
}

interface Run {
  conclusion: string | undefined;
  id: number;
  run_attempt: number;
  status: string;
}

interface ConcurrencyMember {
  run_id: number;
  status: string;
}

const pauseBuffer = new Int32Array(new SharedArrayBuffer(4));

function pause(milliseconds: number): void {
  Atomics.wait(pauseBuffer, 0, 0, milliseconds);
}

function command(executable: string, arguments_: string[], options: CommandOptions = {}): string {
  const result = spawnSync(executable, arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${arguments_.join(' ')} failed\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  if (!options.quiet && result.stderr) process.stderr.write(result.stderr);
  return result.stdout.trim();
}

function gitAuthentication(token: string): NodeJS.ProcessEnv {
  const basicCredential = Buffer.from(`x-access-token:${token}`).toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basicCredential}`,
  };
}

export function createSmokeCommandClients(
  execute: SmokeCommandExecutor,
  baseToken: string,
  forkToken: string,
): {
  baseGh: GhClient;
  baseGit: (arguments_: string[], cwd: string) => string;
  forkGh: GhClient;
  forkGit: (arguments_: string[], cwd: string) => string;
} {
  const githubClient =
    (token: string): GhClient =>
    (arguments_, options = {}) =>
      execute('gh', arguments_, {
        ...options,
        env: { ...options.env, GH_TOKEN: token },
      });
  const gitClient =
    (token: string) =>
    (arguments_: string[], cwd: string): string =>
      execute('git', arguments_, { cwd, env: gitAuthentication(token) });
  return {
    baseGh: githubClient(baseToken),
    baseGit: gitClient(baseToken),
    forkGh: githubClient(forkToken),
    forkGit: gitClient(forkToken),
  };
}

function ghJson(path: string, ghClient: GhClient): unknown {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return JSON.parse(ghClient(['api', path], { quiet: true })) as unknown;
    } catch (error) {
      lastError = error;
      pause(attempt * 1000);
    }
  }
  throw lastError;
}

function waitFor<T>(description: string, probe: () => T | undefined, seconds = 300): T {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const value = probe();
    if (value !== undefined) return value;
    pause(2000);
  }
  throw new Error(`timed out waiting for ${description}`);
}

function serializedInConcurrencyGroup(
  ghClient: GhClient,
  repo: string,
  pullNumber: number,
  eventRunId: number,
  sweepRunId: number,
): boolean {
  try {
    const group = JSON.parse(
      ghClient(
        [
          'api',
          '-H',
          'X-GitHub-Api-Version: 2026-03-10',
          `repos/${repo}/actions/concurrency_groups/pr-review-${pullNumber}`,
        ],
        { quiet: true },
      ),
    ) as { group_members: ConcurrencyMember[] };
    const members = group.group_members.filter(member =>
      [eventRunId, sweepRunId].includes(member.run_id),
    );
    return (
      members.length === 2 &&
      members.some(member => member.status === 'in_progress') &&
      members.some(member => member.status === 'pending')
    );
  } catch {
    return false;
  }
}

function latestRun(
  ghClient: GhClient,
  repo: string,
  workflow: string,
  event: string,
): Run | undefined {
  const response = ghJson(
    `repos/${repo}/actions/workflows/${workflow}/runs?event=${event}&per_page=10`,
    ghClient,
  ) as { workflow_runs: Record<string, unknown>[] };
  const run = response.workflow_runs[0];
  if (run === undefined) return undefined;
  return {
    conclusion: typeof run.conclusion === 'string' ? run.conclusion : undefined,
    id: Number(run.id),
    run_attempt: Number(run.run_attempt),
    status: String(run.status),
  };
}

function jobs(ghClient: GhClient, repo: string, runId: number): Job[] {
  return (
    ghJson(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`, ghClient) as {
      jobs: Job[];
    }
  ).jobs;
}

function waitForSuccess(ghClient: GhClient, repo: string, runId: number): void {
  let minimumAttempt = 1;
  for (let retry = 0; retry <= 1; retry += 1) {
    const run = waitFor(
      `workflow run ${runId}`,
      () => {
        const value = ghJson(`repos/${repo}/actions/runs/${runId}`, ghClient) as Run;
        return value.status === 'completed' && value.run_attempt >= minimumAttempt
          ? value
          : undefined;
      },
      600,
    );
    if (run.conclusion === 'success') return;
    const detail = ghClient(['run', 'view', String(runId), '--repo', repo, '--log-failed'], {
      quiet: true,
    });
    const infrastructureFailure =
      /Service Unavailable|Internal Server Error|Failed to resolve action download info/u.test(
        detail,
      );
    if (retry === 0 && infrastructureFailure) {
      minimumAttempt = run.run_attempt + 1;
      ghClient(['run', 'rerun', String(runId), '--repo', repo, '--failed']);
      continue;
    }
    throw new Error(`workflow run ${runId} concluded ${run.conclusion}\n${detail}`);
  }
  throw new Error(`workflow run ${runId} exhausted its infrastructure retry`);
}

function snapshot(ghClient: GhClient, repo: string, pullNumber: number, headSha: string): string {
  const pull = ghJson(`repos/${repo}/pulls/${pullNumber}`, ghClient) as {
    mergeable: boolean | undefined;
    mergeable_state: string;
  };
  const reviews = ghJson(`repos/${repo}/pulls/${pullNumber}/reviews?per_page=100`, ghClient) as {
    id: number;
    state: string;
  }[];
  const statuses = ghJson(`repos/${repo}/commits/${headSha}/status`, ghClient) as {
    statuses: { context: string; state: string }[];
  };
  const checks = ghJson(`repos/${repo}/commits/${headSha}/check-runs`, ghClient) as {
    check_runs: { conclusion?: string; name: string; status: string }[];
  };
  return JSON.stringify({
    checks: checks.check_runs.map(({ conclusion, name, status }) => ({ conclusion, name, status })),
    mergeable: pull.mergeable,
    mergeableState: pull.mergeable_state,
    reviews: reviews.map(({ id, state }) => ({ id, state })),
    statuses: statuses.statuses.map(({ context, state }) => ({ context, state })),
  });
}

function writeFixture(directory: string): void {
  const fixture = createPrReviewSmokeFixture('0.0.0-smoke');
  const files = new Map([
    ['.github/workflows/safeword-pr-review.yml', fixture.router],
    ['.github/workflows/safeword-pr-review-publisher.yml', fixture.publisher],
    ['.github/workflows/safeword-pr-review-worker.yml', fixture.worker],
    ['.github/workflows/safeword-pr-review-smoke-sweep.yml', fixture.sweep],
    ['.safeword/config.json', fixture.config],
    ['README.md', '# Disposable Safeword advisory PR review smoke\n'],
  ]);
  for (const [path, content] of files) {
    const destination = nodePath.join(directory, path);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
}

interface CleanupSmokeResourcesInput {
  baseGh: GhClient;
  baseRepo: string;
  branch?: string;
  directory: string;
  forkGh: GhClient;
  forkRepo: string;
  pullNumber?: number;
  removeDirectory?: (directory: string) => void;
}

export function cleanupSmokeResources(input: CleanupSmokeResourcesInput): Error[] {
  const errors: Error[] = [];
  const attempt = (description: string, action: () => void): void => {
    try {
      action();
    } catch (error) {
      errors.push(
        new Error(`${description}: ${error instanceof Error ? error.message : String(error)}`),
      );
    }
  };
  if (input.pullNumber !== undefined) {
    attempt('close pull request', () => {
      input.baseGh(['pr', 'close', String(input.pullNumber), '--repo', input.baseRepo]);
    });
  }
  if (input.branch !== undefined) {
    attempt('delete fork branch', () => {
      input.forkGh([
        'api',
        '--method',
        'DELETE',
        `repos/${input.forkRepo}/git/refs/heads/${input.branch}`,
      ]);
    });
  }
  attempt('remove local fixture', () => {
    const removeDirectory =
      input.removeDirectory ??
      (directory => {
        rmSync(directory, { force: true, recursive: true });
      });
    removeDirectory(input.directory);
  });
  return errors;
}

export function resolveSmokeConfig(environment: NodeJS.ProcessEnv): {
  baseRepo: string;
  baseToken: string;
  forkOwner: string;
  forkRepo: string;
  forkToken: string;
} {
  const baseToken = (environment.GH_TOKEN || '').trim();
  const forkToken = (environment.SAFEWORD_PR_REVIEW_SMOKE_FORK_TOKEN || '').trim();
  if (!baseToken || !forkToken) {
    throw new Error('GH_TOKEN and SAFEWORD_PR_REVIEW_SMOKE_FORK_TOKEN are required');
  }
  return {
    baseRepo: 'ArcadeAI/safeword-pr-review-smoke-base',
    baseToken,
    forkOwner: 'TheMostlyGreat',
    forkRepo: 'TheMostlyGreat/safeword-pr-review-smoke-base',
    forkToken,
  };
}

interface VerifyResultInput {
  before: string;
  ghClient: GhClient;
  headSha: string;
  pullNumber: number;
  repo: string;
  runIds: number[];
}

function verifyResult(input: VerifyResultInput): string {
  const { before, ghClient, headSha, pullNumber, repo, runIds } = input;
  for (const runId of runIds) {
    const artifacts = ghJson(`repos/${repo}/actions/runs/${runId}/artifacts`, ghClient) as {
      total_count: number;
    };
    if (artifacts.total_count !== 1) {
      throw new Error(`run ${runId} did not emit one JSON handoff`);
    }
  }

  const comments = (
    ghJson(`repos/${repo}/issues/${pullNumber}/comments?per_page=100`, ghClient) as {
      body: string;
      html_url: string;
    }[]
  ).filter(comment => comment.body.startsWith('<!-- safeword:pr-review-receipt:v1 -->'));
  if (comments.length !== 1 || !comments[0]?.body.includes(`Reviewed revision: ${headSha}`)) {
    throw new Error('publication did not reconcile exactly one current ordinary issue comment');
  }
  const after = snapshot(ghClient, repo, pullNumber, headSha);
  if (after !== before) {
    throw new Error(
      `advisory smoke changed merge state, reviews, checks, or statuses\nbefore=${before}\nafter=${after}`,
    );
  }
  return comments[0].html_url;
}

export function runPrReviewDisposableSmoke(): void {
  const { baseRepo, baseToken, forkOwner, forkRepo, forkToken } = resolveSmokeConfig(process.env);
  const { baseGh, baseGit, forkGh, forkGit } = createSmokeCommandClients(
    command,
    baseToken,
    forkToken,
  );

  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase();
  const branch = `safeword-pr-review-smoke-${suffix}`;
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-smoke-'));
  let branchPushed = false;
  let failure: unknown;
  let output: string | undefined;
  let pullNumber: number | undefined;

  try {
    console.log(`Updating fixed sandbox fixture ${baseRepo}`);
    baseGit(['clone', `https://github.com/${baseRepo}.git`, directory], tmpdir());
    baseGit(['config', 'user.name', 'Safeword smoke'], directory);
    baseGit(['config', 'user.email', 'smoke@safeword.dev'], directory);
    writeFixture(directory);
    baseGit(['add', '.'], directory);
    if (baseGit(['status', '--porcelain'], directory) !== '') {
      baseGit(['commit', '-m', 'Update advisory PR review smoke fixture'], directory);
      baseGit(['push', 'origin', 'main'], directory);
    }

    baseGit(['checkout', '-b', branch], directory);
    writeFileSync(nodePath.join(directory, '.flux'), 'require_human_review = true\n');
    writeFileSync(nodePath.join(directory, '.safeword-smoke-run'), `${suffix}\n`);
    baseGit(['add', '.flux', '.safeword-smoke-run'], directory);
    baseGit(['commit', '-m', 'Exercise fork advisory review'], directory);
    forkGit(['push', `https://github.com/${forkRepo}.git`, `HEAD:refs/heads/${branch}`], directory);
    branchPushed = true;
    const pullUrl = baseGh([
      'pr',
      'create',
      '--repo',
      baseRepo,
      '--base',
      'main',
      '--head',
      `${forkOwner}:${branch}`,
      '--no-maintainer-edit',
      '--title',
      'Exercise advisory PR review smoke',
      '--body',
      'Disposable release compatibility proof.',
    ]);
    const createdPullNumber = Number(
      baseGh(['pr', 'view', pullUrl, '--repo', baseRepo, '--json', 'number', '--jq', '.number']),
    );
    if (!Number.isSafeInteger(createdPullNumber) || createdPullNumber <= 0) {
      throw new Error(`GitHub returned invalid pull request number: ${createdPullNumber}`);
    }
    pullNumber = createdPullNumber;
    const headSha = (
      ghJson(`repos/${baseRepo}/pulls/${createdPullNumber}`, baseGh) as { head: { sha: string } }
    ).head.sha;

    const eventRun = waitFor('fork pull_request_target run', () =>
      latestRun(baseGh, baseRepo, 'safeword-pr-review.yml', 'pull_request_target'),
    );
    waitForSuccess(baseGh, baseRepo, eventRun.id);
    const before = waitFor('stable pre-publication mergeability', () => {
      const value = snapshot(baseGh, baseRepo, createdPullNumber, headSha);
      return (JSON.parse(value) as { mergeableState: string }).mergeableState === 'unknown'
        ? undefined
        : value;
    });
    const publisherRun = waitFor('trusted fork-event publisher', () =>
      latestRun(baseGh, baseRepo, 'safeword-pr-review-publisher.yml', 'workflow_run'),
    );
    waitFor('trusted publication job', () =>
      jobs(baseGh, baseRepo, publisherRun.id).some(
        job => job.name === 'publish-event-result' && job.status === 'in_progress',
      )
        ? true
        : undefined,
    );

    baseGh([
      'workflow',
      'run',
      'safeword-pr-review-smoke-sweep.yml',
      '--repo',
      baseRepo,
      '--ref',
      'main',
      '-f',
      `pull_number=${createdPullNumber}`,
    ]);
    const sweepRun = waitFor('manual scheduled-call projection', () =>
      latestRun(baseGh, baseRepo, 'safeword-pr-review-smoke-sweep.yml', 'workflow_dispatch'),
    );
    waitFor('two serialized per-PR concurrency leases', () =>
      serializedInConcurrencyGroup(
        baseGh,
        baseRepo,
        createdPullNumber,
        publisherRun.id,
        sweepRun.id,
      )
        ? true
        : undefined,
    );

    waitForSuccess(baseGh, baseRepo, publisherRun.id);
    waitForSuccess(baseGh, baseRepo, sweepRun.id);
    const comment = verifyResult({
      before,
      ghClient: baseGh,
      headSha,
      pullNumber: createdPullNumber,
      repo: baseRepo,
      runIds: [eventRun.id, sweepRun.id],
    });

    output = JSON.stringify({
      comment,
      eventRun: eventRun.id,
      forkPullRequest: pullUrl,
      publisherRun: publisherRun.id,
      serialized: true,
      sweepRun: sweepRun.id,
    });
  } catch (error) {
    failure = error;
  }

  const cleanupErrors = cleanupSmokeResources({
    baseGh,
    baseRepo,
    branch: branchPushed ? branch : undefined,
    directory,
    forkGh,
    forkRepo,
    pullNumber,
  });
  const errors = [failure, ...cleanupErrors].filter(
    (error): error is Error => error instanceof Error,
  );
  if (errors.length > 0) {
    throw new AggregateError(errors, 'advisory PR review smoke failed');
  }
  if (output === undefined) {
    throw new Error('advisory PR review smoke completed without a result');
  }
  console.log(output);
}

if (import.meta.main) runPrReviewDisposableSmoke();
