/* eslint-disable unicorn/no-null -- null models an explicit file-removal mutation */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { PassThrough, Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyCodexFinalization,
  codexFinalizationIsComplete,
  codexRecoveryIsRequired,
  promptCodexFinalization,
  recoverCodexFinalization,
  resolveCodexFinalizationConfirmation,
} from '../../src/codex-plugin/finalization.js';

describe('Codex migration finalization', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('leaves finalization unconfirmed when the interactive prompt is declined', async () => {
    const confirm = vi.fn().mockResolvedValue(false);

    const confirmed = await resolveCodexFinalizationConfirmation({
      assumeYes: false,
      confirm,
    });

    expect(confirmed).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('accepts an explicit yes at the interactive finalization prompt', async () => {
    const output = new PassThrough();

    await expect(
      promptCodexFinalization(
        'Finalization plan:\n- remove .agents/skills/bdd/SKILL.md\n',
        Readable.from(['yes\n']),
        output,
      ),
    ).resolves.toBe(true);
    expect(output.read()?.toString()).toContain(
      'Finalization plan:\n- remove .agents/skills/bdd/SKILL.md',
    );
  });

  it('defaults to declining an empty interactive finalization response', async () => {
    const output = new PassThrough();

    await expect(
      promptCodexFinalization('Finalization plan:\n', Readable.from(['\n']), output),
    ).resolves.toBe(false);
  });

  it('does not treat a marker without a finalized transaction manifest as complete', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const safewordDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(safewordDirectory);
    writeFileSync(
      nodePath.join(safewordDirectory, 'codex-plugin.json'),
      JSON.stringify({
        schema_version: 1,
        migration_state: 'finalized',
        finalized_at: '2026-07-28T00:00:00.000Z',
      }),
    );

    expect(codexFinalizationIsComplete(directory)).toBe(false);
  });

  it('does not treat a finalized manifest without validated entries as complete', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const safewordDirectory = nodePath.join(directory, '.safeword');
    const backupDirectory = nodePath.join(safewordDirectory, 'codex-migration-backup');
    mkdirSync(backupDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(safewordDirectory, 'codex-plugin.json'),
      JSON.stringify({ schema_version: 1, mode: 'plugin' }),
    );
    writeFileSync(
      nodePath.join(backupDirectory, 'manifest.json'),
      JSON.stringify({ schema_version: 1, status: 'finalized' }),
    );

    expect(codexFinalizationIsComplete(directory)).toBe(false);
    expect(codexRecoveryIsRequired(directory)).toBe(true);
  });

  it('surfaces an orphaned backup directory as recovery required', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    mkdirSync(nodePath.join(directory, '.safeword/codex-migration-backup'), {
      recursive: true,
    });

    expect(codexRecoveryIsRequired(directory)).toBe(true);
  });

  it('rejects a dangling symlink before creating recovery evidence or mutating it', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const linkPath = nodePath.join(directory, 'owned');
    symlinkSync('missing-target', linkPath);

    expect(() => applyCodexFinalization(directory, [{ path: 'owned', content: null }])).toThrow(
      'symbolic link',
    );
    expect(existsSync(nodePath.join(directory, '.safeword/codex-migration-backup'))).toBe(false);
    expect(readlinkSync(linkPath)).toBe('missing-target');
  });

  it('rolls back the complete pre-migration state when finalization fails', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    writeFileSync(nodePath.join(directory, 'first.txt'), 'first before\n');
    writeFileSync(nodePath.join(directory, 'second.txt'), 'second before\n');

    expect(() =>
      applyCodexFinalization(
        directory,
        [
          { path: 'first.txt', content: 'first after\n' },
          { path: 'second.txt', content: 'second after\n' },
        ],
        {
          beforeMutation: index => {
            if (index === 1) throw new Error('injected finalization failure');
          },
        },
      ),
    ).toThrow('injected finalization failure');

    expect(readFileSync(nodePath.join(directory, 'first.txt'), 'utf8')).toBe('first before\n');
    expect(readFileSync(nodePath.join(directory, 'second.txt'), 'utf8')).toBe('second before\n');
    expect(existsSync(nodePath.join(directory, '.safeword/codex-migration-backup'))).toBe(false);
  });

  it('retains recovery evidence when automatic rollback fails', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    writeFileSync(nodePath.join(directory, 'first.txt'), 'first before\n');
    writeFileSync(nodePath.join(directory, 'second.txt'), 'second before\n');

    expect(() =>
      applyCodexFinalization(
        directory,
        [
          { path: 'first.txt', content: 'first after\n' },
          { path: 'second.txt', content: 'second after\n' },
        ],
        {
          beforeMutation: index => {
            if (index === 1) throw new Error('injected finalization failure');
          },
          beforeRollback: () => {
            throw new Error('injected rollback failure');
          },
        },
      ),
    ).toThrow('recovery is required');

    expect(readFileSync(nodePath.join(directory, 'first.txt'), 'utf8')).toBe('first after\n');
    const manifestPath = nodePath.join(directory, '.safeword/codex-migration-backup/manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'prepared',
    });
  });

  it('does not overwrite a file changed after the backup was prepared', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const target = nodePath.join(directory, 'owned.txt');
    writeFileSync(target, 'before\n');

    expect(() =>
      applyCodexFinalization(directory, [{ path: 'owned.txt', content: 'after\n' }], {
        afterPrepared: () => {
          writeFileSync(target, 'teammate edit\n');
        },
      }),
    ).toThrow('changed after the Codex migration backup was prepared');
    expect(readFileSync(target, 'utf8')).toBe('teammate edit\n');
  });

  it('retains recovery evidence instead of clobbering an edit made before rollback', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const first = nodePath.join(directory, 'first.txt');
    writeFileSync(first, 'first before\n');
    writeFileSync(nodePath.join(directory, 'second.txt'), 'second before\n');

    expect(() =>
      applyCodexFinalization(
        directory,
        [
          { path: 'first.txt', content: 'first after\n' },
          { path: 'second.txt', content: 'second after\n' },
        ],
        {
          beforeMutation: index => {
            if (index === 1) throw new Error('injected finalization failure');
          },
          beforeRollback: () => {
            writeFileSync(first, 'teammate edit\n');
          },
        },
      ),
    ).toThrow('recovery is required');
    expect(readFileSync(first, 'utf8')).toBe('teammate edit\n');
    expect(
      existsSync(nodePath.join(directory, '.safeword/codex-migration-backup/manifest.json')),
    ).toBe(true);
  });

  it('rejects recovery entries outside the schema-owned Codex migration inventory', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const backupDirectory = nodePath.join(directory, '.safeword/codex-migration-backup');
    const payloadDirectory = nodePath.join(backupDirectory, 'payloads');
    mkdirSync(payloadDirectory, { recursive: true });
    const innocent = nodePath.join(directory, 'innocent.txt');
    const current = Buffer.from('innocent current\n');
    const forgedBefore = Buffer.from('forged overwrite\n');
    writeFileSync(innocent, current);
    writeFileSync(nodePath.join(payloadDirectory, '0.bin'), forgedBefore);
    const hash = (content: Buffer) => createHash('sha256').update(content).digest('hex');
    writeFileSync(
      nodePath.join(backupDirectory, 'manifest.json'),
      JSON.stringify({
        schema_version: 1,
        status: 'finalized',
        entries: [
          {
            path: 'innocent.txt',
            before: {
              kind: 'file',
              mode: 0o644,
              sha256: hash(forgedBefore),
              payload: 'payloads/0.bin',
            },
            after: { kind: 'file', mode: 0o644, sha256: hash(current) },
          },
        ],
      }),
    );

    expect(() => recoverCodexFinalization(directory)).toThrow('not part of the Codex migration');
    expect(readFileSync(innocent, 'utf8')).toBe('innocent current\n');
  });

  it('propagates the handled transaction failure after restoring pre-migration state', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    writeFileSync(nodePath.join(directory, 'owned.txt'), 'before\n');
    const failure = new Error('handled write failure');

    expect(() =>
      applyCodexFinalization(
        directory,
        [
          { path: 'owned.txt', content: 'after\n' },
          { path: 'created.txt', content: 'created\n' },
        ],
        {
          beforeMutation: index => {
            if (index === 1) throw failure;
          },
        },
      ),
    ).toThrow(failure);

    expect(readFileSync(nodePath.join(directory, 'owned.txt'), 'utf8')).toBe('before\n');
    expect(existsSync(nodePath.join(directory, 'created.txt'))).toBe(false);
  });

  it('leaves deterministic recovery evidence when execution stops after preparation', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    writeFileSync(nodePath.join(directory, 'owned.txt'), 'before\n');

    expect(() =>
      applyCodexFinalization(directory, [{ path: 'owned.txt', content: 'after\n' }], {
        afterPrepared: () => {
          throw new Error('simulated process stop');
        },
      }),
    ).toThrow('simulated process stop');

    expect(readFileSync(nodePath.join(directory, 'owned.txt'), 'utf8')).toBe('before\n');
    const manifestPath = nodePath.join(directory, '.safeword/codex-migration-backup/manifest.json');
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'prepared',
      entries: [{ path: 'owned.txt' }],
    });
  });

  it('rejects an unsafe backup target before changing any file', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-finalization-'));
    directories.push(directory);
    const outsideName = `${nodePath.basename(directory)}-outside.txt`;
    const outsidePath = nodePath.join(nodePath.dirname(directory), outsideName);
    writeFileSync(outsidePath, 'outside before\n');
    directories.push(outsidePath);

    expect(() =>
      applyCodexFinalization(directory, [
        { path: `../${outsideName}`, content: 'outside after\n' },
      ]),
    ).toThrow('Unsafe Codex migration path');

    expect(readFileSync(outsidePath, 'utf8')).toBe('outside before\n');
    expect(existsSync(nodePath.join(directory, '.safeword/codex-migration-backup'))).toBe(false);
  });
});
