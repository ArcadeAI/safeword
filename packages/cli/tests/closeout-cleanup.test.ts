/* eslint-disable import-x/no-unresolved -- RED: production guard is introduced by GREEN */
import { describe, expect, it } from 'vitest';

import {
  buildCleanupPlan,
  cleanupPlanDigest,
  type CloseoutObservation,
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
    ['no pull request', { pullRequests: [] }],
    [
      'ambiguous pull request',
      { pullRequests: [...safeObservation().pullRequests, ...safeObservation().pullRequests] },
    ],
    [
      'unmerged pull request',
      { pullRequests: [{ ...safeObservation().pullRequests[0], state: 'OPEN' }] },
    ],
    [
      'fork or remote mismatch',
      { remote: { name: 'origin', url: 'git@github.com:other/widget.git', oid: 'a'.repeat(40) } },
    ],
    ['changed local ref', { localRefOid: 'c'.repeat(40) }],
    [
      'changed remote ref',
      { remote: { name: 'origin', url: 'git@github.com:acme/widget.git', oid: 'c'.repeat(40) } },
    ],
    [
      'default branch',
      { pullRequests: [{ ...safeObservation().pullRequests[0], headRefName: 'main' }] },
    ],
    ['unknown protection', { protection: 'unknown' }],
    ['protected branch', { protection: 'protected' }],
    ['dirty worktree', { worktrees: [{ ...safeObservation().worktrees[1], dirty: true }] }],
    ['locked worktree', { worktrees: [{ ...safeObservation().worktrees[1], locked: true }] }],
    ['stale registration', { worktrees: [{ ...safeObservation().worktrees[1], prunable: true }] }],
    [
      'ambiguous worktree',
      { worktrees: [safeObservation().worktrees[1], safeObservation().worktrees[1]] },
    ],
    ['stale verification', { verification: { ...safeObservation().verification, current: false } }],
    ['failed verification', { verification: { ...safeObservation().verification, passed: false } }],
    ['missing session binding', { retro: { ...safeObservation().retro, bound: false } }],
    ['incomplete retro', { retro: { ...safeObservation().retro, complete: false } }],
    ['pending drafts', { retro: { ...safeObservation().retro, pendingDrafts: 2 } }],
  ] satisfies [string, Partial<CloseoutObservation>][])(
    '%s blocks every deletion',
    (_name, overrides) => {
      const plan = buildCleanupPlan(safeObservation(overrides));
      expect(plan.blockers.length).toBeGreaterThan(0);
      expect(plan.operations).toEqual([]);
    },
  );

  it('treats proven-absent exact targets as complete without broadening scope', () => {
    const plan = buildCleanupPlan(
      safeObservation({
        worktrees: [safeObservation().worktrees[0]],
        remote: undefined,
        localRefOid: undefined,
      }),
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.operations).toEqual([]);
    expect(plan.completed).toEqual(['worktree', 'remote branch', 'local branch']);
  });
});
