import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  applyCleanupPlan,
  buildCleanupPlan,
  type CleanupOperation,
  cleanupPlanDigest,
  type CloseoutObservation,
} from '../../templates/scripts/closeout-cleanup.ts';
import type { SafewordWorld } from './world.js';

interface CloseoutWorld extends SafewordWorld {
  closeoutObservation?: CloseoutObservation;
  closeoutOperations?: CleanupOperation[];
  closeoutAdvisories?: string[];
  closeoutResult?: ReturnType<typeof applyCleanupPlan>;
}

function observation(): CloseoutObservation {
  const oid = 'a'.repeat(40);
  return {
    pullRequests: [
      {
        url: 'https://github.com/acme/widget/pull/42',
        state: 'MERGED',
        headOwner: 'acme',
        headRepository: 'widget',
        headRefName: 'feature/closeout',
        headRefOid: oid,
        ciChecks: 'passed',
      },
    ],
    remote: {
      name: 'origin',
      url: 'git@github.com:acme/widget.git',
      pushUrl: 'git@github.com:acme/widget.git',
      oid,
    },
    remoteResolution: 'matched',
    localRefOid: oid,
    defaultBranch: 'main',
    protection: 'unprotected',
    deliveryWorktreePath: '/repo-closeout',
    worktrees: [
      { path: '/repo', branch: 'main', oid: 'b'.repeat(40), main: true },
      { path: '/repo-closeout', branch: 'feature/closeout', oid, main: false },
    ],
    verification: { current: true, passed: true, headOid: oid, stateHash: 'clean' },
    retro: { bound: true, complete: true, pendingDrafts: 0, evidenceHash: 'preview-retro' },
  };
}

Given(
  'an authorized cleanup preview with a completed retrospective',
  function (this: CloseoutWorld) {
    this.closeoutObservation = observation();
    this.closeoutOperations = [];
  },
);

Given('the bound transcript grows append-only before apply', function (this: CloseoutWorld) {
  assert.ok(this.closeoutObservation);
  this.closeoutObservation = {
    ...this.closeoutObservation,
    retro: {
      ...this.closeoutObservation.retro,
      evidenceHash: 'refreshed-host-progress',
    },
  };
});

Given(
  'the mandatory refreshed retrospective reports no unresolved work',
  function (this: CloseoutWorld) {
    assert.equal(this.closeoutObservation?.retro.complete, true);
  },
);

Given(
  'the mandatory refreshed retrospective reports unresolved work',
  function (this: CloseoutWorld) {
    assert.ok(this.closeoutObservation);
    this.closeoutObservation = {
      ...this.closeoutObservation,
      retro: {
        ...this.closeoutObservation.retro,
        complete: false,
        evidenceHash: 'refreshed-user-friction',
      },
    };
  },
);

When(
  'closeout refreshes the retrospective and applies the preview',
  function (this: CloseoutWorld) {
    const preview = observation();
    const plan = buildCleanupPlan(preview);
    const refreshed = this.closeoutObservation;
    assert.ok(refreshed);
    this.closeoutAdvisories = buildCleanupPlan(refreshed).advisories;
    let current: CloseoutObservation = refreshed;

    this.closeoutResult = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => current,
      execute: operation => {
        this.closeoutOperations?.push(operation);
        if (operation.kind === 'remove-worktree') {
          current = { ...current, worktrees: observation().worktrees.slice(0, 1) };
        } else if (operation.kind === 'delete-remote-ref') {
          current = { ...current, remote: undefined, remoteResolution: 'absent' };
        } else {
          current = { ...current, localRefOid: undefined };
        }
      },
    });
  },
);

Then('cleanup completes with the previewed exact targets', function (this: CloseoutWorld) {
  assert.equal(this.closeoutResult?.applied, true);
  assert.deepEqual(
    this.closeoutOperations?.map(operation => operation.kind),
    ['remove-worktree', 'delete-remote-ref', 'delete-local-ref'],
  );
});

Then('the incomplete retrospective is reported as an advisory', function (this: CloseoutWorld) {
  assert.ok(this.closeoutAdvisories?.includes('the current session retrospective is incomplete'));
});
