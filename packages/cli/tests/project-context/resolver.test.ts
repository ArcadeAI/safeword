import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveGlobalProjectPaths } from '../../src/project-context/global-store.js';
import { resolveProjectIdentity } from '../../src/project-context/identity.js';
import { resolveProjectContext } from '../../src/project-context/resolver.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const fixtures: string[] = [];

function fixture(): string {
  const directory = createTemporaryDirectory();
  fixtures.push(directory);
  return realpathSync(directory);
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) removeTemporaryDirectory(directory);
});

describe('project context resolution', () => {
  it('derives a non-Git partition from the canonical directory without creating it', () => {
    const project = fixture();
    const data = nodePath.join(fixture(), 'data');
    const key = createHash('sha256').update(project).digest('hex');

    const identity = resolveProjectIdentity(project);
    const paths = resolveGlobalProjectPaths(identity, { XDG_DATA_HOME: data });

    expect(identity).toEqual({ kind: 'directory', projectKey: key, worktreeKey: key });
    expect(paths.partitionMarker).toBe(
      nodePath.join(data, 'safeword', 'project-contexts', 'v1', key, 'partition.json'),
    );
    expect(existsSync(paths.partitionRoot)).toBe(false);
  });

  it('selects the current repository marker without creating global state', () => {
    const project = fixture();
    const data = nodePath.join(fixture(), 'data');
    mkdirSync(nodePath.join(project, '.safeword'));
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');

    const result = resolveProjectContext(project, { XDG_DATA_HOME: data });

    expect(result).toMatchObject({
      kind: 'ready',
      context: { authority: 'local', workspaceRoot: project },
    });
    expect(existsSync(data)).toBe(false);
  });

  it('reports an enrolled containing project while leaving the choice unresolved', () => {
    const containing = fixture();
    const project = nodePath.join(containing, 'nested', 'project');
    const data = nodePath.join(fixture(), 'data');
    mkdirSync(project, { recursive: true });
    mkdirSync(nodePath.join(containing, '.safeword'));
    writeFileSync(nodePath.join(containing, '.safeword', 'SAFEWORD.md'), '# enrolled\n');

    const result = resolveProjectContext(project, { XDG_DATA_HOME: data });

    expect(result).toMatchObject({ kind: 'choice-required', containingProject: containing });
    expect(existsSync(data)).toBe(false);
  });
});
