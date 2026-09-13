import { existsSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveGlobalProjectPaths } from './global-store.js';
import { resolveProjectIdentity } from './identity.js';
import type { ContextResolution } from './types.js';

const MARKER = nodePath.join('.safeword', 'SAFEWORD.md');

function candidateRoots(cwd: string): [string, ...string[]] {
  const candidate = realpathSync(cwd);
  const roots: [string, ...string[]] = [candidate];
  let current = candidate;
  while (true) {
    const parent = nodePath.dirname(current);
    if (parent === current) return roots;
    roots.push(parent);
    current = parent;
  }
}

export function resolveProjectContext(
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): ContextResolution {
  const roots = candidateRoots(cwd);
  const markedRoot = roots.find(root => existsSync(nodePath.join(root, MARKER)));
  const workspaceRoot = roots[0];

  if (markedRoot === workspaceRoot) {
    return {
      kind: 'ready',
      context: {
        authority: 'local',
        workspaceRoot,
        namespaceRoot: nodePath.join(workspaceRoot, '.project'),
        stateRoot: nodePath.join(workspaceRoot, '.safeword', 'state'),
      },
    };
  }
  const globalPaths = resolveGlobalProjectPaths(resolveProjectIdentity(workspaceRoot), environment);
  const globalExists = existsSync(globalPaths.partitionMarker);
  if (globalExists) {
    return {
      kind: 'ready',
      context: {
        authority: 'global',
        workspaceRoot,
        namespaceRoot: globalPaths.namespaceRoot,
        stateRoot: globalPaths.stateRoot,
      },
    };
  }
  return {
    kind: 'choice-required',
    workspaceRoot,
    containingProject: markedRoot,
    globalPaths,
  };
}
