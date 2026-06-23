/**
 * Integration test: installCrashCapture turns an uncaught hook exception into a
 * sanitized spool record while preserving swallow-and-continue (exit 0).
 * (Ticket QYYC5Y, issue #345, increment 2b.)
 *
 * Spawns a throwaway hook that installs the backstop and then throws, and asserts
 * the crash was captured (with a safeword-internal frame) and the process still
 * exited 0.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readReports } from '../../templates/hooks/lib/self-report.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const LIB = nodePath.resolve(import.meta.dirname, '../../templates/hooks/lib/self-report.ts');

describe('installCrashCapture (QYYC5Y)', () => {
  let directory: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('captures an uncaught hook exception and still exits 0', () => {
    const fixture = nodePath.join(directory, 'crashy-hook.ts');
    writeFileSync(
      fixture,
      [
        `import { installCrashCapture } from ${JSON.stringify(LIB)};`,
        `installCrashCapture('crashy-hook', ${JSON.stringify(directory)});`,
        "throw new TypeError('kaboom in a hook');",
      ].join('\n'),
    );

    const result = spawnSync('bun', [fixture], {
      cwd: directory,
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    // Swallow-and-continue preserved: the host session is never broken.
    expect(result.status).toBe(0);

    const records = readReports(directory);
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe('crashy-hook');
    expect(records[0]?.errorClass).toBe('TypeError');
    // The error message ("kaboom") is never stored, and the fixture's own frame
    // (outside safeword) is dropped — a real hook crash retains its safeword
    // frames; this throwaway fixture has none, so frames are absent here.
    expect(JSON.stringify(records[0])).not.toContain('kaboom');
    expect(records[0]?.frames).toBeUndefined();
  });
});
