import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadTrackerMap, planTicketSync, TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { TrackerReference } from '../../src/tracker-sync/types.js';

/**
 * The sidecar data + decision layer (JS5K5G AC5/AC6/AC8/AC9). loadTrackerMap
 * distinguishes ok / missing / corrupt; planTicketSync decides create vs update
 * vs reconcile from a ticket's recorded state. No network — pure over the file.
 */
describe('sync-tracker tracker-map sidecar', () => {
  let directory: string;
  let sidecarPath: string;

  const ref: TrackerReference = { provider: 'github', id: '42', url: 'https://x/issues/42' };

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'tracker-map-'));
    sidecarPath = nodePath.join(directory, 'tracker-map.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  // AC9 — a missing sidecar is reported as missing (orchestrator refuses on a configured project)
  it('reports an absent sidecar as missing', () => {
    const result = loadTrackerMap(sidecarPath);
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  // AC9 — a corrupt sidecar is reported as corrupt (never blind-recreated)
  it('reports an unparseable sidecar as corrupt', () => {
    writeFileSync(sidecarPath, '{ this is not json');
    const result = loadTrackerMap(sidecarPath);
    expect(result).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('loads a present, valid sidecar', () => {
    new TrackerMap().save(sidecarPath);
    const result = loadTrackerMap(sidecarPath);
    expect(result.ok).toBe(true);
  });

  // AC5 — a ticket absent from a present sidecar plans a create
  it('plans create for a ticket absent from the map', () => {
    const map = new TrackerMap();
    expect(planTicketSync(map, 'AB12CD')).toEqual({ kind: 'create' });
  });

  // AC5 — recording a ref makes it retrievable and persists across a save/load
  it('records a ref and round-trips it through save/load', () => {
    const map = new TrackerMap();
    map.record('AB12CD', ref);
    map.save(sidecarPath);

    const reloaded = loadTrackerMap(sidecarPath);
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(reloaded.map.lookup('AB12CD')?.ref).toEqual(ref);
    }
  });

  // AC6 — a recorded ticket plans an update with the existing ref (never a create)
  it('plans update for a recorded ticket', () => {
    const map = new TrackerMap();
    map.record('AB12CD', ref);
    expect(planTicketSync(map, 'AB12CD')).toEqual({ kind: 'update', ref });
  });

  // AC8 — a pending ticket plans a reconcile (adopt the existing issue, no second create)
  it('plans reconcile for a ticket left pending by a crashed run', () => {
    const map = new TrackerMap();
    map.markPending('AB12CD', ref);
    expect(planTicketSync(map, 'AB12CD')).toEqual({ kind: 'reconcile', ref });
  });

  it('promotes a reconciled pending entry to recorded', () => {
    const map = new TrackerMap();
    map.markPending('AB12CD', ref);
    map.record('AB12CD', ref);
    expect(planTicketSync(map, 'AB12CD')).toEqual({ kind: 'update', ref });
  });
});
