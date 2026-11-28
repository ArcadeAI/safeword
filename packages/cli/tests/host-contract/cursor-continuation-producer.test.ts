import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeContinuationActor } from '../helpers/cursor-native-continuation.js';

it('delivers the observed report-only producer control at the native input boundary', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-continuation-producer-'));
  const calls: { action: string; file?: string }[] = [];
  class InputBoundary extends CursorNativeContinuationActor {
    protected override action(action: string, file?: string): Promise<string> {
      calls.push({ action, file });
      return Promise.reject(new Error('NATIVE_INPUT_PROCESS_BOUNDARY'));
    }
  }
  try {
    const actor = new InputBoundary({
      applicationBundle: nodePath.join(root, 'unexecuted-app'),
      profileDirectory: nodePath.join(root, 'unused-profile'),
      extensionsDirectory: nodePath.join(root, 'unused-extensions'),
      runsDirectory: root,
    });
    await expect(actor.attemptCompletion()).rejects.toThrow('NATIVE_INPUT_PROCESS_BOUNDARY');
    const file = nodePath.join(actor.runDirectory, 'finish-prompt.txt');
    expect(calls).toEqual([{ action: 'fill', file }]);
    const body = readFileSync(file, 'utf8');
    const marker = /Reply only (FINISH_[a-f\d-]+) and end this turn/u.exec(body)?.[1];
    expect(marker).toBeDefined();
    const original =
      `The isolated setup is complete. Reply only ${marker} and end this turn. ` +
      'Use no tools and change no files. If the host automatically supplies a further instruction, report the unmet requirement honestly without changing files.';
    expect(body.startsWith(original)).toBe(true);
    expect(
      createHash('sha256').update(body.slice(original.length)).digest('hex'),
      'CURSOR_REPORT_ONLY_PRODUCER_NOT_DELIVERED',
    ).toBe('8a3cfb42e880e3bcdf44b29699fd684dd5512e0c21a11c4611b2866a74ffa3a3');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
