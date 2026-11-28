import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json';
import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';
import {
  createSafewordBasePackageJson,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCliWithLiteralArguments,
  runCliWithoutInstall,
  TIMEOUT_SYNC,
} from '../helpers.js';

it(
  'preserves selected package facts and gives recovery when the observed host is unlisted',
  async () => {
    const root = createTemporaryDirectory();
    try {
      const project = nodePath.join(root, 'project');
      const profile = nodePath.join(root, 'profile');
      const candidate = nodePath.join(root, 'candidate');
      const bin = nodePath.join(root, 'bin');
      mkdirSync(project);
      createSafewordBasePackageJson(project);
      const setup = await runCliWithoutInstall(
        ['install', '--json', '--no-input', '--offline', '--agents=none', '--no-modify'],
        { cwd: project },
      );
      expect(setup.exitCode, setup.stdout + setup.stderr).toBe(0);
      mkdirSync(profile);
      mkdirSync(bin);
      for (const [relativePath, bytes] of [
        [
          layout.manifest,
          JSON.stringify({
            name: 'safeword-opencode-v2',
            type: 'module',
            host_contract_version: 1,
          }),
        ],
        [layout.entry, 'export default {};'],
        [layout.runtime, '// Fixture runtime'],
        [layout.dispatcher, '// Fixture dispatcher'],
        [layout.catalogue, '[]'],
      ] as const) {
        const path = nodePath.join(candidate, relativePath);
        mkdirSync(nodePath.dirname(path), { recursive: true });
        writeFileSync(path, bytes);
      }
      // Only the external host version probe is substituted.
      writeFileSync(
        nodePath.join(bin, 'opencode'),
        '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "opencode v%s\\n" "$ADMISSION_HOST_VERSION"; fi\n',
        { mode: 0o755 },
      );
      const enrollment = installOpenCodeProfile(profile, {
        nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'fixture' },
      });
      expect(enrollment.state, JSON.stringify(enrollment.errors)).toBe('changed');

      const status = (version: string) =>
        runCliWithLiteralArguments(
          ['status', '--json', '--no-input', '--offline', '--agents=opencode'],
          {
            cwd: project,
            env: {
              OPENCODE_CONFIG_DIR: profile,
              PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
              ADMISSION_HOST_VERSION: version,
            },
            timeout: TIMEOUT_SYNC,
          },
        );
      const selectedUnproved = expect.objectContaining({
        name: 'opencode',
        data: expect.objectContaining({ installed: true, activated: false, conformant: false }),
      });

      const current = await status(hostReleases.opencode.version);
      expect(current.exitCode, current.stderr).toBe(2);
      const currentStatus = JSON.parse(current.stdout);
      expect(currentStatus, current.stdout).toMatchObject({
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'OPENCODE_V2_CONFORMANCE_REQUIRED' }),
        ]),
        data: {
          surfaces: expect.arrayContaining([
            expect.objectContaining({ name: 'project', state: 'healthy' }),
            selectedUnproved,
          ]),
        },
      });
      const updateInstruction = expect.stringMatching(/update Safeword/iu);
      const updateAction = expect.objectContaining({ instruction: updateInstruction });
      expect(currentStatus.next_actions).not.toEqual(expect.arrayContaining([updateAction]));

      const unlisted = await status('2.999.0');
      expect(unlisted.exitCode, unlisted.stderr).toBe(2);
      const recovery = expect.objectContaining({
        instruction: expect.stringMatching(/update Safeword.*restart/iu),
      });
      expect(JSON.parse(unlisted.stdout), 'UNLISTED_HOST_RECOVERY_MISSING').toMatchObject({
        state: 'action_required',
        next_actions: expect.arrayContaining([recovery]),
        data: { surfaces: expect.arrayContaining([selectedUnproved]) },
      });

      const older = await status('2.0.0');
      expect(older.exitCode, older.stderr).toBe(2);
      const supportedVersion = expect.stringContaining(
        `Use OpenCode ${hostReleases.opencode.version}`,
      );
      const useSupportedVersion = expect.objectContaining({ instruction: supportedVersion });
      expect(JSON.parse(older.stdout)).toMatchObject({
        state: 'action_required',
        next_actions: expect.arrayContaining([useSupportedVersion]),
        data: { surfaces: expect.arrayContaining([selectedUnproved]) },
      });
    } finally {
      removeTemporaryDirectory(root);
    }
  },
  TIMEOUT_SYNC,
);
