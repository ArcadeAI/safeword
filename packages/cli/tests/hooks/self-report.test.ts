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
  captureGateEscalation,
  detectAgent,
  formatIssueDrafts,
  formatSelfReportSurfacing,
  readReports,
  readSelfReportConfig,
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

    it('does NOT leak a customer dir that merely contains "safeword" as a substring', () => {
      // Regression: substring match used to keep `my-safeword/secret.ts` etc.
      const stack = [
        'Error: boom',
        '    at a (/Users/joe/my-safeword/secret.ts:1:1)',
        '    at b (/srv/acme-safeword/private/keys.ts:2:2)',
      ].join('\n');
      expect(sanitizeStackFrames(stack)).toEqual([]);
    });

    it('does NOT leak a customer repo literally named "safeword" (non-internal tail)', () => {
      const stack = [
        'Error: boom',
        '    at biz (/Users/joe/code/safeword/src/customer-secret-logic.ts:12:3)',
        '    at c (/home/x/safeword/app/private-keys.ts:1:1)',
      ].join('\n');
      // Segment matches, but the tail is not a safeword-internal prefix → dropped.
      expect(sanitizeStackFrames(stack)).toEqual([]);
    });

    it('does NOT leak a token-shaped filename sitting after a safeword/ segment', () => {
      const stack = 'Error: x\n    at f (/tmp/safeword/.cache/token_ghp_SECRET.ts:1:1)';
      const frames = sanitizeStackFrames(stack);
      expect(frames.join('\n')).not.toContain('ghp_');
      expect(frames.join('\n')).not.toContain('token_');
      expect(frames).toEqual([]);
    });

    it('drops a crafted function label that carries path/secret content, keeping the location', () => {
      // error.stack is arbitrary text — a junk label on a safeword-located frame
      // must not survive verbatim.
      const stack =
        'Error: x\n    at evilFn </Users/cust/secret> (/x/safeword/packages/cli/a.ts:1:1)';
      const frames = sanitizeStackFrames(stack);
      expect(frames).toEqual(['at packages/cli/a.ts:1:1']);
      expect(frames.join('\n')).not.toContain('/Users/cust');
      expect(frames.join('\n')).not.toContain('secret');
    });

    it('keeps a normal V8 function label', () => {
      const stack = 'Error: x\n    at Object.<anonymous> (/x/safeword/packages/cli/a.ts:9:2)';
      expect(sanitizeStackFrames(stack)).toEqual(['at Object.<anonymous> (packages/cli/a.ts:9:2)']);
    });

    it('caps the number of retained frames', () => {
      const deep = [
        'Error: deep',
        ...Array.from(
          { length: 50 },
          (_unused, i) => `    at fn${i} (/x/safeword/packages/cli/a.ts:${i}:1)`,
        ),
      ].join('\n');
      expect(sanitizeStackFrames(deep).length).toBeLessThanOrEqual(20);
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

  describe('formatIssueDrafts (#353)', () => {
    it('emits one sanitized draft per signature, titled by the dedup signature', () => {
      recordSignal(
        projectDirectory,
        's',
        {
          source: 'post-tool-quality',
          agent: 'claude',
          errorClass: 'TypeError',
          stack:
            'TypeError: x\n    at f (/h/safeword/packages/cli/templates/hooks/post-tool-quality.ts:9:1)',
        },
        '0.55.0',
      );
      recordSignal(
        projectDirectory,
        's',
        { source: 'post-tool-quality', agent: 'claude', errorClass: 'TypeError' },
        '0.55.0',
      );
      recordSignal(
        projectDirectory,
        's',
        { source: 'check', agent: 'claude', exitCode: 1 },
        '0.55.0',
      );

      const drafts = formatIssueDrafts(readReports(projectDirectory));

      expect(drafts).toHaveLength(2);
      // Signature + title are agent-prefixed so cross-agent bugs file separately.
      const typeError = drafts.find(
        draft => draft.signature === 'claude:TypeError@post-tool-quality',
      );
      expect(typeError?.title).toBe('[self-report] claude:TypeError@post-tool-quality');
      expect(typeError?.labels).toContain('self-reported');
      expect(typeError?.body).toContain('Agent:** `claude`');
      expect(typeError?.body).toContain('Occurrences this report:** 2');
      expect(typeError?.body).toContain('0.55.0');
      // The safeword-internal frame survives; the title is the dedup key.
      expect(typeError?.body).toContain('post-tool-quality.ts:9:1');

      const exitDraft = drafts.find(draft => draft.signature === 'claude:exit1@check');
      expect(exitDraft?.body).toContain('Exit code:** 1');
      expect(exitDraft?.body).toContain('No stack frames');
    });

    it('files the same failure under different agents as distinct signatures', () => {
      recordSignal(
        projectDirectory,
        's',
        { source: 'stop-quality', agent: 'claude', errorClass: 'E' },
        '1',
      );
      recordSignal(
        projectDirectory,
        's',
        { source: 'stop-quality', agent: 'cursor', errorClass: 'E' },
        '1',
      );

      const drafts = formatIssueDrafts(readReports(projectDirectory));
      const signatures = drafts
        .map(draft => draft.signature)
        .toSorted((a, b) => a.localeCompare(b));
      expect(signatures).toEqual(['claude:E@stop-quality', 'cursor:E@stop-quality']);
    });

    it('returns no drafts for an empty spool', () => {
      expect(formatIssueDrafts([])).toEqual([]);
    });
  });

  describe('agent attribution (#345 follow-up)', () => {
    it('detectAgent reads the harness from the environment', () => {
      expect(detectAgent({ CLAUDE_PROJECT_DIR: '/x' })).toBe('claude');
      expect(detectAgent({ CLAUDE_CODE_SESSION_ID: 'abc' })).toBe('claude');
      expect(detectAgent({ CURSOR_TRACE_ID: '1' })).toBe('cursor');
      expect(detectAgent({ CODEX_SANDBOX: '1' })).toBe('codex');
      expect(detectAgent({})).toBe('unknown');
    });

    it('SAFEWORD_AGENT_RUNTIME is authoritative over env prefixes (shared channel)', () => {
      // The Codex adapter sets CLAUDE_PROJECT_DIR for path resolution but the hook
      // really runs under Codex — the runtime declaration must win. This is the
      // same env var safeword's run-identity system uses.
      expect(detectAgent({ SAFEWORD_AGENT_RUNTIME: 'codex', CLAUDE_PROJECT_DIR: '/x' })).toBe(
        'codex',
      );
      // A bogus declaration is ignored, falling back to env detection.
      expect(detectAgent({ SAFEWORD_AGENT_RUNTIME: 'bogus', CLAUDE_PROJECT_DIR: '/x' })).toBe(
        'claude',
      );
    });

    it('records the signal agent, bounded to the enum (deny-by-default)', () => {
      expect(
        buildRecord({ source: 'x', agent: 'cursor' }, { sessionId: 's', safewordVersion: '1' })
          .agent,
      ).toBe('cursor');
      // Missing → unknown; a bogus value is not stored verbatim.
      expect(buildRecord({ source: 'x' }, { sessionId: 's', safewordVersion: '1' }).agent).toBe(
        'unknown',
      );
      expect(
        buildRecord(
          { source: 'x', agent: 'evil' as unknown as 'claude' },
          { sessionId: 's', safewordVersion: '1' },
        ).agent,
      ).toBe('unknown');
    });
  });

  describe('captureGateEscalation (Slice 1b)', () => {
    it('records a GateEscalation signal for the gate pattern', () => {
      captureGateEscalation(projectDirectory, 's', 'done-gate-tests-failed');
      const records = readReports(projectDirectory);
      expect(records).toHaveLength(1);
      expect(records[0]?.errorClass).toBe('GateEscalation');
      expect(records[0]?.source).toBe('done-gate-tests-failed');
      expect(summarizeReports(records)[0]?.signature).toContain(
        'GateEscalation@done-gate-tests-failed',
      );
    });

    it('is suppressed when selfReport.capture is false', () => {
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(projectDirectory, '.safeword', 'config.json'),
        JSON.stringify({ selfReport: { capture: false } }),
      );
      captureGateEscalation(projectDirectory, 's', 'loc');
      expect(readReports(projectDirectory)).toHaveLength(0);
    });
  });

  describe('readSelfReportConfig (#353)', () => {
    function writeConfig(value: unknown): void {
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(projectDirectory, '.safeword', 'config.json'),
        JSON.stringify(value),
      );
    }

    it('defaults to capture-on / surface-on / file-OFF when absent', () => {
      expect(readSelfReportConfig(projectDirectory)).toEqual({
        capture: true,
        surface: true,
        file: false,
      });
    });

    it('reads explicit booleans and ignores non-booleans', () => {
      writeConfig({ selfReport: { file: true, surface: false, capture: 'yes' } });
      expect(readSelfReportConfig(projectDirectory)).toEqual({
        capture: true, // 'yes' is not a boolean → default
        surface: false,
        file: true,
      });
    });

    it('falls back to defaults on malformed config', () => {
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(projectDirectory, '.safeword', 'config.json'), 'not json');
      expect(readSelfReportConfig(projectDirectory).file).toBe(false);
    });
  });

  describe('surfacing file pointer + spool cap (#353)', () => {
    it('appends a factual filing pointer to the guide only when file is enabled', () => {
      recordSignal(projectDirectory, 's', { source: 'check', exitCode: 1 }, '1');
      const records = readSessionReports(projectDirectory, 's');

      const without = formatSelfReportSurfacing(records);
      expect(without).not.toContain('self-report-filing.md');

      const withFile = formatSelfReportSurfacing(records, { file: true });
      expect(withFile).toContain('.safeword/guides/self-report-filing.md');
      expect(withFile).toContain('selfReport.file');
    });

    it('caps the spool so a crash-loop cannot grow it without bound', () => {
      for (let i = 0; i < 250; i++) {
        recordSignal(
          projectDirectory,
          'loop',
          { source: 'post-tool-quality', errorClass: 'E' },
          '1',
        );
      }
      expect(readSessionReports(projectDirectory, 'loop').length).toBeLessThanOrEqual(200);
    });
  });
});
