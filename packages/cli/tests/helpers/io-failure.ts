/**
 * Filesystem-failure simulations that hold for EVERY uid.
 *
 * DO NOT use `chmod` to simulate an I/O failure in a test. Root holds
 * CAP_DAC_OVERRIDE and bypasses every file permission bit, so a chmod-based
 * simulation silently does not happen under uid 0: the code under test takes
 * the SUCCESS path, and the test fails while asserting on that success output.
 *
 * The failure mode is environment-split, which is what makes it expensive.
 * GitHub Actions runs as `runner` (uid 1001), so a chmod-based test passes in
 * CI and fails in every root container — agent sessions, devcontainers, plain
 * `docker run`. The test looks correct to the author and broken to everyone
 * reading it from a container.
 *
 * Each helper below induces the failure through filesystem STRUCTURE, which
 * no uid can override. They return the path they were given so a call can be
 * inlined into the setup it replaces.
 *
 * Pick by the failure the code under test must hit:
 *
 * | Need                                      | Helper           | errno   |
 * | ----------------------------------------- | ---------------- | ------- |
 * | writes accepted, read-back always empty   | `sinkWrites`     | —       |
 * | writing this exact path fails             | `blockWrites`    | EISDIR  |
 * | creating anything under this dir fails    | `blockChildren`  | ENOTDIR |
 * | scanning/stat-ing into this dir fails     | `blockScan`      | ELOOP   |
 *
 * If none of them expresses the scenario faithfully, prefer an explicit
 * `it.skipIf(process.getuid?.() === 0)` with a stated reason over inventing a
 * simulation that only approximately reproduces the condition. A visible skip
 * is honest; a test that passes for the wrong reason is not.
 *
 * POSIX-only, matching this repo's CI (ubuntu-latest) and the symlink-based
 * fixtures already used across the suite.
 */

import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Creates `path`'s parent directory when it is missing. */
function ensureParent(path: string): void {
  mkdirSync(nodePath.dirname(path), { recursive: true });
}

/**
 * Points `path` at `/dev/null`: appends and writes succeed, and every read
 * comes back empty.
 *
 * Use for write-then-read-back verification — code that persists a record and
 * then re-reads it to confirm the write landed. This is the only helper where
 * the write must SUCCEED; use `blockWrites` when the write itself should fail.
 */
export function sinkWrites(path: string): string {
  ensureParent(path);
  rmSync(path, { force: true, recursive: true });
  symlinkSync('/dev/null', path);
  return path;
}

/**
 * Occupies `path` with a directory, so writing the file fails with EISDIR.
 *
 * Use when one specific file must not be writable. Prefer this over
 * `blockChildren` on the parent when the target filename is known — it is
 * narrower, and leaves the rest of the directory usable.
 *
 * DESTRUCTIVE: anything already at `path` is removed first. `mkdirSync` throws
 * EEXIST against an existing FILE even with `recursive: true`, and a path worth
 * blocking is usually one the code has already written once. If the prior
 * contents matter to the assertion, capture them before calling this.
 */
export function blockWrites(path: string): string {
  ensureParent(path);
  rmSync(path, { force: true, recursive: true });
  mkdirSync(path);
  return path;
}

/**
 * Occupies `directory` with a regular file, so creating anything beneath it
 * fails with ENOTDIR.
 *
 * Use when the code picks its own filename under a directory you control, so
 * there is no single target path to block.
 *
 * DESTRUCTIVE, for the same reason as {@link blockWrites}: `writeFileSync`
 * throws EISDIR against a path that is already a directory — which is the
 * usual state of a directory worth blocking — so anything there is removed
 * first. Capture the prior contents before calling if the assertion needs them.
 */
export function blockChildren(directory: string): string {
  ensureParent(directory);
  rmSync(directory, { force: true, recursive: true });
  writeFileSync(directory, '');
  return directory;
}

/**
 * Plants a self-referential symlink inside `directory`, so any scan that
 * follows its entries fails with ELOOP.
 *
 * Use when `directory` must stay a real, readable directory — so the code
 * gets far enough to enumerate it — but walking into it must fail. Blocking
 * writes is not equivalent: a scan that merely finds an unexpected file
 * usually tolerates it and continues down the success path.
 */
export function blockScan(directory: string, entryName = 'hooks'): string {
  mkdirSync(directory, { recursive: true });
  const loop = nodePath.join(directory, entryName);
  rmSync(loop, { force: true, recursive: true });
  symlinkSync(entryName, loop);
  return directory;
}
