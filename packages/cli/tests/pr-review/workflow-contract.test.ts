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

  it('SHA-pins every action that is not first-party GitHub', () => {
    // This workflow ships into other people's repositories, so a movable tag on
    // third-party code is a supply-chain foothold — and setup-bun is the sharpest
    // case, because it executes in the job holding pull-requests, checks and
    // id-token write. Asserts the CLASS (a 40-char SHA) rather than specific
    // SHAs, so routine bumps do not churn the test while a regression to a
    // floating tag still fails.
    for (const action of [
      'actions/upload-artifact',
      'actions/download-artifact',
      'oven-sh/setup-bun',
    ]) {
      const marker = `${action}@`;
      const index = directives.indexOf(marker);
      expect(index, `${action} should appear in the workflow`).toBeGreaterThan(-1);

      const ref = directives.slice(index + marker.length).split(/\s/, 1)[0] ?? '';
      expect(ref, `${action} must be SHA-pinned, not a floating tag`).toMatch(/^[\da-f]{40}$/);
    }
  });

  it('deliberately leaves actions/checkout on a floating major', () => {
    // Reversing the obvious advice, on purpose. checkout is FIRST-PARTY GitHub,
    // and the fork-refusal protection this whole two-stage design leans on
    // arrived as a BACKPORT to the floating majors (2026-07-16). A SHA pin taken
    // before that date would have silently opted out of the very protection the
    // security argument rests on, and future security backports too.
    //
    // Pinned here for a different threat than setup-bun faces: tag movement on
    // third-party code you do not control, versus losing security updates from
    // the vendor who publishes the runner itself. Asserted so a well-meaning
    // future "pin everything" pass has to read this before undoing it.
    const marker = 'actions/checkout@';
    const index = directives.indexOf(marker);
    expect(index, 'actions/checkout should appear in the workflow').toBeGreaterThan(-1);

    const ref = directives.slice(index + marker.length).split(/\s/, 1)[0] ?? '';
    expect(ref, 'actions/checkout stays on a floating major — see the comment').toMatch(/^v\d+$/);
  });

  it('pins the CLI to THIS release, like the Codex hook manifest', async () => {
    // `bunx safeword` unpinned resolves to whatever is latest AT RUN TIME, in a
    // job holding pull-requests/checks/id-token write, in every customer repo.
    // An npm compromise would become a fleet-wide write primitive. Pinned in the
    // template because FileDefinition has no content-transform hook, so this
    // test is what keeps the pin from going stale across a version bump.
    const { VERSION } = await import('../../src/version.js');
    expect(directives).toContain(`bunx --bun safeword@${VERSION} review-pr`);
  });

  it('does not install the host project dependencies', () => {
    // `bunx` fetches safeword itself. Running the host's install would hard-fail
    // every Rust, Python or Go project safeword supports — and reviewing a diff
    // never needed them.
    expect(directives).not.toContain('bun install');
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

describe('the bundle handoff can actually carry files (36EEMY)', () => {
  it('stages the bundle outside the checkout, not in a dot-directory', () => {
    // upload-artifact defaults `include-hidden-files: false`, and defines hidden
    // as "any file beginning with . or files within folders beginning with ." —
    // so a dot-prefixed staging path matches ZERO files. With the default
    // `if-no-files-found: warn` the step still SUCCEEDS, stage 1 goes green, and
    // the failure only appears in the privileged job. That combination is why
    // this is asserted rather than trusted.
    // Scoped to the UPLOAD job: stage 2 downloading into a dot-directory is
    // harmless (it is the base checkout, and download has no hidden-file rule).
    expect(jobBlock('bundle')).toContain('runner.temp');
    expect(jobBlock('bundle')).not.toMatch(/path:\s*\.safeword-pr-review/);
  });

  it('fails the upload loudly rather than shipping an empty bundle', () => {
    expect(directives).toContain('if-no-files-found: error');
  });

  it('grants stage 2 actions:read so the cross-run download can authenticate', () => {
    // `permissions:` is an allowlist — anything unlisted resolves to none, and
    // download-artifact takes the Actions API path whenever github-token is set,
    // even same-repo. Without this the download 403s.
    expect(jobBlock('review')).toContain('actions: read');
  });

  it('does not re-trigger itself on its own completion', () => {
    // workflow_run watches this workflow's own name, so a stage-2 run completing
    // would re-enter the workflow and look for an artifact that is not there.
    expect(jobBlock('review')).toContain("github.event.workflow_run.event == 'pull_request'");
  });
});

describe('the enable switch cannot be flipped by the pull request under review', () => {
  it('reads config from the base ref, never the head', () => {
    // A fork setting `enabled: false` — or deleting the file — must not be able
    // to suppress its own review. That is the one direction of this gate that is
    // a security control rather than a convenience.
    expect(jobBlock('bundle')).toContain('github.event.pull_request.base.sha');
  });

  it('parses the config instead of require()-ing it', () => {
    // `require` resolves a DIRECTORY named config.json to its index.js, so a
    // fork committing that shape would get arbitrary code execution.
    expect(directives).not.toContain('require(&apos;./.safeword');
    expect(directives).toContain('JSON.parse');
  });

  it('keeps no credential on disk while untrusted code is checked out', () => {
    // actions/checkout defaults persist-credentials: true, which leaves the
    // job's token in .git/config — so "this job holds no credential" is only
    // true if we say so explicitly.
    expect(jobBlock('bundle')).toContain('persist-credentials: false');
  });
});
