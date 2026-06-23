/**
 * Self-report capture core (ticket QYYC5Y, issue #345).
 *
 * The load-bearing test is the GUARDRAIL: a captured signal whose source error
 * carries an absolute path, a secret token, and a file-content snippet must
 * persist a record containing NONE of them, while RETAINING the safeword-internal
 * stack frame and the error class. This pins the epic premortem (over-redaction
 * that strips the actionable frame must also fail).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildRecord,
  formatSelfReportSurfacing,
  readReports,
  readSessionReports,
  recordSignal,
  sanitizeStackFrames,
  type SelfReportSignal,
  spoolPath,
  summarizeReports,
} from '../../templates/hooks/lib/self-report.js';

describe('self-report capture (QYYC5Y)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-selfreport-'));
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  describe('sanitizeStackFrames', () => {
    it('keeps safeword-internal frames and strips the absolute/home prefix', () => {
      const stack = [
        'Error: boom',
        '    at doThing (/home/alice/work/safeword/packages/cli/templates/hooks/post-tool-quality.ts:42:10)',
        '    at run (/home/alice/.safeword/hooks/stop-quality.ts:7:3)',
      ].join('\n');

      const frames = sanitizeStackFrames(stack);

      expect(frames).toContain(
        'at doThing (packages/cli/templates/hooks/post-tool-quality.ts:42:10)',
      );
      // Cut at the last "safeword" segment, so /home/alice/.safeword/... -> hooks/...
      expect(frames.some(frame => frame.includes('hooks/stop-quality.ts:7:3'))).toBe(true);
      // No absolute/home prefix survives.
      expect(frames.join('\n')).not.toContain('/home/alice');
    });

    it('drops frames that point outside safeword (customer code)', () => {
      const stack = [
        'Error: boom',
        '    at handler (/Users/customer/secret-project/app.ts:1:1)',
        '    at doThing (/srv/safeword/packages/cli/src/cli.ts:10:2)',
      ].join('\n');

      const frames = sanitizeStackFrames(stack);

      expect(frames.join('\n')).not.toContain('secret-project');
      expect(frames.join('\n')).not.toContain('/Users/customer');
      expect(frames.some(frame => frame.includes('packages/cli/src/cli.ts'))).toBe(true);
    });

    it('returns an empty array for an undefined or frameless stack', () => {
      expect(sanitizeStackFrames(undefined)).toEqual([]);
      expect(sanitizeStackFrames('Error: just a message')).toEqual([]);
    });
  });

  describe('buildRecord allowlist', () => {
    it('GUARDRAIL: never leaks message contents; keeps safeword frame + errorClass', () => {
      const secretToken = 'ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1234';
      const absolutePath = '/Users/customer/private/credentials.env';
      const fileSnippet = 'const API_KEY = "sk-customer-secret-value";';

      // A real error's stack, carrying sensitive data in the message line and a
      // customer frame — built as a string so we never mutate a built-in Error.
      const stack = [
        `TypeError: failed reading ${absolutePath}: ${fileSnippet} (token ${secretToken})`,
        '    at parse (/home/alice/safeword/packages/cli/templates/hooks/post-tool-quality.ts:42:10)',
        `    at handler (${absolutePath.replace('.env', '.ts')}:3:1)`,
      ].join('\n');

      const signal: SelfReportSignal = {
        source: 'post-tool-quality',
        errorClass: 'TypeError',
        stack,
      };

      const record = buildRecord(signal, { sessionId: 'sess-1', safewordVersion: '9.9.9' });
      const serialized = JSON.stringify(record);

      // Nothing sensitive from the message survives.
      expect(serialized).not.toContain(secretToken);
      expect(serialized).not.toContain('ghp_');
      expect(serialized).not.toContain(absolutePath);
      expect(serialized).not.toContain('/Users/customer');
      expect(serialized).not.toContain('sk-customer-secret-value');
      expect(serialized).not.toContain('credentials');

      // The actionable signal IS retained (premortem: over-redaction fails here).
      expect(record.errorClass).toBe('TypeError');
      expect(
        record.frames?.some(frame =>
          frame.includes('packages/cli/templates/hooks/post-tool-quality.ts:42:10'),
        ),
      ).toBe(true);
      expect(record.source).toBe('post-tool-quality');
      expect(record.sessionId).toBe('sess-1');
      expect(record.safewordVersion).toBe('9.9.9');
      expect(typeof record.ts).toBe('string');
    });

    it('sanitizes a free-form source down to a safe token', () => {
      const record = buildRecord(
        { source: 'evil/../../etc/passwd \n rm -rf', exitCode: 1 },
        { sessionId: 's', safewordVersion: '1.0.0' },
      );
      expect(record.source).not.toContain('/');
      expect(record.source).not.toContain(' ');
      expect(record.source).not.toContain('\n');
      expect(record.exitCode).toBe(1);
    });

    it('omits frames and errorClass for a pure exit-code signal', () => {
      const record = buildRecord(
        { source: 'check', exitCode: 2 },
        { sessionId: 's', safewordVersion: '1.0.0' },
      );
      expect(record.exitCode).toBe(2);
      expect(record.frames).toBeUndefined();
      expect(record.errorClass).toBeUndefined();
    });
  });

  describe('recordSignal / readReports', () => {
    it('appends a sanitized JSONL record and reads it back', () => {
      recordSignal(
        projectDirectory,
        'sess-A',
        {
          source: 'stop-quality',
          errorClass: 'Error',
          stack: 'Error: x\n    at f (/x/safeword/packages/cli/a.ts:1:1)',
        },
        '2.0.0',
      );

      expect(spoolPath(projectDirectory, 'sess-A')).toContain(
        nodePath.join('.safeword', 'self-reports', 'sess-A.jsonl'),
      );

      const records = readReports(projectDirectory);
      expect(records).toHaveLength(1);
      expect(records[0]?.source).toBe('stop-quality');
      expect(records[0]?.safewordVersion).toBe('2.0.0');
    });

    it('is best-effort: never throws even when the spool cannot be written', () => {
      // Point the project dir at a path whose .safeword is a FILE, so mkdir fails.
      const blocked = mkdtempSync(nodePath.join(tmpdir(), 'sw-blocked-'));
      writeFileSync(nodePath.join(blocked, '.safeword'), 'i am a file, not a dir');

      expect(() => {
        recordSignal(blocked, 's', { source: 'x', errorClass: 'Error' }, '1.0.0');
      }).not.toThrow();

      rmSync(blocked, { recursive: true, force: true });
    });

    it('skips malformed JSONL lines when reading', () => {
      const directory = nodePath.join(projectDirectory, '.safeword', 'self-reports');
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        nodePath.join(directory, 'sess-B.jsonl'),
        ['{"ts":"t","sessionId":"sess-B","safewordVersion":"1","source":"a"}', 'not json', ''].join(
          '\n',
        ),
      );
      const records = readReports(projectDirectory);
      expect(records).toHaveLength(1);
      expect(records[0]?.source).toBe('a');
    });
  });

  describe('summarizeReports', () => {
    it('groups by signature and counts, sorted by count desc', () => {
      recordSignal(
        projectDirectory,
        's1',
        { source: 'post-tool-quality', errorClass: 'TypeError' },
        '1',
      );
      recordSignal(
        projectDirectory,
        's1',
        { source: 'post-tool-quality', errorClass: 'TypeError' },
        '1',
      );
      recordSignal(projectDirectory, 's2', { source: 'check', exitCode: 1 }, '1');

      const groups = summarizeReports(readReports(projectDirectory));

      expect(groups).toHaveLength(2);
      expect(groups[0]?.count).toBe(2);
      expect(groups[0]?.signature).toContain('TypeError');
      expect(groups[1]?.count).toBe(1);
    });
  });

  describe('readSessionReports', () => {
    it('returns only the named session, not other sessions in the spool', () => {
      recordSignal(projectDirectory, 'mine', { source: 'stop-quality', errorClass: 'Error' }, '1');
      recordSignal(projectDirectory, 'other', { source: 'check', exitCode: 1 }, '1');

      const mine = readSessionReports(projectDirectory, 'mine');
      expect(mine).toHaveLength(1);
      expect(mine[0]?.source).toBe('stop-quality');
    });

    it('returns an empty array when the session has no spool', () => {
      expect(readSessionReports(projectDirectory, 'nope')).toEqual([]);
    });
  });

  describe('formatSelfReportSurfacing', () => {
    it('returns null when there is nothing to surface', () => {
      expect(formatSelfReportSurfacing([])).toBeUndefined();
    });

    it('states the count + breakdown as a fact, not an imperative', () => {
      recordSignal(
        projectDirectory,
        's',
        { source: 'post-tool-quality', errorClass: 'TypeError' },
        '1',
      );
      recordSignal(projectDirectory, 's', { source: 'check', exitCode: 1 }, '1');

      const line = formatSelfReportSurfacing(readSessionReports(projectDirectory, 's'));

      expect(line).toContain('Safeword recorded 2');
      expect(line).toContain('TypeError@post-tool-quality (×1)');
      expect(line).toContain('exit1@check (×1)');
      expect(line).toContain('safeword self-report');
      // Factual framing — no imperative "you must / file an issue" command.
      expect(line?.toLowerCase()).not.toContain('you must');
      expect(line?.toLowerCase()).not.toContain('file an issue');
    });
  });
});
