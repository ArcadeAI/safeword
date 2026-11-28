import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';

// Substitute only the window/UI boundary. Real install, wrapper reconciliation,
// probe and helper preflight run; stop before selecting/submitting a model turn.
class MenuBoundaryActor extends CursorNativeCatalogueActor {
  protected override async prepareHost(): Promise<void> {}
  protected override launchWindow(): Promise<void> {
    return Promise.reject(new Error('SOURCE_MENU_READY'));
  }
  protected override async freshAgent(): Promise<void> {}
  protected override action(action: string, payload?: string): Promise<string> {
    if (action === 'select-workflow' && payload)
      return Promise.reject(new Error(`SOURCE_MENU_SELECTOR:${readFileSync(payload, 'utf8')}`));
    return Promise.resolve('');
  }
}

it.each([
  [
    '3.29.9',
    'project-hooks',
    '/explain Read and follow the instructions in .safeword/skills/explain/SKILL.md',
  ],
  [
    '3.29.9',
    'native',
    '/explain Runs the Safeword contract catalogue probe in an isolated native host test.',
  ],
])(
  'selects the actual %s %s catalogue row, never name alone',
  async (version, delivery, label) => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-selector-'));
    try {
      const actor = new MenuBoundaryActor({
        runsDirectory: root,
        applicationBundle: nodePath.join(root, 'unused-app'),
        profileDirectory: nodePath.join(root, 'owned-profile'),
        extensionsDirectory: nodePath.join(root, 'owned-extensions'),
      });
      await expect(actor.prepare('Cursor', version, 'IDE', delivery)).rejects.toThrow(
        'SOURCE_MENU_READY',
      );
      await expect(
        actor.invokeWorkflow(),
        'CURSOR_PROJECT_SELECTOR_NOT_INSTALLED_BODY',
      ).rejects.toThrow(`SOURCE_MENU_SELECTOR:${label}`);
      if (delivery === 'project-hooks') {
        const wrapper = nodePath.join(actor.workspace, '.cursor/commands/explain.md');
        const before = readFileSync(wrapper, 'utf8');
        writeFileSync(wrapper, before.replace('skills/explain/SKILL.md', 'skills/audit/SKILL.md'));
        await expect(actor.invokeWorkflow()).rejects.toThrow(
          'CURSOR_PROJECT_COMMAND_ORIGIN_MISMATCH',
        );
        writeFileSync(wrapper, before);
        await expect(actor.invokeWorkflow()).rejects.toThrow(`SOURCE_MENU_SELECTOR:${label}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
