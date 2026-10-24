import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { runCli } from '../helpers.js';
import { claudeReviewerShellPrelude, createTrustedReviewerDirectory } from '../review-fixtures.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

type BranchReport = {
  errors?: { message: string }[];
  data?: {
    review_id?: string;
    base?: string;
    head?: string;
    reviewed_paths?: string[];
    omitted_paths?: { path: string; reason: string }[];
    coverage?: string;
    freshness?: string;
  };
};

function expectCompleteScope(report: BranchReport, project: string): void {
  expect(report.data?.base).toBe(git(project, 'merge-base', 'origin/main', 'HEAD'));
  expect(report.data?.head).toBe(git(project, 'rev-parse', 'HEAD'));
  expect(report.data?.reviewed_paths?.toSorted((left, right) => left.localeCompare(right))).toEqual(
    ['caller.ts', 'source.ts'],
  );
  expect(report.data?.coverage).toBe('complete');
  expect(report.data?.freshness).toBe('current');
  expect(report.data?.omitted_paths).toEqual([]);
}

it('reviews both authored files from the integration merge base against the ticket', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-scope-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n\n## Work Log\n',
  );
  writeFileSync(
    nodePath.join(ticket, 'spec.md'),
    '# Rule\nBoth files must be reviewed together.\n',
  );
  writeFileSync(nodePath.join(project, 'seed.txt'), 'base\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'remote', 'set-head', 'origin', '-a');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  git(project, 'add', 'source.ts');
  git(project, 'commit', '-m', 'add source');
  writeFileSync(nodePath.join(project, 'caller.ts'), 'export const result = 2;\n');
  git(project, 'add', 'caller.ts');
  git(project, 'commit', '-m', 'add caller');
  git(project, 'checkout', 'main');
  writeFileSync(nodePath.join(project, 'upstream.ts'), 'export const unrelated = true;\n');
  git(project, 'add', 'upstream.ts');
  git(project, 'commit', '-m', 'advance integration branch');
  git(project, 'push', 'origin', 'main');
  git(project, 'checkout', 'topic');
  expect(git(project, 'merge-base', 'origin/main', 'HEAD')).not.toBe(
    git(project, 'rev-parse', 'origin/main'),
  );

  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-scope-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nprintf '%s' "$payload" > "$SAFEWORD_REVIEW_LOG"\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed both files against the ticket","findings":[]}\\n' "$dispatch_id"\n`,
    { mode: 0o755 },
  );

  const result = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'review-packet.json'),
    },
  });
  const report = JSON.parse(result.stdout) as BranchReport;
  expect(result.exitCode, report.errors?.[0]?.message).toBe(0);
  expectCompleteScope(report, project);
  const reviewerPacket = readFileSync(nodePath.join(root, 'review-packet.json'), 'utf8');
  expect(reviewerPacket).toContain('Both files must be reviewed together.');
  expect(reviewerPacket).toContain('source.ts');
  expect(reviewerPacket).toContain('caller.ts');
  expect(reviewerPacket).toContain('export const value = 1;');
  expect(reviewerPacket).toContain('export const result = 2;');
  expect(reviewerPacket).not.toContain('upstream.ts');
  expect(reviewerPacket).not.toContain('export const unrelated = true;');

  const ticketBeforeOffline = readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8');
  const jobs = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
  const jobsBeforeOffline = readdirSync(jobs);
  const offline = await runCli(['review', 'branch', 'ABC123', '--offline', '--json'], {
    cwd: project,
  });
  const offlineReport = JSON.parse(offline.stdout) as BranchReport;
  expect(offline.exitCode).toBe(2);
  expect(offlineReport.data?.review_id).toBeUndefined();
  expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toBe(ticketBeforeOffline);
  expect(readdirSync(jobs)).toEqual(jobsBeforeOffline);

  git(project, 'remote', 'set-url', 'origin', nodePath.join(root, 'missing-remote.git'));
  const failedFetch = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  const failedReport = JSON.parse(failedFetch.stdout) as BranchReport;
  expect(failedFetch.exitCode).toBe(2);
  expect(failedReport.data?.review_id).toBeUndefined();
  expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toBe(ticketBeforeOffline);
  expect(readdirSync(jobs)).toEqual(jobsBeforeOffline);
});

it('says no branch work was reviewed when the integration base is unavailable', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-missing-base-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
  );
  writeFileSync(nodePath.join(project, 'seed.txt'), 'base\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/missing');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const result = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  const report = JSON.parse(result.stdout) as {
    data?: { coverage?: string; reviewed_paths?: string[] };
    findings?: { message?: string }[];
  };
  expect(report.data?.coverage).toBe('none');
  expect(report.data?.reviewed_paths).toEqual([]);
  expect(report.findings?.[0]?.message).toContain('No branch work was reviewed');

  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'reset', '--hard', 'main');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const dirty = true;\n');
  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-dirty-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Saw the dirty file","findings":[]}\\n' "$dispatch_id"\n`,
    { mode: 0o755 },
  );
  const dirty = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  });
  const dirtyReport = JSON.parse(dirty.stdout) as BranchReport;
  expect(dirtyReport.data?.coverage).toBe('none');
  expect(dirtyReport.data?.reviewed_paths).toEqual([]);
  expect(dirtyReport.data?.omitted_paths).toContainEqual({
    path: 'source.ts',
    reason: 'uncommitted work; commit and review again for complete coverage',
  });
});

it('refuses a topic branch as configured integration scope', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-self-base-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
  );
  writeFileSync(nodePath.join(project, 'seed.txt'), 'base\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  git(project, 'add', 'source.ts');
  git(project, 'commit', '-m', 'feature');
  git(project, 'push', '-u', 'origin', 'topic');
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(
    nodePath.join(project, '.safeword', 'config.json'),
    '{"branchReview":{"integrationRef":"refs/remotes/origin/topic"}}\n',
  );

  const result = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  const report = JSON.parse(result.stdout) as {
    data?: { review_id?: string; coverage?: string };
    findings?: { message?: string }[];
  };
  expect(result.exitCode).toBe(2);
  expect(report.findings?.[0]?.message ?? '').toContain('topic branch');
  expect(report.data?.review_id).toBeUndefined();
  expect(readFileSync(ticketPath, 'utf8')).not.toContain('branch_review_exit_id');
  expect(existsSync(nodePath.join(project, '.safeword', 'state', 'reviews', 'branch'))).toBe(false);
});
