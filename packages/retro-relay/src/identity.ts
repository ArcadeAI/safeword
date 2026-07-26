import { createHash } from 'node:crypto';

import type { FileRetroDraftRequest, RequestScope } from './types.js';

function encodeFields(fields: string[]): Buffer {
  return Buffer.concat(
    fields.flatMap(field => {
      const bytes = Buffer.from(field, 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      return [length, bytes];
    }),
  );
}

export function normalizeRepo(repo: string): string {
  const normalized = repo.toLowerCase();
  if (!/^[\da-z][\d.a-z-]{0,38}\/[\d.a-z_-]+$/u.test(normalized)) {
    throw new Error('repository must be canonical owner/repo');
  }
  return normalized;
}

export function payloadHash(request: FileRetroDraftRequest): string {
  return createHash('sha256')
    .update(
      encodeFields([
        'payload-v1',
        normalizeRepo(request.repository),
        request.canonicalKey,
        request.legacySignature,
        request.title,
        request.body,
        ...[...new Set(request.labels)].toSorted((left, right) => left.localeCompare(right)),
      ]),
    )
    .digest('hex');
}

export function requestMarker(scope: RequestScope): string {
  const digest = createHash('sha256')
    .update(
      encodeFields([
        '1',
        scope.tenantId,
        String(scope.installationId),
        normalizeRepo(scope.repository),
        scope.requestId,
      ]),
    )
    .digest('hex');
  return `<!-- safeword-retro-request-v1: ${digest} -->`;
}

export function canonicalMarker(value: string): string {
  return `<!-- safeword-retro-canonical: ${value} -->`;
}

export function legacyMarker(value: string): string {
  return `<!-- safeword-retro-signature: ${value} -->`;
}
