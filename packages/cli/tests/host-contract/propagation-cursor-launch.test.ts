import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeWindowActor } from '../helpers/cursor-native-window.js';

class LaunchActor extends CursorNativeWindowActor {
  protected override get cursorCli(): string {
    return nodePath.join(this.config.runsDirectory, 'launcher');
  }

  async launch(): Promise<void> {
    await this.launchWindow();
  }
}

// Real launcher subprocess only. It records argv and deliberately stops before
// any process lookup/Accessibility/UI/model work; this is not a native proof.
it('requests classic IDE mode through the shared launcher with the exact owned profile arguments', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ide-launch-'));
  try {
    const launcher = nodePath.join(root, 'launcher');
    writeFileSync(launcher, '#!/bin/sh\nprintf "%s\\n" "$@" > "$0.args"\nexit 78\n', {
      mode: 0o755,
    });
    const profile = nodePath.join(root, 'private-profile');
    const extensions = nodePath.join(root, 'private-extensions');
    const actor = new LaunchActor({
      runsDirectory: root,
      applicationBundle: nodePath.join(root, 'unused-app'),
      profileDirectory: profile,
      extensionsDirectory: extensions,
    });
    await expect(actor.launch()).rejects.toThrow('Command failed');
    const argv = readFileSync(`${launcher}.args`, 'utf8').trim().split('\n');
    expect(argv, 'CURSOR_IDE_CLASSIC_MODE_NOT_REQUESTED').toContain('--classic');
    expect(argv, 'CURSOR_RENDERER_ACCESSIBILITY_NOT_REQUESTED').toContain(
      '--force-renderer-accessibility',
    );
    expect(argv).toEqual([
      '--classic',
      '--force-renderer-accessibility',
      '--user-data-dir',
      profile,
      '--extensions-dir',
      extensions,
      '--locale',
      'en-US',
      '--new-window',
      actor.workspaceFile,
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
