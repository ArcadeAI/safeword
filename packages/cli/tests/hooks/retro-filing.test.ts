import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fileSpooledDrafts,
  readSpooledDrafts,
  spoolDrafts,
  type SpooledDraft,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { decideRetroNudge } from '../../templates/hooks/lib/retro-nudge.js';

const draft = (signature: string, title = 'A friction'): SpooledDraft => ({
  signature,
  title,
  body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

describe('fileSpooledDrafts (BNGK9W — the agent filing seam: post each verbatim, drain filed)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-filing-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('posts each spooled draft body verbatim through the (mocked) transport, then drains', async () => {
    const drafts = [draft('retro:aaaaaaaaaaaa', 'One'), draft('retro:bbbbbbbbbbbb', 'Two')];
    spoolDrafts(projectDirectory, 'sess-1', drafts);

    const posts: SpooledDraft[] = [];
    const post = (d: SpooledDraft): Promise<void> => {
      posts.push(d);
      return Promise.resolve();
    };
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    expect(result).toEqual({ posted: 2, failed: 0 });
    expect(posts).toHaveLength(2); // exactly N posts for N drafts
    // Each post's body byte-equals the corresponding spooled draft body (signature marker included).
    expect(posts[0]?.body).toBe(drafts[0]?.body);
    expect(posts[1]?.body).toBe(drafts[1]?.body);
    expect(posts[0]?.body).toContain('<!-- safeword-retro-signature: retro:aaaaaaaaaaaa -->');
    // All posted → spool fully drained.
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([]);
  });

  it('leaves an un-postable draft spooled for retry, and a later boundary still nudges for it', async () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa', 'Postable'),
      draft('retro:bbbbbbbbbbbb', 'Unpostable'),
    ]);

    const post = (d: SpooledDraft): Promise<void> =>
      d.signature === 'retro:bbbbbbbbbbbb'
        ? Promise.reject(new Error('MCP post failed'))
        : Promise.resolve();
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    expect(result).toEqual({ posted: 1, failed: 1 });
    // A FRESH read yields only the draft that failed to post.
    const remaining = readSpooledDrafts(projectDirectory, 'sess-1');
    expect(remaining).toEqual([draft('retro:bbbbbbbbbbbb', 'Unpostable')]);
    // A later boundary still surfaces exactly one line for the remaining draft.
    const line = decideRetroNudge(projectDirectory, 'sess-1');
    expect(line).toBeDefined();
    expect(line).toContain('1');
  });
});
