import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RelayStore } from '../src/store.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.length = 0;
});

describe('retro relay runtime qualification', () => {
  it('loads the native driver, enables WAL, migrates, and reopens on Node 22', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-relay-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'relay.sqlite');

    const first = RelayStore.open(databasePath);
    expect(first.journalMode()).toBe('wal');
    expect(first.schemaVersion()).toBe(1);
    first.close();

    const reopened = RelayStore.open(databasePath);
    expect(reopened.journalMode()).toBe('wal');
    expect(reopened.schemaVersion()).toBe(1);
    reopened.close();
  });
});
