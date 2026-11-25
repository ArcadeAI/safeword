import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { preparePropagationReadiness } from '../helpers/propagation-policy-case.js';

it.each(['project', 'package', 'git'] as const)(
  'refuses a foreign Cursor readiness %s before any producer or Git write',
  async changed => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-cli-catalogue-'));
    const root = realpathSync(temporary);
    try {
      const project = nodePath.join(root, 'workspace');
      const candidate = nodePath.join(root, 'candidate');
      const foreign = nodePath.join(root, 'foreign');
      for (const directory of [project, candidate, foreign]) mkdirSync(directory);
      if (changed === 'git') symlinkSync(foreign, nodePath.join(project, '.git'));
      await expect(
        preparePropagationReadiness(
          changed === 'project' ? foreign : project,
          changed === 'package' ? foreign : candidate,
          '',
          '',
          root,
        ),
      ).rejects.toThrow(
        changed === 'git'
          ? 'readiness Git must use independent owned metadata'
          : `readiness ${changed} outside owned native actor`,
      );
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);
