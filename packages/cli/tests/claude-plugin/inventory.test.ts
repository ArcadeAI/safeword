import { linkSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { claudeNativePayloadFiles } from '../../src/claude-plugin/inventory.js';
import { createTemporaryDirectory } from '../helpers.js';

// Claude renames `<pid>.tmp.<hex>` onto `<pid>` while Safeword walks the cache.
// Deleting the entry the moment the walk lists it reproduces that window without
// depending on timing.
const vanishAfterListing = vi.hoisted(() => ({ path: undefined as string | undefined }));
// Arms a non-ENOENT lstat failure so the ENOENT narrowing can be proven, not just asserted in prose.
const denyStatFor = vi.hoisted(() => ({ path: undefined as string | undefined }));

vi.mock(import('node:fs'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    readdirSync: ((...args: Parameters<typeof actual.readdirSync>) => {
      const entries = actual.readdirSync(...args);
      const doomed = vanishAfterListing.path;
      if (doomed !== undefined && nodePath.dirname(doomed) === String(args[0])) {
        vanishAfterListing.path = undefined;
        actual.rmSync(doomed, { force: true });
      }
      return entries;
    }) as typeof actual.readdirSync,
    lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
      if (denyStatFor.path !== undefined && String(args[0]) === denyStatFor.path) {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      }
      return actual.lstatSync(...args);
    }) as typeof actual.lstatSync,
  };
});

afterEach(() => {
  vanishAfterListing.path = undefined;
  denyStatFor.path = undefined;
});

function cacheFixture(): string {
  const root = createTemporaryDirectory();
  mkdirSync(nodePath.join(root, '.in_use'));
  writeFileSync(nodePath.join(root, 'identity.json'), '{}');
  return root;
}

describe('Claude cache metadata inventory', () => {
  it('excludes only valid host-owned lease and orphan markers', () => {
    const root = cacheFixture();
    writeFileSync(
      nodePath.join(root, '.in_use/12345'),
      JSON.stringify({ pid: 12_345, procStart: 'Sun Aug  9 17:18:28 2026' }),
    );
    writeFileSync(nodePath.join(root, '.orphaned_at'), '1785974107464');

    expect(claudeNativePayloadFiles(root)).toEqual(['identity.json']);
  });

  it('excludes an orphaned lease temp file left by an interrupted rename', () => {
    const root = cacheFixture();
    writeFileSync(
      nodePath.join(root, '.in_use/65506.tmp.d9f968fe'),
      JSON.stringify({ pid: 65_506, procStart: 'Mon Aug 31 21:28:08 2026' }),
    );

    expect(claudeNativePayloadFiles(root)).toEqual(['identity.json']);
  });

  it('excludes a lease temp file renamed away while the cache is walked', () => {
    const root = cacheFixture();
    const temporaryLease = nodePath.join(root, '.in_use/82289.tmp.faa7241e');
    writeFileSync(
      temporaryLease,
      JSON.stringify({ pid: 82_289, procStart: 'Fri Sep  4 22:57:03 2026' }),
    );
    vanishAfterListing.path = temporaryLease;

    expect(claudeNativePayloadFiles(root)).toEqual(['identity.json']);
  });

  it('reports a vanished entry that never carried a lease temp name', () => {
    const root = cacheFixture();
    const doomed = nodePath.join(root, '.in_use/unexpected-runtime.js');
    writeFileSync(doomed, 'payload');
    vanishAfterListing.path = doomed;

    expect(claudeNativePayloadFiles(root)).toContain('.in_use/unexpected-runtime.js');
  });

  // Kills the mutant that drops `vanishedDuringScan` entirely: this file is never
  // absent, it is merely too large for readSmallMetadataFile, so only the stat
  // check distinguishes it from a lease being renamed into place.
  it('reports a present lease temp file too large to read as metadata', () => {
    const root = cacheFixture();
    writeFileSync(nodePath.join(root, '.in_use/12345.tmp.d9f968fe'), 'x'.repeat(2048));

    expect(claudeNativePayloadFiles(root)).toContain('.in_use/12345.tmp.d9f968fe');
  });

  // Kills the mutant that widens `vanishedDuringScan` to `return true`: the entry is
  // present, so failing to stat it must not excuse it.
  it('reports a present lease temp file whose stat fails with a non-ENOENT error', () => {
    const root = cacheFixture();
    const denied = nodePath.join(root, '.in_use/12345.tmp.d9f968fe');
    writeFileSync(denied, JSON.stringify({ pid: 12_345, procStart: 'now' }));
    denyStatFor.path = denied;

    expect(claudeNativePayloadFiles(root)).toContain('.in_use/12345.tmp.d9f968fe');
  });

  // Kills the mutant that drops the `.tmp.` infix guard: only a temp name is
  // mid-rename, so a vanished final `<pid>` lease must still be reported.
  it('reports a vanished final lease name that carries no temp infix', () => {
    const root = cacheFixture();
    const doomed = nodePath.join(root, '.in_use/12345');
    writeFileSync(doomed, JSON.stringify({ pid: 12_345, procStart: 'now' }));
    vanishAfterListing.path = doomed;

    expect(claudeNativePayloadFiles(root)).toContain('.in_use/12345');
  });

  it.each([
    ['non-PID lease name', '.in_use/unexpected-runtime.js', '{}'],
    ['lease PID mismatch', '.in_use/12345', '{"pid":54321,"procStart":"now"}'],
    ['extra lease fields', '.in_use/12345', '{"pid":12345,"procStart":"now","extra":true}'],
    ['malformed lease', '.in_use/12345', 'not json'],
    ['lease temp PID mismatch', '.in_use/12345.tmp.d9f968fe', '{"pid":54321,"procStart":"now"}'],
    [
      'lease temp with non-hex suffix',
      '.in_use/12345.tmp.payload',
      '{"pid":12345,"procStart":"now"}',
    ],
    ['malformed orphan marker', '.orphaned_at', 'not-an-epoch'],
    ['root OS metadata', '.DS_Store', 'arbitrary bytes'],
    ['nested OS metadata', '.in_use/.DS_Store', 'arbitrary bytes'],
  ])('reports %s as unexpected payload', (_label, relativePath, content) => {
    const root = cacheFixture();
    writeFileSync(nodePath.join(root, relativePath), content);

    expect(claudeNativePayloadFiles(root)).toContain(relativePath);
  });

  it('reports nested lease directories and symlinked metadata as unexpected payload', () => {
    const root = cacheFixture();
    mkdirSync(nodePath.join(root, '.in_use/nested'));
    writeFileSync(nodePath.join(root, '.in_use/nested/payload.js'), 'payload');
    const externalOrphan = nodePath.join(root, 'valid-external-orphan');
    const externalLease = nodePath.join(root, 'valid-external-lease');
    writeFileSync(externalOrphan, '1785974107464');
    writeFileSync(
      externalLease,
      JSON.stringify({ pid: 12_345, procStart: 'Sun Aug  9 17:18:28 2026' }),
    );
    symlinkSync(externalOrphan, nodePath.join(root, '.orphaned_at'));
    symlinkSync(externalLease, nodePath.join(root, '.in_use/12345'));

    expect(claudeNativePayloadFiles(root)).toEqual(
      expect.arrayContaining(['.in_use/12345', '.in_use/nested/payload.js', '.orphaned_at']),
    );
  });

  it('reports hard-linked lifecycle metadata as unexpected payload', () => {
    const root = cacheFixture();
    const external = nodePath.join(root, 'external-lease');
    writeFileSync(external, JSON.stringify({ pid: 12_345, procStart: 'Sun Aug  9 17:18:28 2026' }));
    linkSync(external, nodePath.join(root, '.in_use/12345'));

    expect(claudeNativePayloadFiles(root)).toContain('.in_use/12345');
  });
});
