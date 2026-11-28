import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { command } from '../helpers/cursor-native-window.js';
import {
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  refreshNativeCatalogueProbe,
} from '../helpers/native-catalogue-probe.js';

// Actual production renderer and packaged helper process; no host/model/admission claim.
it('refreshes a generated package in place while retaining its runtime and package identity', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-package-refresh-'));
  try {
    for (const name of ['previous', 'current', 'project/.host-contract', 'project/.safeword'])
      mkdirSync(nodePath.join(root, name), { recursive: true });
    const previous = createCanonicalCatalogueInputs(nodePath.join(root, 'previous'));
    const current = createCanonicalCatalogueInputs(nodePath.join(root, 'current'));
    const probe = await createNativeCatalogueProbe(root, undefined, 'explain', previous);
    const installed = realpathSync(probe.packageRoot);
    const runtime = nodePath.join(installed, 'runtime/cli.js');
    const beforeRuntime = readFileSync(runtime);
    const beforeManifest = readFileSync(nodePath.join(installed, 'package.json'));
    const refreshed = await refreshNativeCatalogueProbe(probe, current);
    expect(realpathSync(refreshed.packageRoot)).toBe(installed);
    expect(readFileSync(runtime)).toEqual(beforeRuntime);
    expect(readFileSync(nodePath.join(installed, 'package.json'))).toEqual(beforeManifest);
    expect(readFileSync(nodePath.join(installed, 'skills/explain/SKILL.md'), 'utf8')).toContain(
      current.workflowMarker,
    );
    expect(
      readFileSync(
        nodePath.join(installed, 'skills/explain/references/HOST_CONTRACT_GUIDE.md'),
        'utf8',
      ),
    ).toContain(current.guideMarker);
    const project = nodePath.join(root, 'project');
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Synthetic enrollment\n');
    const stdout = await command(
      'bun',
      [runtime, 'project', 'runtime', 'audit-principle-trace', '--cwd', project, '--', project],
      {
        cwd: project,
        env: { ...process.env, SAFEWORD_CLI: undefined, SAFEWORD_PLUGIN_CLI: runtime },
      },
    );
    expect(stdout.trim()).toBe(current.helperMarker);
    const record = JSON.parse(
      readFileSync(nodePath.join(project, '.host-contract/native-helper.json'), 'utf8'),
    );
    expect(record.marker).toBe(current.helperMarker);
    expect(realpathSync(record.origin)).toBe(
      realpathSync(nodePath.join(installed, 'templates/hooks/audit-principle-trace.ts')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
