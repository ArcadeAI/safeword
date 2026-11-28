import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { propagationLanes, resourceCompletion } from '../../scripts/lib/resource-propagation.js';
import {
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
} from '../helpers/native-catalogue-probe.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function owned() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-propagation-control-'));
  roots.push(root);
  return root;
}

const expected = {
  workflowMarker: 'WORKFLOW_CURRENT',
  guideMarker: 'GUIDE_CURRENT',
  helperMarker: 'HELPER_CURRENT',
};

it('cannot credit native plugin observations to the independent current project-hook delivery', () => {
  const required = propagationLanes();
  const rows = required.map(lane => ({
    lane: lane.id,
    delivery: 'native',
    markers: { ...expected },
  }));
  expect(resourceCompletion(required, expected, rows), 'PROPAGATION_DELIVERY_SUBSTITUTED').toEqual({
    exit: 3,
    failures: ['PROPAGATION_DELIVERY_UNOBSERVED:cursor@3.29.9/IDE/project-hooks'],
  });
});
it('discovers all exact runtime and delivery identities from the existing independent target oracle', () => {
  expect(propagationLanes().map(row => row.id)).toEqual([
    'cursor@2026.11.05-86047df/CLI/native',
    'claude@2.1.319/CLI/native',
    'codex@0.167.0/CLI/native',
    'cursor@3.29.9/IDE/native',
    'cursor@3.29.9/IDE/project-hooks',
    'opencode@2.4.1/CLI/native',
    'opencode@2.4.1/TUI/native',
  ]);
});
it.each(['workflowMarker', 'guideMarker', 'helperMarker'] as const)(
  'names the exact stale delivery when only %s is old',
  field => {
    const required = propagationLanes();
    const rows = required.map(lane => ({
      lane: lane.id,
      delivery: lane.delivery,
      markers: { ...expected },
    }));
    const stale = rows.at(-1);
    expect(stale).toBeDefined();
    if (!stale) throw new Error('Independent population empty');
    stale.markers[field] = 'OLD';
    expect(resourceCompletion(required, expected, rows)).toEqual({
      exit: 2,
      failures: ['PROPAGATION_RESOURCE_STALE:opencode@2.4.1/TUI/native'],
    });
    stale.markers[field] = expected[field];
    expect(resourceCompletion(required, expected, rows)).toEqual({ exit: 0, failures: [] });
  },
);
it.each(['missing', 'duplicate', 'extra'] as const)(
  'does not accept %s native resource observations as complete',
  mutation => {
    const required = propagationLanes();
    const rows = required.map(lane => ({
      lane: lane.id,
      delivery: lane.delivery,
      markers: { ...expected },
    }));
    if (mutation === 'missing') rows.pop();
    else
      rows.push({
        lane: mutation === 'duplicate' ? 'opencode@2.4.1/TUI/native' : 'foreign',
        delivery: 'native',
        markers: expected,
      });
    const result = resourceCompletion(required, expected, rows);
    expect(result.exit).toBe(2);
    const count = mutation === 'missing' ? 0 : 2;
    expect(result.failures).toContain(
      mutation === 'extra'
        ? 'PROPAGATION_LANE_EXTRA:foreign'
        : `PROPAGATION_LANE_COUNT:opencode@2.4.1/TUI/native:${count}`,
    );
  },
);

// Renderer integration only. No native/model execution and no admission receipt.
it('renders the supplied single canonical skill/guide/helper revision instead of inventing per-host revisions', async () => {
  const inputs = createCanonicalCatalogueInputs(owned());
  const probe = await createNativeCatalogueProbe(owned(), undefined, 'explain', inputs);
  expect(probe.workflowMarker, 'CANONICAL_PROPAGATION_INPUT_DROPPED').toBe(inputs.workflowMarker);
  expect(probe.guideMarker).toBe(inputs.guideMarker);
  expect(probe.helperMarker).toBe(inputs.helperMarker);
  const skill = readFileSync(nodePath.join(probe.packageRoot, 'skills/explain/SKILL.md'), 'utf8');
  expect(skill).toContain(inputs.workflowMarker);
  expect(
    readFileSync(
      nodePath.join(probe.packageRoot, 'skills/explain/references/HOST_CONTRACT_GUIDE.md'),
      'utf8',
    ),
  ).toContain(inputs.guideMarker);
  expect(
    readFileSync(
      nodePath.join(probe.packageRoot, 'templates/hooks/audit-principle-trace.ts'),
      'utf8',
    ),
  ).toContain(inputs.helperMarker);
}, 120_000);
