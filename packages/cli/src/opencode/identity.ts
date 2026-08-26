import { exactRecord, isNonEmptyString, isSha256 } from './records.js';

export interface OpenCodeIdentityV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly plugin_path: 'plugins/safeword.js';
  readonly plugin_sha256: string;
  readonly runtime_path: string;
  readonly dispatcher_path: string;
  readonly dispatcher_sha256: string;
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

export function parseOpenCodeIdentity(value: unknown): OpenCodeIdentityV1 | undefined {
  const record = exactRecord(value, IDENTITY_KEYS);
  if (
    record?.schema_version !== 1 ||
    record.plugin_path !== 'plugins/safeword.js' ||
    !isNonEmptyString(record.safeword_version) ||
    !isSha256(record.plugin_sha256) ||
    !isNonEmptyString(record.runtime_path) ||
    !isNonEmptyString(record.dispatcher_path) ||
    !isSha256(record.dispatcher_sha256)
  ) {
    return undefined;
  }
  return record as unknown as OpenCodeIdentityV1;
}
