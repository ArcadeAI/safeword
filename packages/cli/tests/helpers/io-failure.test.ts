/**
 * The io-failure helpers exist so a test can induce an I/O failure that no uid
 * can bypass. That only holds if they really raise what they document, and if
 * they survive a path the code under test already wrote — the usual state of
 * anything worth blocking. Both are asserted here against the real filesystem.
 */

import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { blockChildren, blockScan, blockWrites, sinkWrites } from './io-failure.js';

const roots: string[] = [];

afterEach(() => {
  for (const created of roots) rmSync(created, { force: true, recursive: true });
  roots.length = 0;
});

function scratchRoot(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-io-failure-'));
  roots.push(directory);
  return directory;
}

function errnoOf(run: () => void): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as NodeJS.ErrnoException).code;
  }
  return undefined;
}

describe('io-failure helpers', () => {
  it('sinkWrites accepts appends and reads back nothing', () => {
    const path = sinkWrites(nodePath.join(scratchRoot(), 'acks.jsonl'));
    appendFileSync(path, 'recorded\n');
    expect(readFileSync(path, 'utf8')).toBe('');
  });

  it('sinkWrites replaces a pre-existing directory', () => {
    const path = nodePath.join(scratchRoot(), 'acks.jsonl');
    mkdirSync(path);
    expect(() => sinkWrites(path)).not.toThrow();
    appendFileSync(path, 'recorded\n');
    expect(readFileSync(path, 'utf8')).toBe('');
  });

  it('blockWrites makes writing that exact path fail with EISDIR', () => {
    const path = blockWrites(nodePath.join(scratchRoot(), 'marker'));
    expect(
      errnoOf(() => {
        appendFileSync(path, 'x');
      }),
    ).toBe('EISDIR');
  });

  it('blockChildren makes anything beneath it fail with ENOTDIR', () => {
    const directory = blockChildren(nodePath.join(scratchRoot(), 'tickets'));
    expect(
      errnoOf(() => {
        mkdirSync(nodePath.join(directory, 'child'));
      }),
    ).toBe('ENOTDIR');
  });

  it('blockScan makes following the directory fail with ELOOP', () => {
    const directory = blockScan(nodePath.join(scratchRoot(), '.safeword'), 'hooks');
    // The directory itself stays listable — the code under test must get far
    // enough to enumerate it, and fail only when it walks in.
    expect(readdirSync(directory)).toContain('hooks');
    expect(errnoOf(() => readFileSync(nodePath.join(directory, 'hooks', 'any')))).toBe('ELOOP');
  });

  // A helper that throws on setup blocks nothing; it just relocates the failure
  // into the arrange step, where it reads as a broken test rather than the
  // simulation it was meant to be.
  // Positional %s consumes the tuple in order, so the two formatted values must
  // be the first two elements — the helper goes last or the name reads as source.
  it.each([
    ['sinkWrites', 'file', sinkWrites],
    ['blockWrites', 'file', blockWrites],
    ['blockChildren', 'directory', blockChildren],
  ] as const)('%s replaces a path that already exists as a %s', (_name, kind, helper) => {
    const path = nodePath.join(scratchRoot(), 'occupied');
    if (kind === 'directory') mkdirSync(path);
    else blockChildren(path);

    expect(() => helper(path)).not.toThrow();
  });

  it('blockScan replaces an entry that already exists', () => {
    const directory = nodePath.join(scratchRoot(), '.safeword');
    mkdirSync(directory, { recursive: true });
    mkdirSync(nodePath.join(directory, 'hooks'));

    expect(() => blockScan(directory, 'hooks')).not.toThrow();
  });
});
