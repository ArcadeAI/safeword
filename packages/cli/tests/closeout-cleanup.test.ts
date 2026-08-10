import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { rememberCloseoutBinding } from '../templates/hooks/lib/closeout-binding.ts';
import { draftSpoolPath, markDraftsFiled } from '../templates/hooks/lib/retro-draft-spool.ts';
import {
  applyCleanupPlan,
  buildCleanupPlan,
  classifyRetroFailure,
  cleanupPlanDigest,
  type CloseoutObservation,
  defaultBranchArguments,
  executeCleanupOperation,
  operationCommand,
  parseWorktrees,
  POST_MERGE_VERIFICATION_KINDS,
  pullRequestIdentity,
  resolveCloseoutBinding,
  resolveProtection,
  resolveRemoteRef as resolveRemoteReference,
  retroAgentForRuntime,
  runBoundRetro,
  safewordCliCommand,
  transcriptMatchesBinding,
} from '../templates/scripts/closeout-cleanup.ts';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

function normalizedCloseoutScript(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(
      /import \{\s*type CloseoutBinding,\s*readFreshCloseoutBinding,\s*\} from '\.\.\/\.\.\/runtime\/hooks\/lib\/closeout-binding\.ts';/u,
      "import { type CloseoutBinding, readFreshCloseoutBinding } from '../hooks/lib/closeout-binding.ts';",
    )
    .replace('../../runtime/hooks/lib/retro-draft-spool.ts', '../hooks/lib/retro-draft-spool.ts')
    .replace('../../runtime/hooks/lib/run-identity.ts', '../hooks/lib/run-identity.ts');
}

function safeObservation(overrides: Partial<CloseoutObservation> = {}): CloseoutObservation {
  return {
    pullRequests: [
      {
        url: 'https://github.com/acme/widget/pull/42',
        state: 'MERGED',
        headOwner: 'acme',
        headRepository: 'widget',
        headRefName: 'feature/closeout',
        headRefOid: 'a'.repeat(40),
      },
    ],
    remote: { name: 'origin', url: 'git@github.com:acme/widget.git', oid: 'a'.repeat(40) },
    remoteResolution: 'matched',
    localRefOid: 'a'.repeat(40),
    defaultBranch: 'main',
    protection: 'unprotected',
    deliveryWorktreePath: '/repo-closeout',
    worktrees: [
      { path: '/repo', branch: 'main', oid: 'b'.repeat(40), main: true },
      {
        path: '/repo-closeout',
        branch: 'feature/closeout',
        oid: 'a'.repeat(40),
        main: false,
      },
    ],
    verification: { current: true, passed: true, headOid: 'a'.repeat(40), stateHash: 'clean' },
    retro: { bound: true, complete: true, pendingDrafts: 0 },
    ...overrides,
  };
}

function pullRequest() {
  const value = safeObservation().pullRequests[0];
  if (!value) throw new Error('fixture pull request missing');
  return value;
}

function worktree(index: number) {
  const value = safeObservation().worktrees[index];
  if (!value) throw new Error(`fixture worktree ${index} missing`);
  return value;
}

function runGit(...arguments_: string[]): string {
  const result = spawnSync('git', arguments_, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

describe('closeout cleanup guard (93C14D TBU1.R2/R3)', () => {
  it('revalidates immutable merged code without rerunning mutable dependency intelligence', () => {
    expect(POST_MERGE_VERIFICATION_KINDS).toEqual(['verify', 'build', 'typecheck', 'bdd']);
    expect(POST_MERGE_VERIFICATION_KINDS).not.toContain('deps');
  });

  it('uses Codex Desktop thread identity when the one-shot hook bridge is unavailable', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-codex-desktop-'));
    try {
      mkdirSync(nodePath.join(root, '.safeword'));
      writeFileSync(nodePath.join(root, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');

      expect(resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' })).toEqual({
        runtime: 'codex',
        id: 'desktop-thread-42',
        projectRoot: realpathSync(root),
      });
      expect(resolveCloseoutBinding(root, {})).toBeUndefined();

      rememberCloseoutBinding({
        projectDirectory: root,
        runtime: 'claude',
        id: 'hook-session-42',
        transcriptPath: '/exact/hook-session-42.jsonl',
      });
      expect(resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' })).toEqual({
        runtime: 'claude',
        id: 'hook-session-42',
        projectRoot: realpathSync(root),
        transcriptPath: '/exact/hook-session-42.jsonl',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('selects the mandatory retro extractor from the bound host runtime', () => {
    expect(retroAgentForRuntime('claude')).toBe('claude');
    expect(retroAgentForRuntime('codex')).toBe('codex');
    expect(retroAgentForRuntime('cursor')).toBe('cursor');
  });

  it.each(['claude', 'codex', 'cursor'] as const)(
    'passes the bound %s runtime to the real retro command boundary',
    runtime => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-agent-'));
      const transcript =
        runtime === 'cursor'
          ? nodePath.join(root, 'agent-transcripts', `${runtime}-42`, `${runtime}-42.jsonl`)
          : nodePath.join(root, 'transcript.jsonl');
      mkdirSync(nodePath.dirname(transcript), { recursive: true });
      writeFileSync(
        transcript,
        `${JSON.stringify(
          runtime === 'cursor'
            ? { role: 'user', message: { content: [{ type: 'text', text: 'hello' }] } }
            : { session_id: `${runtime}-42`, cwd: root },
        )}\n`,
      );
      let observedEnvironment: Record<string, string | undefined> | undefined;
      let observedArguments: string[] = [];
      try {
        const result = runBoundRetro(
          root,
          { runtime, id: `${runtime}-42`, projectRoot: root, transcriptPath: transcript },
          (_cwd, arguments_, env) => {
            observedArguments = arguments_;
            observedEnvironment = env;
            return {
              status: 0,
              stdout: JSON.stringify({
                state: 'healthy',
                data: { agent_filing_needed: false },
              }),
              stderr: '',
            };
          },
        );

        expect(result.complete).toBe(true);
        expect(observedArguments).toContain('--auto-extract');
        expect(observedEnvironment?.SAFEWORD_RETRO_AGENT).toBe(runtime);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it('reuses a completed extraction after the user files its pending drafts', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-filing-recovery-'));
    const id = 'claude-filing-recovery';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const spool = draftSpoolPath(root, id);
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(
        spool,
        `${JSON.stringify({
          signature: 'retro:filing-recovery',
          title: 'File the completed retrospective',
          body: 'A safe, already-extracted finding.',
          labels: ['retro'],
        })}\n`,
      );
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return {
          status: 0,
          stdout: JSON.stringify({ state: 'changed', data: { agent_filing_needed: true } }),
          stderr: '',
        };
      };

      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'filing',
      });
      markDraftsFiled(root, id, ['retro:filing-recovery']);
      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: true,
        pendingDrafts: 0,
      });
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reruns extraction when the bound transcript is rewritten after its snapshot', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-snapshot-invalidation-'));
    const id = 'claude-retro-snapshot-invalidation';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(
        transcript,
        `${JSON.stringify({ session_id: id, cwd: root, message: 'close this delivery' })}\n`,
      );
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return {
          status: 0,
          stdout: JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }),
          stderr: '',
        };
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      writeFileSync(
        transcript,
        `${JSON.stringify({ session_id: id, cwd: root, message: 'rewritten closeout context' })}\n`,
      );
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [true, '', false, 0, undefined],
    [false, 'Retro extraction failed.', false, 0, 'extraction'],
    [false, '', true, 0, 'filing'],
    [false, '', false, 1, 'filing'],
    [false, 'malformed output', false, 0, 'unknown'],
  ] as const)(
    'classifies the current retro outcome (%s, %s, %s, %s)',
    (complete, errorText, agentFilingNeeded, pendingDrafts, expected) => {
      expect(classifyRetroFailure({ complete, errorText, agentFilingNeeded, pendingDrafts })).toBe(
        expected,
      );
    },
  );

  it('resolves the project-local SafeWord CLI before the package runner fallback', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-cli-'));
    try {
      const installed = nodePath.join(root, 'node_modules', 'safeword', 'dist');
      mkdirSync(installed, { recursive: true });
      writeFileSync(nodePath.join(installed, 'cli.js'), '');

      expect(safewordCliCommand(root)).toEqual(['bun', nodePath.join(installed, 'cli.js')]);
      rmSync(nodePath.join(root, 'node_modules'), { recursive: true, force: true });
      expect(safewordCliCommand(root)).toEqual(['bunx', 'safeword']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('looks up the default branch in the pull request head repository', () => {
    expect(defaultBranchArguments(pullRequest())).toEqual([
      'repo',
      'view',
      'acme/widget',
      '--json',
      'defaultBranchRef',
    ]);
  });

  it('maps current GitHub pull request shapes without trusting incomplete identities', () => {
    const expected = pullRequest();
    expect(
      pullRequestIdentity({
        url: expected.url,
        state: expected.state,
        headRefName: expected.headRefName,
        headRefOid: expected.headRefOid,
        headRepositoryOwner: { login: expected.headOwner },
        headRepository: { name: expected.headRepository },
      }),
    ).toEqual(expected);
    expect(
      pullRequestIdentity({
        url: expected.url,
        state: expected.state,
        headRefName: expected.headRefName,
        headRefOid: expected.headRefOid,
        headRepository: { nameWithOwner: `${expected.headOwner}/${expected.headRepository}` },
      }),
    ).toEqual(expected);
    expect(
      pullRequestIdentity({
        url: expected.url,
        state: expected.state,
        headRefName: expected.headRefName,
        headRefOid: expected.headRefOid,
      }),
    ).toBeUndefined();
  });

  it('derives branch protection conservatively while allowing a proven-absent remote ref', () => {
    expect(resolveProtection('absent')).toBe('unprotected');
    expect(resolveProtection('matched', true)).toBe('protected');
    expect(resolveProtection('matched', false)).toBe('unprotected');
    expect(resolveProtection('matched')).toBe('unknown');
    expect(resolveProtection('unknown', false)).toBe('unprotected');
  });

  it('keeps installed and native-plugin closeout guards in canonical parity', () => {
    const template = normalizedCloseoutScript(
      nodePath.join(repoRoot, 'packages/cli/templates/scripts/closeout-cleanup.ts'),
    );
    expect(
      normalizedCloseoutScript(nodePath.join(repoRoot, '.safeword/scripts/closeout-cleanup.ts')),
    ).toBe(template);
    expect(
      normalizedCloseoutScript(
        nodePath.join(repoRoot, 'plugin/resources/scripts/closeout-cleanup.ts'),
      ),
    ).toBe(template);
  });

  it('previews exact cleanup in worktree, remote, local order with a stable digest', () => {
    const observation = safeObservation();
    const plan = buildCleanupPlan(observation);

    expect(plan.blockers).toEqual([]);
    expect(plan.operations.map(operation => operation.kind)).toEqual([
      'remove-worktree',
      'delete-remote-ref',
      'delete-local-ref',
    ]);
    expect(plan.operations[0]).toMatchObject({ path: '/repo-closeout', oid: 'a'.repeat(40) });
    expect(plan.operations[1]).toMatchObject({ remote: 'origin', oid: 'a'.repeat(40) });
    expect(plan.operations[2]).toMatchObject({ ref: 'refs/heads/feature/closeout' });
    expect(cleanupPlanDigest(plan)).toMatch(/^[a-f0-9]{64}$/);
    expect(cleanupPlanDigest(plan)).toBe(cleanupPlanDigest(buildCleanupPlan(observation)));
  });

  it('uses the unique default-branch worktree when the primary worktree is detached', () => {
    const observation = safeObservation({
      worktrees: [
        { path: '/repo-main', branch: 'main', oid: 'b'.repeat(40), main: false },
        worktree(1),
      ],
    });

    const plan = buildCleanupPlan(observation);

    expect(plan.blockers).toEqual([]);
    expect(plan.operations).toHaveLength(3);
    expect(plan.operations.every(operation => operation.cwd === '/repo-main')).toBe(true);
  });

  it('never removes the primary worktree even when another worktree holds the default branch', () => {
    const plan = buildCleanupPlan(
      safeObservation({
        worktrees: [
          { path: '/repo-main', branch: 'main', oid: 'b'.repeat(40), main: false },
          { ...worktree(1), main: true },
        ],
      }),
    );

    expect(plan.blockers).toContain('the main worktree is never a closeout target');
    expect(plan.operations).toEqual([]);
  });

  it.each([
    ['no pull request', { pullRequests: [] }, 'exactly one matching pull request is required'],
    [
      'ambiguous pull request',
      { pullRequests: [...safeObservation().pullRequests, ...safeObservation().pullRequests] },
      'exactly one matching pull request is required',
    ],
    [
      'unmerged pull request',
      { pullRequests: [{ ...pullRequest(), state: 'OPEN' }] },
      'the exact pull request is not confirmed merged',
    ],
    [
      'fork or remote mismatch',
      { remote: { name: 'origin', url: 'git@github.com:other/widget.git', oid: 'a'.repeat(40) } },
      'the pull request head repository does not match the selected git remote',
    ],
    [
      'lookalike remote host',
      {
        remote: {
          name: 'origin',
          url: 'https://evil.example/github.com/acme/widget.git',
          oid: 'a'.repeat(40),
        },
      },
      'the pull request head repository does not match the selected git remote',
    ],
    [
      'changed local ref',
      { localRefOid: 'c'.repeat(40) },
      'the local branch no longer matches the pull request head',
    ],
    [
      'changed remote ref',
      { remote: { name: 'origin', url: 'git@github.com:acme/widget.git', oid: 'c'.repeat(40) } },
      'the remote branch no longer matches the pull request head',
    ],
    [
      'ambiguous remote mapping',
      { remote: undefined, remoteResolution: 'ambiguous' },
      'the pull request head repository does not map to exactly one git remote',
    ],
    [
      'unobservable remote branch',
      { remote: undefined, remoteResolution: 'unknown' },
      'the remote branch state could not be observed',
    ],
    [
      'default branch',
      { pullRequests: [{ ...pullRequest(), headRefName: 'main' }] },
      'the default branch is never a closeout target',
    ],
    ['unknown default branch', { defaultBranch: '' }, 'the default branch is unknown'],
    ['unknown protection', { protection: 'unknown' }, 'branch protection state is unknown'],
    ['protected branch', { protection: 'protected' }, 'the topic branch is protected'],
    [
      'dirty worktree',
      { worktrees: [worktree(0), { ...worktree(1), dirty: true }] },
      'the linked worktree is dirty: /repo-closeout',
    ],
    [
      'locked worktree',
      { worktrees: [worktree(0), { ...worktree(1), locked: true }] },
      'the linked worktree is locked: /repo-closeout',
    ],
    [
      'stale registration',
      { worktrees: [worktree(0), { ...worktree(1), prunable: true }] },
      'the worktree registration is stale: /repo-closeout',
    ],
    [
      'ambiguous worktree',
      { worktrees: [worktree(0), worktree(1), worktree(1)] },
      'the linked topic worktree is ambiguous',
    ],
    [
      'missing default-branch worktree',
      { worktrees: [worktree(1)] },
      'exactly one surviving default-branch worktree is required',
    ],
    [
      'ambiguous default-branch worktree',
      {
        worktrees: [
          worktree(0),
          { ...worktree(0), path: '/another-main', main: false },
          worktree(1),
        ],
      },
      'exactly one surviving default-branch worktree is required',
    ],
    [
      'stale verification',
      { verification: { ...safeObservation().verification, current: false } },
      'local verification is stale',
    ],
    [
      'failed verification',
      { verification: { ...safeObservation().verification, passed: false } },
      'local verification failed',
    ],
    [
      'missing session binding',
      { retro: { ...safeObservation().retro, bound: false } },
      'the current host session binding is missing or expired',
    ],
    [
      'incomplete retro',
      { retro: { ...safeObservation().retro, complete: false } },
      'the current session retrospective is incomplete',
    ],
    [
      'failed retro extraction',
      { retro: { ...safeObservation().retro, complete: false, failure: 'extraction' } },
      'retrospective extraction failed; resolve the extraction failure',
    ],
    [
      'failed retro filing',
      { retro: { ...safeObservation().retro, complete: false, failure: 'filing' } },
      'retrospective filing failed; resolve the filing failure',
    ],
    [
      'pending drafts',
      { retro: { ...safeObservation().retro, pendingDrafts: 2 } },
      'the current session filing spool has pending drafts',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks every deletion',
    (_name, overrides, expectedBlocker) => {
      const plan = buildCleanupPlan(safeObservation(overrides));
      expect(plan.blockers).toContain(expectedBlocker);
      expect(plan.operations).toEqual([]);
    },
  );

  it('preserves a topic branch used by a different worktree', () => {
    const plan = buildCleanupPlan(safeObservation({ deliveryWorktreePath: '/somewhere-else' }));

    expect(plan.blockers).toContain(
      'the topic branch is used by a different worktree: /repo-closeout',
    );
    expect(plan.operations).toEqual([]);
  });

  it('treats proven-absent exact targets as complete without broadening scope', () => {
    const plan = buildCleanupPlan(
      safeObservation({
        worktrees: [worktree(0)],
        remote: undefined,
        remoteResolution: 'absent',
        localRefOid: undefined,
      }),
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.operations).toEqual([]);
    expect(plan.completed).toEqual(['worktree', 'remote branch', 'local branch']);
  });

  it('applies only a digest-bound unchanged plan using compare-and-swap commands', () => {
    const observation = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const observations = [observation, observation, afterWorktree, afterWorktree];
    const plan = buildCleanupPlan(observation);
    const executed: string[][] = [];

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? afterWorktree,
      execute: operation => {
        executed.push(operationCommand(operation));
      },
    });

    expect(result.applied).toBe(true);
    expect(executed).toEqual([
      ['git', '-C', '/repo', 'worktree', 'remove', '/repo-closeout'],
      [
        'git',
        '-C',
        '/repo',
        'push',
        `--force-with-lease=refs/heads/feature/closeout:${'a'.repeat(40)}`,
        'origin',
        ':refs/heads/feature/closeout',
      ],
      ['git', '-C', '/repo', 'update-ref', '-d', 'refs/heads/feature/closeout', 'a'.repeat(40)],
    ]);
    expect(executed.flat()).not.toContain('--force');
  });

  it('invalidates stale digests and changed observations before mutation', () => {
    const plan = buildCleanupPlan(safeObservation());
    const execute = () => {
      throw new Error('must not execute');
    };

    expect(
      applyCleanupPlan({ plan, digest: 'stale', observe: safeObservation, execute }).blockers,
    ).toContain('cleanup plan digest does not match');
    expect(
      applyCleanupPlan({
        plan,
        digest: cleanupPlanDigest(plan),
        observe: () =>
          safeObservation({
            verification: { ...safeObservation().verification, stateHash: 'changed' },
          }),
        execute,
      }).blockers,
    ).toContain('repository state changed after preview');
  });

  it('re-observes each remaining target and stops after a concurrent ref change', () => {
    const initial = safeObservation();
    const remote = initial.remote;
    if (!remote) throw new Error('fixture remote missing');
    const changedRemote = safeObservation({
      worktrees: [worktree(0)],
      remote: { ...remote, oid: 'c'.repeat(40) },
    });
    const observations = [initial, initial, changedRemote];
    const executed: string[] = [];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? changedRemote,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.applied).toBe(false);
    expect(result.blockers).toContain('delete-remote-ref target changed during cleanup');
    expect(executed).toEqual(['remove-worktree']);
  });

  it('reports completed and remaining operations after an execution failure', () => {
    const initial = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const observations = [initial, initial, afterWorktree];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? afterWorktree,
      execute: operation => {
        if (operation.kind === 'delete-remote-ref') throw new Error('lease rejected');
      },
    });

    expect(result).toMatchObject({
      applied: false,
      completed: ['remove-worktree'],
      remaining: ['delete-remote-ref', 'delete-local-ref'],
      blockers: ['delete-remote-ref failed: lease rejected'],
    });
  });

  it('runs each cleanup process from the operation surviving worktree', () => {
    const operation = buildCleanupPlan(safeObservation()).operations[1];
    if (!operation) throw new Error('fixture operation missing');
    const calls: { command: string; arguments_: string[]; cwd: string }[] = [];

    const result = executeCleanupOperation(operation, (command, arguments_, cwd) => {
      calls.push({ command, arguments_, cwd });
      return { status: 0, stdout: '', stderr: '' };
    });

    expect(result.status).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.cwd).toBe('/repo');
  });

  it('distinguishes an absent remote ref from an unobservable remote', () => {
    expect(resolveRemoteReference({ status: 0, stdout: '', stderr: '' })).toEqual({
      resolution: 'absent',
    });
    expect(
      resolveRemoteReference({ status: 1, stdout: '', stderr: 'authentication failed' }),
    ).toEqual({
      resolution: 'unknown',
    });
    expect(
      resolveRemoteReference({
        status: 0,
        stdout: `${'a'.repeat(40)}\trefs/heads/topic\n`,
        stderr: '',
      }),
    ).toEqual({ resolution: 'matched', oid: 'a'.repeat(40) });
  });

  it('executes the exact cleanup commands against a real linked git worktree and remote', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-git-'));
    const main = nodePath.join(sandbox, 'main');
    const topic = nodePath.join(sandbox, 'topic');
    const remote = nodePath.join(sandbox, 'remote.git');
    try {
      runGit('init', '--bare', remote);
      runGit('init', '--initial-branch=main', main);
      runGit('-C', main, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', main, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(main, 'README.md'), 'main\n');
      runGit('-C', main, 'add', 'README.md');
      runGit('-C', main, 'commit', '-m', 'main');
      runGit('-C', main, 'remote', 'add', 'origin', remote);
      runGit('-C', main, 'push', '-u', 'origin', 'main');
      runGit('-C', main, 'worktree', 'add', '-b', 'feature/closeout', topic);
      writeFileSync(nodePath.join(topic, 'feature.txt'), 'topic\n');
      runGit('-C', topic, 'add', 'feature.txt');
      runGit('-C', topic, 'commit', '-m', 'topic');
      runGit('-C', topic, 'push', '-u', 'origin', 'feature/closeout');
      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const mainWorktree = {
        path: main,
        branch: 'main',
        oid: runGit('-C', main, 'rev-parse', 'HEAD'),
        main: true,
      };
      const baseline = safeObservation({
        deliveryWorktreePath: topic,
        pullRequests: [{ ...pullRequest(), headRefOid: oid }],
        remote: { name: 'origin', url: 'git@github.com:acme/widget.git', oid },
        localRefOid: oid,
        worktrees: [mainWorktree, { path: topic, branch: 'feature/closeout', oid, main: false }],
        verification: { current: true, passed: true, headOid: oid, stateHash: 'real-git' },
      });
      const afterWorktree = { ...baseline, worktrees: [mainWorktree] };
      const afterRemote = {
        ...afterWorktree,
        remote: undefined,
        remoteResolution: 'absent' as const,
      };
      const observations = [baseline, baseline, afterWorktree, afterRemote];
      const plan = buildCleanupPlan(baseline);
      const result = applyCleanupPlan({
        plan,
        digest: cleanupPlanDigest(plan),
        observe: () => observations.shift() ?? afterRemote,
        execute: operation => {
          const [command, ...arguments_] = operationCommand(operation);
          if (!command) throw new Error('missing command');
          const execution = spawnSync(command, arguments_, { encoding: 'utf8' });
          if (execution.status !== 0) throw new Error(execution.stderr);
        },
      });

      expect(result.applied).toBe(true);
      expect(existsSync(topic)).toBe(false);
      expect(runGit('-C', main, 'ls-remote', '--heads', 'origin', 'feature/closeout')).toBe('');
      expect(
        spawnSync('git', ['-C', main, 'show-ref', '--verify', 'refs/heads/feature/closeout'])
          .status,
      ).not.toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('preserves a live topic worktree whose path contains blank lines', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-newline-'));
    const main = nodePath.join(sandbox, 'main');
    const topic = nodePath.join(sandbox, 'topic\n\nwith-blank-line');
    try {
      runGit('init', '--initial-branch=main', main);
      runGit('-C', main, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', main, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(main, 'README.md'), 'main\n');
      runGit('-C', main, 'add', 'README.md');
      runGit('-C', main, 'commit', '-m', 'main');
      runGit('-C', main, 'worktree', 'add', '-b', 'feature/closeout', topic);

      const worktrees = parseWorktrees(main);
      const canonicalTopic = realpathSync(topic);
      expect(worktrees.map(candidate => candidate.path)).toContain(canonicalTopic);
      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const plan = buildCleanupPlan(
        safeObservation({
          deliveryWorktreePath: main,
          pullRequests: [{ ...pullRequest(), headRefOid: oid }],
          localRefOid: oid,
          remote: undefined,
          remoteResolution: 'absent',
          worktrees,
          verification: { current: true, passed: true, headOid: oid, stateHash: 'newline' },
        }),
      );
      expect(plan.blockers).toContain(
        `the topic branch is used by a different worktree: ${canonicalTopic}`,
      );
      expect(plan.operations).toEqual([]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('discovers a linked default-branch survivor after the primary worktree is detached', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-detached-main-'));
    const primary = nodePath.join(sandbox, 'primary');
    const surviving = nodePath.join(sandbox, 'surviving-main');
    const topic = nodePath.join(sandbox, 'topic');
    try {
      runGit('init', '--initial-branch=main', primary);
      runGit('-C', primary, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', primary, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(primary, 'README.md'), 'main\n');
      runGit('-C', primary, 'add', 'README.md');
      runGit('-C', primary, 'commit', '-m', 'main');
      runGit('-C', primary, 'checkout', '--detach');
      runGit('-C', primary, 'worktree', 'add', surviving, 'main');
      runGit('-C', primary, 'worktree', 'add', '-b', 'feature/closeout', topic);

      const worktrees = parseWorktrees(primary);
      const survivingWorktree = {
        path: realpathSync(surviving),
        branch: 'main',
        main: false,
      };
      const topicWorktree = {
        path: realpathSync(topic),
        branch: 'feature/closeout',
        main: false,
      };
      expect(worktrees).toEqual(
        expect.arrayContaining([
          expect.objectContaining(survivingWorktree),
          expect.objectContaining(topicWorktree),
        ]),
      );

      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const plan = buildCleanupPlan(
        safeObservation({
          deliveryWorktreePath: realpathSync(topic),
          pullRequests: [{ ...pullRequest(), headRefOid: oid }],
          localRefOid: oid,
          remote: undefined,
          remoteResolution: 'absent',
          worktrees,
          verification: { current: true, passed: true, headOid: oid, stateHash: 'detached-main' },
        }),
      );

      expect(plan.blockers).toEqual([]);
      expect(plan.operations.every(operation => operation.cwd === realpathSync(surviving))).toBe(
        true,
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('accepts an exact bound session after its original worktree is removed', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-transcript-'));
    const otherRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-other-'));
    const originalWorktree = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-original-'));
    const transcript = nodePath.join(root, 'transcript.jsonl');
    mkdirSync(nodePath.join(root, '.project'));
    writeFileSync(
      transcript,
      `${JSON.stringify({ type: 'user', sessionId: 'session-42', cwd: originalWorktree })}\n`,
    );
    rmSync(originalWorktree, { recursive: true, force: true });

    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'claude', id: 'session-42', projectRoot: root },
        root,
      ),
    ).toBe(true);
    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'claude', id: 'other-session', projectRoot: root },
        root,
      ),
    ).toBe(false);
    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'claude', id: 'session-42', projectRoot: root },
        otherRoot,
      ),
    ).toBe(false);

    const spoofedText = ['session-42', root].join(' ');
    writeFileSync(transcript, `${JSON.stringify({ type: 'message', text: spoofedText })}\n`);
    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'claude', id: 'session-42', projectRoot: root },
        root,
      ),
    ).toBe(false);
  });

  it('accepts a real Cursor transcript only when its canonical path matches the bound id', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cursor-transcript-'));
    const id = 'c2f6d84a-473f-47a3-824d-1107b75f23ce';
    const directory = nodePath.join(root, 'agent-transcripts', id);
    const transcript = nodePath.join(directory, `${id}.jsonl`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      transcript,
      `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'hello' }] } })}\n`,
    );

    expect(
      transcriptMatchesBinding(transcript, { runtime: 'cursor', id, projectRoot: root }, root),
    ).toBe(true);
    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'cursor', id: 'different-id', projectRoot: root },
        root,
      ),
    ).toBe(false);
    expect(
      transcriptMatchesBinding(
        nodePath.join(directory, 'subagents', `${id}.jsonl`),
        { runtime: 'cursor', id, projectRoot: root },
        root,
      ),
    ).toBe(false);
  });
});
