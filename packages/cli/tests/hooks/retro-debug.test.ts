import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  recordRetroDebugEvent,
  RETRO_DEBUG_LOG_ENV,
} from '../../templates/hooks/lib/retro-debug.js';
import { readJsonlFile } from '../helpers.js';

describe('recordRetroDebugEvent', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'retro-debug-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes opt-in sanitized JSONL without raw transcript or model output content', () => {
    const logPath = nodePath.join(dir, 'nested', 'retro-debug.jsonl');

    recordRetroDebugEvent(
      {
        event: 'retro_cli_extraction',
        sessionId: 'session-1',
        transcriptPathPresent: true,
        transcriptText: 'RAW TRANSCRIPT',
        prompt: 'RAW PROMPT',
        stdout: 'RAW STDOUT',
        stderr: 'RAW STDERR',
        findings: [{ title: 'RAW FINDING' }],
        nested: {
          rawFindings: ['RAW NESTED FINDING'],
          body: 'RAW BODY',
          safeCount: 2,
        },
      },
      { [RETRO_DEBUG_LOG_ENV]: logPath },
    );

    const [event] = readJsonlFile(logPath);
    expect(event).toEqual(
      expect.objectContaining({
        event: 'retro_cli_extraction',
        sessionId: 'session-1',
        transcriptPathPresent: true,
        transcriptText: '[redacted]',
        prompt: '[redacted]',
        stdout: '[redacted]',
        stderr: '[redacted]',
        findings: '[redacted]',
        nested: {
          rawFindings: '[redacted]',
          body: '[redacted]',
          safeCount: 2,
        },
      }),
    );

    const rawLog = readFileSync(logPath, 'utf8');
    expect(rawLog).not.toContain('RAW TRANSCRIPT');
    expect(rawLog).not.toContain('RAW FINDING');
    expect(rawLog).not.toContain('RAW BODY');
  });

  it('stays silent when disabled and fail-open when the log path is unwritable', () => {
    const disabledPath = nodePath.join(dir, 'disabled.jsonl');
    recordRetroDebugEvent({ event: 'disabled' }, {});
    expect(existsSync(disabledPath)).toBe(false);

    const blockedParent = nodePath.join(dir, 'blocked');
    writeFileSync(blockedParent, 'not a directory');
    expect(() => {
      recordRetroDebugEvent(
        { event: 'unwritable', transcript: 'RAW TRANSCRIPT' },
        { [RETRO_DEBUG_LOG_ENV]: nodePath.join(blockedParent, 'retro-debug.jsonl') },
      );
    }).not.toThrow();
  });
});
