import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseOpenCodeIdentity } from '../../cli/src/opencode/identity.js';

function readProfileFile(path: string): Buffer {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed identity path or a verified inventory member
  return readFileSync(path);
}

const noOwnership = () => false;

/** V1's existing installed inventory owns these bytes; V2 never deletes their files. */
export function readLegacyOwnership(
  profile: string,
  identityPath: string,
): (path: string) => boolean {
  try {
    const content = readProfileFile(nodePath.join(profile, identityPath)).toString('utf8');
    const identity = parseOpenCodeIdentity(JSON.parse(content));
    const owned = new Map(
      identity?.assets?.map(asset => [nodePath.resolve(profile, asset.path), asset.sha256]),
    );
    return path => {
      const expected = owned.get(path);
      if (expected === undefined) return false;
      try {
        return createHash('sha256').update(readProfileFile(path)).digest('hex') === expected;
      } catch {
        return false;
      }
    };
  } catch {
    return noOwnership;
  }
}
