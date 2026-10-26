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
  findings?: { message: string }[];
  data?: {
    review_id?: string;
    base?: string;
    head?: string;
    reviewed_paths?: string[];
    omitted_paths?: { path: string; reason: string }[];
    coverage?: string;
    freshness?: string;
    skip_eligible?: boolean;
    fetched_at?: string;
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

// eslint-disable-next-line complexity -- One Git fixture checks scope, upstream movement, and saved review freshness.
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
    '---\nid: ABC123\ntype: feature\nphase: implement\nphase_anchors:\n  - scenario-gate: features/access.feature\n---\n# Review branch\n\n## Work Log\n',
  );
  mkdirSync(nodePath.join(project, 'features'));
  writeFileSync(
    nodePath.join(project, 'features', 'access.feature'),
    'Feature: Access\n  Scenario: Both files preserve access\n    Then callers cannot bypass the check\n',
  );
  writeFileSync(
    nodePath.join(ticket, 'spec.md'),
    '# Rule\nBoth files must be reviewed together.\n',
  );
  writeFileSync(nodePath.join(project, 'seed.txt'), 'base\n');
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\n.safeword/config.json\n');
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
  expect(reviewerPacket).toContain('Both files preserve access');
  expect(reviewerPacket).toContain('source.ts');
  expect(reviewerPacket).toContain('caller.ts');
  expect(reviewerPacket).toContain('export const value = 1;');
  expect(reviewerPacket).toContain('export const result = 2;');
  expect(reviewerPacket).not.toContain('upstream.ts');
  expect(reviewerPacket).not.toContain('export const unrelated = true;');

  git(project, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/topic');
  const localHeadChange = await runCli(
    ['review', 'branch-check', 'ABC123', 'implement', '--json'],
    {
      cwd: project,
    },
  );
  expect(JSON.parse(localHeadChange.stdout).data?.freshness).toBe('current');
  git(project, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');

  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  const configPath = nodePath.join(project, '.safeword', 'config.json');
  writeFileSync(configPath, '{"branchReview":{"integrationRef":"refs/remotes/origin/topic"}}\n');
  const changedConfig = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(changedConfig.stdout).data?.freshness).toBe('stale');
  rmSync(configPath);

  git(project, 'push', '-u', 'origin', 'topic');
  const integrator = nodePath.join(root, 'integrator');
  git(root, 'clone', remote, integrator);
  git(integrator, 'config', 'user.name', 'Integration Builder');
  git(integrator, 'config', 'user.email', 'integrator@example.test');
  git(integrator, 'merge', '--no-ff', 'origin/topic', '-m', 'merge reviewed topic');
  git(integrator, 'push', 'origin', 'main');
  git(project, 'fetch', 'origin', 'main');
  const afterMerge = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(afterMerge.stdout).data?.freshness).toBe('current');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 2;\n');
  const afterEdit = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(afterEdit.stdout).data?.freshness).toBe('stale');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');

  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: implement', 'phase: verify'),
  );
  const originalMarker = /^branch_review_exit_id:[^\n]*$/mu.exec(
    readFileSync(ticketPath, 'utf8'),
  )?.[0];
  const emptyReplacement = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'review-packet.json'),
    },
  });
  expect(JSON.parse(emptyReplacement.stdout).data?.coverage).toBe('none');
  const emptyCheck = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(emptyCheck.stdout).data?.skip_eligible).toBe(true);
  const replacementId = JSON.parse(emptyReplacement.stdout).data?.review_id;
  expect(readFileSync(ticketPath, 'utf8')).toContain(`branch_review_exit_id: ${replacementId}`);
  expect(readFileSync(ticketPath, 'utf8')).not.toContain(String(originalMarker));

  const jobs = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
  const jobsBeforeOffline = readdirSync(jobs);
  const offline = await runCli(['review', 'branch', 'ABC123', '--offline', '--json'], {
    cwd: project,
  });
  const offlineReport = JSON.parse(offline.stdout) as BranchReport;
  expect(offline.exitCode).toBe(2);
  expect(offlineReport.data?.review_id).toBeUndefined();
  expect(offlineReport.findings?.[0]?.message).toMatch(/offline/i);
  expect(readFileSync(ticketPath, 'utf8')).toContain(`branch_review_exit_id: ${replacementId}`);
  expect(readdirSync(jobs)).toHaveLength(jobsBeforeOffline.length);
  const offlineDecision = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  const offlineCheck = JSON.parse(offlineDecision.stdout) as BranchReport;
  expect(offlineCheck.data?.review_id).toBe(replacementId);

  git(project, 'remote', 'set-url', 'origin', nodePath.join(root, 'missing-remote.git'));
  const failedFetch = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  const failedReport = JSON.parse(failedFetch.stdout) as BranchReport;
  expect(failedFetch.exitCode).toBe(2);
  expect(failedReport.data?.coverage).toBe('none');
  expect(failedReport.data?.reviewed_paths).toEqual([]);
  expect(failedReport.data?.review_id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu);
  expect(failedReport.data?.review_id).not.toBe(replacementId);
  expect(readFileSync(ticketPath, 'utf8')).toContain(
    `branch_review_exit_id: ${failedReport.data?.review_id}`,
  );
  const failedDecision = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  const failedCheck = JSON.parse(failedDecision.stdout) as BranchReport;
  expect(failedCheck.data?.skip_eligible).toBe(true);
  expect(failedCheck.data?.fetched_at).toBeUndefined();
});

it('seals no-coverage evidence when a local repository has no remote', async () => {
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-local-only-'));
  roots.push(project);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
  );
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const result = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  const report = JSON.parse(result.stdout) as BranchReport;
  expect(result.exitCode).toBe(2);
  expect(report.data?.coverage).toBe('none');
  expect(report.data?.reviewed_paths).toEqual([]);
  expect(report.data?.review_id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu);
  expect(readFileSync(ticketPath, 'utf8')).toContain(
    `branch_review_exit_id: ${report.data?.review_id}`,
  );
  const decision = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  const check = JSON.parse(decision.stdout) as BranchReport;
  expect(check.data?.skip_eligible).toBe(true);
  expect(check.data?.fetched_at).toBeUndefined();
});

// eslint-disable-next-line complexity -- One Git fixture covers unavailable base and dirty-only coverage outcomes.
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

  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: implement', 'phase: verify'),
  );
  git(project, 'commit', '-am', 'record verification phase');
  const routineCheck = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(routineCheck.stdout).data?.freshness).toBe('current');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 2;\n');
  const authoredCheck = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(authoredCheck.stdout).data?.freshness).toBe('stale');
  const refreshed = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  expect(JSON.parse(refreshed.stdout).data?.coverage).toBe('none');
  const refreshedCheck = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(refreshedCheck.stdout).data?.skip_eligible).toBe(true);

  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'reset', '--hard', 'main');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const dirty = true;\n');
  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-dirty-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nif [ "\${SAFEWORD_REVIEW_FAKE_FINDING:-}" = '1' ]; then\n  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"The behavior fails","findings":[{"severity":"error","message":"The current file breaks the ticket rule."}]}\\n' "$dispatch_id"\n  exit 0\nfi\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Saw the dirty file","findings":[]}\\n' "$dispatch_id"\n`,
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
  const changesRequested = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_FAKE_FINDING: '1',
    },
  });
  expect(JSON.parse(changesRequested.stdout).data?.coverage).toBe('none');
  const skipCheck = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  const skipReport = JSON.parse(skipCheck.stdout) as {
    data?: { skip_eligible?: boolean };
    findings?: { message: string }[];
  };
  expect(skipReport.data?.skip_eligible).toBe(false);
  expect(skipReport.findings?.[0]?.message).toContain('requested changes');
  expect(skipReport.findings?.map(finding => finding.message)).toContain(
    'The current file breaks the ticket rule.',
  );
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

  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/missing');
  const unknownDefault = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
  expect(unknownDefault.exitCode).toBe(2);
  expect(JSON.parse(unknownDefault.stdout).findings?.[0]?.message).toContain('topic branch');
  expect(JSON.parse(unknownDefault.stdout).data?.review_id).toBeUndefined();
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');

  for (const invalid of [
    '{',
    '{"branchReview":42}',
    '{"branchReview":{"integrationRef":42}}',
    '{"branchReview":{"integrationRef":"HEAD~1"}}',
    '{"branchReview":{"integrationRef":"refs/remotes/--upload-pack=echo/main"}}',
    '{"branchReview":{"integrationRef":"refs/remotes/unknown/main"}}',
    '{"branchReview":{"integrationRef":"refs/remotes/origin/missing"}}',
  ]) {
    writeFileSync(nodePath.join(project, '.safeword', 'config.json'), `${invalid}\n`);
    const rejected = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project });
    expect(rejected.exitCode, invalid).toBe(2);
    expect(JSON.parse(rejected.stdout).data?.review_id, invalid).toBeUndefined();
    expect(readFileSync(ticketPath, 'utf8'), invalid).not.toContain('branch_review_exit_id');
    expect(existsSync(nodePath.join(project, '.safeword', 'state', 'reviews', 'branch'))).toBe(
      false,
    );
  }
});

it('reviews a topic tracking the configured non-default integration branch', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-develop-base-'));
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
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/config.json\n.safeword/state/\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'remote', 'set-head', 'origin', '-a');
  git(project, 'checkout', '-b', 'develop');
  writeFileSync(nodePath.join(project, 'develop.ts'), 'export const shared = true;\n');
  git(project, 'add', 'develop.ts');
  git(project, 'commit', '-m', 'shared integration work');
  git(project, 'push', '-u', 'origin', 'develop');
  git(project, 'checkout', '-b', 'topic');
  git(project, 'branch', '--set-upstream-to=origin/develop');
  writeFileSync(nodePath.join(project, 'topic.ts'), 'export const feature = true;\n');
  git(project, 'add', 'topic.ts');
  git(project, 'commit', '-m', 'topic work');
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(
    nodePath.join(project, '.safeword', 'config.json'),
    '{"branchReview":{"integrationRef":"refs/remotes/origin/develop"}}\n',
  );

  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-develop-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed topic","findings":[]}\\n' "$dispatch_id"\n`,
    { mode: 0o755 },
  );
  const result = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  });
  const report = JSON.parse(result.stdout) as BranchReport;
  expect(result.exitCode, JSON.stringify(report)).toBe(0);
  expect(report.data?.base).toBe(git(project, 'merge-base', 'origin/develop', 'HEAD'));
  expect(report.data?.reviewed_paths).toContain('topic.ts');
  expect(report.data?.reviewed_paths).not.toContain('develop.ts');
  expect(report.data?.coverage).toBe('complete');
});

it('shows mapped test source with a changed proof manifest', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-proof-context-'));
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
  mkdirSync(nodePath.join(project, 'tests'));
  writeFileSync(
    nodePath.join(project, 'tests', 'evidence.test.ts'),
    'test("mapped proof", () => { expect("proof-sentinel").toBeDefined(); });\n',
  );
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'checkout', '-b', 'topic');
  mkdirSync(nodePath.join(project, 'features'));
  writeFileSync(
    nodePath.join(project, 'features', 'access.bdd-proof.json'),
    JSON.stringify({
      scenarios: { 'Mapped behavior': ['tests/evidence.test.ts', 'mapped proof'] },
    }),
  );
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const access = true;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');
  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-proof-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nprintf '%s' "$payload" > "$SAFEWORD_REVIEW_LOG"\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed proof context","findings":[]}\\n' "$dispatch_id"\n`,
    { mode: 0o755 },
  );
  const review = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'packet.json'),
    },
  });
  expect(JSON.parse(review.stdout).data?.coverage).toBe('complete');
  expect(readFileSync(nodePath.join(root, 'packet.json'), 'utf8')).toContain('proof-sentinel');
});
