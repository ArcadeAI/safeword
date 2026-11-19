/**
 * A session's unfiled retro findings survive its worktree (#5467 part 3b).
 *
 * The writer keeps a durable copy in the repository's shared git directory,
 * which every worktree shares. The filer keeps working on the copy in the
 * project's `.safeword/retro-drafts/`, so it never reads or writes inside
 * `.git`. These tests spool from a real linked worktree, remove it each way git
 * allows, and run the real Claude Stop filing hook from the primary checkout.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { drainRetroSpool } from '../../templates/hooks/lib/drain-retro-spool.js';
import {
  draftSpoolPath,
  durableDraftSpoolPath,
  markDraftsAcceptedByServer,
  readServerSpooledDrafts,
  readSpooledDrafts,
  recordFiledAck,
  spoolDrafts,
  stageRetroSpool,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { decideRetroFilingNudge } from '../../templates/hooks/lib/retro-nudge.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  repoRoot,
  retroDraft as draft,
  TIMEOUT_QUICK,
} from '../helpers';
import { blockWrites } from '../helpers/io-failure';

const STOP_HOOK = nodePath.join(repoRoot, 'packages/cli/templates/hooks/stop-retro-filing.ts');
const SESSION = 'sess-worktree';

function git(cwd: string, ...arguments_: string[]): string {
  const result = spawnSync('git', arguments_, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${arguments_.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

/** Run the real Claude Stop filing hook launched in `directory`. */
function stopHook(directory: string): { decision?: string; reason?: string } | undefined {
  const result = spawnSync('bun', [STOP_HOOK], {
    input: JSON.stringify({ session_id: SESSION, stop_hook_active: false }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  expect(result.status).toBe(0);
  const output = result.stdout.trim();
  return output.length === 0 ? undefined : (JSON.parse(output) as { reason?: string });
}

function lines(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0);
}

describe('retro spool survives a deleted worktree (#5467)', () => {
  let root: string;
  let primary: string;
  let worktree: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    primary = nodePath.join(root, 'primary');
    worktree = nodePath.join(root, 'linked');
    mkdirSync(nodePath.join(primary, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(primary, '.safeword', 'config.json'), '{}\n');
    git(primary, 'init', '-q', '-b', 'main');
    git(primary, 'config', 'user.email', 'test@example.com');
    git(primary, 'config', 'user.name', 'Test');
    git(primary, 'add', '.');
    git(primary, 'commit', '-q', '-m', 'init');
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  const removals: [string, string[], () => void][] = [
    ['git worktree remove', [], () => git(primary, 'worktree', 'remove', '--force', worktree)],
    [
      'deleting the folder, then git worktree prune',
      [],
      () => {
        rmSync(worktree, { recursive: true, force: true });
        git(primary, 'worktree', 'prune');
      },
    ],
    [
      'a --relative-paths worktree, removed',
      ['--relative-paths'],
      () => git(primary, 'worktree', 'remove', '--force', worktree),
    ],
  ];

  it.each(removals)(
    'the primary checkout still dispatches the draft after %s',
    (_label, worktreeFlags, remove) => {
      git(primary, 'worktree', 'add', '-q', ...worktreeFlags, '-b', 'feature', worktree);
      spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
      remove();
      expect(existsSync(worktree)).toBe(false);

      const output = stopHook(primary);

      expect(output?.decision).toBe('block');
      const workingCopy = draftSpoolPath(primary, SESSION);
      expect(output?.reason).toContain(workingCopy);
      expect(readSpooledDrafts(primary, SESSION).map(spooled => spooled.signature)).toEqual([
        'retro:aaaaaaaaaaaa',
      ]);
      expect(lines(workingCopy)).toHaveLength(1);
    },
  );

  it('keeps the durable copy in the shared git directory, never in the working tree', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);

    const durable = durableDraftSpoolPath(worktree, SESSION);
    expect(durable).toBe(
      nodePath.join(realGitDirectory(primary), 'safeword', 'retro-drafts', `${SESSION}.jsonl`),
    );
    expect(lines(durable)).toHaveLength(1);
    expect(git(worktree, 'status', '--porcelain')).toBe('');
  });

  it('files each finding once: the filer acks and drains the working copy, and both copies empty', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa'), draft('retro:bbbbbbbbbbbb')]);
    expect(stopHook(worktree)?.decision).toBe('block');

    // The filer's own steps: ack each post beside the working copy, then drain.
    for (const signature of ['retro:aaaaaaaaaaaa', 'retro:bbbbbbbbbbbb']) {
      expect(recordFiledAck(worktree, SESSION, { signature, issue: 7 })).toBe(true);
    }
    expect(drainRetroSpool(draftSpoolPath(worktree, SESSION))).toEqual({ state: 'drained' });

    expect(lines(draftSpoolPath(worktree, SESSION))).toEqual([]);
    expect(readSpooledDrafts(worktree, SESSION)).toEqual([]);
    expect(stopHook(worktree)).toBeUndefined();
  });

  it('stays drained from working-copy acks when the drain could not write the shared folder', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    expect(stopHook(worktree)?.decision).toBe('block');
    // A sandboxed filer can write only inside the workspace.
    const unblock = blockSharedLedgers(worktree);
    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    drainRetroSpool(draftSpoolPath(worktree, SESSION));
    unblock();

    expect(stopHook(worktree)).toBeUndefined();
    expect(readSpooledDrafts(worktree, SESSION)).toEqual([]);
  });

  it('keeps a sandboxed filing filed after the worktree is deleted', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    expect(stopHook(worktree)?.decision).toBe('block');
    const unblock = blockSharedLedgers(worktree);
    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    drainRetroSpool(draftSpoolPath(worktree, SESSION));
    unblock();
    const sharedAcks = `${durableDraftSpoolPath(worktree, SESSION).slice(0, -'.jsonl'.length)}.acks.jsonl`;
    expect(lines(sharedAcks)).toEqual([]);
    // The filer's turn ends: the Stop hook copies the acks to the shared folder.
    expect(stopHook(worktree)).toBeUndefined();
    expect(lines(sharedAcks)).toHaveLength(1);
    git(primary, 'worktree', 'remove', '--force', worktree);

    expect(stopHook(primary)).toBeUndefined();
    expect(readSpooledDrafts(primary, SESSION)).toEqual([]);
  });

  it('hands the filer nothing, and spends no attempt, when staging cannot write the working copy', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    const working = blockWrites(draftSpoolPath(worktree, SESSION));

    expect(stopHook(worktree)).toBeUndefined();
    expect(stopHook(worktree)).toBeUndefined();
    expect(stopHook(worktree)).toBeUndefined();
    rmSync(working, { recursive: true });

    const dispatched = stopHook(worktree);
    expect(dispatched?.reason).toContain(draftSpoolPath(worktree, SESSION));
    expect(lines(draftSpoolPath(worktree, SESSION))).toHaveLength(1);
  });

  it('nudges with the working copy after the worktree that spooled the draft is deleted', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    git(primary, 'worktree', 'remove', '--force', worktree);

    const nudge = decideRetroFilingNudge(primary, SESSION);

    expect(nudge).toContain(
      `1 unfiled finding from this session at ${draftSpoolPath(primary, SESSION)}`,
    );
    expect(lines(draftSpoolPath(primary, SESSION))).toHaveLength(1);
  });

  it('skips the nudge, and retries it next time, when staging cannot write the working copy', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    const working = blockWrites(draftSpoolPath(worktree, SESSION));

    expect(decideRetroFilingNudge(worktree, SESSION)).toBeUndefined();
    rmSync(working, { recursive: true });

    expect(decideRetroFilingNudge(worktree, SESSION)).toContain(draftSpoolPath(worktree, SESSION));
  });

  it('falls back to the working copy when the shared directory cannot be written', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    const durable = blockWrites(durableDraftSpoolPath(worktree, SESSION));

    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    rmSync(durable, { recursive: true });

    expect(lines(draftSpoolPath(worktree, SESSION))).toHaveLength(1);
    expect(stopHook(worktree)?.decision).toBe('block');
  });

  it("keeps every draft when an append crosses the shared copy's per-session cap", () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    const signature = (index: number): string => `retro:${String(index).padStart(12, '0')}`;
    spoolDrafts(
      worktree,
      SESSION,
      Array.from({ length: 19 }, (_, index) => draft(signature(index))),
    );
    // The first 19 are already staged into the working copy, which has one slot left.
    stageRetroSpool(worktree, SESSION);
    spoolDrafts(worktree, SESSION, [draft(signature(19)), draft(signature(20))]);

    expect(lines(durableDraftSpoolPath(worktree, SESSION))).toHaveLength(20);
    const signatures = readSpooledDrafts(worktree, SESSION).map(spooled => spooled.signature);
    expect(signatures.toSorted((left, right) => left.localeCompare(right))).toEqual(
      Array.from({ length: 21 }, (_, index) => signature(index)),
    );
  });

  it('dispatches a finding in both copies once, and a pre-upgrade working-copy draft too', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    const legacy = draftSpoolPath(worktree, SESSION);
    mkdirSync(nodePath.dirname(legacy), { recursive: true });
    writeFileSync(
      legacy,
      `${[draft('retro:aaaaaaaaaaaa'), draft('retro:cccccccccccc')].map(entry => JSON.stringify(entry)).join('\n')}\n`,
    );
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa'), draft('retro:bbbbbbbbbbbb')]);

    expect(stopHook(worktree)?.reason).toContain('3 ');
    expect(
      lines(legacy).map(line => (JSON.parse(line) as { signature: string }).signature),
    ).toEqual(['retro:aaaaaaaaaaaa', 'retro:cccccccccccc', 'retro:bbbbbbbbbbbb']);
  });

  it('never restages a durable draft the working copy already acknowledged', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);

    expect(stopHook(worktree)).toBeUndefined();
    expect(lines(draftSpoolPath(worktree, SESSION))).toEqual([]);
  });

  it('never lets a filed direct ack hide or prune a server-routed draft with the same signature', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    spoolDrafts(worktree, SESSION, [{ ...draft('retro:aaaaaaaaaaaa'), route: 'server-v3' }]);

    stopHook(worktree);

    expect(readServerSpooledDrafts(worktree, SESSION).map(spooled => spooled.signature)).toEqual([
      'retro:aaaaaaaaaaaa',
    ]);
    expect(lines(durableDraftSpoolPath(worktree, SESSION))).toHaveLength(1);
  });

  it('removes a server-accepted draft from both copies', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [{ ...draft('retro:aaaaaaaaaaaa'), route: 'server-v3' }]);

    markDraftsAcceptedByServer(worktree, SESSION, ['retro:aaaaaaaaaaaa']);

    expect(readServerSpooledDrafts(worktree, SESSION)).toEqual([]);
    expect(lines(draftSpoolPath(worktree, SESSION))).toEqual([]);
  });

  it('never rewrites the shared copy, so a draft appended during a removal survives', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    stageRetroSpool(worktree, SESSION);
    const durableBefore = readFileSync(durableDraftSpoolPath(worktree, SESSION), 'utf8');

    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    drainRetroSpool(draftSpoolPath(worktree, SESSION));
    stopHook(worktree);
    expect(readFileSync(durableDraftSpoolPath(worktree, SESSION), 'utf8')).toBe(durableBefore);

    // The background retro writer appends while the gate reconciles.
    spoolDrafts(worktree, SESSION, [draft('retro:bbbbbbbbbbbb')]);
    expect(stopHook(worktree)?.decision).toBe('block');
    expect(readSpooledDrafts(worktree, SESSION).map(spooled => spooled.signature)).toEqual([
      'retro:bbbbbbbbbbbb',
    ]);
  });

  it('never restores a server-accepted draft the durable copy could not drop', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [{ ...draft('retro:aaaaaaaaaaaa'), route: 'server-v3' }]);
    stageRetroSpool(worktree, SESSION);
    const unblock = blockSharedLedgers(worktree);
    markDraftsAcceptedByServer(worktree, SESSION, ['retro:aaaaaaaaaaaa']);
    unblock();

    stopHook(worktree);
    expect(readServerSpooledDrafts(worktree, SESSION)).toEqual([]);
  });

  it('never brings back a drained draft when a stale staging write lands after the drain', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa'), draft('retro:bbbbbbbbbbbb')]);
    const working = draftSpoolPath(worktree, SESSION);
    stageRetroSpool(worktree, SESSION);
    const staleSnapshot = readFileSync(working, 'utf8');

    recordFiledAck(worktree, SESSION, { signature: 'retro:aaaaaaaaaaaa', issue: 7 });
    drainRetroSpool(working);
    // A staging pass that read before the drain writes its snapshot after it.
    writeFileSync(working, staleSnapshot);

    expect(readSpooledDrafts(worktree, SESSION).map(spooled => spooled.signature)).toEqual([
      'retro:bbbbbbbbbbbb',
    ]);
    expect(stopHook(worktree)?.reason).toContain('1 sanitized finding ');
    // The file the filer is handed holds only the pending draft.
    expect(
      lines(working).map(line => (JSON.parse(line) as { signature: string }).signature),
    ).toEqual(['retro:bbbbbbbbbbbb']);
  });

  it('never replaces the working copy while another writer holds it', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    const working = draftSpoolPath(worktree, SESSION);
    mkdirSync(nodePath.dirname(working), { recursive: true });
    // A fallback writer is mid-append: its draft exists only in the working copy.
    writeFileSync(working, `${JSON.stringify(draft('retro:bbbbbbbbbbbb'))}\n`);
    mkdirSync(`${working}.lock`);

    expect(stageRetroSpool(worktree, SESSION)).toBeUndefined();
    expect(lines(working)).toHaveLength(1);

    rmSync(`${working}.lock`, { recursive: true });
    expect(stageRetroSpool(worktree, SESSION)).toBe(working);
    expect(
      lines(working).map(line => (JSON.parse(line) as { signature: string }).signature),
    ).toEqual(['retro:bbbbbbbbbbbb', 'retro:aaaaaaaaaaaa']);
  });

  it('a fallback writer waits for a held lock instead of appending under it', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    const durable = blockWrites(durableDraftSpoolPath(worktree, SESSION));
    const working = draftSpoolPath(worktree, SESSION);
    mkdirSync(`${working}.lock`, { recursive: true });
    // Held past the old 2-second wait, but not yet abandoned.
    const held = new Date(Date.now() - 5000);
    utimesSync(`${working}.lock`, held, held);

    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    rmSync(durable, { recursive: true });

    // It took the lock (once abandoned) and released it, rather than appending beside its holder.
    expect(existsSync(`${working}.lock`)).toBe(false);
    expect(lines(working)).toHaveLength(1);
  });

  it('clears a lock abandoned by a killed writer', () => {
    git(primary, 'worktree', 'add', '-q', '-b', 'feature', worktree);
    spoolDrafts(worktree, SESSION, [draft('retro:aaaaaaaaaaaa')]);
    const working = draftSpoolPath(worktree, SESSION);
    mkdirSync(`${working}.lock`, { recursive: true });
    const abandoned = new Date(Date.now() - 60_000);
    utimesSync(`${working}.lock`, abandoned, abandoned);

    expect(stageRetroSpool(worktree, SESSION)).toBe(working);
    expect(existsSync(`${working}.lock`)).toBe(false);
  });

  it('outside git, the durable copy is the working copy', () => {
    const plain = nodePath.join(root, 'plain');
    mkdirSync(plain);
    expect(durableDraftSpoolPath(plain, SESSION)).toBe(draftSpoolPath(plain, SESSION));
  });
});

/** Make the shared folder's ack and removal ledgers unwritable, as an agent sandbox does. */
function blockSharedLedgers(projectDirectory: string): () => void {
  const base = durableDraftSpoolPath(projectDirectory, SESSION).slice(0, -'.jsonl'.length);
  const ledgers = [`${base}.acks.jsonl`, `${base}.removed.jsonl`].map(ledger =>
    blockWrites(ledger),
  );
  return () => {
    for (const ledger of ledgers) rmSync(ledger, { recursive: true });
  };
}

function realGitDirectory(primary: string): string {
  return git(primary, 'rev-parse', '--path-format=absolute', '--git-common-dir');
}
