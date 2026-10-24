import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { runCli } from '../helpers.js';
import { createTrustedReviewerDirectory } from '../review-fixtures.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// One Git fixture captures successive review snapshots; each scenario asserts its own result.
// eslint-disable-next-line complexity -- The fixture follows successive review snapshots without duplicating setup.
async function gatherBranchProof() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-review-'));
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
  writeFileSync(nodePath.join(project, 'seed.txt'), 'seed\n');
  writeFileSync(nodePath.join(project, 'remove-me.txt'), 'remove this later\n');
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\nforce-added.txt\n');
  writeFileSync(nodePath.join(project, '.gitattributes'), 'generated.out generated\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'remote', 'set-head', 'origin', '-a');
  git(project, 'checkout', '-b', 'topic');
  for (let index = 0; index < 35; index += 1) {
    writeFileSync(nodePath.join(project, `change-${index}.txt`), `${index}\n`);
  }
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'first part of feature');
  for (let index = 35; index < 70; index += 1) {
    writeFileSync(nodePath.join(project, `change-${index}.txt`), `${index}\n`);
  }
  writeFileSync(nodePath.join(project, 'generated.out'), 'generated output\n');
  writeFileSync(nodePath.join(project, '.env'), 'PRIVATE_TOKEN=committed-secret-sentinel\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');
  git(project, 'push', '-u', 'origin', 'topic');
  const changed = git(project, 'diff', '--name-only', 'origin/main...HEAD').split('\n');

  const reviewerRoot = createTrustedReviewerDirectory('branch-pass-');
  const reviewerBin = nodePath.join(reviewerRoot, 'bin');
  mkdirSync(reviewerBin);
  const reviewer = nodePath.join(reviewerBin, 'claude');
  writeFileSync(
    reviewer,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = '--version' ]; then printf 'claude 1.0.0\\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\\n' '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')
if [ -f "$SAFEWORD_REVIEW_LOG.mutate" ]; then
  mutate_path=$(cat "$SAFEWORD_REVIEW_LOG.mutate")
  printf 'changed during review\\n' >> "$mutate_path"
fi
printf 'pass\\n' >> "$SAFEWORD_REVIEW_LOG"
pass_count=$(/usr/bin/awk 'END { print NR }' "$SAFEWORD_REVIEW_LOG")
printf '%s\\n' "$payload" > "$SAFEWORD_REVIEW_LOG.$pass_count"
if [ "\${SAFEWORD_REVIEW_FAKE_FINDING:-}" = '1' ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Scenario is not met","findings":[{"severity":"error","message":"The access scenario fails across source.ts and caller.ts: callers can bypass the check; enforce it before returning data."}]}\\n' "$dispatch_id"
  exit 0
fi
if [ "\${SAFEWORD_REVIEW_FAKE_VERDICT:-}" = 'approve' ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed eligible branch files","findings":[]}\\n' "$dispatch_id"
  exit 0
fi
if [ "$pass_count" -gt 1 ]; then exit 9; fi
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"First pass reviewed","findings":[]}\\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(reviewer, 0o755);
  const result = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  });
  const report = JSON.parse(result.stdout) as {
    data?: {
      base?: string;
      head?: string;
      coverage?: string;
      reviewed_paths?: string[];
      omitted_paths?: { path: string }[];
    };
  };
  const accounted = [
    ...(report.data?.reviewed_paths ?? []),
    ...(report.data?.omitted_paths ?? []).map(entry => entry.path),
  ];
  const sorted = (paths: readonly string[]) =>
    paths.toSorted((left, right) => left.localeCompare(right));
  expect(sorted(accounted)).toEqual(sorted(changed));
  expect(report.data?.coverage).toBe('partial');
  expect(report.data?.base).toBe(git(project, 'merge-base', 'origin/main', 'HEAD'));
  expect(report.data?.head).toBe(git(project, 'rev-parse', 'HEAD'));
  expect(report.data?.omitted_paths).toContainEqual({
    path: 'generated.out',
    reason: 'marked as generated',
  });
  expect(report.data?.omitted_paths).toContainEqual({
    path: '.env',
    reason: 'sensitive path; content withheld from reviewer',
  });
  expect(readFileSync(nodePath.join(root, 'passes.log'), 'utf8').trim().split('\n')).toHaveLength(
    2,
  );
  const packetPaths = (pass: number) =>
    [
      ...new Set(
        readFileSync(nodePath.join(root, `passes.log.${pass}`), 'utf8').match(/change-\d+\.txt/gu),
      ),
    ].toSorted((left, right) => left.localeCompare(right));
  expect(packetPaths(1).length).toBeGreaterThan(0);
  expect(packetPaths(2).length).toBeGreaterThan(0);
  expect(readFileSync(nodePath.join(root, 'passes.log.1'), 'utf8')).not.toContain(
    'committed-secret-sentinel',
  );
  expect(readFileSync(nodePath.join(root, 'passes.log.2'), 'utf8')).not.toContain(
    'committed-secret-sentinel',
  );
  expect(sorted(report.data?.reviewed_paths ?? [])).toEqual(packetPaths(1));
  expect(
    sorted(
      (report.data?.omitted_paths ?? [])
        .map(entry => entry.path)
        .filter(path => path !== 'generated.out' && path !== '.env'),
    ),
  ).toEqual(packetPaths(2));

  git(project, 'reset', '--hard', 'main');
  const empty = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
    },
  });
  expect(JSON.parse(empty.stdout).data?.coverage).toBe('none');
  const emptyGate = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(emptyGate.stdout).data?.may_advance).toBe(false);
  expect(JSON.parse(emptyGate.stdout).findings?.[0]?.message).toContain(
    'No branch changes were reviewed',
  );

  writeFileSync(nodePath.join(project, 'source.ts'), 'export const allowed = true;\n');
  writeFileSync(nodePath.join(project, 'caller.ts'), 'export const result = true;\n');
  writeFileSync(
    nodePath.join(ticket, 'spec.md'),
    '# Access scenario\nCallers must pass the check before data is returned.\n',
  );
  const focused = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_REVIEW_FAKE_FINDING: '1',
    },
  });
  const focusedReport = JSON.parse(focused.stdout);
  expect(focusedReport.data?.coverage, focused.stdout).toBe('none');
  expect(focusedReport.data?.reviewed_paths).toEqual([]);
  const typedFinding = expect.objectContaining({
    affected_behavior: expect.stringContaining('access scenario'),
    related_paths: expect.arrayContaining(['source.ts', 'caller.ts']),
    consequence: expect.stringContaining('bypass the check'),
    priority: 'high',
  });
  expect(focusedReport.data?.branch_findings).toEqual(expect.arrayContaining([typedFinding]));
  expect(focusedReport.data?.omitted_paths).toContainEqual({
    path: 'source.ts',
    reason: 'uncommitted work; commit and review again for complete coverage',
  });
  expect(focusedReport.data?.review_passes?.[0]?.status).toBe('changes_requested');
  const matchingFinding = expect.objectContaining({
    severity: 'error',
    message: expect.stringContaining('source.ts and caller.ts'),
  });
  expect(focusedReport.findings).toEqual(expect.arrayContaining([matchingFinding]));
  expect(readFileSync(nodePath.join(root, 'passes.log.3'), 'utf8')).toContain('spec.md');
  expect(readFileSync(nodePath.join(root, 'passes.log.3'), 'utf8')).toContain('source.ts');
  expect(readFileSync(nodePath.join(root, 'passes.log.3'), 'utf8')).toContain('caller.ts');
  const findingGate = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(findingGate.stdout).data?.may_advance).toBe(false);

  writeFileSync(nodePath.join(root, 'passes.log.mutate'), nodePath.join(project, 'source.ts'));
  const editedDuringReview = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_REVIEW_FAKE_VERDICT: 'approve',
    },
  });
  rmSync(nodePath.join(root, 'passes.log.mutate'));
  expect(JSON.parse(editedDuringReview.stdout).data?.freshness).toBe('stale');
  const staleGate = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(staleGate.stdout).data?.may_advance).toBe(false);
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const allowed = true;\n');
  git(project, 'add', 'source.ts', 'caller.ts', '.project/tickets/ABC123-review-branch/spec.md');
  git(project, 'commit', '-m', 'save authored access work');

  writeFileSync(nodePath.join(project, '.env'), 'PRIVATE_TOKEN=must-stay-local\n');
  const dirty = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_REVIEW_FAKE_VERDICT: 'approve',
    },
  });
  const dirtyReport = JSON.parse(dirty.stdout);
  expect(dirtyReport.data?.freshness).toBe('current');
  expect(dirtyReport.data?.coverage).toBe('partial');
  expect(dirtyReport.data?.dirty_paths).toContain('.env');
  expect(dirtyReport.data?.omitted_paths).toContainEqual({
    path: '.env',
    reason: 'sensitive path; content withheld from reviewer',
  });
  expect(dirtyReport.data?.next_action).toContain('acknowledge');
  expect(readFileSync(nodePath.join(root, 'passes.log.5'), 'utf8')).not.toContain(
    'must-stay-local',
  );

  git(project, 'mv', 'seed.txt', 'renamed-seed.txt');
  git(project, 'rm', 'remove-me.txt');
  writeFileSync(nodePath.join(project, 'force-added.txt'), 'authored despite ignore rule\n');
  git(project, 'add', '-f', 'force-added.txt');
  git(project, 'commit', '-m', 'rename and remove legacy files');
  const renamed = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_REVIEW_FAKE_VERDICT: 'approve',
    },
  });
  const renamedReport = JSON.parse(renamed.stdout);
  expect(renamedReport.data?.reviewed_paths).toContain('renamed-seed.txt');
  expect(renamedReport.data?.reviewed_paths).toContain('force-added.txt');
  expect(renamedReport.data?.omitted_paths).toContainEqual({
    path: 'seed.txt',
    reason: 'deleted or renamed source',
  });
  expect(renamedReport.data?.omitted_paths).toContainEqual({
    path: 'remove-me.txt',
    reason: 'deleted or renamed source',
  });
  expect(renamedReport.data?.coverage).toBe('partial');
  const narrowed = await runCli(['review', 'branch', 'ABC123', 'HEAD~1', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(narrowed.stdout).ok).toBe(false);

  git(project, 'reset', '--hard', 'main');
  git(project, 'clean', '-fd');
  for (let index = 0; index < 4; index += 1) {
    writeFileSync(nodePath.join(project, `large-${index}.txt`), 'x'.repeat(240 * 1024));
  }
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'four reviewable large files');
  const bounded = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_REVIEW_LOG: nodePath.join(root, 'passes.log'),
      SAFEWORD_REVIEW_FAKE_VERDICT: 'approve',
    },
  });
  const boundedReport = JSON.parse(bounded.stdout);
  expect(boundedReport.data?.coverage).toBe('complete');
  expect(boundedReport.data?.review_passes).toHaveLength(2);

  writeFileSync(
    reviewer,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = '--version' ]; then printf 'claude 1.0.0\\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\\n' '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Change needed","findings":[{"severity":"error","message":"Unattributed problem"}]}\\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  const malformed = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
    },
  });
  const malformedReport = JSON.parse(malformed.stdout);
  expect(malformedReport.data?.coverage).toBe('none');
  expect(malformedReport.data?.reviewed_paths).toEqual([]);
  expect(malformedReport.data?.branch_findings).toEqual([]);
  expect(malformedReport.data?.omitted_paths).toContainEqual({
    path: 'large-0.txt',
    reason: 'review finding lacks behavior, related files, or consequence',
  });
  expect(malformedReport.findings).toEqual(
    expect.arrayContaining([expect.objectContaining({ message: 'Unattributed problem' })]),
  );
  const blockedSkip = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(blockedSkip.stdout).data?.skip_eligible).toBe(false);

  git(project, 'reset', '--hard', 'main');
  const superseding = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
    },
  });
  const supersedingId = JSON.parse(superseding.stdout).data?.review_id as string;
  writeFileSync(
    nodePath.join(project, '.project', 'skill-invocations.log'),
    `review:ABC123-review-branch:phase@implement review-id:${supersedingId} skip:No changed work remains at exit.\n`,
  );
  const supersedingCheck = await runCli(
    ['review', 'branch-check', 'ABC123', 'implement', '--json'],
    { cwd: project },
  );
  expect(JSON.parse(supersedingCheck.stdout).data?.may_advance).toBe(true);
  expect(JSON.parse(supersedingCheck.stdout).data?.disclosure).toContain('Unattributed problem');
  return {
    report,
    focusedReport,
    dirtyReport,
    renamedReport,
    narrowed: JSON.parse(narrowed.stdout),
    passOne: readFileSync(nodePath.join(root, 'passes.log.1'), 'utf8'),
    passTwo: readFileSync(nodePath.join(root, 'passes.log.2'), 'utf8'),
  };
}

const branchProof = (() => {
  let promise: ReturnType<typeof gatherBranchProof> | undefined;
  return (): ReturnType<typeof gatherBranchProof> => (promise ??= gatherBranchProof());
})();

it('refuses a caller-supplied later branch base', async () => {
  const proof = await branchProof();
  expect(proof.narrowed.ok).toBe(false);
});

it('attributes a cross-file finding to behavior, paths, and consequence', async () => {
  const proof = await branchProof();
  const expectedFinding = expect.objectContaining({
    affected_behavior: expect.stringContaining('access scenario'),
    related_paths: expect.arrayContaining(['source.ts', 'caller.ts']),
    consequence: expect.stringContaining('bypass the check'),
  });
  expect(proof.focusedReport.data?.branch_findings).toContainEqual(expectedFinding);
});

it('names a skipped generated file as an omission', async () => {
  const proof = await branchProof();
  expect(proof.report.data?.omitted_paths).toContainEqual({
    path: 'generated.out',
    reason: 'marked as generated',
  });
  expect(proof.report.data?.coverage).toBe('partial');
});

it('withholds a sensitive file from every review packet', async () => {
  const proof = await branchProof();
  expect(proof.report.data?.omitted_paths).toContainEqual({
    path: '.env',
    reason: 'sensitive path; content withheld from reviewer',
  });
  expect(proof.passOne).not.toContain('committed-secret-sentinel');
  expect(proof.passTwo).not.toContain('committed-secret-sentinel');
});

it('gives a builder the next action for partial coverage', async () => {
  const proof = await branchProof();
  expect(proof.dirtyReport.data?.next_action).toContain('acknowledge');
});

it('keeps a dirty branch current but partially covered', async () => {
  const proof = await branchProof();
  expect(proof.dirtyReport.data?.freshness).toBe('current');
  expect(proof.dirtyReport.data?.coverage).toBe('partial');
  expect(proof.dirtyReport.data?.dirty_paths).toContain('.env');
});

it('omits paths from a failed later review pass', async () => {
  const proof = await branchProof();
  expect(proof.report.data?.reviewed_paths?.length).toBeGreaterThan(0);
  expect(proof.report.data?.omitted_paths?.length).toBeGreaterThan(0);
  expect(proof.report.data?.coverage).toBe('partial');
});

it('inventories renamed, deleted, and force-added ignored paths', async () => {
  const proof = await branchProof();
  expect(proof.renamedReport.data?.reviewed_paths).toContain('renamed-seed.txt');
  expect(proof.renamedReport.data?.reviewed_paths).toContain('force-added.txt');
  expect(proof.renamedReport.data?.omitted_paths).toContainEqual({
    path: 'seed.txt',
    reason: 'deleted or renamed source',
  });
  expect(proof.renamedReport.data?.omitted_paths).toContainEqual({
    path: 'remove-me.txt',
    reason: 'deleted or renamed source',
  });
});

it('refuses a caller-selected subset of branch files', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-subset-'));
  roots.push(root);
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
  );
  writeFileSync(nodePath.join(project, 'one.ts'), 'export const one = 1;\n');
  writeFileSync(nodePath.join(project, 'two.ts'), 'export const two = 2;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const result = await runCli(['review', 'branch', 'ABC123', 'one.ts', '--json'], { cwd: project });
  const report = JSON.parse(result.stdout);
  expect(result.exitCode).toBe(1);
  expect(report.data?.review_id).toBeUndefined();
  expect(report.errors?.[0]?.message).toContain('too many arguments');
  expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).not.toContain(
    'branch_review_exit_id',
  );
});
