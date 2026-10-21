import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { ReviewerOutput } from '../../src/review/contract.js';
import type { ExecutionPlanConformanceResult } from '../../src/review/execution-plan-conformance.js';
import type { ConfirmedReviewerModel } from '../../src/review/runtime.js';

export interface ExecutionObservation {
  readonly case_id: string;
  readonly dispatch_mode: 'cli' | 'headless' | 'replay';
  readonly output: ReviewerOutput;
  readonly confirmed_model?: ConfirmedReviewerModel;
  readonly attempt_timeout_ms?: number;
}

function atomicJson(path: string, value: unknown): void {
  mkdirSync(nodePath.dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, undefined, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

/** Result replacement commits only after its raw observations and input metadata exist. */
export function writeExecutionCheckpoint(
  path: string,
  results: readonly unknown[],
  outputs: readonly unknown[],
  metadata: unknown,
): void {
  atomicJson(`${path}.outputs.json`, outputs);
  atomicJson(`${path}.metadata.json`, metadata);
  atomicJson(path, results);
}

function requireRetained(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function optionalMarker(
  record: Readonly<Record<string, unknown>>,
  key: string,
  value: string,
): boolean {
  return record[key] === undefined || record[key] === value;
}

function requireSupportedCheckpoint(record: Readonly<Record<string, unknown>>): void {
  requireRetained(
    optionalMarker(record, 'corpus_kind', 'conformance') &&
      optionalMarker(record, 'dispatch_mode', 'headless') &&
      optionalMarker(record, 'mode', 'live') &&
      typeof record.requested_model === 'string' &&
      record.requested_model.trim() !== '',
    'Retained observations support exact headless conformance only',
  );
}

/** Read only passing observations; failed attempts remain in their original checkpoint. */
export function readExecutionCheckpoint(
  path: string,
  expected: Readonly<Record<string, unknown>>,
  caseIds: readonly string[],
): {
  results: ExecutionPlanConformanceResult[];
  outputs: ExecutionObservation[];
  source: Record<string, unknown>;
} {
  requireSupportedCheckpoint(expected);
  const resultBytes = readFileSync(path);
  const outputBytes = readFileSync(`${path}.outputs.json`);
  const metadataBytes = readFileSync(`${path}.metadata.json`);
  const metadata = JSON.parse(metadataBytes.toString()) as Record<string, unknown>;
  // Legacy conformance markers may be absent. Current-oracle replay deliberately
  // permits an older oracle; only headless assertions are reusable this way.
  requireSupportedCheckpoint(metadata);
  const identity = [
    'schema_version',
    'contract_sha256',
    'corpus_sha256',
    'reviewer',
    'requested_model',
  ];
  requireRetained(
    identity.every(key => metadata[key] === expected[key]),
    'Retained conformance metadata mismatch',
  );
  const results = JSON.parse(resultBytes.toString()) as ExecutionPlanConformanceResult[];
  const outputs = JSON.parse(outputBytes.toString()) as ExecutionObservation[];
  requireRetained(
    Array.isArray(results) &&
      new Set(results.map(result => result.case_id)).size === results.length &&
      results.every(
        result =>
          caseIds.includes(result.case_id) &&
          typeof result.passed === 'boolean' &&
          result.reviewer === expected.reviewer &&
          result.model === expected.requested_model,
      ),
    'Retained conformance result identity mismatch',
  );
  requireRetained(
    Array.isArray(outputs) &&
      new Set(outputs.map(output => output.case_id)).size === outputs.length,
    'Retained raw observation identity mismatch',
  );
  const passing = results.filter(result => result.passed);
  const passedIds = new Set(passing.map(result => result.case_id));
  const retained = outputs.filter(output => passedIds.has(output.case_id));
  requireRetained(
    retained.every(output => output.dispatch_mode === 'headless'),
    'Retained passing observations must be headless',
  );
  requireRetained(
    retained.length === passing.length &&
      retained.every(
        output =>
          output.confirmed_model !== undefined &&
          output.confirmed_model.model === expected.requested_model &&
          output.confirmed_model.provider ===
            (expected.reviewer === 'claude' ? 'anthropic' : 'openai'),
      ),
    'Retained passing observation lacks exact model confirmation',
  );
  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  return {
    results: passing,
    outputs: retained,
    source: {
      results_sha256: sha256(resultBytes),
      outputs_sha256: sha256(outputBytes),
      metadata_sha256: sha256(metadataBytes),
      recorded_attempt_timeout_ms: metadata.current_attempt_timeout_ms ?? 'not_retained',
    },
  };
}
