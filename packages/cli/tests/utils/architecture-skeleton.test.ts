/**
 * Unit tests for the architecture skeleton extractor (ticket QD5DTT, Slice 1).
 * Covers the "skeleton reflects the real project" rule from
 * features/architecture-state-docs.feature. Temp-dir fixtures, no project setup.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractSkeleton, purposeFloorViolations } from '../../src/utils/architecture-skeleton.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('extractSkeleton — skeleton reflects the real project', () => {
  it('lists exactly the top-level src modules, each referencing its real path', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'auth',
      'billing',
    ]);

    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.auth).toBe(nodePath.join('src', 'auth'));
    expect(pathByName.billing).toBe(nodePath.join('src', 'billing'));
  });

  it('gives every node a non-empty purpose and flags a node missing one', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.every(node => node.purpose.trim().length > 0)).toBe(true);

    expect(purposeFloorViolations([{ name: 'blanked', path: 'src/blanked', purpose: '' }])).toEqual(
      ['blanked'],
    );
  });

  it('does not list a file outside any module as a node', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'scripts'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'scripts', 'build.ts'), 'export {};\n');

    const skeleton = extractSkeleton(context.directory);

    const names = skeleton.nodes.map(node => node.name);
    expect(names).not.toContain('build.ts');
    expect(names).not.toContain('scripts');
  });

  it('produces a minimal skeleton when there is no src directory', () => {
    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('produces an empty skeleton when src exists but holds no modules', () => {
    mkdirSync(nodePath.join(context.directory, 'src'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });
});
