import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationCompletion } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Substitute only the window boundary. No app launch, UI or model; actual
// public install and generated project hook execute in both catalogue deliveries.
class OwnedIdeSourceActor extends CursorNativeCatalogueActor {
  protected override async prepareHost(): Promise<void> {}
  protected override launchWindow(): Promise<void> {
    return Promise.reject(new Error('OWNED_IDE_SOURCE_READY'));
  }
  get installedEnvironment() {
    return this.environment;
  }
}

it.each(['project-hooks', 'native'])(
  'binds %s IDE project hooks to the owned current CLI',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-ide-owned-policy-'));
    try {
      const inputs = createCanonicalCatalogueInputs(root);
      const sourcePackage = createPropagationSource(root, inputs);
      const marker = 'VERIFICATION_cc-aa';
      requirePropagationVerificationMarker(inputs, marker);
      // Canonical mutations precede normal install; no installed byte patching.
      const actor = new OwnedIdeSourceActor(
        {
          runsDirectory: root,
          applicationBundle: nodePath.join(root, 'unused-app'),
          profileDirectory: nodePath.join(root, 'owned-profile'),
          extensionsDirectory: nodePath.join(root, 'owned-extensions'),
        },
        { ...inputs, sourcePackage },
      );
      await expect(actor.prepare('Cursor', '3.29.9', 'IDE', delivery)).rejects.toThrow(
        'OWNED_IDE_SOURCE_READY',
      );
      expect(actor.installedEnvironment.SAFEWORD_CLI, 'PROPAGATION_IDE_REAL_REPO_RUNTIME').toBe(
        nodePath.join(sourcePackage, 'src/cli.ts'),
      );
      const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
      const run = (evidence: string) => {
        preparePropagationCompletion(actor.workspace, 'ide-source-session', 'cursor', evidence);
        const manifest = JSON.parse(
          readFileSync(nodePath.join(actor.workspace, '.cursor/hooks.json'), 'utf8'),
        );
        expect(manifest.hooks.stop).toHaveLength(1);
        const result = spawnSync('sh', ['-c', manifest.hooks.stop[0].command], {
          cwd: actor.workspace,
          env: actor.installedEnvironment,
          encoding: 'utf8',
          input: JSON.stringify({
            workspace_roots: [actor.workspace],
            conversation_id: 'ide-source-session',
            status: 'completed',
            loop_count: 0,
          }),
        });
        expect(result.status, result.stderr).toBe(0);
        return JSON.parse(result.stdout);
      };
      expect(run(scope).followup_message).toContain(marker);
      expect(run(`${scope}\n${marker}\n`)).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
