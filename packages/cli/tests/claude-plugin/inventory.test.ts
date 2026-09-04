import { linkSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { claudeNativePayloadFiles } from '../../src/claude-plugin/inventory.js';
import { createTemporaryDirectory } from '../helpers.js';

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
