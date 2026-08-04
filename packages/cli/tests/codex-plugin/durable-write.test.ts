import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystem = vi.hoisted(() => ({
  closeSync: vi.fn(),
  fsyncSync: vi.fn(),
  openSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock('node:fs', () => fileSystem);

import { durableRename } from '../../src/codex-plugin/durable-write.js';

describe('durableRename', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fileSystem.openSync.mockReturnValue(17);
  });

  it('fails before publication when the destination directory cannot be opened', () => {
    fileSystem.openSync.mockImplementation(() => {
      throw Object.assign(new Error('unopenable'), { code: 'EACCES' });
    });

    expect(() => {
      durableRename('staged', '/target/published');
    }).toThrow('unopenable');
    expect(fileSystem.renameSync).not.toHaveBeenCalled();
  });

  it('publishes without directory fsync when opening directories is unsupported', () => {
    fileSystem.openSync.mockImplementation(() => {
      throw Object.assign(new Error('unsupported'), { code: 'EISDIR' });
    });

    durableRename('staged', '/target/published');

    expect(fileSystem.renameSync).toHaveBeenCalledWith('staged', '/target/published');
    expect(fileSystem.fsyncSync).not.toHaveBeenCalled();
    expect(fileSystem.closeSync).not.toHaveBeenCalled();
  });

  it('reports a durability failure after publication and still closes the directory', () => {
    fileSystem.fsyncSync.mockImplementation(() => {
      throw Object.assign(new Error('device failure'), { code: 'EIO' });
    });

    expect(() => {
      durableRename('staged', '/target/published');
    }).toThrow('device failure');
    expect(fileSystem.renameSync).toHaveBeenCalledWith('staged', '/target/published');
    expect(fileSystem.closeSync).toHaveBeenCalledWith(17);
  });

  it('opens, publishes, flushes, and closes in order', () => {
    durableRename('staged', '/target/published');

    expect(fileSystem.openSync).toHaveBeenCalledWith('/target', 'r');
    expect(fileSystem.openSync.mock.invocationCallOrder[0]).toBeLessThan(
      fileSystem.renameSync.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(fileSystem.renameSync.mock.invocationCallOrder[0]).toBeLessThan(
      fileSystem.fsyncSync.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(fileSystem.fsyncSync.mock.invocationCallOrder[0]).toBeLessThan(
      fileSystem.closeSync.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
