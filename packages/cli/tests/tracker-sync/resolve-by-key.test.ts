import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveFolderByTrackerKey } from '../../src/tracker-sync/resolve-by-key.js';
import { TrackerMap } from '../../src/tracker-sync/tracker-map.js';

/**
 * The tracker-key → local-folder join reader (KKNFZA SM2.AC6 / child DGH59K
 * SM1.AC1). Pure over the tickets dir + the tracker-map: reverse-resolves a
 * tracker key to the recorded ticket's folder, returns null on miss, and never
 * returns a dangling path for a stale entry. No network.
 */
describe('tracker-key → local-folder join reader (tracker-identity-and-join.SM1.AC1)', () => {
  let ticketsDirectory: string;

  const folder = (name: string): string => {
    const path = nodePath.join(ticketsDirectory, name);
    mkdirSync(path, { recursive: true });
    return path;
  };

  beforeEach(() => {
    ticketsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'join-reader-'));
  });

  afterEach(() => {
    rmSync(ticketsDirectory, { recursive: true, force: true });
  });

  // SM1.AC1.known_key_resolves_folder — id "ENG-45" → folder "ENG-45-slug" by prefix
  it('resolves a known tracker key to its ticket folder', () => {
    const expected = folder('ENG-45-login-bug');
    const map = new TrackerMap();
    map.record('ENG-45', { provider: 'linear', id: 'ENG-45' });

    expect(resolveFolderByTrackerKey(ticketsDirectory, map, 'ENG-45')).toBe(expected);
  });

  // SM1.AC1.both_key_shapes_resolve — GitHub "#123" and Linear "ENG-45" each to their own folder
  it('resolves both GitHub and Linear key shapes to their own folders', () => {
    const gh = folder('123-gh-bug');
    const lin = folder('ENG-45-lin-bug');
    const map = new TrackerMap();
    map.record('123', { provider: 'github', id: '123' });
    map.record('ENG-45', { provider: 'linear', id: 'ENG-45' });

    expect(resolveFolderByTrackerKey(ticketsDirectory, map, '#123')).toBe(gh);
    expect(resolveFolderByTrackerKey(ticketsDirectory, map, 'ENG-45')).toBe(lin);
  });

  // SM1.AC1.known_key_resolves — legacy: Crockford ticket id differs from the tracker key
  it('resolves when the ticket id differs from the tracker key', () => {
    const expected = folder('7K9M3P-legacy-bug');
    const map = new TrackerMap();
    map.record('7K9M3P', { provider: 'linear', id: 'ENG-45' });

    expect(resolveFolderByTrackerKey(ticketsDirectory, map, 'ENG-45')).toBe(expected);
  });

  // SM1.AC1.unknown_key_clean_not_found
  it('returns the not-found sentinel for an unknown key, without raising', () => {
    const map = new TrackerMap();
    map.record('ENG-45', { provider: 'linear', id: 'ENG-45' });
    folder('ENG-45-login-bug');

    expect(resolveFolderByTrackerKey(ticketsDirectory, map, 'ENG-999')).toBeUndefined();
  });

  // SM1.AC1.stale_map_entry_not_found — mapped but the folder no longer exists
  it('returns null (not a dangling path) when the mapped folder is gone', () => {
    const map = new TrackerMap();
    map.record('ENG-45', { provider: 'linear', id: 'ENG-45' });
    // deliberately do NOT create the folder

    expect(resolveFolderByTrackerKey(ticketsDirectory, map, 'ENG-45')).toBeUndefined();
  });
});
