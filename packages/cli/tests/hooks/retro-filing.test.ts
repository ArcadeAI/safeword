import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fileSpooledDrafts,
  readAcks,
  readSpooledDrafts,
  spoolDrafts,
  type SpooledDraft,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { decideRetroFilingNudge } from '../../templates/hooks/lib/retro-nudge.js';
import { retroDraft as draft, sealedRetroDraft } from '../helpers.js';

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
    const post = (d: SpooledDraft): Promise<{ issue: number }> => {
      posts.push(d);
      return Promise.resolve({ issue: 100 + posts.length });
    };
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    expect(result).toEqual({ posted: 2, failed: 0, rejected: 0 });
    expect(posts).toHaveLength(2); // exactly N posts for N drafts
    // Each post's body byte-equals the corresponding spooled draft body (signature marker included).
    expect(posts[0]?.body).toBe(drafts[0]?.body);
    expect(posts[1]?.body).toBe(drafts[1]?.body);
    expect(posts[0]?.body).toContain('<!-- safeword-retro-signature: retro:aaaaaaaaaaaa -->');
    // All posted → spool fully drained.
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([]);
  });

  it('forwards a spooled canonical signature unchanged to the posting boundary', async () => {
    const canonical: SpooledDraft = {
      ...draft('retro:aaaaaaaaaaaa', 'Canonical'),
      canonicalSignature: 'canonical:aaaaaaaaaaaa',
    };
    spoolDrafts(projectDirectory, 'sess-1', [canonical]);
    const posted: SpooledDraft[] = [];
    await fileSpooledDrafts(projectDirectory, 'sess-1', value => {
      posted.push(value);
      return Promise.resolve({ issue: 101 });
    });
    expect(posted).toEqual([canonical]);
  });

  it('files nothing and posts nothing at a drained boundary (no re-file, no re-nudge)', async () => {
    // Everything already filed → an empty spool. A later boundary must not re-post.
    let posts = 0;
    const post = (): Promise<{ issue: number }> => {
      posts += 1;
      return Promise.resolve({ issue: 100 });
    };
    const result = await fileSpooledDrafts(projectDirectory, 'drained-sess', post);
    expect(result).toEqual({ posted: 0, failed: 0, rejected: 0 });
    expect(posts).toBe(0);
    expect(decideRetroFilingNudge(projectDirectory, 'drained-sess')).toBeUndefined();
  });

  // GH644A SM2.AC2: the ack is written after each post and before any drain, so
  // a crash between post and drain never looks like a forged bare drain.
  it('records each ack after its post and before any drain (observed mid-run)', async () => {
    const drafts = [draft('retro:aaaaaaaaaaaa', 'Acked'), draft('retro:bbbbbbbbbbbb', 'Failing')];
    spoolDrafts(projectDirectory, 'sess-1', drafts);

    let midRun: { acks: unknown[]; spooled: number } | undefined;
    const post = (d: SpooledDraft): Promise<{ issue: number }> => {
      if (d.signature === 'retro:bbbbbbbbbbbb') {
        // At the moment the SECOND post is invoked, the FIRST draft's ack line
        // must already be on disk while its draft is still spooled (not yet drained).
        midRun = {
          acks: readAcks(projectDirectory, 'sess-1'),
          spooled: readSpooledDrafts(projectDirectory, 'sess-1').length,
        };
        return Promise.reject(new Error('MCP post failed'));
      }
      return Promise.resolve({ issue: 101 });
    };
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    expect(result).toEqual({ posted: 1, failed: 1, rejected: 0 });
    expect(midRun?.acks).toEqual([{ signature: 'retro:aaaaaaaaaaaa', issue: 101 }]);
    expect(midRun?.spooled).toBe(2); // ack precedes ANY drain
    // End state: success acked + drained; failure unacked + spooled.
    expect(readAcks(projectDirectory, 'sess-1')).toEqual([
      { signature: 'retro:aaaaaaaaaaaa', issue: 101 },
    ]);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([
      draft('retro:bbbbbbbbbbbb', 'Failing'),
    ]);
  });

  it('leaves an un-postable draft spooled for retry, and a later boundary still nudges for it', async () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa', 'Postable'),
      draft('retro:bbbbbbbbbbbb', 'Unpostable'),
    ]);

    const post = (d: SpooledDraft): Promise<{ issue: number }> =>
      d.signature === 'retro:bbbbbbbbbbbb'
        ? Promise.reject(new Error('MCP post failed'))
        : Promise.resolve({ issue: 100 });
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    expect(result).toEqual({ posted: 1, failed: 1, rejected: 0 });
    // A FRESH read yields only the draft that failed to post.
    const remaining = readSpooledDrafts(projectDirectory, 'sess-1');
    expect(remaining).toEqual([draft('retro:bbbbbbbbbbbb', 'Unpostable')]);
    // A later boundary still surfaces exactly one line for the remaining draft.
    const line = decideRetroFilingNudge(projectDirectory, 'sess-1');
    expect(line).toBeDefined();
    expect(line).toContain('1');
  });

  // JDK0F0 (#773 rung 3): the seal is what graduates retro/SKILL.md's
  // "post verbatim, never re-word" rule — the seam refuses, prose just points.
  it('refuses to post a draft whose body was modified after sealing (it stays spooled)', async () => {
    const sealed = sealedRetroDraft('retro:aaaaaaaaaaaa', 'Intact');
    // Sealed correctly, then the body re-worded — the digest no longer matches.
    const tampered = {
      ...sealedRetroDraft('retro:bbbbbbbbbbbb', 'Tampered'),
      body: 're-worded after sealing',
    };
    spoolDrafts(projectDirectory, 'sess-1', [sealed, tampered]);

    const posts: SpooledDraft[] = [];
    const post = (d: SpooledDraft): Promise<{ issue: number }> => {
      posts.push(d);
      return Promise.resolve({ issue: 100 });
    };
    const result = await fileSpooledDrafts(projectDirectory, 'sess-1', post);

    // The mismatched body never reaches the transport — not a failed post, a refusal.
    expect(result).toEqual({ posted: 1, failed: 0, rejected: 1 });
    expect(posts.map(d => d.signature)).toEqual(['retro:aaaaaaaaaaaa']);
    // It stays spooled (visible for a human to inspect), and no ack is forged for it.
    expect(readSpooledDrafts(projectDirectory, 'sess-1').map(d => d.signature)).toEqual([
      'retro:bbbbbbbbbbbb',
    ]);
    expect(readAcks(projectDirectory, 'sess-1')).toEqual([
      { signature: 'retro:aaaaaaaaaaaa', issue: 100 },
    ]);
  });
});
