import nodePath from 'node:path';

import { exactRecord, isNonEmptyString, isSha256 } from './records.js';

export interface OpenCodeIdentityV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly plugin_path: 'plugins/safeword.js';
  readonly plugin_sha256: string;
  readonly runtime_path: string;
  readonly dispatcher_path: string;
  readonly dispatcher_sha256: string;
  readonly assets?: readonly OpenCodeManagedAsset[];
}

export interface OpenCodeManagedAsset {
  readonly path: string;
  readonly sha256: string;
}

const IDENTITY_KEYS = [
  'schema_version',
  'safeword_version',
  'plugin_path',
  'plugin_sha256',
  'runtime_path',
  'dispatcher_path',
  'dispatcher_sha256',
] as const;
const CURRENT_IDENTITY_KEYS = [...IDENTITY_KEYS, 'assets'] as const;

function isManagedAsset(value: unknown): value is OpenCodeManagedAsset {
  const record = exactRecord(value, ['path', 'sha256'] as const);
  return (
    record !== undefined &&
    isNonEmptyString(record.path) &&
    !nodePath.isAbsolute(record.path) &&
    !record.path.split(/[\\/]/u).includes('..') &&
    isSha256(record.sha256)
  );
}

function hasValidAssets(record: Record<string, unknown>): boolean {
  return (
    !('assets' in record) || (Array.isArray(record.assets) && record.assets.every(isManagedAsset))
  );
}

function isIdentityRecord(record: Record<string, unknown> | undefined): boolean {
  return (
    record?.schema_version === 1 &&
    record.plugin_path === 'plugins/safeword.js' &&
    isNonEmptyString(record.safeword_version) &&
    isSha256(record.plugin_sha256) &&
    isNonEmptyString(record.runtime_path) &&
    isNonEmptyString(record.dispatcher_path) &&
    isSha256(record.dispatcher_sha256)
  );
}

export function parseOpenCodeIdentity(value: unknown): OpenCodeIdentityV1 | undefined {
  const record = exactRecord(value, CURRENT_IDENTITY_KEYS) ?? exactRecord(value, IDENTITY_KEYS);
  if (!isIdentityRecord(record) || record === undefined || !hasValidAssets(record))
    return undefined;
  return record as unknown as OpenCodeIdentityV1;
}
