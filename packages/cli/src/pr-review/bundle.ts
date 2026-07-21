// The stage-1 → stage-2 handoff (ticket 36EEMY, SM1.R3).
//
// Everything in this directory was produced by a job that checked out
// fork-controlled code. It is INERT DATA: read it, never execute it, and
// validate anything that will reach a URL or a filesystem path before use.
//
// The split exists because the threat is executing untrusted code while holding
// a credential, not reading it. This module is the boundary where that data
// crosses into the credentialed job, so it is the right place to be strict.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

interface BundledFile {
  /** Repo-relative path, e.g. `src/helper.ts`. */
  path: string;
  contents: string;
}

export interface ReviewBundle {
  pullNumber: number;
  /** The unified diff — what actually changed. */
  diff: string;
  /** Changed files plus their neighbours, so a finding can rest on untouched code (R17). */
  files: BundledFile[];
}

/** Guard against a hostile bundle exhausting memory in the privileged job. */
const MAX_FILES = 500;
const MAX_FILE_BYTES = 200_000;

/**
 * Read the bundle stage 1 uploaded, or `undefined` when it is missing or
 * unusable.
 *
 * Undefined is always a SKIP upstream, never an empty review. The dangerous
 * failure is not "no bundle" — it is a bundle that looks readable but carries no
 * diff, because the model then reports no findings and the runner records a
 * `reviewed` receipt for a change nobody looked at.
 */
export function readReviewBundle(bundleDirectory: string): ReviewBundle | undefined {
  if (!existsSync(bundleDirectory)) return undefined;

  const pullNumber = readPullNumber(bundleDirectory);
  if (pullNumber === undefined) return undefined;

  const diff = readIfPresent(nodePath.join(bundleDirectory, 'diff.patch'));
  if (diff === undefined || diff.trim().length === 0) return undefined;

  return { pullNumber, diff, files: readFiles(nodePath.join(bundleDirectory, 'files')) };
}

/**
 * The pull number reaches a URL, and it was written by the untrusted-side job,
 * so it is parsed strictly rather than interpolated. `Number()` alone would
 * accept `'42abc'`-style input via coercion in other positions; the explicit
 * integer test is what makes traversal impossible.
 */
function readPullNumber(bundleDirectory: string): number | undefined {
  const raw = readIfPresent(nodePath.join(bundleDirectory, 'pull-number'));
  if (raw === undefined) return undefined;

  const parsed = Number(raw.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** Walk `files/`, returning repo-relative paths. Bounded in count and size. */
function readFiles(root: string): BundledFile[] {
  if (!existsSync(root)) return [];

  const collected: BundledFile[] = [];
  for (const full of walkFiles(root)) {
    if (collected.length >= MAX_FILES) break;
    const file = readBundledFile(root, full);
    if (file !== undefined) collected.push(file);
  }
  return collected;
}

/** Every file beneath `root`, depth-first. Unreadable directories are skipped. */
function* walkFiles(root: string): Generator<string> {
  const queue: string[] = [root];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) continue;

    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = nodePath.join(current, entry.name);
        if (entry.isDirectory()) queue.push(full);
        else yield full;
      }
    } catch {
      // A directory we cannot read is not a reason to abandon the bundle.
    }
  }
}

function readBundledFile(root: string, full: string): BundledFile | undefined {
  try {
    // Oversized files are SKIPPED rather than truncated mid-token: half a file
    // reads as a complete one and invites a finding about code that is not
    // actually shaped that way.
    if (statSync(full).size > MAX_FILE_BYTES) return undefined;
  } catch {
    return undefined;
  }

  const contents = readIfPresent(full);
  return contents === undefined ? undefined : { path: nodePath.relative(root, full), contents };
}
