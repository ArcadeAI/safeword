import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  smallWorkFileFootprint,
  smallWorkFootprintDenial,
} from '../../templates/hooks/lib/small-work-footprint.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('small-work thresholds', () => {
  let project: string;
  const thresholds = { files: 2, surfaces: 1 };

  beforeEach(() => {
    project = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(project);
  });

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();

  function commit(message: string): void {
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      message,
    );
  }

  it('counts nested project paths once and excludes sibling changes', () => {
    git('init', '-q');
    const nested = nodePath.join(project, 'package');
    mkdirSync(nested);
    const source = nodePath.join(nested, 'source.ts');
    const sibling = nodePath.join(project, 'sibling.ts');
    writeFileSync(source, 'before');
    writeFileSync(sibling, 'before');
    commit('base');
    const base = git('rev-parse', 'HEAD');

    writeFileSync(source, 'after');
    writeFileSync(sibling, 'after');
    writeFileSync(nodePath.join(nested, 'new.ts'), 'new');
    expect(smallWorkFileFootprint(nested, base, source)).toEqual(['new.ts', 'source.ts']);
  });

  it('counts earlier committed changes plus the proposed edit from the task base', () => {
    git('init', '-q');
    writeFileSync(nodePath.join(project, 'existing.ts'), 'export const initial = 1;\n');
    commit('base');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(nodePath.join(project, 'existing.ts'), 'export const initial = 2;\n');
    writeFileSync(nodePath.join(project, 'second.ts'), 'export const second = 2;\n');
    commit('two changes below the threshold');

    const evaluated = {
      base,
      fileLimit: 2,
      surfaceLimit: 1,
      aboveFileLimit: false,
      aboveSurfaceLimit: false,
      declaredSurfaces: ['CLI'],
      surfacePaths: [
        { path: 'existing.ts', surfaces: ['CLI'] },
        { path: 'second.ts', surfaces: ['CLI'] },
        { path: 'third.ts', surfaces: ['CLI'] },
      ],
    };
    const second = nodePath.join(project, 'second.ts');
    expect(smallWorkFootprintDenial(project, second, evaluated, thresholds)).toBeUndefined();

    const third = nodePath.join(project, 'third.ts');
    expect(smallWorkFileFootprint(project, base, third)).toEqual([
      'existing.ts',
      'second.ts',
      'third.ts',
    ]);
    expect(smallWorkFootprintDenial(project, third, evaluated, thresholds)).toMatch(/crossed/);
    expect(
      smallWorkFootprintDenial(project, third, { ...evaluated, aboveFileLimit: true }, thresholds),
    ).toBeUndefined();

    expect(
      smallWorkFootprintDenial(
        project,
        second,
        {
          ...evaluated,
          surfacePaths: [
            { path: 'existing.ts', surfaces: ['CLI'] },
            { path: 'second.ts', surfaces: ['Cursor'] },
          ],
        },
        thresholds,
      ),
    ).toMatch(/crossed/);
    expect(smallWorkFootprintDenial(project, second, evaluated, { files: 3, surfaces: 1 })).toMatch(
      /thresholds changed/,
    );
  });
});
