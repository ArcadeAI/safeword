import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { command } from '../helpers/cursor-native-window.js';
import {
  createCursorProjectSource,
  refreshCursorProjectCatalogue,
} from '../helpers/cursor-project-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';

// Public CLI + real schema/reconciliation. No IDE, model, profile or native-proof assertion.
it('refreshes the project command, shared skill, registered guide and helper from one canonical revision', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-project-propagation-'));
  try {
    mkdirSync(nodePath.join(root, 'previous'));
    mkdirSync(nodePath.join(root, 'current'));
    const previous = createCanonicalCatalogueInputs(nodePath.join(root, 'previous'));
    const current = createCanonicalCatalogueInputs(nodePath.join(root, 'current'));
    const source = createCursorProjectSource(root, previous);
    const workspace = nodePath.join(root, 'workspace');
    mkdirSync(workspace);
    await refreshCursorProjectCatalogue(source, workspace, 'install');
    const guide = nodePath.join(workspace, '.safeword/skills/explain/HOST_CONTRACT_GUIDE.md');
    expect(existsSync(guide), 'CURSOR_PROJECT_GUIDE_NOT_DELIVERED').toBe(true);
    expect(readFileSync(guide, 'utf8')).toContain(previous.guideMarker);
    expect(
      readFileSync(nodePath.join(workspace, '.safeword/skills/explain/SKILL.md'), 'utf8'),
    ).toContain(previous.workflowMarker);
    // Change only canonical source, not managed output. Use the existing Cursor project upgrade route.
    cpSync(current.canonicalRoot, nodePath.join(source, 'templates'), { recursive: true });
    await refreshCursorProjectCatalogue(source, workspace, 'upgrade');
    expect(readFileSync(guide, 'utf8')).toContain(current.guideMarker);
    expect(
      readFileSync(nodePath.join(workspace, '.safeword/skills/explain/SKILL.md'), 'utf8'),
    ).toContain(current.workflowMarker);
    mkdirSync(nodePath.join(workspace, '.host-contract'));
    const stdout = await command(
      'bun',
      [nodePath.join(workspace, '.safeword/hooks/audit-principle-trace.ts'), workspace],
      { cwd: workspace },
    );
    expect(stdout.trim()).toBe(current.helperMarker);
    const record = JSON.parse(
      readFileSync(nodePath.join(workspace, '.host-contract/native-helper.json'), 'utf8'),
    );
    expect(record).toMatchObject({
      marker: current.helperMarker,
      origin: realpathSync(nodePath.join(workspace, '.safeword/hooks/audit-principle-trace.ts')),
    });
    expect(existsSync(nodePath.join(workspace, '.host-contract/workspace-open-config.json'))).toBe(
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
