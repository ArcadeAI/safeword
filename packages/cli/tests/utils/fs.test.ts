/**
 * Unit Tests: readJson robustness
 *
 * readJson is best-effort: it returns `undefined` when no JSON value can be
 * obtained from a path, and must never throw — callers all treat the result as
 * `T | undefined`. A directory at the path (EISDIR) or an unreadable file
 * previously threw uncaught and crashed callers like reconcile's jsonMerge.
 */

import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readJson } from '../../src/utils/fs.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';

let dir: string;

beforeEach(() => {
  dir = createTemporaryDirectory();
});

afterEach(() => {
  if (dir) removeTemporaryDirectory(dir);
});

describe('readJson', () => {
  it('parses a valid JSON file', () => {
    writeTestFile(dir, 'config.json', JSON.stringify({ a: 1 }));
    expect(readJson(nodePath.join(dir, 'config.json'))).toEqual({ a: 1 });
  });

  it('returns undefined for a missing file', () => {
    expect(readJson(nodePath.join(dir, 'nope.json'))).toBeUndefined();
  });

  it('returns undefined (no throw) for a file with JSONC comments', () => {
    writeTestFile(dir, 'config.jsonc', '{\n  // a comment\n  "a": 1\n}\n');
    expect(readJson(nodePath.join(dir, 'config.jsonc'))).toBeUndefined();
  });

  it('returns undefined (no throw) when a directory sits at the path (EISDIR)', () => {
    mkdirSync(nodePath.join(dir, 'config.json'));
    expect(() => readJson(nodePath.join(dir, 'config.json'))).not.toThrow();
    expect(readJson(nodePath.join(dir, 'config.json'))).toBeUndefined();
  });
});
