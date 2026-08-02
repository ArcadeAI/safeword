import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { ReviewKind, ReviewPacket } from './contract.js';

export function buildReviewPacket(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
): ReviewPacket {
  return {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: targets.map(target => ({
      path: target,
      content: readFileSync(nodePath.resolve(cwd, target), 'utf8'),
    })),
  };
}
