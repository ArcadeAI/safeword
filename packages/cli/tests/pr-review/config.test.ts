import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deliverReview, resolvePrReviewConfig } from '../../src/pr-review/config.js';
import { createReviewPoster, type GitHubCall } from '../../src/pr-review/poster.js';
import type { Review } from '../../src/pr-review/verdict.js';

const CONTEXT = { owner: 'acme', repo: 'monorepo', pull: 42, headSha: 'deadbeef' };

const worthOneComment: Review = {
  verdict: 'needs-a-human',
  findings: [{ path: 'src/auth.ts', line: 12, consequence: 'A prefix match authenticates.' }],
};

function recordingPoster() {
  const calls: GitHubCall[] = [];
  const poster = createReviewPoster((method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    return Promise.resolve({});
  }, CONTEXT);
  return { calls, poster };
}

describe('pr-review configuration and the kill switch (36EEMY slice 8)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-prreview-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  function writeConfig(config: unknown): void {
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify(config),
    );
  }

  describe('autonomous-pr-review.SM1.R2 — a maintainer can turn it off without deleting it', () => {
    const rows = [
      { state: 'enables', prReview: { enabled: true, post: true }, count: 1 },
      { state: 'disables', prReview: { enabled: false }, count: 0 },
    ] as const;

    it.each(rows)(
      'autonomous-pr-review.SM1.R2.the_config_switch_toggles_posting_but_never_uninstalls [$state]',
      async ({ prReview, count }) => {
        writeConfig({ prReview });
        const { calls, poster } = recordingPoster();

        await deliverReview(worthOneComment, poster, resolvePrReviewConfig(projectDirectory));

        expect(calls.filter(c => c.path.endsWith('/comments'))).toHaveLength(count);
        // Disabled means SILENT, not merely comment-free: a receipt would still
        // be the reviewer speaking on a PR it was switched off for.
        if (count === 0) expect(calls).toHaveLength(0);
      },
    );

    it('runs quiet when enabled but not permitted to post — the shadow posture', async () => {
      // SM1.R1 wants measured evidence BEFORE the reviewer fires on someone
      // else's repo. `post: false` is how a maintainer watches it run without
      // spending a single unit of trust.
      writeConfig({ prReview: { enabled: true, post: false } });
      const { calls, poster } = recordingPoster();

      const result = await deliverReview(
        worthOneComment,
        poster,
        resolvePrReviewConfig(projectDirectory),
      );

      expect(calls).toHaveLength(0);
      expect(result.posted).toBe(false);
      expect(result.reason).toMatch(/shadow|post/i);
    });

    it('explains its silence, so a disabled reviewer is not mistaken for a broken one', async () => {
      writeConfig({ prReview: { enabled: false } });
      const { poster } = recordingPoster();

      const result = await deliverReview(
        worthOneComment,
        poster,
        resolvePrReviewConfig(projectDirectory),
      );

      expect(result.posted).toBe(false);
      expect(result.reason).toMatch(/disabled/i);
    });
  });

  describe('resolvePrReviewConfig — default-off, and an unreadable config never enables', () => {
    it('defaults to disabled when the project has no safeword config at all', () => {
      rmSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true, force: true });
      expect(resolvePrReviewConfig(projectDirectory).enabled).toBe(false);
    });

    it('defaults to disabled when prReview is absent from an otherwise valid config', () => {
      writeConfig({ installedPacks: ['typescript'] });
      expect(resolvePrReviewConfig(projectDirectory).enabled).toBe(false);
    });

    it('stays disabled on malformed JSON', () => {
      writeFileSync(nodePath.join(projectDirectory, '.safeword', 'config.json'), '{ not json');
      expect(resolvePrReviewConfig(projectDirectory).enabled).toBe(false);
    });

    it('stays disabled when enabled is a truthy string rather than a boolean', () => {
      // Fail-CLOSED: everything this gate protects is an outbound write to
      // someone else's pull request. A hand-written config is exactly where
      // `"true"` shows up, so only a literal boolean enables.
      writeConfig({ prReview: { enabled: 'true', post: 'true' } });
      const config = resolvePrReviewConfig(projectDirectory);
      expect(config.enabled).toBe(false);
      expect(config.post).toBe(false);
    });

    it('reads the required-check override and the arcade user when present', () => {
      writeConfig({
        prReview: { enabled: true, requiredChecks: ['ci/build'], arcade: { userId: 'a@b.com' } },
      });
      const config = resolvePrReviewConfig(projectDirectory);

      expect(config.enabled).toBe(true);
      expect(config.requiredChecks).toEqual(['ci/build']);
      expect(config.arcadeUserId).toBe('a@b.com');
    });

    it('ignores a non-array requiredChecks rather than crashing the run', () => {
      writeConfig({ prReview: { enabled: true, requiredChecks: 'ci/build' } });
      expect(resolvePrReviewConfig(projectDirectory).requiredChecks).toEqual([]);
    });

    it('resolves shared identity unless per-author is explicitly opted into', () => {
      // Absence must not pick the more permissive mode: per-author is what
      // re-enables tracker reads on forks, and it is not implemented yet.
      writeConfig({ prReview: { enabled: true, arcade: { userId: 'a@b.com' } } });
      expect(resolvePrReviewConfig(projectDirectory).identityMode).toBe('shared');

      writeConfig({ prReview: { enabled: true, identityMode: 'per-author' } });
      expect(resolvePrReviewConfig(projectDirectory).identityMode).toBe('per-author');
    });
  });
});
