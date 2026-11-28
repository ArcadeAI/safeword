import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationCompletion } from '../helpers/propagation-policy-case.js';

// Only host preparation/window I/O is substituted. No actual host/model run.
class SourceWindow extends CursorNativeCatalogueActor {
  missingExtension = false;
  protected override async prepareHost(): Promise<void> {}
  protected override launchWindow(): Promise<void> {
    if (!this.missingExtension) return Promise.reject(new Error('SOURCE_WINDOW_BOUNDARY'));
    const record = nodePath.join(this.workspace, '.host-contract/workspace-open.json');
    writeFileSync(
      record,
      JSON.stringify({ pluginPaths: [nodePath.join(this.runDirectory, 'candidate')] }),
    );
    return Promise.resolve();
  }
  runStop(extension: string, shim: string, realBun: string) {
    const manifest = JSON.parse(readFileSync(nodePath.join(extension, 'hooks/hooks.json'), 'utf8'));
    return spawnSync('sh', ['-c', manifest.hooks.stop[0].command], {
      cwd: this.workspace,
      env: {
        ...this.environment,
        CURSOR_PLUGIN_ROOT: extension,
        PATH: `${shim}:${process.env.PATH}`,
        SAFEWORD_REAL_BUN: realBun,
      },
      encoding: 'utf8',
      input: JSON.stringify({
        workspace_roots: [this.workspace],
        conversation_id: 'source-policy',
        hook_event_name: 'stop',
        status: 'completed',
        loop_count: 0,
      }),
    });
  }
}

function fixture(root: string) {
  return new SourceWindow(
    {
      runsDirectory: root,
      applicationBundle: nodePath.join(root, 'unused-app'),
      profileDirectory: nodePath.join(root, 'owned-profile'),
      extensionsDirectory: nodePath.join(root, 'owned-extensions'),
    },
    createCanonicalCatalogueInputs(root),
  );
}

it('uses the packaged test-plan provider in an actual native-mode generated Stop process', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-native-provenance-'));
  try {
    const actor = fixture(root);
    await expect(actor.prepare('Cursor', '3.29.9', 'IDE', 'portable')).rejects.toThrow(
      'SOURCE_WINDOW_BOUNDARY',
    );
    preparePropagationCompletion(
      actor.workspace,
      'source-policy',
      'cursor',
      '**PR Scope:** ✅ Synthetic scope\n',
    );
    const shim = nodePath.join(root, 'bin');
    mkdirSync(shim);
    const calls = nodePath.join(root, 'bun-args');
    writeFileSync(
      nodePath.join(shim, 'bun'),
      `#!/bin/sh\nprintf '%s\\n' "$@" >> '${calls}'\nexec "$SAFEWORD_REAL_BUN" "$@"\n`,
      { mode: 0o755 },
    );
    const extension = nodePath.join(actor.runDirectory, 'extension');
    expect(JSON.parse(actor.observedInstallation())).toEqual([
      nodePath.join(actor.runDirectory, 'candidate'),
      actor.workspace,
      extension,
    ]);
    const result = actor.runStop(
      extension,
      shim,
      execFileSync('which', ['bun'], { encoding: 'utf8' }).trim(),
    );
    expect(result.status, result.stderr).toBe(0);
    const argv = readFileSync(calls, 'utf8').split('\n');
    const paths = argv
      .filter(value => nodePath.isAbsolute(value))
      .map(value => realpathSync(value));
    expect(paths, `CURSOR_NATIVE_SOURCE_TEST_PLAN_OVERRIDE: ${JSON.stringify(argv)}`).toContain(
      realpathSync(nodePath.join(extension, 'runtime/cli.js')),
    );
    expect(paths, 'CURSOR_NATIVE_SOURCE_TEST_PLAN_OVERRIDE').not.toContain(
      realpathSync(nodePath.join(actor.runDirectory, 'source/packages/cli/src/cli.ts')),
    );
    expect(argv).toContain('test-plan');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it('refuses a current workspace discovery record missing the native extension', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-native-discovery-'));
  try {
    const actor = fixture(root);
    actor.missingExtension = true;
    await expect(actor.prepare('Cursor', '3.29.9', 'IDE', 'portable')).rejects.toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native extension missing from workspace discovery',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
