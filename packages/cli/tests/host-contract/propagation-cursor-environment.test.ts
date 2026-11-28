import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { command } from '../helpers/cursor-native-window.js';

// Substitute only OS/window launch. Preparation still uses real project install
// and packaged helper execution; the process receives the launch environment.
class LaunchBoundaryActor extends CursorNativeCatalogueActor {
  observed: NodeJS.ProcessEnv = {};

  protected override async prepareHost(): Promise<void> {
    await Promise.resolve();
  }

  protected override async launchWindow(): Promise<void> {
    this.observed = JSON.parse(
      await command('bun', ['-e', 'console.log(JSON.stringify(process.env))'], {
        env: this.environment,
      }),
    ) as NodeJS.ProcessEnv;
    throw new Error('SOURCE_WINDOW_BOUNDARY_REACHED');
  }
}

it('launches project hooks with the originating fixture CLI on every environment read', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cursor-launch-env-'));
  try {
    const actor = new LaunchBoundaryActor({
      runsDirectory: root,
      applicationBundle: nodePath.join(root, 'unused-app'),
      profileDirectory: nodePath.join(root, 'owned-profile'),
      extensionsDirectory: nodePath.join(root, 'owned-extensions'),
    });
    await expect(actor.prepare('Cursor', '3.29.9', 'IDE', 'project-hooks')).rejects.toThrow(
      'SOURCE_WINDOW_BOUNDARY_REACHED',
    );
    const cli = nodePath.join(actor.runDirectory, 'project-source/src/cli.ts');
    expect(actor.observed.SAFEWORD_CLI, 'CURSOR_FIXTURE_POLICY_SOURCE_NOT_BOUND').toBe(cli);
    expect(actor.observed.SAFEWORD_PLUGIN_CLI).toBe(cli);
    expect(actor.observed.CODEX_HOME).toBe(
      nodePath.join(actor.runDirectory, 'foreign-codex-profile'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
