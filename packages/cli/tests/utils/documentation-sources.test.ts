import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readConfiguredDocumentationSourceDecision,
  readConfiguredDocumentationSources,
} from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  const directory = nodePath.join(cwd, '.safeword');
  mkdirSync(directory, { recursive: true });
  writeFileSync(nodePath.join(directory, 'config.json'), JSON.stringify(config, undefined, 2));
}

describe('readConfiguredDocumentationSources', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('resolves relative local sources against the project root', () => {
    writeConfig(cwd, {
      docs: {
        sources: [{ type: 'local', path: 'docs' }],
      },
    });

    expect(readConfiguredDocumentationSources(cwd)).toEqual([
      { type: 'local', path: 'docs', resolvedPath: nodePath.join(cwd, 'docs') },
    ]);
  });

  it('uses absolute local source paths verbatim', () => {
    const externalDirectory = createTemporaryDirectory();
    try {
      writeConfig(cwd, {
        docs: {
          sources: [{ type: 'local', path: externalDirectory }],
        },
      });

      expect(readConfiguredDocumentationSources(cwd)).toEqual([
        { type: 'local', path: externalDirectory, resolvedPath: externalDirectory },
      ]);
    } finally {
      removeTemporaryDirectory(externalDirectory);
    }
  });

  it('returns URL and git sources without filesystem resolution', () => {
    writeConfig(cwd, {
      docs: {
        sources: [
          { type: 'url', url: 'https://docs.example.test/safeword' },
          { type: 'git', repo: 'git@example.com:org/docs.git', path: 'product' },
          { type: 'git', repo: 'git@example.com:org/runbooks.git' },
        ],
      },
    });

    expect(readConfiguredDocumentationSources(cwd)).toEqual([
      { type: 'url', url: 'https://docs.example.test/safeword' },
      { type: 'git', repo: 'git@example.com:org/docs.git', path: 'product' },
      { type: 'git', repo: 'git@example.com:org/runbooks.git' },
    ]);
  });

  it('ignores malformed config and invalid source entries', () => {
    writeConfig(cwd, {
      docs: {
        sources: [
          undefined,
          'docs',
          { type: 'local', path: '' },
          { type: 'url', url: '' },
          { type: 'git', repo: '' },
          { type: 'unsupported', path: 'docs' },
          { type: 'local', path: 'README.md' },
        ],
      },
    });

    expect(readConfiguredDocumentationSources(cwd)).toEqual([
      { type: 'local', path: 'README.md', resolvedPath: nodePath.join(cwd, 'README.md') },
    ]);
  });

  it('returns an empty list when config is missing, unparsable, or docs.sources is not an array', () => {
    expect(readConfiguredDocumentationSources(cwd)).toEqual([]);

    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{ not json');
    expect(readConfiguredDocumentationSources(cwd)).toEqual([]);

    writeConfig(cwd, { docs: { sources: 'docs' } });
    expect(readConfiguredDocumentationSources(cwd)).toEqual([]);
  });
});

describe('readConfiguredDocumentationSourceDecision', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('returns unset when no docs.sources decision exists', () => {
    writeConfig(cwd, { installedPacks: ['typescript'] });

    expect(readConfiguredDocumentationSourceDecision(cwd)).toEqual({ kind: 'unset' });
  });

  it('returns explicit-none when docs.sources is an empty array', () => {
    writeConfig(cwd, { docs: { sources: [] } });

    expect(readConfiguredDocumentationSourceDecision(cwd)).toEqual({ kind: 'explicit-none' });
  });

  it('returns configured when docs.sources has entries', () => {
    writeConfig(cwd, { docs: { sources: [{ type: 'local', path: 'docs' }] } });

    expect(readConfiguredDocumentationSourceDecision(cwd)).toEqual({
      kind: 'configured',
      sources: [{ type: 'local', path: 'docs', resolvedPath: nodePath.join(cwd, 'docs') }],
    });
  });
});
