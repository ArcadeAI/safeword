import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { renameDurable } from '../../src/retro/durable-fs.js';

describe('durable filesystem mutations', () => {
  it('synchronizes both directory entries for a cross-directory rename', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'durable-rename-'));
    const sourceDirectory = path.join(root, 'source');
    const destinationDirectory = path.join(root, 'destination');
    mkdirSync(sourceDirectory);
    mkdirSync(destinationDirectory);
    const source = path.join(sourceDirectory, 'record.json');
    const destination = path.join(destinationDirectory, 'record.json');
    writeFileSync(source, '{}');
    const beforeDirectorySync = vi.fn<() => Promise<void>>(() => Promise.resolve());

    try {
      await renameDurable(source, destination, { beforeDirectorySync });
      expect(beforeDirectorySync).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
