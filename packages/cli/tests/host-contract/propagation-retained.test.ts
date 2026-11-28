import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { runResourcePropagation } from '../../scripts/lib/resource-propagation.js';
import type { CanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';

// Controller control only: filesystem installations stand in for external native hosts.
// Baseline/current/held-back/repair read the same files; no native result or receipt is fabricated.
it.each([false, true])('retains seven installations and rejects replacement=%s', async replace => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retained-propagation-'));
  const prepared: string[] = [];
  const previous = {
    canonicalRoot: root,
    workflowMarker: 'WORKFLOW_aaa',
    guideMarker: 'GUIDE_aaa',
    helperMarker: 'HELPER_aaa',
  };
  const current = {
    canonicalRoot: root,
    workflowMarker: 'WORKFLOW_bbb',
    guideMarker: 'GUIDE_bbb',
    helperMarker: 'HELPER_bbb',
  };
  try {
    const pending = runResourcePropagation(previous, current, async (lane, inputs) => {
      prepared.push(lane.id);
      let installation = nodePath.join(root, String(prepared.length));
      mkdirSync(installation);
      let file = nodePath.join(installation, 'revision.json');
      writeFileSync(file, JSON.stringify(inputs));
      const observe = () =>
        Promise.resolve({
          delivery: lane.delivery,
          markers: JSON.parse(readFileSync(file, 'utf8')),
          installation,
          raw: readFileSync(file, 'utf8'),
        });
      return {
        ...(await observe()),
        refreshResources: (next: CanonicalCatalogueInputs) => {
          if (replace) {
            installation += '-replacement';
            mkdirSync(installation);
            file = nodePath.join(installation, 'revision.json');
          }
          writeFileSync(file, JSON.stringify(next));
          return Promise.resolve();
        },
        observe,
      };
    });
    if (replace) {
      await expect(pending).rejects.toThrow(
        'PROPAGATION_INSTALLATION_REPLACED:cursor@2026.11.05-86047df/CLI/native',
      );
      return;
    }
    const result = await pending;
    expect(result.rejected).toEqual({
      exit: 2,
      failures: ['PROPAGATION_RESOURCE_STALE:opencode@2.4.1/TUI/native'],
    });
    expect(prepared, 'PROPAGATION_REPLACED_INSTALLATIONS_INSTEAD_OF_REFRESHING').toHaveLength(7);
    expect(new Set(prepared).size).toBe(7);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
