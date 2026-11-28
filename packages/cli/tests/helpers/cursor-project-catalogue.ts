import assert from 'node:assert/strict';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { renderCursorCommandWrapper } from '../../src/cursor-wrappers.js';
import { readCanonicalCommandWrappers } from '../../src/host-contract/catalogue.js';
import { command } from './cursor-native-window.js';
import type { CanonicalCatalogueInputs } from './native-catalogue-probe.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');

/** Disposable source package: canonical inputs precede the real public reconciler. */
export function createCursorProjectSource(
  directory: string,
  inputs: CanonicalCatalogueInputs,
  skill = 'explain',
) {
  const source = nodePath.join(directory, 'project-source');
  mkdirSync(source, { recursive: true });
  cpSync(nodePath.join(cliRoot, 'src'), nodePath.join(source, 'src'), { recursive: true });
  cpSync(inputs.canonicalRoot, nodePath.join(source, 'templates'), { recursive: true });
  // The synthetic guide has no shipped schema entry. Register it in this owned
  // fixture schema, so install/upgrade/remove all use the real reconciler.
  // Existing command, skill and helper definitions remain production-owned.
  const guide = `skills/${skill}/HOST_CONTRACT_GUIDE.md`;
  const ownedGuide = `.safeword/${guide}`;
  appendFileSync(
    nodePath.join(source, 'src/schema.ts'),
    `\nSAFEWORD_SCHEMA.ownedFiles[${JSON.stringify(ownedGuide)}] = { template: ${JSON.stringify(guide)} };\n`,
  );
  cpSync(nodePath.join(cliRoot, 'package.json'), nodePath.join(source, 'package.json'));
  symlinkSync(nodePath.join(cliRoot, 'node_modules'), nodePath.join(source, 'node_modules'), 'dir');
  return source;
}

/** Exercise the existing public Cursor install/upgrade route in an owned fixture. */
export async function refreshCursorProjectCatalogue(
  source: string,
  workspace: string,
  mode: 'install' | 'upgrade',
  environment?: NodeJS.ProcessEnv,
) {
  const wrapper = readCanonicalCommandWrappers(nodePath.join(source, 'templates')).find(
    row => row.name === 'explain',
  );
  assert.ok(wrapper, 'CURSOR_PROJECT_COMMAND_UNAVAILABLE');
  writeFileSync(
    nodePath.join(source, 'templates/commands/explain.md'),
    renderCursorCommandWrapper({ wrapper }),
  );
  const stdout = await command(
    'bun',
    [
      nodePath.join(source, 'src/cli.ts'),
      mode,
      '--agents',
      'cursor',
      '--cwd',
      workspace,
      '--offline',
      '--no-input',
      '--no-modify',
      '--json',
    ],
    { cwd: workspace, env: environment, timeout: 120_000 },
  );
  const output = JSON.parse(stdout) as { ok: boolean };
  assert.equal(output.ok, true, 'CURSOR_PROJECT_REFRESH_UNAVAILABLE');
  const installedWrapper = readFileSync(
    nodePath.join(workspace, '.cursor/commands/explain.md'),
    'utf8',
  );
  assert.ok(
    installedWrapper.includes('.safeword/skills/explain/SKILL.md'),
    'CURSOR_PROJECT_COMMAND_MISWIRED',
  );
}
