/**
 * Differential test (ticket TAGWZ8, P58R22 pattern): the hook-side
 * namespace-root resolver is a deliberate copy of the CLI-side one — hooks
 * run standalone in customer repos with no import path to the CLI. Feed both
 * copies the same fixtures and assert they agree, so the copies can't
 * silently drift.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveNamespaceRoot as cliResolve } from '../../src/utils/configured-paths.js';
import { resolveNamespaceRoot as hookResolve } from '../../templates/hooks/lib/namespace-root.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

type Fixture = { name: string; setup: (cwd: string) => void };

const FIXTURES: Fixture[] = [
  { name: 'neither directory', setup: () => {} },
  {
    name: 'project only',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.project'));
    },
  },
  {
    name: 'legacy only',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.safeword-project'));
    },
  },
  {
    name: 'both directories',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.project'));
      mkdirSync(nodePath.join(cwd, '.safeword-project'));
    },
  },
  {
    name: 'configured relative root',
    setup: cwd => {
      writeConfig(cwd, { paths: { projectRoot: 'shared/ns' } });
    },
  },
  {
    name: 'configured empty-string root with legacy present',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.safeword-project'));
      writeConfig(cwd, { paths: { projectRoot: '' } });
    },
  },
  {
    name: 'configured non-string root with legacy present',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.safeword-project'));
      writeConfig(cwd, { paths: { projectRoot: 7 } });
    },
  },
  {
    name: 'unparseable config with project present',
    setup: cwd => {
      mkdirSync(nodePath.join(cwd, '.project'));
      mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{ not json');
    },
  },
];

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), JSON.stringify(config));
}

describe('namespace-root resolver — hook copy agrees with CLI copy (TAGWZ8)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it.each(FIXTURES)('$name', ({ setup }) => {
    setup(cwd);

    expect(hookResolve(cwd)).toBe(cliResolve(cwd));
  });
});
