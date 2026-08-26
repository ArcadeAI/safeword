import { exactRecord, isNonEmptyString, isSha256, isTimestamp, matchesRecord } from './records.js';

export type OpenCodeActivationEvent =
  'plugin_load' | 'session_start' | 'prompt_submit' | 'pre_tool' | 'post_tool' | 'stop';

export interface OpenCodeActivationV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly plugin_sha256: string;
  readonly project_sha256: string;
  readonly opencode_version?: string;
  readonly event: OpenCodeActivationEvent;
  readonly session_id_sha256: string;
  readonly call_id_sha256?: string;
  readonly observed_at: string;
}

export interface OpenCodeConformanceV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly opencode_version: string;
  readonly platform: string;
  readonly arch: string;
  readonly plugin_sha256: string;
  readonly command_catalogue: boolean;
  readonly agent_catalogue: boolean;
  readonly denial: boolean;
  readonly control: boolean;
  readonly checked_at: string;
  readonly result: 'passed' | 'failed';
}

export interface OpenCodeProfileErrorV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly plugin_sha256: string;
  readonly error_code: 'marker_resolution_failed';
  readonly observed_at: string;
}

const ACTIVATION_EVENTS = new Set<OpenCodeActivationEvent>([
  'plugin_load',
  'session_start',
  'prompt_submit',
  'pre_tool',
  'post_tool',
  'stop',
]);
const CALL_BOUND_EVENTS = new Set<OpenCodeActivationEvent>(['pre_tool', 'post_tool']);

function isSchemaVersion(value: unknown): boolean {
  return value === 1;
}

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}

function isActivationEvent(value: unknown): value is OpenCodeActivationEvent {
  return typeof value === 'string' && ACTIVATION_EVENTS.has(value as OpenCodeActivationEvent);
}

function isConformanceResult(value: unknown): boolean {
  return value === 'passed' || value === 'failed';
}

export function parseOpenCodeActivation(value: unknown): OpenCodeActivationV1 | undefined {
  const record = exactRecord(
    value,
    [
      'schema_version',
      'safeword_version',
      'plugin_sha256',
      'project_sha256',
      'event',
      'session_id_sha256',
      'observed_at',
    ],
    ['opencode_version', 'call_id_sha256'],
  );
  if (
    !matchesRecord(record, {
      schema_version: isSchemaVersion,
      safeword_version: isNonEmptyString,
      plugin_sha256: isSha256,
      project_sha256: isSha256,
      event: isActivationEvent,
      session_id_sha256: isSha256,
      observed_at: isTimestamp,
    })
  )
    return undefined;
  if (record.opencode_version !== undefined && !isNonEmptyString(record.opencode_version))
    return undefined;
  if (record.call_id_sha256 !== undefined && !isSha256(record.call_id_sha256)) return undefined;
  if (CALL_BOUND_EVENTS.has(record.event as OpenCodeActivationEvent) && !record.call_id_sha256)
    return undefined;
  return record as unknown as OpenCodeActivationV1;
}

export function parseOpenCodeConformance(value: unknown): OpenCodeConformanceV1 | undefined {
  const record = exactRecord(value, [
    'schema_version',
    'safeword_version',
    'opencode_version',
    'platform',
    'arch',
    'plugin_sha256',
    'command_catalogue',
    'agent_catalogue',
    'denial',
    'control',
    'checked_at',
    'result',
  ]);
  if (
    !matchesRecord(record, {
      schema_version: isSchemaVersion,
      safeword_version: isNonEmptyString,
      opencode_version: isNonEmptyString,
      platform: isNonEmptyString,
      arch: isNonEmptyString,
      plugin_sha256: isSha256,
      command_catalogue: isBoolean,
      agent_catalogue: isBoolean,
      denial: isBoolean,
      control: isBoolean,
      checked_at: isTimestamp,
      result: isConformanceResult,
    })
  )
    return undefined;
  return record as unknown as OpenCodeConformanceV1;
}

export function parseOpenCodeProfileError(value: unknown): OpenCodeProfileErrorV1 | undefined {
  const record = exactRecord(value, [
    'schema_version',
    'safeword_version',
    'plugin_sha256',
    'error_code',
    'observed_at',
  ]);
  if (
    !matchesRecord(record, {
      schema_version: isSchemaVersion,
      safeword_version: isNonEmptyString,
      plugin_sha256: isSha256,
      error_code: errorCode => errorCode === 'marker_resolution_failed',
      observed_at: isTimestamp,
    })
  )
    return undefined;
  return record as unknown as OpenCodeProfileErrorV1;
}
