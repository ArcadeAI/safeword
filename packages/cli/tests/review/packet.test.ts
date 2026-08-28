import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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
  it('treats only impl-plan.md as plan-review work and preserves supporting context', () => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Plan\n');
    writeFileSync(nodePath.join(root, 'spec.md'), '# Spec\n');
    const prepared = prepareReviewPacket(
      root,
      'plan-implementation',
      ['impl-plan.md'],
      ['spec.md'],
    );
    try {
      expect(prepared.packet.logical_files.map(file => file.path)).toEqual(['impl-plan.md']);
      expect(prepared.packet.context_files?.map(file => file.path)).toEqual(['spec.md']);
    } finally {
      prepared.cleanup();
    }
  });

  it('rejects supporting evidence supplied as plan-review work', () => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Plan\n');
    writeFileSync(nodePath.join(root, 'spec.md'), '# Spec\n');
    expect(() =>
      prepareReviewPacket(root, 'plan-implementation', ['impl-plan.md', 'spec.md']),
    ).toThrow('one non-blank impl-plan.md work file');
  });
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

  it('treats source deletion as drift from the captured packet', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    writeFileSync(source, 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    unlinkSync(source);

    expect(prepared.sourceChanged()).toBe(true);
    expect(prepared.snapshotChanged()).toBe(false);
    prepared.cleanup();
  });

  it('detects a same-content source replacement with a different file identity', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    const replacement = nodePath.join(project, 'replacement.md');
    writeFileSync(source, 'same bytes\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    writeFileSync(replacement, 'same bytes\n');
    renameSync(replacement, source);

    expect(prepared.sourceChanged()).toBe(true);
    prepared.cleanup();
  });

  it('detects a captured source replaced by a same-content symlink', () => {
    const project = temporaryDirectory();
    const outside = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    const replacement = nodePath.join(outside, 'replacement.md');
    writeFileSync(source, 'same bytes\n');
    writeFileSync(replacement, 'same bytes\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    unlinkSync(source);
    symlinkSync(replacement, source);

    expect(prepared.sourceChanged()).toBe(true);
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

  it('treats an unreadable snapshot traversal as reviewer mutation', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);
    rmSync(prepared.workspace, { recursive: true, force: true });

    expect(prepared.snapshotChanged()).toBe(true);
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

  it('applies the file-count bound across targets and supporting context', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 32 }, (_, index) => `target-${index}.md`);
    const context = Array.from({ length: 33 }, (_, index) => `context-${index}.md`);

    expect(() => prepareReviewPacket(project, 'quality-review', targets, context)).toThrow(
      '64-file limit',
    );
  });

  it('rejects the same file appearing more than once or in both packet roles', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'review me\n');

    expect(() =>
      prepareReviewPacket(project, 'quality-review', ['input.md'], ['./input.md']),
    ).toThrow('duplicate file');
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

  it('separates supporting context from the work product under review', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'target.md'), 'review this\n');
    writeFileSync(nodePath.join(project, 'context.md'), 'supporting evidence\n');

    const prepared = prepareReviewPacket(project, 'quality-review', ['target.md'], ['context.md']);

    expect(prepared.packet.logical_files).toEqual([
      { path: 'target.md', content: 'review this\n' },
    ]);
    expect(prepared.packet.context_files).toEqual([
      { path: 'context.md', content: 'supporting evidence\n' },
    ]);
    prepared.cleanup();
  });

  it('requires a non-blank spec.md as the first scenario-gate context file', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'behavior.feature'), 'Feature: grounded review\n');
    writeFileSync(nodePath.join(project, 'spec.md'), ' \n');

    expect(() => prepareReviewPacket(project, 'scenario-gate', ['behavior.feature'])).toThrow(
      'requires a non-blank spec.md as its first context file',
    );
    expect(() =>
      prepareReviewPacket(project, 'scenario-gate', ['behavior.feature'], ['spec.md']),
    ).toThrow('requires a non-blank spec.md as its first context file');
    writeFileSync(nodePath.join(project, 'principles.md'), '# Principles\n');
    writeFileSync(nodePath.join(project, 'spec.md'), '# Intended behavior\n');
    expect(() =>
      prepareReviewPacket(
        project,
        'scenario-gate',
        ['behavior.feature'],
        ['principles.md', 'spec.md'],
      ),
    ).toThrow('requires a non-blank spec.md as its first context file');
  });

  it('accepts a scenario-gate packet grounded by a non-blank ticket spec', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'behavior.feature'), 'Feature: grounded review\n');
    writeFileSync(nodePath.join(project, 'spec.md'), '# Intended behavior\n');

    const prepared = prepareReviewPacket(
      project,
      'scenario-gate',
      ['behavior.feature'],
      ['spec.md'],
    );
    expect(prepared.packet.context_files?.[0]?.path).toBe('spec.md');
    prepared.cleanup();
  });

  it('applies the aggregate packet bound across targets and supporting context', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 3 }, (_, index) => `target-${index}.md`);
    const context = Array.from({ length: 2 }, (_, index) => `context-${index}.md`);
    for (const path of [...targets, ...context]) {
      writeFileSync(nodePath.join(project, path), 'x'.repeat(220 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets, context)).toThrow(
      '1048576-byte limit',
    );
  });

  it('bounds the serialized packet after JSON escaping expands source content', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 4 }, (_, index) => `escaped-${index}.md`);
    for (const target of targets) {
      writeFileSync(nodePath.join(project, target), '\\'.repeat(250 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow(
      '1048576-byte limit',
    );
  });
});
