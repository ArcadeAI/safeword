/**
 * CLI-side crash producer (ticket 5XXQQZ, issues #345 / #720).
 *
 * `recordCliCrash` captures only GENUINE safeword crashes — an uncaught
 * exception or unhandled rejection thrown out of a command — never a deliberate
 * `process.exit(1)` status/validation exit (that flood is exactly #720).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordCliCrash } from '../src/self-report-capture.js';
import { readReports } from '../templates/hooks/lib/self-report.js';

describe('recordCliCrash (5XXQQZ / #720)', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'sw-cli-crash-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('captures a genuine crash by error class, never storing the message', () => {
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });

    recordCliCrash(new TypeError('secret /home/alex/token'), ['node', 'cli', 'check'], directory);

    const records = readReports(directory);
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe('check');
    expect(records[0]?.errorClass).toBe('TypeError');
    // Raw message (paths/secrets) must never reach the spool.
    expect(JSON.stringify(records[0])).not.toContain('secret');
    expect(JSON.stringify(records[0])).not.toContain('/home/alex');
  });

  it('coerces a non-Error thrown value into an Error-class record', () => {
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });

    recordCliCrash('a bare string reject', ['node', 'cli', 'architecture'], directory);

    const records = readReports(directory);
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe('architecture');
    expect(records[0]?.errorClass).toBe('Error');
  });

  it('never creates a spool outside a safeword project', () => {
    // No .safeword/ dir present.
    recordCliCrash(new Error('boom'), ['node', 'cli', 'check'], directory);
    expect(readReports(directory)).toHaveLength(0);
  });

  it('honors selfReport.capture = false (does not record)', () => {
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ selfReport: { capture: false } }),
    );
    recordCliCrash(new Error('boom'), ['node', 'cli', 'check'], directory);
    expect(readReports(directory)).toHaveLength(0);
  });
});
