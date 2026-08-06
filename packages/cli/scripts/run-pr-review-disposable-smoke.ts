import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { createPrReviewSmokeFixture } from '../src/pr-review/smoke-fixture.js';

interface CommandOptions {
  cwd?: string;
  input?: string;
  quiet?: boolean;
}

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
    env: process.env,
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

function gh(arguments_: string[], options?: CommandOptions): string {
  return command('gh', arguments_, options);
}

function ghJson(path: string): unknown {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return JSON.parse(gh(['api', path], { quiet: true })) as unknown;
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

function repoExists(repo: string): boolean {
  try {
    ghJson(`repos/${repo}`);
    return true;
  } catch {
    return false;
  }
}

function serializedInConcurrencyGroup(
  repo: string,
  pullNumber: number,
  eventRunId: number,
  sweepRunId: number,
): boolean {
  try {
    const group = JSON.parse(
      gh(
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

function latestRun(repo: string, workflow: string, event: string): Run | undefined {
  const response = ghJson(
    `repos/${repo}/actions/workflows/${workflow}/runs?event=${event}&per_page=10`,
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

function jobs(repo: string, runId: number): Job[] {
  return (ghJson(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`) as { jobs: Job[] }).jobs;
}

function waitForSuccess(repo: string, runId: number): void {
  let minimumAttempt = 1;
  for (let retry = 0; retry <= 1; retry += 1) {
    const run = waitFor(
      `workflow run ${runId}`,
      () => {
        const value = ghJson(`repos/${repo}/actions/runs/${runId}`) as Run;
        return value.status === 'completed' && value.run_attempt >= minimumAttempt
          ? value
          : undefined;
      },
      600,
    );
    if (run.conclusion === 'success') return;
    const detail = gh(['run', 'view', String(runId), '--repo', repo, '--log-failed'], {
      quiet: true,
    });
    const infrastructureFailure =
      /Service Unavailable|Internal Server Error|Failed to resolve action download info/u.test(
        detail,
      );
    if (retry === 0 && infrastructureFailure) {
      minimumAttempt = run.run_attempt + 1;
      gh(['run', 'rerun', String(runId), '--repo', repo, '--failed']);
      continue;
    }
    throw new Error(`workflow run ${runId} concluded ${run.conclusion}\n${detail}`);
  }
  throw new Error(`workflow run ${runId} exhausted its infrastructure retry`);
}

function snapshot(repo: string, pullNumber: number, headSha: string): string {
  const pull = ghJson(`repos/${repo}/pulls/${pullNumber}`) as {
    mergeable: boolean | undefined;
    mergeable_state: string;
  };
  const reviews = ghJson(`repos/${repo}/pulls/${pullNumber}/reviews?per_page=100`) as {
    id: number;
    state: string;
  }[];
  const statuses = ghJson(`repos/${repo}/commits/${headSha}/status`) as {
    statuses: { context: string; state: string }[];
  };
  const checks = ghJson(`repos/${repo}/commits/${headSha}/check-runs`) as {
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

function cleanupFixture(
  baseRepo: string,
  forkRepo: string,
  directory: string,
  baseCreated: boolean,
  forkCreated: boolean,
): void {
  if (process.env.SAFEWORD_KEEP_PR_REVIEW_SMOKE === '1') {
    console.log(`Keeping ${baseRepo} and ${forkRepo}`);
    return;
  }
  if (forkCreated) gh(['repo', 'delete', forkRepo, '--yes']);
  if (baseCreated) gh(['repo', 'delete', baseRepo, '--yes']);
  rmSync(directory, { force: true, recursive: true });
}

function verifyResult(
  repo: string,
  pullNumber: number,
  headSha: string,
  before: string,
  runIds: number[],
): string {
  for (const runId of runIds) {
    const artifacts = ghJson(`repos/${repo}/actions/runs/${runId}/artifacts`) as {
      total_count: number;
    };
    if (artifacts.total_count !== 1) {
      throw new Error(`run ${runId} did not emit one JSON handoff`);
    }
  }

  const comments = (
    ghJson(`repos/${repo}/issues/${pullNumber}/comments?per_page=100`) as {
      body: string;
      html_url: string;
    }[]
  ).filter(comment => comment.body.startsWith('<!-- safeword:pr-review-receipt:v1 -->'));
  if (comments.length !== 1 || !comments[0]?.body.includes(`Reviewed revision: ${headSha}`)) {
    throw new Error('publication did not reconcile exactly one current ordinary issue comment');
  }
  const after = snapshot(repo, pullNumber, headSha);
  if (after !== before) {
    throw new Error(
      `advisory smoke changed merge state, reviews, checks, or statuses\nbefore=${before}\nafter=${after}`,
    );
  }
  return comments[0].html_url;
}

export function runPrReviewDisposableSmoke(): void {
  const login = gh(['api', 'user', '--jq', '.login'], { quiet: true });
  const baseOwner = process.env.SAFEWORD_PR_REVIEW_SMOKE_OWNER || 'ArcadeAI';
  const forkOwner = process.env.SAFEWORD_PR_REVIEW_SMOKE_FORK_OWNER || login;
  if (baseOwner.toLowerCase() === forkOwner.toLowerCase()) {
    throw new Error('base and fork owners must differ to prove pull_request_target fork behavior');
  }

  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase();
  const repoName = `safeword-pr-review-smoke-${suffix}`;
  const baseRepo = `${baseOwner}/${repoName}`;
  const forkRepo = `${forkOwner}/${repoName}`;
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-smoke-'));
  let baseCreated = false;
  let forkCreated = false;

  try {
    console.log(`Creating disposable fixture ${baseRepo}`);
    gh([
      'repo',
      'create',
      baseRepo,
      '--public',
      '--description',
      'Disposable Safeword release smoke',
    ]);
    baseCreated = true;
    writeFixture(directory);
    command('git', ['init', '--initial-branch=main'], { cwd: directory });
    command('git', ['config', 'user.name', 'Safeword smoke'], { cwd: directory });
    command('git', ['config', 'user.email', 'smoke@safeword.dev'], { cwd: directory });
    command('git', ['add', '.'], { cwd: directory });
    command('git', ['commit', '-m', 'Add advisory PR review smoke fixture'], { cwd: directory });
    command('git', ['remote', 'add', 'origin', `https://github.com/${baseRepo}.git`], {
      cwd: directory,
    });
    command('git', ['push', '--set-upstream', 'origin', 'main'], { cwd: directory });

    gh(['api', '--method', 'PUT', `repos/${baseRepo}/environments/safeword-pr-review-model`]);
    gh(
      ['secret', 'set', 'OPENAI_API_KEY', '--env', 'safeword-pr-review-model', '--repo', baseRepo],
      { input: `smoke-${crypto.randomUUID()}\n` },
    );

    gh(['repo', 'fork', baseRepo, '--clone=false', '--fork-name', repoName]);
    waitFor('fork creation', () => (repoExists(forkRepo) ? true : undefined));
    forkCreated = true;

    command('git', ['checkout', '-b', 'smoke-fork-change'], { cwd: directory });
    writeFileSync(nodePath.join(directory, '.flux'), 'require_human_review = true\n');
    command('git', ['add', '.flux'], { cwd: directory });
    command('git', ['commit', '-m', 'Exercise fork advisory review'], { cwd: directory });
    command('git', ['push', `https://github.com/${forkRepo}.git`, 'HEAD:smoke-fork-change'], {
      cwd: directory,
    });
    const pullUrl = gh([
      'pr',
      'create',
      '--repo',
      baseRepo,
      '--base',
      'main',
      '--head',
      `${forkOwner}:smoke-fork-change`,
      '--title',
      'Exercise advisory PR review smoke',
      '--body',
      'Disposable release compatibility proof.',
    ]);
    const pullNumber = Number(
      gh(['pr', 'view', pullUrl, '--repo', baseRepo, '--json', 'number', '--jq', '.number']),
    );
    const headSha = (ghJson(`repos/${baseRepo}/pulls/${pullNumber}`) as { head: { sha: string } })
      .head.sha;

    const eventRun = waitFor('fork pull_request_target run', () =>
      latestRun(baseRepo, 'safeword-pr-review.yml', 'pull_request_target'),
    );
    waitForSuccess(baseRepo, eventRun.id);
    const before = waitFor('stable pre-publication mergeability', () => {
      const value = snapshot(baseRepo, pullNumber, headSha);
      return (JSON.parse(value) as { mergeableState: string }).mergeableState === 'unknown'
        ? undefined
        : value;
    });
    const publisherRun = waitFor('trusted fork-event publisher', () =>
      latestRun(baseRepo, 'safeword-pr-review-publisher.yml', 'workflow_run'),
    );
    waitFor('trusted publication job', () =>
      jobs(baseRepo, publisherRun.id).some(
        job => job.name === 'publish-event-result' && job.status === 'in_progress',
      )
        ? true
        : undefined,
    );

    gh([
      'workflow',
      'run',
      'safeword-pr-review-smoke-sweep.yml',
      '--repo',
      baseRepo,
      '--ref',
      'main',
      '-f',
      `pull_number=${pullNumber}`,
    ]);
    const sweepRun = waitFor('manual scheduled-call projection', () =>
      latestRun(baseRepo, 'safeword-pr-review-smoke-sweep.yml', 'workflow_dispatch'),
    );
    waitFor('two serialized per-PR concurrency leases', () =>
      serializedInConcurrencyGroup(baseRepo, pullNumber, publisherRun.id, sweepRun.id)
        ? true
        : undefined,
    );

    waitForSuccess(baseRepo, publisherRun.id);
    waitForSuccess(baseRepo, sweepRun.id);
    const comment = verifyResult(baseRepo, pullNumber, headSha, before, [eventRun.id, sweepRun.id]);

    console.log(
      JSON.stringify({
        comment,
        eventRun: eventRun.id,
        forkPullRequest: pullUrl,
        publisherRun: publisherRun.id,
        serialized: true,
        sweepRun: sweepRun.id,
      }),
    );
  } finally {
    cleanupFixture(baseRepo, forkRepo, directory, baseCreated, forkCreated);
  }
}

if (import.meta.main) runPrReviewDisposableSmoke();
