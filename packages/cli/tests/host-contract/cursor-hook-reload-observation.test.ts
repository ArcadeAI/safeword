import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeWindowActor } from '../helpers/cursor-native-window.js';

class ReloadObservation extends CursorNativeWindowActor {
  count() {
    return this.hookConfigurationLoads();
  }
}

// Actual native log grammar in independent files; no host/window/model process.
it('observes later-window reloads while retaining closed-window counts', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-reload-observation-'));
  try {
    const actor = new ReloadObservation({
      runsDirectory: root,
      applicationBundle: nodePath.join(root, 'unused-app'),
      profileDirectory: nodePath.join(root, 'profile'),
      extensionsDirectory: nodePath.join(root, 'unused-extensions'),
    });
    const log = (window: string, workspace: string, count: number) => {
      const directory = nodePath.join(root, 'profile/logs/20261107T234436', window, 'output');
      mkdirSync(directory, { recursive: true });
      const file = nodePath.join(directory, 'cursor.hooks.workspaceId-fixture.log');
      writeFileSync(
        file,
        `Project config path (workspace): ${workspace}/.cursor/hooks.json\n${'Loaded 2 project hook(s) for steps: workspaceOpen, afterShellExecution\n'.repeat(
          count,
        )}`,
      );
      return file;
    };
    const old = log('window1', actor.workspace, 5);
    expect(actor.count()).toBe(5);
    const current = log('window2', actor.workspace, 2);
    log('unrelated', '/different-owned-workspace', 20);
    expect(actor.count(), 'CURSOR_NEW_WINDOW_RELOAD_UNOBSERVED').toBe(7);
    appendFileSync(
      current,
      'Loaded 2 project hook(s) for steps: workspaceOpen, afterShellExecution\n',
    );
    expect(actor.count(), 'CURSOR_LATER_WINDOW_INCREMENT_UNOBSERVED').toBe(8);
    appendFileSync(old, 'Loaded 2 project hook(s) for steps: workspaceOpen, afterShellExecution\n');
    expect(actor.count()).toBe(9);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
