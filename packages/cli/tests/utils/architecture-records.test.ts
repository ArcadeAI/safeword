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
});
