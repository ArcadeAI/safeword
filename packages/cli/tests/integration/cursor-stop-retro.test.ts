/**
 * Integration test: the cursor/stop.ts retro path fires retro via followup_message
 * once per substantial Cursor session, and coexists with the existing
 * quality-review followup (ticket KHYXY4).
 *
 * Spawns the real Cursor stop hook under bun with a seeded transcript + config,
 * and drives the real branches: retro on a no-edit stop, quality-review wins on an
 * edit stop (retro yields, sentinel untouched), trivial/second-stop/aborted/
 * malformed all silent. The unit logic is covered in tests/hooks/retro-trigger*.
 */

import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.js';
import { QUALITY_REVIEW_MESSAGE } from '../../templates/hooks/lib/quality.js';
import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { FILER_AGENT_NAME } from '../../templates/hooks/lib/retro-filing-gate.js';
import { hasNudged, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  retroDraft,
  TIMEOUT_QUICK,
  writeSelfReportConfig as writeConfig,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/cursor/stop.ts');

// Claude-shaped transcript (Cursor's documented shape): n assistant tool_use blocks.
function writeTranscript(directory: string, name: string, toolUses: number): string {
  const lines: string[] = [];
  for (let i = 0; i < toolUses; i++) {
    lines.push(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: `t${i}`, name: 'edit', input: {} }],
        },
      }),
    );
  }
  const file = nodePath.join(directory, name);
  writeFileSync(file, lines.join('\n'));
  return file;
}

function markerPathFor(conversationId: string): string {
  return cursorEditedMarkerPath({ conversation_id: conversationId });
}

function runHook(directory: string, input: unknown) {
  return spawnSync('bun', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('cursor/stop.ts retro path (KHYXY4)', () => {
  let dir: string;
  const conversationIds: string[] = [];

  function freshConversation(tag: string): string {
    const id = `khyxy4-${tag}-${process.pid}-${conversationIds.length}`;
    conversationIds.push(id);
    return id;
  }

  beforeEach(() => {
    dir = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(dir);
    for (const id of conversationIds) {
      rmSync(sentinelPath(id), { force: true });
      rmSync(markerPathFor(id), { force: true });
    }
    conversationIds.length = 0;
  });

  function basePayload(id: string, transcript: string) {
    return {
      workspace_roots: [dir],
      conversation_id: id,
      status: 'completed',
      transcript_path: transcript,
    };
  }

  it('fires a retro followup with the transcript path and guide on a substantial no-edit stop', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshConversation('big');

    const result = runHook(dir, basePayload(id, transcript));

    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.followup_message).toContain(transcript);
    expect(out.followup_message.toLowerCase()).toContain('guide');
    expect(hasNudged(id)).toBe(true);
  });

  it('stays silent on a trivial session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'small.jsonl', 1);
    const id = freshConversation('small');

    const result = runHook(dir, basePayload(id, transcript));

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
    expect(hasNudged(id)).toBe(false);
  });

  it('does not fire retro again on the second stop for the same session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshConversation('twice');

    const first = JSON.parse(runHook(dir, basePayload(id, transcript)).stdout);
    expect(first.followup_message).toContain('guide');
    const second = JSON.parse(runHook(dir, basePayload(id, transcript)).stdout);
    expect(second).toEqual({});
  });

  it('yields to the quality-review followup on an edit stop, leaving the retro sentinel unset', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshConversation('coexist');
    // Simulate an afterFileEdit this session by creating the marker the hook reads.
    writeFileSync(markerPathFor(id), '1');

    const result = runHook(dir, basePayload(id, transcript));

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).followup_message).toBe(QUALITY_REVIEW_MESSAGE);
    // Retro never ran on the quality-review stop → its sentinel is untouched, so it
    // can still fire on a later no-edit stop.
    expect(hasNudged(id)).toBe(false);
  });

  it('emits no retro followup on a non-completed status', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshConversation('aborted');

    const result = runHook(dir, { ...basePayload(id, transcript), status: 'aborted' });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
    expect(hasNudged(id)).toBe(false);
  });

  it('fails open with valid JSON on malformed stdin', () => {
    writeConfig(dir, { surface: true });

    const result = runHook(dir, 'not json at all');

    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  // Filing gate (GH628F / #628): unfiled spooled drafts win the one
  // followup_message slot over the retro-available nudge on a no-edit stop.
  describe('filing gate (GH628F)', () => {
    it('retro-filer-gate.SM1.AC1.dispatches_filer_over_the_retro_available_nudge', () => {
      writeConfig(dir, { surface: true, file: true });
      const transcript = writeTranscript(dir, 'big.jsonl', 8);
      const id = freshConversation('filing');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);

      const result = runHook(dir, basePayload(id, transcript));

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.followup_message).toContain(FILER_AGENT_NAME);
      // Filing took the slot; the retro-available nudge did not burn its sentinel.
      expect(hasNudged(id)).toBe(false);
    });

    it('retro-filer-gate.SM1.AC1.quality_review_still_wins_an_edit_stop', () => {
      writeConfig(dir, { surface: true, file: true });
      const transcript = writeTranscript(dir, 'big.jsonl', 8);
      const id = freshConversation('filingquality');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);
      writeFileSync(markerPathFor(id), '1');

      const result = runHook(dir, basePayload(id, transcript));

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).followup_message).toBe(QUALITY_REVIEW_MESSAGE);
    });

    it('retro-filer-gate.SM1.AC1.silent_dispatch_when_selfReport_file_off', () => {
      writeConfig(dir, { surface: false, file: false });
      const transcript = writeTranscript(dir, 'small.jsonl', 1);
      const id = freshConversation('filingoff');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);

      const result = runHook(dir, basePayload(id, transcript));

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({});
    });
  });
});
