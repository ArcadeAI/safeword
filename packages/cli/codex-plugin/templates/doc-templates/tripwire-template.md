# Upstream Workaround Tripwire: {dependency}

<!--
Scaffold for a tripwire test — a test that fails when a temporary workaround
becomes removable, so the workaround leaves on the event that makes it
removable rather than on someone's memory.

Emit one only when BOTH hold:
  1. Removal depends on someone else's release (upstream bug, unshipped fix).
  2. The failure mode is silent — nothing fails loudly if the workaround
     rots, or if a later cleanup deletes it and reintroduces the bug.

A workaround for something obvious and loud does not need one.

Full rules: `.safeword/guides/testing-guide.md` → "Upstream Workaround
Tripwires". Copy the two blocks below into the tripwire test file, fill every
slot, then delete this guidance.
-->

## 1. File header (the runbook)

The header is the deliverable. It is read by whoever the failing test wakes
up — someone who has no context and is holding a red build.

```ts
/**
 * TRIPWIRE — {dependency} is pinned to work around {upstream-issue-url}.
 *
 * The bug: {what breaks, and how it presents}. {Why it is silent — no error,
 * no warning, wrong output that looks right.}
 *
 * The workaround: {what this repo does instead, in one or two sentences}.
 *
 * When this test fails, someone bumped {dependency}. Check
 * {upstream-issue-url}:
 *   - Fix shipped → delete the workaround: {file}, {file}, {file}. Then
 *     delete this test file.
 *   - Not fixed yet → re-pin {dependency} to the last known-bad version and
 *     bump PINNED_VERSION below. A red test here is the check working.
 *
 * Do NOT "clean this up" without reading the above. {The obvious
 * simplification — e.g. using the framework's own official helper — is
 * wrong because {reason}. It reintroduces the bug silently.}
 */
```

The last paragraph is not optional when a plausible cleanup reintroduces the
bug. A workaround that looks removable but is not has to say so where the
person deleting it will read.

## 2. The test

Assert the **pin**, not the bug. Adapt to the project's test runner.

```ts
/** Newest {dependency} known to still need the workaround. */
const PINNED_VERSION = '{x.y.z}';

describe('{dependency} workaround ({upstream-issue-ref})', () => {
  test(`{dependency} is still pinned to ${PINNED_VERSION} — read this file's header before changing`, () => {
    expect(installedVersion('{dependency}')).toBe(PINNED_VERSION);
  });
});
```

Read the version from the resolved package (its `package.json`, the lockfile,
or the manifest pin) — whichever the project treats as the source of truth for
what actually runs.
