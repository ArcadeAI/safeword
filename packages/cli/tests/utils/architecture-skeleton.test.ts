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

  it('is content-agnostic — a malformed file in a module never aborts extraction', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'auth', 'broken.ts'),
      'function ( { this is not valid typescript <<<',
    );

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toContain('auth');
  });
});

describe('extractSkeleton — Go layout (ticket ZD70P1)', () => {
  function writeGoModule(directory: string, modulePath = 'example.com/app'): void {
    writeFileSync(nodePath.join(directory, 'go.mod'), `module ${modulePath}\n\ngo 1.22\n`);
  }

  it('lists the recognized Go layout directories as modules when there is a go.mod', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'internal', 'store'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'pkg', 'api'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['cmd', 'internal', 'pkg']);
    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.cmd).toBe('cmd');
    expect(pathByName.internal).toBe('internal');
    expect(pathByName.pkg).toBe('pkg');
  });

  it('lists only the recognized Go directories that are present', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'docs'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['cmd']);
  });

  it('keeps the src layout authoritative — go.mod is ignored when src modules exist', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'core'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['core']);
    expect(skeleton.nodes[0]?.path).toBe(nodePath.join('src', 'core'));
  });

  it('produces an empty skeleton for a flat Go package with no recognized layout', () => {
    writeGoModule(context.directory);
    writeFileSync(nodePath.join(context.directory, 'main.go'), 'package main\n');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('does not treat cmd/internal/pkg as modules without a go.mod', () => {
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });
});
