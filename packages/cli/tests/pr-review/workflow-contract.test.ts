import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const WORKFLOW_PATH = nodePath.join(
  import.meta.dirname,
  '..',
  '..',
  'templates',
  'workflows',
  'pr-review.yml',
);
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

/**
 * The workflow with comments stripped.
 *
 * The forbidden-token assertions below run against THIS, not the raw file: the
 * contract is about what the workflow is configured to do, and the header
 * explains at length why `pull_request_target` and `allow-unsafe-pr-checkout`
 * are avoided. Asserting on raw text would force us to delete the reasoning to
 * satisfy the test — losing the explanation that keeps the next editor from
 * reintroducing the very thing it warns about.
 */
const directives = workflow
  .split('\n')
  .map(line => {
    const hash = line.indexOf('#');
    return hash === -1 ? line : line.slice(0, hash);
  })
  .join('\n');

/** The block of a named job, up to the next top-level job key. */
function jobBlock(name: string): string {
  const start = directives.indexOf(`\n  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  const rest = directives.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}\w[\w-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('the shipped workflow keeps its fork-safety shape (36EEMY, SM1.R3)', () => {
  // These assertions exist because the trust model is structural, not
  // behavioral: nothing at runtime re-checks it. A future edit that
  // reintroduces the pwn-request shape has to fail here or it ships.

  it('never uses pull_request_target', () => {
    // The classic pwn-request: fork code executing with the base repo's
    // credentials in scope.
    expect(directives).not.toContain('pull_request_target');
  });

  it('never opts out of checkout’s fork protection', () => {
    expect(directives).not.toContain('allow-unsafe-pr-checkout');
  });

  it('gives the secretless stage-1 job read-only contents and nothing else', () => {
    const bundle = jobBlock('bundle');
    expect(bundle).toContain('contents: read');
    // The job that checks out the fork's head must hold no credential, so
    // there is nothing for injected code to reach.
    expect(bundle).not.toContain('secrets.');
    expect(bundle).not.toContain('id-token');
    expect(bundle).not.toContain('pull-requests: write');
  });

  it('never checks out the pull request head in the credentialed stage-2 job', () => {
    const review = jobBlock('review');
    expect(review).toContain('actions/download-artifact');
    // No `ref:` at all — the base is the default, and naming the head or the
    // merge ref here is exactly the mistake this test exists to catch.
    expect(review).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
    expect(review).not.toMatch(/ref:\s*refs\/pull/);
  });

  it('grants stage 2 only the scopes it actually writes with', () => {
    const review = jobBlock('review');
    expect(review).toContain('pull-requests: write'); // inline comments
    expect(review).toContain('checks: write'); // the receipt
    expect(review).toContain('id-token: write'); // WIF, so no standing secret
  });

  it('defaults the whole workflow to no permissions', () => {
    // `permissions: {}` at the top means a job that forgets to declare its own
    // gets nothing, rather than inheriting a broad default.
    expect(directives).toMatch(/^permissions:\s*\{\}\s*$/m);
  });

  it('SHA-pins the third-party actions that handle the untrusted bundle', () => {
    // This workflow ships into other people's repositories, so a movable tag on
    // a third-party action is a supply-chain foothold — and these two are the
    // ones that carry the artifact built from fork-controlled code. Asserts the
    // CLASS (pinned to a 40-char SHA) rather than specific SHAs, so routine
    // version bumps do not churn the test while a regression to a floating tag
    // still fails.
    for (const action of ['actions/upload-artifact', 'actions/download-artifact']) {
      const marker = `${action}@`;
      const index = directives.indexOf(marker);
      expect(index, `${action} should appear in the workflow`).toBeGreaterThan(-1);

      const ref = directives.slice(index + marker.length).split(/\s/, 1)[0] ?? '';
      expect(ref, `${action} must be SHA-pinned, not a floating tag`).toMatch(/^[\da-f]{40}$/);
    }
  });

  it('gates on the project having opted in before it does any work', () => {
    expect(directives).toContain('prReview?.enabled===true');
    expect(jobBlock('bundle')).toContain("steps.gate.outputs.enabled == 'true'");
  });
});

describe('the workflow is distributed, not hand-installed (36EEMY slice 8)', () => {
  it('is a schema ownedFile, so security fixes reach projects that already installed it', () => {
    const entry = SAFEWORD_SCHEMA.ownedFiles['.github/workflows/pr-review.yml'];
    expect(entry).toBeDefined();
    expect(entry?.template).toBe('workflows/pr-review.yml');
  });

  it('adds to .github/workflows without owning it — the customer keeps their own CI', () => {
    // Owning the directory would make reset/uninstall delete the project's
    // other workflows.
    expect(SAFEWORD_SCHEMA.sharedDirs).toContain('.github/workflows');
    expect(SAFEWORD_SCHEMA.ownedDirs).not.toContain('.github/workflows');
  });
});
