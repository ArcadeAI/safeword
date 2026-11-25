import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json';
import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

it.each(['cli', 'tui'] as const)(
  'runs %s conformance against the project selected by the public CLI',
  runtime => {
    const root = createTemporaryDirectory();
    try {
      const project = nodePath.join(root, 'project');
      const profile = nodePath.join(root, 'profile');
      const candidate = nodePath.join(root, 'candidate');
      const bin = nodePath.join(root, 'bin');
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Synthetic project\n');
      mkdirSync(bin);
      mkdirSync(profile);
      for (const [relativePath, bytes] of [
        [layout.manifest, '{"name":"safeword-opencode-v2","type":"module"}'],
        [layout.entry, 'export default {};'],
        [layout.runtime, '// Fixture runtime'],
        [layout.dispatcher, '// Fixture dispatcher'],
        [layout.catalogue, '[]'],
      ] as const) {
        const path = nodePath.join(candidate, relativePath);
        mkdirSync(nodePath.dirname(path), { recursive: true });
        writeFileSync(path, bytes);
      }
      writeFileSync(
        nodePath.join(bin, 'opencode'),
        `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'opencode v%s\\n' '${hostReleases.opencode.version}'; fi\n`,
        { mode: 0o755 },
      );
      expect(
        installOpenCodeProfile(profile, {
          nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'fixture' },
        }).state,
      ).toBe('changed');

      const result = spawnSync(
        'bun',
        [
          nodePath.resolve('src/cli.ts'),
          'conformance',
          '--cwd',
          project,
          '--agents=opencode',
          ...(runtime === 'tui' ? ['--runtime=tui'] : []),
          '--json',
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            OPENCODE_CONFIG_DIR: profile,
            PATH: `${bin}:${process.env.PATH ?? ''}`,
          },
          encoding: 'utf8',
          timeout: 30_000,
        },
      );
      expect(result.status, result.stderr).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        findings: [expect.objectContaining({ code: 'OPENCODE_V2_OBSERVATIONS_REQUIRED' })],
        data: { conformant: false, proof_id: expect.any(String), runtime: runtime.toUpperCase() },
      });
    } finally {
      removeTemporaryDirectory(root);
    }
  },
);
