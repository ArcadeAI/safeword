/**
 * Unit proof for the provenance manifest (ticket A4HG61, #849): read shapes
 * (absent / corrupt / ok), byte-exact hashing, sorted serialization, and
 * merge-never-truncate recording.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hashManagedFileContent,
  MANAGED_FILE_MANIFEST_PATH,
  readManagedFileManifest,
  recordManagedFileProvenance,
  serializeManagedFileManifest,
} from '../../src/utils/managed-file-manifest.js';

describe('managed-file-manifest', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'manifest-unit-'));
    // The manifest lives under .safeword/, which exists on any install.
    writeFileSync(nodePath.join(dir, '.gitkeep'), '');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function manifestPath(): string {
    return nodePath.join(dir, MANAGED_FILE_MANIFEST_PATH);
  }

  function writeManifestRaw(content: string): void {
    writeFileSync(manifestPath(), content);
  }

  it('reads absent when no manifest exists', () => {
    expect(readManagedFileManifest(dir)).toEqual({ kind: 'absent' });
  });

  it.each([
    ['not JSON at all', '{nope'],
    ['files is an array', '{"version":1,"files":["a"]}'],
    ['files is null', '{"version":1,"files":null}'],
    ['a hash value is not a string', '{"version":1,"files":{"a.md":42}}'],
    ['files key missing', '{"version":1}'],
  ])('reads corrupt when %s', (_label, raw) => {
    recordManagedFileProvenance(dir, { 'seed.md': 'seed' }); // ensure dir exists
    writeManifestRaw(raw);
    expect(readManagedFileManifest(dir)).toEqual({ kind: 'corrupt' });
  });

  it('round-trips recorded entries', () => {
    recordManagedFileProvenance(dir, { 'steps/world.ts': 'abc', '.codex/config.toml': 'def' });
    expect(readManagedFileManifest(dir)).toEqual({
      kind: 'ok',
      files: { 'steps/world.ts': 'abc', '.codex/config.toml': 'def' },
    });
  });

  it('merges new entries without dropping existing ones', () => {
    recordManagedFileProvenance(dir, { 'a.md': 'old-a', 'b.md': 'old-b' });
    recordManagedFileProvenance(dir, { 'b.md': 'new-b', 'c.md': 'new-c' });
    expect(readManagedFileManifest(dir)).toEqual({
      kind: 'ok',
      files: { 'a.md': 'old-a', 'b.md': 'new-b', 'c.md': 'new-c' },
    });
  });

  it('records nothing and leaves a corrupt manifest byte-for-byte alone', () => {
    recordManagedFileProvenance(dir, { 'seed.md': 'seed' });
    writeManifestRaw('{corrupt');
    recordManagedFileProvenance(dir, { 'a.md': 'hash' });
    expect(readFileSync(manifestPath(), 'utf8')).toBe('{corrupt');
  });

  it('is a no-op for an empty entry set (setup-on-clone writes nothing)', () => {
    recordManagedFileProvenance(dir, {});
    expect(readManagedFileManifest(dir)).toEqual({ kind: 'absent' });
  });

  it('serializes with sorted keys and a trailing newline', () => {
    const serialized = serializeManagedFileManifest({ 'z.md': '1', 'a.md': '2' });
    expect(serialized.endsWith('\n')).toBe(true);
    const keys = Object.keys((JSON.parse(serialized) as { files: object }).files);
    expect(keys).toEqual(['a.md', 'z.md']);
  });

  it('hashes byte-exact content', () => {
    expect(hashManagedFileContent('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashManagedFileContent('abc\n')).not.toBe(hashManagedFileContent('abc'));
  });
});
