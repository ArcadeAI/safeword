import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reviewPrCommand } from '../../src/commands/review-pr.js';
import type { Review } from '../../src/pr-review/verdict.js';

// A WIRING test: real config loading, real createGitHubRequest, real poster,
// real trigger evaluation, real runPrReview. Only two process boundaries are
// faked — the env credential and global fetch. A fully-mocked suite can be green
// while config→module wiring is broken, which is exactly the class of bug this
// file exists to catch.

const HEAD = 'head0000000000000000000000000000000000';
const OLD = 'old00000000000000000000000000000000000';

const oneFinding: Review = {
  verdict: 'needs-a-human',
  findings: [{ path: 'src/auth.ts', line: 12, consequence: 'A prefix match authenticates.' }],
};

interface Routes {
  /** Files GitHub reports for the WHOLE pull request. */
  pullFiles: string[];
  /** Files changed between the last reviewed SHA and the head. */
  compareFiles: string[];
  /** Whether an earlier commit already carries the reviewer's receipt. */
  previouslyReviewed: boolean;
}

describe('safeword review-pr — entry point wiring (36EEMY)', () => {
  let projectDirectory: string;
  let originalToken: string | undefined;
  let requested: string[];

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-wiring-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ prReview: { enabled: true, post: true } }),
    );

    originalToken = process.env.GITHUB_TOKEN;
    // Shaped like a real token so resolveGitHubToken accepts it and never
    // shells out to `gh` (which would make this test depend on the machine).
    process.env.GITHUB_TOKEN = `ghs_${'a'.repeat(36)}`;
    requested = [];
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
    process.env.GITHUB_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  /** The payload GitHub would return for one path, or `{}` for anything else. */
  function payloadFor(path: string, routes: Routes): unknown {
    if (path.endsWith('/pulls/42')) {
      return { draft: false, head: { sha: HEAD }, base: { ref: 'main' } };
    }
    if (path.includes(`/commits/${HEAD}/check-runs`)) {
      return { check_runs: [{ name: 'build', conclusion: 'success' }] };
    }
    if (path.includes(`/commits/${OLD}/check-runs`)) {
      return {
        check_runs: routes.previouslyReviewed
          ? [{ name: 'safeword/pr-review', conclusion: 'neutral' }]
          : [],
      };
    }
    if (path.endsWith('/pulls/42/commits')) return [{ sha: OLD }, { sha: HEAD }];
    if (path.includes('/pulls/42/files')) {
      return routes.pullFiles.map(filename => ({ filename }));
    }
    if (path.includes('/compare/')) {
      return { files: routes.compareFiles.map(filename => ({ filename })) };
    }
    // Includes `/rules/branches/` — no ruleset, so the required set falls
    // through to config, then to all-checks.
    return [];
  }

  function stubGitHub(routes: Routes): void {
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      // Query string stripped before routing. Several of these endpoints are
      // requested with `?per_page=100`, and matching on the full URL silently
      // dropped them into the empty fallback — which made this stub report "no
      // prior review" and hid the very behavior the test was written to check.
      const path = input.replace('https://api.github.com', '').split('?', 1)[0] ?? '';
      requested.push(`${init?.method ?? 'GET'} ${path}`);
      return Promise.resolve(Response.json(payloadFor(path, routes)));
    });
  }

  it('drives a first review end to end and posts through the real poster', async () => {
    stubGitHub({ pullFiles: ['src/auth.ts'], compareFiles: [], previouslyReviewed: false });

    const outcome = await reviewPrCommand({
      repository: 'acme/monorepo',
      pull: '42',
      projectDirectory,
      review: () => Promise.resolve(oneFinding),
    });

    expect(outcome.ran).toBe(true);
    expect(outcome.posted).toBe(true);
    // Real config → real trigger → real poster, all the way to the wire.
    expect(requested).toContain('POST /repos/acme/monorepo/pulls/42/comments');
    expect(requested).toContain('POST /repos/acme/monorepo/check-runs');
  });

  it('drives prompt and bundle through the real vendor adapter without leaking GitHub auth', async () => {
    stubGitHub({ pullFiles: ['src/auth.ts'], compareFiles: [], previouslyReviewed: false });

    const promptDirectory = nodePath.join(projectDirectory, '.claude', 'skills', 'pr-review');
    mkdirSync(promptDirectory, { recursive: true });
    writeFileSync(nodePath.join(promptDirectory, 'SKILL.md'), 'Review this pull request.');

    const bundleDirectory = nodePath.join(projectDirectory, '.safeword-pr-review');
    mkdirSync(nodePath.join(bundleDirectory, 'files', 'src'), { recursive: true });
    writeFileSync(nodePath.join(bundleDirectory, 'pull-number'), '42');
    writeFileSync(
      nodePath.join(bundleDirectory, 'diff.patch'),
      'diff --git a/src/auth.ts b/src/auth.ts\n+const allowed = name.startsWith(prefix);\n',
    );
    writeFileSync(nodePath.join(bundleDirectory, 'files', 'src', 'auth.ts'), 'export {};\n');

    let childEnvironment: Record<string, string | undefined> | undefined;
    let childArgv: string[] = [];
    const outcome = await reviewPrCommand({
      repository: 'acme/monorepo',
      pull: '42',
      projectDirectory,
      bundleDirectory,
      spawn: (_binary, argv, options) => {
        childEnvironment = options.env;
        childArgv = argv;
        const outputPath = argv[argv.indexOf('-o') + 1];
        if (outputPath !== undefined) writeFileSync(outputPath, JSON.stringify(oneFinding));
        return { status: 0, stdout: '' };
      },
    });

    expect(outcome).toMatchObject({ ran: true, posted: true });
    expect(childArgv.join(' ')).toContain('Review this pull request.');
    expect(childArgv.join(' ')).toContain('const allowed = name.startsWith(prefix)');
    expect(childEnvironment).not.toHaveProperty('GITHUB_TOKEN');
    expect(requested).toContain('POST /repos/acme/monorepo/pulls/42/comments');
    expect(requested).toContain('POST /repos/acme/monorepo/check-runs');
  });

  it('does not re-review when only DOCS changed since the last review', async () => {
    // The pull request as a whole touches source — that source landed in the
    // commit already reviewed. Since then only docs changed, so R8 says stay
    // quiet. Reading the whole-PR file list instead of the diff SINCE the
    // reviewed SHA makes the reviewer re-fire on every docs push forever.
    stubGitHub({
      pullFiles: ['src/auth.ts', 'README.md'],
      compareFiles: ['README.md'],
      previouslyReviewed: true,
    });

    const outcome = await reviewPrCommand({
      repository: 'acme/monorepo',
      pull: '42',
      projectDirectory,
      review: () => Promise.resolve(oneFinding),
    });

    expect(outcome.ran).toBe(false);
    expect(outcome.reason).toMatch(/no material change/i);
  });

  it('stays silent and green when the project has not opted in', async () => {
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ prReview: { enabled: false } }),
    );
    stubGitHub({ pullFiles: [], compareFiles: [], previouslyReviewed: false });

    const outcome = await reviewPrCommand({
      repository: 'acme/monorepo',
      pull: '42',
      projectDirectory,
      review: () => Promise.resolve(oneFinding),
    });

    expect(outcome.ran).toBe(false);
    // Not one network call: a project that never opted in should not be queried.
    expect(requested).toHaveLength(0);
  });
});
