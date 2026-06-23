/**
 * CLI-side non-zero-exit producer (ticket QYYC5Y, issue #345).
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordCliExit } from '../src/self-report-capture.js';
import { readReports } from '../templates/hooks/lib/self-report.js';

describe('recordCliExit (QYYC5Y)', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'sw-cli-exit-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('captures a non-zero exit into the spool inside a safeword project', () => {
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });

    recordCliExit(2, ['node', 'cli', 'check'], directory);

    const records = readReports(directory);
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe('check');
    expect(records[0]?.exitCode).toBe(2);
  });

  it('does nothing on a clean (zero) exit', () => {
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    recordCliExit(0, ['node', 'cli', 'check'], directory);
    expect(readReports(directory)).toHaveLength(0);
  });

  it('never creates a spool outside a safeword project', () => {
    // No .safeword/ dir present.
    recordCliExit(1, ['node', 'cli', 'check'], directory);
    expect(readReports(directory)).toHaveLength(0);
  });
});
