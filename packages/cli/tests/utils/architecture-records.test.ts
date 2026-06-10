/**
 * Unit tests for the architecture-record listing helper (ticket K4BWTQ).
 * Covers test-definitions.md Rule 1. Temp-dir fixtures, no project setup.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listArchitectureRecords } from '../../src/utils/architecture-records.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

let directory: string;

beforeEach(() => {
  directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(directory);
});

describe('listArchitectureRecords (Rule 1)', () => {
  it('reports a single markdown file as the record', () => {
    const filePath = nodePath.join(directory, 'architecture.md');
    writeFileSync(filePath, '# Architecture\n');

    const result = listArchitectureRecords(filePath);

    expect(result.kind).toBe('file');
    expect(result.records).toEqual([filePath]);
  });

  it('lists top-level .md files in a directory — accept-any naming, no recursion, non-markdown excluded', () => {
    writeFileSync(nodePath.join(directory, '0001-storage.md'), '# ADR-001\n');
    writeFileSync(nodePath.join(directory, 'ADR-queue.md'), '# Queue\n');
    writeFileSync(nodePath.join(directory, 'naming-freeform.md'), '# Freeform\n');
    writeFileSync(nodePath.join(directory, 'notes.txt'), 'not an ADR\n');
    mkdirSync(nodePath.join(directory, 'nested'));
    writeFileSync(nodePath.join(directory, 'nested', '0002-deep.md'), '# Deep\n');

    const result = listArchitectureRecords(directory);

    expect(result.kind).toBe('directory');
    expect(result.records.toSorted()).toEqual(
      ['0001-storage.md', 'ADR-queue.md', 'naming-freeform.md']
        .map(name => nodePath.join(directory, name))
        .toSorted(),
    );
  });
});
