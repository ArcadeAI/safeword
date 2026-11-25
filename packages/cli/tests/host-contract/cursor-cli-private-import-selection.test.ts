import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { CursorCliCatalogueActor } from '../helpers/cursor-cli-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';

const requested = [
  'arcade-productivity@arcade-skills',
  'safeword@safeword',
  'arcade-writing@arcade-skills',
] as const;

function sourceVendor(root: string) {
  const binary = nodePath.join(root, 'host');
  writeFileSync(
    binary,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'host.mjs'))} "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    nodePath.join(root, 'host.mjs'),
    `
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (process.argv.includes('--version')) { console.log(${JSON.stringify(hostReleases.cursorCli.version)}); process.exit(0); }
const file = process.cwd() + '/.claude/settings.local.json';
writeFileSync(${JSON.stringify(nodePath.join(root, 'capture.json'))}, JSON.stringify({
  workspace: process.cwd(), exists: existsSync(file), prompt: process.argv.at(-1),
  settings: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
}));
console.error('SOURCE_VENDOR_BOUNDARY_REACHED'); process.exit(91);
`,
  );
  return binary;
}

// Real factory, generation and packaged helper; only the external vendor edge
// captures settings then stops. No discovery, policy or native result supplied.
it('forwards only the requested private imported-plugin selections before the first turn', async () => {
  const root = realpathSync(mkdtempSync('/tmp/cursor-private-imports-'));
  try {
    const binary = sourceVendor(root);
    const lane = propagationLanes().find(row => row.agent === 'cursor' && row.runtime === 'CLI');
    assert.ok(lane);
    const actor = await prepareNativeResourceActor(
      lane,
      createCanonicalCatalogueInputs(root),
      { binary, disabledClaudePlugins: requested },
      root,
    );
    await expect(actor.observe()).rejects.toThrow('SOURCE_VENDOR_BOUNDARY_REACHED');
    const captured = JSON.parse(readFileSync(nodePath.join(root, 'capture.json'), 'utf8'));
    expect(captured.settings?.enabledPlugins, 'CURSOR_PRIVATE_IMPORT_SELECTION_DROPPED').toEqual(
      Object.fromEntries(requested.map(name => [name, false])),
    );
    expect(captured.prompt).toContain(
      'Run its declared helper exactly once in a single Shell call.',
    );
    expect(captured.prompt).toContain('Copy the complete helper command unchanged.');
    expect(captured.prompt).toContain(
      'Do not add commands before or after it, wrap it, or retry it',
    );
    expect(captured.workspace).not.toBe(root);
    expect(existsSync(nodePath.join(root, '.claude/settings.local.json'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it('leaves private selection absent when the factory fixture requests none', async () => {
  const root = realpathSync(mkdtempSync('/tmp/cursor-private-default-'));
  try {
    const binary = sourceVendor(root);
    const lane = propagationLanes().find(row => row.agent === 'cursor' && row.runtime === 'CLI');
    assert.ok(lane);
    const actor = await prepareNativeResourceActor(
      lane,
      createCanonicalCatalogueInputs(root),
      { binary },
      root,
    );
    await expect(actor.observe()).rejects.toThrow('SOURCE_VENDOR_BOUNDARY_REACHED');
    const captured = JSON.parse(readFileSync(nodePath.join(root, 'capture.json'), 'utf8'));
    expect(captured.exists).toBe(false);
    expect(captured.settings).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it.each([false, true])(
  'preserves pre-seeded settings before a turn (explicit selection %s)',
  async selected => {
    const root = realpathSync(mkdtempSync('/tmp/cursor-private-preserved-'));
    const actor = new CursorCliCatalogueActor(
      sourceVendor(root),
      createCanonicalCatalogueInputs(root),
      selected ? requested : undefined,
    );
    try {
      await actor.prepare('Cursor', hostReleases.cursorCli.version, 'CLI');
      const workspace = JSON.parse(actor.observedInstallation())[1] as string;
      const directory = nodePath.join(workspace, '.claude');
      const file = nodePath.join(directory, 'settings.local.json');
      const settings = {
        enabledPlugins: {
          'unrelated@fixture': false,
          'owned-candidate@fixture': true,
          [requested[0]]: true,
        },
        permissions: { allow: ['Read'] },
        fixtureSetting: 'preserve',
      };
      mkdirSync(directory, { recursive: true });
      const before = `${JSON.stringify(settings, undefined, 2)}\n`;
      writeFileSync(file, before);
      await expect(actor.invokeWorkflow()).rejects.toThrow('SOURCE_VENDOR_BOUNDARY_REACHED');
      const captured = JSON.parse(readFileSync(nodePath.join(root, 'capture.json'), 'utf8'));
      expect(captured.settings).toEqual({
        ...settings,
        enabledPlugins: {
          ...settings.enabledPlugins,
          ...(selected && Object.fromEntries(requested.map(name => [name, false]))),
        },
      });
      if (!selected) expect(readFileSync(file, 'utf8')).toBe(before);
    } finally {
      actor.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
