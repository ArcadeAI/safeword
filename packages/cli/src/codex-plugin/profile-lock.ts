import { homedir } from 'node:os';
import nodePath from 'node:path';

import {
  acquireProfileLock,
  type ProfileLock,
  type ProfileLockOptions,
} from '../utils/profile-lock.js';

export { releaseProfileLock as releaseCodexProfileLock } from '../utils/profile-lock.js';

export type CodexProfileLock = ProfileLock;

function profileDirectory(environment: NodeJS.ProcessEnv): string {
  return environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex');
}

export function acquireCodexProfileLock(
  environment: NodeJS.ProcessEnv = process.env,
  options: ProfileLockOptions = {},
): CodexProfileLock | undefined {
  return acquireProfileLock(
    nodePath.join(profileDirectory(environment), 'safeword/profile-mutation.lock'),
    options,
  );
}
