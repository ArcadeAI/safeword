/**
 * Release gate: the remote-test workflow's version pin (#3784 follow-up).
 *
 * The bundled workflow runs `npx safeword@<version>`, written into the file as a
 * literal. It has to be one: `classifyRemoteWorkflow` tells an outdated
 * safeword-shipped workflow (upgradeable) apart from a customer-edited one (never
 * touched) by comparing against the enumerated digests in
 * REMOTE_WORKFLOW_RELEASE_MANIFEST, and digests are only enumerable while the bundled
 * bytes are fixed. So the advisory PR review workflows' install-time substitution
 * cannot be used here.
 *
 * That literal never moved: it sat at 0.78.6 from the day the workflow landed (#3128)
 * through five releases, because nothing tied it to the CLI's own version.
 *
 * remote-workflow-contract.test.ts already owns the manifest and fixture invariants —
 * every superseded release frozen as a fixture, the bundled workflow as the current
 * entry. This covers only what those leave open: that the tamper contract's exact
 * command still names the same version as the template, and that the version is one
 * npm could have published.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { VERSION } from '../src/version.js';

/** Minor releases the pin may trail the CLI by before it counts as drift. */
const MAX_MINOR_LAG = 2;

const PACKAGE_ROOT = nodePath.resolve(import.meta.dirname, '..');

function pinnedVersion(relativePath: string): string | undefined {
  const source = readFileSync(nodePath.join(PACKAGE_ROOT, relativePath), 'utf8');
  return /npx --yes safeword@(?<version>\d+\.\d+\.\d+)/u.exec(source)?.groups?.version;
}

describe('remote-test workflow version pin', () => {
  const pinned = pinnedVersion('templates/workflows/remote-tests.yml');

  it('is the version the tamper contract expects', () => {
    // The contract compares the test step's `run` byte-for-byte, so bumping the
    // template alone makes every installed workflow report `fixed_test_command`.
    expect(pinned).toBeDefined();
    expect(pinnedVersion('src/test-execution/remote-workflow-contract.ts')).toBe(pinned);
  });

  it(`names a released version no more than ${MAX_MINOR_LAG} minors behind the CLI`, () => {
    const [pinMajor = -1, pinMinor = -1] = (pinned ?? '').split('.').map(Number);
    const [major = -1, minor = -1] = VERSION.split('.').map(Number);
    expect(pinMajor, `pin ${pinned} is a different major than ${VERSION}`).toBe(major);
    // Ahead of the CLI would name a version npm has never published.
    expect(pinMinor, `pin ${pinned} is ahead of the CLI's own ${VERSION}`).toBeLessThanOrEqual(
      minor,
    );
    expect(
      minor - pinMinor,
      `pin ${pinned} trails CLI ${VERSION} — bump it through the release-manifest procedure in remote-workflow-state.ts`,
    ).toBeLessThanOrEqual(MAX_MINOR_LAG);
  });
});
