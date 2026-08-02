import { describe, expect, it } from 'vitest';

import {
  applyCleanupPlan,
  buildCleanupPlan,
  cleanupPlanDigest,
  type CloseoutObservation,
  operationCommand,
} from '../templates/scripts/closeout-cleanup.ts';

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

describe('closeout cleanup guard (93C14D TBU1.R2/R3)', () => {
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
      'default branch',
      { pullRequests: [{ ...pullRequest(), headRefName: 'main' }] },
      'the default branch is never a closeout target',
    ],
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
});
