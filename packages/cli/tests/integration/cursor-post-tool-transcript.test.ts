import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cursorConversationStashPath,
  cursorProjectStashPath,
  cursorTranscriptStashPath,
} from '../../templates/hooks/lib/cursor-state.ts';

const createdPaths: string[] = [];

afterEach(() => {
  for (const path of createdPaths.splice(0)) rmSync(path, { force: true, recursive: true });
});

describe('Cursor postToolUse transcript binding', () => {
  it('stashes the transcript when Cursor first provides it after shell execution', () => {
    const conversationId = randomUUID();
    const projectDirectory = nodePath.join(tmpdir(), `safeword-cursor-post-${randomUUID()}`);
    const transcript = nodePath.join(projectDirectory, 'transcript.jsonl');
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    createdPaths.push(projectDirectory);

    const state = { conversation_id: conversationId };
    const stashPaths = [
      cursorConversationStashPath(state),
      cursorProjectStashPath(state),
      cursorTranscriptStashPath(state),
    ];
    createdPaths.push(...stashPaths);

    const beforeResult = spawnSync(
      'bun',
      [nodePath.resolve('templates/hooks/cursor/before-shell-execution.ts')],
      {
        cwd: projectDirectory,
        encoding: 'utf8',
        input: JSON.stringify({
          conversation_id: conversationId,
          command: 'pwd',
          workspace_roots: [projectDirectory],
        }),
      },
    );

    expect(beforeResult.status).toBe(0);
    expect(JSON.parse(beforeResult.stdout)).toEqual({ permission: 'allow' });
    expect(existsSync(cursorTranscriptStashPath(state))).toBe(false);

    const result = spawnSync(
      'bun',
      [nodePath.resolve('templates/hooks/cursor/post-tool-quality.ts')],
      {
        cwd: projectDirectory,
        encoding: 'utf8',
        input: JSON.stringify({
          conversation_id: conversationId,
          transcript_path: transcript,
          tool_name: 'Shell',
          tool_input: { command: 'pwd' },
          workspace_roots: [projectDirectory],
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
    expect(existsSync(cursorTranscriptStashPath(state))).toBe(true);
    expect(readFileSync(cursorConversationStashPath(state), 'utf8')).toBe(conversationId);
    expect(readFileSync(cursorProjectStashPath(state), 'utf8')).toBe(
      realpathSync(projectDirectory),
    );
    expect(readFileSync(cursorTranscriptStashPath(state), 'utf8')).toBe(transcript);

    const missingPathResult = spawnSync(
      'bun',
      [nodePath.resolve('templates/hooks/cursor/post-tool-quality.ts')],
      {
        cwd: projectDirectory,
        encoding: 'utf8',
        input: JSON.stringify({
          conversation_id: conversationId,
          tool_name: 'Shell',
          tool_input: { command: 'pwd' },
          workspace_roots: [projectDirectory],
        }),
      },
    );

    expect(missingPathResult.status).toBe(0);
    expect(JSON.parse(missingPathResult.stdout)).toEqual({});
    expect(readFileSync(cursorTranscriptStashPath(state), 'utf8')).toBe(transcript);
  });
});
