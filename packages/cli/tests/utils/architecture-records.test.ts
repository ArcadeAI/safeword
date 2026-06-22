/**
 * Unit tests for the architecture-record listing helper (ticket K4BWTQ).
 * Covers test-definitions.md Rule 1. Temp-dir fixtures, no project setup.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listArchitectureRecords } from '../../src/utils/architecture-records.js';
import { resolveConfiguredPath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('listArchitectureRecords (Rule 1)', () => {
  it('reports a single markdown file as the record', () => {
    const filePath = nodePath.join(context.directory, 'architecture.md');
    writeFileSync(filePath, '# Architecture\n');

    const result = listArchitectureRecords(filePath);

    expect(result.kind).toBe('file');
    expect(result.records).toEqual([filePath]);
  });

  it('lists top-level .md files in a directory — accept-any naming, no recursion, non-markdown excluded', () => {
    writeFileSync(nodePath.join(context.directory, '0001-storage.md'), '# ADR-001\n');
    writeFileSync(nodePath.join(context.directory, 'ADR-queue.md'), '# Queue\n');
    writeFileSync(nodePath.join(context.directory, 'naming-freeform.md'), '# Freeform\n');
    writeFileSync(nodePath.join(context.directory, 'notes.txt'), 'not an ADR\n');
    mkdirSync(nodePath.join(context.directory, 'nested'));
    writeFileSync(nodePath.join(context.directory, 'nested', '0002-deep.md'), '# Deep\n');

    const result = listArchitectureRecords(context.directory);

    expect(result.kind).toBe('directory');
    const byCodeUnit = (a: string, b: string): number => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    };
    expect(result.records.toSorted(byCodeUnit)).toEqual(
      ['0001-storage.md', 'ADR-queue.md', 'naming-freeform.md']
        .map(name => nodePath.join(context.directory, name))
        .toSorted(byCodeUnit),
    );
  });

  it('reports a path routed through a file as absent instead of throwing (ENOTDIR, nodejs#56993)', () => {
    const filePath = nodePath.join(context.directory, 'architecture.md');
    writeFileSync(filePath, '# Architecture\n');

    const result = listArchitectureRecords(nodePath.join(filePath, 'nested'));

    expect(result.kind).toBe('absent');
    expect(result.records).toEqual([]);
  });

  it('reports an absent location with zero records', () => {
    const result = listArchitectureRecords(nodePath.join(context.directory, 'does-not-exist'));

    expect(result.kind).toBe('absent');
    expect(result.records).toEqual([]);
  });

  it('reports a README-only directory with zero records', () => {
    writeFileSync(nodePath.join(context.directory, 'README.md'), '# ADR conventions\n');

    const result = listArchitectureRecords(context.directory);

    expect(result.kind).toBe('directory');
    expect(result.records).toEqual([]);
  });

  it('consumes a configured paths.architecture override directory (seam with resolveConfiguredPath)', () => {
    mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, '.safeword', 'config.json'),
      JSON.stringify({ version: 1, paths: { architecture: 'docs/docs/arch' } }),
    );
    mkdirSync(nodePath.join(context.directory, 'docs', 'docs', 'arch'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'docs', 'docs', 'arch', '0001-foo.md'),
      '# ADR\n',
    );

    const resolved = resolveConfiguredPath(context.directory, 'architecture');
    const result = listArchitectureRecords(resolved);

    expect(result.kind).toBe('directory');
    expect(result.records).toEqual([
      nodePath.join(context.directory, 'docs', 'docs', 'arch', '0001-foo.md'),
    ]);
  });

  it('excludes README.md from directory records', () => {
    writeFileSync(nodePath.join(context.directory, 'README.md'), '# ADR conventions\n');
    writeFileSync(nodePath.join(context.directory, '0001-storage.md'), '# ADR-001\n');

    const result = listArchitectureRecords(context.directory);

    expect(result.records).toEqual([nodePath.join(context.directory, '0001-storage.md')]);
  });
});
