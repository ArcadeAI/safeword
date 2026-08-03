import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-packet-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe('review packet containment and change accounting', () => {
  it('rejects a target that escapes through a symlinked parent directory', () => {
    const project = temporaryDirectory();
    const outside = temporaryDirectory();
    writeFileSync(nodePath.join(outside, 'secret.md'), 'outside\n');
    symlinkSync(outside, nodePath.join(project, 'linked'));

    expect(() => prepareReviewPacket(project, 'quality-review', ['linked/secret.md'])).toThrow(
      'escapes the project',
    );
  });

  it('accepts an in-project filename that merely begins with two dots', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, '..config'), 'inside\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['..config']);

    expect(prepared.packet.logical_files[0]?.path).toBe('..config');
    prepared.cleanup();
  });

  it('distinguishes source drift from reviewer snapshot mutation', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    writeFileSync(source, 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    writeFileSync(source, 'external edit\n');
    expect(prepared.sourceChanged()).toBe(true);
    expect(prepared.snapshotChanged()).toBe(false);
    prepared.cleanup();
  });

  it('detects files newly created inside the disposable snapshot', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);
    mkdirSync(nodePath.join(prepared.workspace, 'new'), { recursive: true });
    writeFileSync(nodePath.join(prepared.workspace, 'new', 'file.md'), 'created\n');

    expect(prepared.snapshotChanged()).toBe(true);
    expect(prepared.sourceChanged()).toBe(false);
    prepared.cleanup();
  });

  it('rejects an individual target that is too large for a bounded review', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'large.md'), 'x'.repeat(256 * 1024 + 1));

    expect(() => prepareReviewPacket(project, 'quality-review', ['large.md'])).toThrow(
      '262144-byte limit',
    );
  });

  it('rejects more files than a bounded review can safely carry', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 65 }, (_, index) => `input-${index}.md`);

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow('64-file limit');
  });

  it('rejects a packet whose individually valid files exceed the aggregate limit', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 5 }, (_, index) => `input-${index}.md`);
    for (const target of targets) {
      writeFileSync(nodePath.join(project, target), 'x'.repeat(220 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow(
      '1048576-byte limit',
    );
  });

  it('rejects malformed UTF-8 instead of reviewing replacement characters', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'invalid.md'), Buffer.from([0xc3, 0x28]));

    expect(() => prepareReviewPacket(project, 'quality-review', ['invalid.md'])).toThrow(
      'not valid UTF-8 text',
    );
  });

  it('preserves a UTF-8 BOM without reporting a reviewer mutation', () => {
    const project = temporaryDirectory();
    writeFileSync(
      nodePath.join(project, 'bom.md'),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('review me\n')]),
    );
    const prepared = prepareReviewPacket(project, 'quality-review', ['bom.md']);

    expect(prepared.snapshotChanged()).toBe(false);
    expect(prepared.sourceChanged()).toBe(false);
    prepared.cleanup();
  });
});
