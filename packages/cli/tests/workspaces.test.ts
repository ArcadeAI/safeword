import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getWorkspacePackageNames, getWorkspacePatterns } from '../src/utils/workspaces.js';

describe('Workspace Utilities', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-workspace-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  describe('getWorkspacePatterns()', () => {
    it('should return empty array for non-workspace project', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'my-app' }),
      );
      expect(getWorkspacePatterns(temporaryDirectory)).toEqual([]);
    });

    it('should return patterns from array format', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*', 'tools/scripts'] }),
      );
      expect(getWorkspacePatterns(temporaryDirectory)).toEqual(['packages/*', 'tools/scripts']);
    });

    it('should return patterns from yarn object format', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: { packages: ['libs/*'] } }),
      );
      expect(getWorkspacePatterns(temporaryDirectory)).toEqual(['libs/*']);
    });

    it('should return empty array when no package.json exists', () => {
      expect(getWorkspacePatterns(temporaryDirectory)).toEqual([]);
    });
  });

  describe('getWorkspacePackageNames()', () => {
    it('should resolve glob pattern to member names', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );

      const cliDirectory = nodePath.join(temporaryDirectory, 'packages', 'cli');
      const webDirectory = nodePath.join(temporaryDirectory, 'packages', 'web');
      mkdirSync(cliDirectory, { recursive: true });
      mkdirSync(webDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(cliDirectory, 'package.json'),
        JSON.stringify({ name: 'my-cli' }),
      );
      writeFileSync(
        nodePath.join(webDirectory, 'package.json'),
        JSON.stringify({ name: 'my-web' }),
      );

      const names = getWorkspacePackageNames(temporaryDirectory);
      expect(names).toEqual(new Set(['my-cli', 'my-web']));
    });

    it('should resolve explicit path to member name', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: ['tools/scripts'] }),
      );

      const toolsDirectory = nodePath.join(temporaryDirectory, 'tools', 'scripts');
      mkdirSync(toolsDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(toolsDirectory, 'package.json'),
        JSON.stringify({ name: 'my-scripts' }),
      );

      const names = getWorkspacePackageNames(temporaryDirectory);
      expect(names).toEqual(new Set(['my-scripts']));
    });

    it('should return empty set for non-workspace project', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'my-app' }),
      );
      expect(getWorkspacePackageNames(temporaryDirectory)).toEqual(new Set());
    });

    it('should skip directories without package.json', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );

      const hasPackageJson = nodePath.join(temporaryDirectory, 'packages', 'real');
      const noPackageJson = nodePath.join(temporaryDirectory, 'packages', 'empty');
      mkdirSync(hasPackageJson, { recursive: true });
      mkdirSync(noPackageJson, { recursive: true });
      writeFileSync(
        nodePath.join(hasPackageJson, 'package.json'),
        JSON.stringify({ name: 'real-pkg' }),
      );

      const names = getWorkspacePackageNames(temporaryDirectory);
      expect(names).toEqual(new Set(['real-pkg']));
    });

    it('should skip dotfile directories', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );

      const dotDirectory = nodePath.join(temporaryDirectory, 'packages', '.internal');
      const normalDirectory = nodePath.join(temporaryDirectory, 'packages', 'public');
      mkdirSync(dotDirectory, { recursive: true });
      mkdirSync(normalDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(dotDirectory, 'package.json'),
        JSON.stringify({ name: 'internal' }),
      );
      writeFileSync(
        nodePath.join(normalDirectory, 'package.json'),
        JSON.stringify({ name: 'public-pkg' }),
      );

      const names = getWorkspacePackageNames(temporaryDirectory);
      expect(names).toEqual(new Set(['public-pkg']));
    });
  });
});
