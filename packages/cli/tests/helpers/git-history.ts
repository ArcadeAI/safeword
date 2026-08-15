/**
 * Preflights for suites that read REAL released bytes out of git history.
 *
 * Several suites verify that today's classifier recognizes the exact bytes a
 * past release shipped, by reading them back with `git show v<version>:<path>`.
 * Reading from a tag is the point: a tag is an immutable record of what
 * actually shipped, so the check cannot be satisfied by editing a fixture in
 * the working tree. A vendored copy would make the test agree with a file that
 * agrees with the classifier.
 *
 * That provenance is bought with full history, and CI pays for it — the jobs
 * running these suites set `fetch-depth: 0` (see .github/workflows/ci.yml).
 *
 * A shallow or tagless clone therefore does not mean the code is broken; it
 * means the clone cannot answer the question. Without a preflight that shows
 * up as dozens of bare `fatal: invalid object name 'v0.68.0'` failures spread
 * across four files, which reads as a broken suite. These helpers turn that
 * into one sentence per suite, naming the remedy.
 *
 * They THROW rather than skip. Skipping would also hide a CI job that lost its
 * `fetch-depth: 0`, silently disabling the provenance guarantee in the one
 * environment that must enforce it.
 */

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { supportedClaudeLegacyReleases } from '../../src/claude-plugin/historical-ownership.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

/** Restores both tags and the commit history the sealed-review suites walk. */
const REMEDY = 'git fetch --unshallow --tags origin';

/**
 * Catalogue keys are release versions AND content digests — only versions are
 * tagged. Deriving the tag list from the catalogue keeps this tracking the
 * fixtures automatically, so a newly catalogued release is covered without
 * editing a hardcoded list here.
 */
const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[\dA-Za-z.]+)?$/u;

function git(arguments_: readonly string[]): { ok: boolean; stdout: string } {
  const result = spawnSync('git', [...arguments_], { cwd: repoRoot, encoding: 'utf8' });
  return { ok: result.status === 0, stdout: (result.stdout ?? '').trim() };
}

function gitShow(ref: string): string {
  const result = spawnSync('git', ['show', ref], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not read historical fixture ${ref}.`);
  return result.stdout;
}

/** Reads the released template bytes installed at `installedPath`. */
export function readHistoricalTemplate(version: string, installedPath: string): string {
  const schema = gitShow(`v${version}:packages/cli/src/schema.ts`);
  const escaped = installedPath.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  // eslint-disable-next-line security/detect-non-literal-regexp -- escaped fixture path is test-owned
  const template = new RegExp(
    String.raw`['"]${escaped}['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]`,
    'su',
  ).exec(schema)?.[1];
  if (template === undefined) {
    throw new Error(`Release ${version} has no schema template for ${installedPath}.`);
  }
  return gitShow(`v${version}:packages/cli/templates/${template}`);
}

/** Every catalogued release version, i.e. the keys that have a release tag. */
function catalogueReleaseVersions(): string[] {
  return supportedClaudeLegacyReleases().filter(key => RELEASE_VERSION.test(key));
}

/**
 * The blob every historical fixture resolves through. Probing it verifies what
 * the suites actually read — a ref that resolves but whose objects were never
 * fetched (partial clone) would pass a bare `rev-parse` and still fail here.
 */
const FIXTURE_PROBE_PATH = 'packages/cli/src/schema.ts';

/**
 * Fails when a release this suite reads is absent from the clone, naming the
 * missing tags so a genuinely deleted tag is distinguishable from a shallow
 * clone.
 *
 * Takes the versions the CALLER reads rather than demanding every catalogued
 * release: a clone holding exactly the tags its suite needs must pass. Pass the
 * same array the suite drives its cases from, so the two cannot drift apart.
 *
 * Each version is checked against the catalogue first — a typo, or a release
 * dropped from the catalogue, fails here instead of surfacing later as a
 * confusing fixture lookup.
 */
export function requireHistoricalReleaseTags(versions: readonly string[]): void {
  const catalogued = new Set(catalogueReleaseVersions());
  const uncatalogued = versions.filter(version => !catalogued.has(version));
  if (uncatalogued.length > 0) {
    throw new Error(
      `Not catalogued releases: ${uncatalogued.join(', ')}. ` +
        'Add them to the historical catalogue, or correct the version list in this suite.',
    );
  }

  if (!git(['rev-parse', '--git-dir']).ok) {
    throw new Error(
      'git could not inspect this repository, so historical release fixtures cannot be confirmed. ' +
        'Check that git is installed and this is a repository.',
    );
  }

  const missing = versions
    .map(version => `v${version}`)
    .filter(tag => !git(['cat-file', '-e', `${tag}:${FIXTURE_PROBE_PATH}`]).ok);
  if (missing.length === 0) return;
  throw new Error(
    `This suite verifies real released bytes read from git tags, which this clone is missing: ${missing.join(', ')}.\n` +
      `CI checks out with fetch-depth: 0 for exactly this reason. To fix locally:\n  ${REMEDY}`,
  );
}

/**
 * Fails on a shallow clone. Tags alone are not enough for suites that walk a
 * path's ancestry — `git log -- <path>` stops at the shallow boundary and
 * silently reports fewer commits rather than failing.
 */
export function requireFullHistory(): void {
  const depth = git(['rev-parse', '--is-shallow-repository']);
  // Failing open here would reproduce the exact hazard this file exists to
  // prevent: a git that cannot run returns empty stdout, which is not 'true',
  // so the shallow check would silently pass and the provenance guarantee
  // would evaporate in whichever environment broke git.
  if (!depth.ok) {
    throw new Error(
      'git could not report whether this clone is shallow, so the history this suite ' +
        'needs cannot be confirmed. Check that git is installed and this is a repository.',
    );
  }
  if (depth.stdout !== 'true') return;
  throw new Error(
    'This suite walks commit ancestry to verify sealed inputs, and this is a shallow clone, ' +
      'so history is truncated and the walk silently returns too few commits.\n' +
      `CI checks out with fetch-depth: 0 for exactly this reason. To fix locally:\n  ${REMEDY}`,
  );
}
