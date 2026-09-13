import { homedir } from 'node:os';
import nodePath from 'node:path';

import type { GlobalProjectPaths, ProjectIdentity } from './types.js';

function userDataRoot(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    const local = environment.LOCALAPPDATA;
    return local !== undefined && nodePath.isAbsolute(local)
      ? nodePath.join(local, 'Safeword')
      : nodePath.join(homedir(), 'AppData', 'Local', 'Safeword');
  }
  const xdg = environment.XDG_DATA_HOME;
  const base =
    xdg !== undefined && nodePath.isAbsolute(xdg)
      ? xdg
      : nodePath.join(homedir(), '.local', 'share');
  return nodePath.join(base, 'safeword');
}

export function resolveGlobalProjectPaths(
  identity: ProjectIdentity,
  environment: NodeJS.ProcessEnv = process.env,
): GlobalProjectPaths {
  const partitionRoot = nodePath.join(
    userDataRoot(environment),
    'project-contexts',
    'v1',
    identity.projectKey,
  );
  return {
    partitionRoot,
    partitionMarker: nodePath.join(partitionRoot, 'partition.json'),
    namespaceRoot: nodePath.join(partitionRoot, 'knowledge'),
    stateRoot: nodePath.join(partitionRoot, 'worktrees', identity.worktreeKey, 'state'),
  };
}
