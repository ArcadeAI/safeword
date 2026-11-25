import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import { OpenCodeNativeWriteActor } from '../helpers/opencode-native-write.js';

it.each(['automatic', 'deferred'] as const)(
  'prepares the owned %s V2 profile after real admission refusal without a native turn',
  async enrollment => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'opencode-retirement-wiring-'));
    try {
      const candidate = nodePath.join(root, 'candidate');
      const build = spawnSync(
        'bun',
        ['scripts/generate-opencode-v2-plugin.ts', '--output', candidate],
        {
          cwd: nodePath.resolve(import.meta.dirname, '../..'),
          encoding: 'utf8',
          timeout: 120_000,
        },
      );
      expect(build.error).toBeUndefined();
      expect(build.status, build.stderr).toBe(0);
      const binary = nodePath.join(root, 'opencode');
      const launches = nodePath.join(root, 'unexpected-launches');
      writeFileSync(
        binary,
        `#!/bin/sh\nif [ "$#" = 1 ] && [ "$1" = --version ]; then echo 2.4.1; else echo unexpected >> '${launches}'; exit 99; fi\n`,
        { mode: 0o755 },
      );
      vi.stubEnv('PATH', `${root}:${process.env.PATH ?? ''}`);
      const runs = nodePath.join(root, 'runs');
      mkdirSync(runs);
      const actor = new OpenCodeNativeWriteActor({
        v2Binary: binary,
        runsDirectory: runs,
        v2CandidatePackage: candidate,
      });
      await actor.prepare('OpenCode V2', '2.4.1', 'CLI', enrollment);
      const { readdirSync } = await import('node:fs');
      const directories = readdirSync(runs);
      expect(directories).toHaveLength(1);
      const directory = directories[0];
      if (!directory) throw new Error('Missing actor directory');
      const owned = realpathSync(nodePath.join(runs, directory));
      const installation = JSON.parse(
        readFileSync(nodePath.join(owned, 'installation.json'), 'utf8'),
      );
      expect(installation.state).toBe('action_required');
      expect(JSON.stringify(installation)).toContain('OPENCODE_V2_ADMISSION_REQUIRED');
      const profile = nodePath.join(owned, 'profile');
      expect(existsSync(profile), 'OWNED_DEFERRED_PROFILE_MISSING').toBe(true);
      const configFile = nodePath.join(profile, 'opencode.jsonc');
      if (enrollment === 'automatic') {
        const config = JSON.parse(readFileSync(configFile, 'utf8'));
        expect(config.plugins).toEqual([
          nodePath.join(owned, 'observer'),
          {
            package: nodePath.join(owned, 'candidate'),
            options: { profileDirectory: profile },
          },
        ]);
      } else {
        expect(existsSync(configFile)).toBe(false);
        // Coexistence's beforeTurn owns the initial declaration, before nested assets.
        writeFileSync(configFile, '{"plugins":[]}\n');
        expect(readFileSync(configFile, 'utf8')).toBe('{"plugins":[]}\n');
      }
      expect(existsSync(nodePath.join(owned, 'profile/plugins/safeword.js'))).toBe(false);
      expect(existsSync(launches)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
