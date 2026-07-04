/**
 * Integration test: the CLI captures only genuine crashes, not deliberate
 * non-zero exits (ticket 5XXQQZ, issue #720).
 *
 * Two guarantees:
 *  1. `installCliCrashCapture` turns an uncaught exception into a sanitized spool
 *     record, still surfaces the crash to the user, and exits NON-ZERO (a crash
 *     must fail for CI/scripts — unlike the hook backstop, which forces exit 0).
 *  2. A command that exits non-zero deliberately (`codify` arg error) records
 *     NOTHING — the #720 false-positive regression.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readReports } from '../../templates/hooks/lib/self-report.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const CAPTURE = nodePath.resolve(import.meta.dirname, '../../src/self-report-capture.ts');
const CLI = nodePath.resolve(import.meta.dirname, '../../src/cli.ts');

describe('CLI crash capture (5XXQQZ / #720)', () => {
  let directory: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('captures an uncaught crash, surfaces it, and exits non-zero', () => {
    const fixture = nodePath.join(directory, 'crashy-cli.ts');
    writeFileSync(
      fixture,
      [
        `import { installCliCrashCapture } from ${JSON.stringify(CAPTURE)};`,
        `installCliCrashCapture();`,
        "throw new TypeError('kaboom with a /home/secret path');",
      ].join('\n'),
    );

    const result = spawnSync('bun', [fixture, 'codify'], {
      cwd: directory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    // A crash must still fail the process (CI/scripts depend on it).
    expect(result.status).not.toBe(0);
    // Crash UX preserved: the user still sees their error on stderr...
    expect(result.stderr).toContain('kaboom');

    const records = readReports(directory);
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe('codify');
    expect(records[0]?.errorClass).toBe('TypeError');
    // ...but the raw message never reaches the sanitized spool.
    expect(JSON.stringify(records[0])).not.toContain('kaboom');
    expect(JSON.stringify(records[0])).not.toContain('/home/secret');
  });

  it('records nothing for a deliberate non-zero status exit (#720)', () => {
    const result = spawnSync('bun', [CLI, 'codify', 'NOSUCHTICKET'], {
      cwd: directory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    // codify exits 1 by design when the ticket folder is missing.
    expect(result.status).not.toBe(0);
    // The deliberate status exit must NOT be spooled as a crash.
    expect(readReports(directory)).toHaveLength(0);
  });
});
