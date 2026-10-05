import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkRetrospectiveHistory,
  RETROSPECTIVE_CUTOFF,
} from '../../src/review/retrospective-history.js';
import { checkHistoryAgainstTrustedCutoff } from '../../src/review/retrospective-history-core.js';

function fixture(prefix = '') {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retrospective-history-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  const commit = (contents: string) => {
    writeFileSync(nodePath.join(root, 'proof.txt'), contents);
    git('add', 'proof.txt');
    git('commit', '-qm', contents);
    return git('rev-parse', 'HEAD');
  };
  const ancestor = commit(`${prefix}ancestor`);
  const cutoff = commit(`${prefix}cutoff`);
  const later = commit(`${prefix}later`);
  const request = {
    ticketId: 'CKWE2D',
    cutoff,
    baseline: cutoff,
    rationale: 'The implementation existed before the migration was authorized.',
  };
  const check = (overrides: Partial<typeof request> = {}, trustedCutoff = cutoff) =>
    checkHistoryAgainstTrustedCutoff(root, { ...request, ...overrides }, trustedCutoff);
  return {
    root,
    git,
    commit,
    ancestor,
    cutoff,
    later,
    check,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe('retrospective history prerequisite', () => {
  it('pins the authorized migration cutoff literally', () => {
    expect(RETROSPECTIVE_CUTOFF).toBe('690536ec56c07c2b042108d9c31d28bc3bc82619');
  });

  it('accepts a fixed cutoff as its own baseline and an earlier ancestor', () => {
    const history = fixture();
    try {
      expect(history.check()).toEqual({ eligibleForReview: true });
      expect(history.check({ baseline: history.ancestor })).toEqual({ eligibleForReview: true });
    } finally {
      history.cleanup();
    }
  });

  it('limits production use to CKWE2D and the immutable cutoff before Git work', () => {
    expect(
      checkRetrospectiveHistory('/not/a/repository', {
        ticketId: 'OTHER1',
        cutoff: RETROSPECTIVE_CUTOFF,
        baseline: RETROSPECTIVE_CUTOFF,
        rationale: 'historical implementation',
      }),
    ).toEqual({ eligibleForReview: false, reason: 'Only CKWE2D may use VERIFIED.' });
    expect(
      checkRetrospectiveHistory('/not/a/repository', {
        ticketId: 'CKWE2D',
        cutoff: '0'.repeat(40),
        baseline: RETROSPECTIVE_CUTOFF,
        rationale: 'historical implementation',
      }),
    ).toEqual({ eligibleForReview: false, reason: 'The migration cutoff changed.' });
  });

  it('requires rationale and a full baseline SHA', () => {
    const history = fixture();
    try {
      expect(history.check({ rationale: ' \n ' })).toEqual({
        eligibleForReview: false,
        reason: 'The RED-unavailability explanation is missing.',
      });
      expect(history.check({ baseline: 'HEAD~1' })).toEqual({
        eligibleForReview: false,
        reason: 'The baseline must be a full lowercase commit SHA.',
      });
    } finally {
      history.cleanup();
    }
  });

  it('rejects absent baseline and absent trusted cutoff objects separately', () => {
    const history = fixture();
    try {
      const missing = '0'.repeat(40);
      expect(history.check({ baseline: missing })).toEqual({
        eligibleForReview: false,
        reason: `Required commit ${missing} is unavailable.`,
      });
      expect(history.check({ cutoff: missing }, missing)).toEqual({
        eligibleForReview: false,
        reason: `Required commit ${missing} is unavailable.`,
      });
    } finally {
      history.cleanup();
    }
  });

  it('rejects a baseline later than the cutoff', () => {
    const history = fixture();
    try {
      expect(history.check({ baseline: history.later })).toEqual({
        eligibleForReview: false,
        reason: 'The baseline must be an ancestor-or-equal of the cutoff.',
      });
    } finally {
      history.cleanup();
    }
  });

  it('rejects a cutoff object that exists but is not reachable from HEAD', () => {
    const history = fixture();
    try {
      history.git('checkout', '-q', '--orphan', 'unrelated');
      history.git('rm', '-q', '-rf', '.');
      history.commit('unrelated');
      expect(history.check()).toEqual({
        eligibleForReview: false,
        reason: 'The fixed migration cutoff is not reachable from HEAD.',
      });
    } finally {
      history.cleanup();
    }
  });

  it('uses the requested repository even when a hook exports GIT_DIR', () => {
    const history = fixture();
    const other = fixture('different-repository-');
    const previous = process.env.GIT_DIR;
    try {
      process.env.GIT_DIR = nodePath.join(other.root, '.git');
      expect(history.check()).toEqual({ eligibleForReview: true });
    } finally {
      if (previous === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previous;
      history.cleanup();
      other.cleanup();
    }
  });

  it('fails closed when Git cannot run', () => {
    const history = fixture();
    const previous = process.env.PATH;
    try {
      process.env.PATH = '';
      expect(history.check()).toEqual({
        eligibleForReview: false,
        reason: 'Git could not inspect migration history.',
      });
    } finally {
      if (previous === undefined) delete process.env.PATH;
      else process.env.PATH = previous;
      history.cleanup();
    }
  });
});
