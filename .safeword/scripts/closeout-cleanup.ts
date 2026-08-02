#!/usr/bin/env bun

import { createHash } from 'node:crypto';

export interface PullRequestIdentity {
  url: string;
  state: string;
  headOwner: string;
  headRepository: string;
  headRefName: string;
  headRefOid: string;
}

export interface RemoteIdentity {
  name: string;
  url: string;
  oid: string;
}

export interface WorktreeIdentity {
  path: string;
  branch: string;
  oid: string;
  main: boolean;
  dirty?: boolean;
  locked?: boolean;
  prunable?: boolean;
}

export interface CloseoutObservation {
  pullRequests: PullRequestIdentity[];
  remote?: RemoteIdentity;
  localRefOid?: string;
  defaultBranch: string;
  protection: 'protected' | 'unprotected' | 'unknown';
  worktrees: WorktreeIdentity[];
  verification: { current: boolean; passed: boolean; headOid: string; stateHash: string };
  retro: { bound: boolean; complete: boolean; pendingDrafts: number };
}

export type CleanupOperation =
  | { kind: 'remove-worktree'; path: string; oid: string }
  | { kind: 'delete-remote-ref'; remote: string; ref: string; oid: string }
  | { kind: 'delete-local-ref'; ref: string; oid: string };

export interface CleanupPlan {
  version: 1;
  identity?: PullRequestIdentity;
  stateHash: string;
  blockers: string[];
  completed: string[];
  operations: CleanupOperation[];
}

function normalizedRepository(url: string): string | undefined {
  const normalized = url.trim().replace(/\.git$/u, '');
  const match = normalized.match(/(?:github\.com[/:])([^/]+)\/([^/]+)$/iu);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined;
}

function block(plan: CleanupPlan, message: string): void {
  if (!plan.blockers.includes(message)) plan.blockers.push(message);
}

export function buildCleanupPlan(observation: CloseoutObservation): CleanupPlan {
  const plan: CleanupPlan = {
    version: 1,
    stateHash: observation.verification.stateHash,
    blockers: [],
    completed: [],
    operations: [],
  };

  if (observation.pullRequests.length !== 1) {
    block(plan, 'exactly one matching pull request is required');
  }
  const pullRequest =
    observation.pullRequests.length === 1 ? observation.pullRequests[0] : undefined;
  if (pullRequest) plan.identity = pullRequest;
  if (pullRequest?.state !== 'MERGED')
    block(plan, 'the exact pull request is not confirmed merged');

  if (!observation.verification.current) block(plan, 'local verification is stale');
  if (!observation.verification.passed) block(plan, 'local verification failed');
  if (!observation.retro.bound)
    block(plan, 'the current host session binding is missing or expired');
  if (!observation.retro.complete) block(plan, 'the current session retrospective is incomplete');
  if (observation.retro.pendingDrafts > 0)
    block(plan, 'the current session filing spool has pending drafts');
  if (observation.protection === 'unknown') block(plan, 'branch protection state is unknown');
  if (observation.protection === 'protected') block(plan, 'the topic branch is protected');

  if (pullRequest) {
    const expectedRepository =
      `${pullRequest.headOwner}/${pullRequest.headRepository}`.toLowerCase();
    if (pullRequest.headRefName === observation.defaultBranch) {
      block(plan, 'the default branch is never a closeout target');
    }
    if (observation.verification.headOid !== pullRequest.headRefOid) {
      block(plan, 'verification does not cover the pull request head');
    }
    if (observation.localRefOid && observation.localRefOid !== pullRequest.headRefOid) {
      block(plan, 'the local branch no longer matches the pull request head');
    }
    if (observation.remote) {
      if (normalizedRepository(observation.remote.url) !== expectedRepository) {
        block(plan, 'the pull request head repository does not match the selected git remote');
      }
      if (observation.remote.oid !== pullRequest.headRefOid) {
        block(plan, 'the remote branch no longer matches the pull request head');
      }
    }

    const topicWorktrees = observation.worktrees.filter(
      worktree => worktree.branch === pullRequest.headRefName,
    );
    if (topicWorktrees.length > 1) block(plan, 'the linked topic worktree is ambiguous');
    const worktree = topicWorktrees[0];
    if (worktree?.main) block(plan, 'the main worktree is never a closeout target');
    if (worktree?.dirty) block(plan, `the linked worktree is dirty: ${worktree.path}`);
    if (worktree?.locked) block(plan, `the linked worktree is locked: ${worktree.path}`);
    if (worktree?.prunable) block(plan, `the worktree registration is stale: ${worktree.path}`);
    if (worktree && worktree.oid !== pullRequest.headRefOid) {
      block(plan, `the linked worktree no longer matches the pull request head: ${worktree.path}`);
    }

    if (plan.blockers.length === 0) {
      if (worktree) {
        plan.operations.push({
          kind: 'remove-worktree',
          path: worktree.path,
          oid: pullRequest.headRefOid,
        });
      } else {
        plan.completed.push('worktree');
      }
      if (observation.remote) {
        plan.operations.push({
          kind: 'delete-remote-ref',
          remote: observation.remote.name,
          ref: `refs/heads/${pullRequest.headRefName}`,
          oid: pullRequest.headRefOid,
        });
      } else {
        plan.completed.push('remote branch');
      }
      if (observation.localRefOid) {
        plan.operations.push({
          kind: 'delete-local-ref',
          ref: `refs/heads/${pullRequest.headRefName}`,
          oid: pullRequest.headRefOid,
        });
      } else {
        plan.completed.push('local branch');
      }
    }
  }

  return plan;
}

export function cleanupPlanDigest(plan: CleanupPlan): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

if (import.meta.main) {
  console.error(
    'closeout-cleanup is preview-first and requires a host-bound observation; invoke it through the closeout skill',
  );
  process.exit(2);
}
