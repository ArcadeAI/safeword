import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyCodexFinalization,
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
});
