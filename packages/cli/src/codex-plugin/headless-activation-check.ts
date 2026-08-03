import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  CODEX_PLUGIN_HOOK_EVENTS,
  type CodexHookProofObservation,
  type CodexPluginHookEvent,
  currentCodexPluginIdentity,
  observeCodexHookProof,
} from './profile-proof.js';

export const DEFAULT_CODEX_ACTIVATION_CHECK_MODEL = 'gpt-5.4';

type ExpectedActivation = 'activated' | 'pending';

export interface HeadlessCodexActivationCheckOptions {
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  expectedActivation: ExpectedActivation;
  expectedActivationId: string;
  codexBinary?: string;
  model?: string;
  timeoutMilliseconds?: number;
}

export interface HeadlessCodexActivationCheckResult {
  activation: ExpectedActivation;
  codexVersion: string;
  model: string;
  proof: CodexHookProofObservation;
  warnings: string[];
}

interface CodexJsonEvent {
  type: string;
  error?: unknown;
  message?: unknown;
}

interface HookProofFile {
  schema_version: 2;
  event: CodexPluginHookEvent;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string;
  recorded_at: string;
}

interface ActivationReceiptFile {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string;
}

const HEADLESS_CHECK_PROMPT =
  'Run the shell command `pwd` exactly once, then reply with exactly SAFEWORD_CODEX_ACTIVATION_CHECK. Do not use any other tools.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCodexJsonEvent(value: unknown): value is CodexJsonEvent {
  return isRecord(value) && typeof value.type === 'string';
}

function isHookProofFile(value: unknown): value is HookProofFile {
  return (
    isRecord(value) &&
    value.schema_version === 2 &&
    CODEX_PLUGIN_HOOK_EVENTS.includes(value.event as CodexPluginHookEvent) &&
    typeof value.plugin_version === 'string' &&
    typeof value.manifest_sha256 === 'string' &&
    typeof value.activation_id === 'string' &&
    typeof value.recorded_at === 'string'
  );
}

function isActivationReceiptFile(value: unknown): value is ActivationReceiptFile {
  return (
    isRecord(value) &&
    value.schema_version === 1 &&
    typeof value.plugin_version === 'string' &&
    typeof value.manifest_sha256 === 'string' &&
    typeof value.activation_id === 'string'
  );
}

function parseJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Could not read structured Codex activation evidence at ${path}.`, {
      cause: error,
    });
  }
}

function parseCodexJsonLines(output: string): CodexJsonEvent[] {
  return output
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line) as unknown;
      } catch (error) {
        throw new Error(`Codex --json emitted malformed JSONL on line ${index + 1}.`, {
          cause: error,
        });
      }
      if (!isCodexJsonEvent(value)) {
        throw new Error(`Codex --json emitted an unsupported event on line ${index + 1}.`);
      }
      return value;
    });
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (isRecord(value) && typeof value.message === 'string' && value.message.trim() !== '') {
    return value.message.trim();
  }
  return undefined;
}

function structuredFailureMessages(events: CodexJsonEvent[]): string[] {
  return events.flatMap(event => {
    if (event.type !== 'error' && event.type !== 'turn.failed') return [];
    const message = errorMessage(event.error) ?? errorMessage(event.message);
    return message === undefined ? [] : [message];
  });
}

function splitWarnings(stderr: string): string[] {
  return stderr
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
}

function runCodexVersion(codexBinary: string, environment: NodeJS.ProcessEnv): string {
  const result = spawnSync(codexBinary, ['--version'], {
    encoding: 'utf8',
    env: environment,
  });
  if (result.error !== undefined) {
    throw new Error(`Could not run ${codexBinary}; install Codex CLI and retry.`, {
      cause: result.error,
    });
  }
  const version = result.stdout.trim();
  if (result.status !== 0 || version === '') {
    throw new Error(`Could not determine Codex CLI version: ${result.stderr.trim()}`);
  }
  return version;
}

function assertCodexRunSucceeded(input: {
  status: number | null;
  events: CodexJsonEvent[];
  model: string;
  codexVersion: string;
  warnings: string[];
}): void {
  const failures = structuredFailureMessages(input.events);
  if (input.status === 0 && failures.length === 0) return;
  const detail = failures.join('; ');
  if (/\b(?:unsupported|not supported|requires? (?:a |an )?upgrade)\b/iu.test(detail)) {
    throw new Error(
      `Codex model "${input.model}" is unsupported by ${input.codexVersion}. Choose a model supported by this Codex CLI and retry with SAFEWORD_CODEX_SMOKE_MODEL=<model>.`,
    );
  }
  const warningDetail =
    input.warnings.length === 0 ? '' : ` Host warnings: ${input.warnings.join('; ')}`;
  const failureDetail = detail || `exit ${String(input.status)}`;
  throw new Error(
    `Headless Codex activation task failed under ${input.codexVersion}: ${failureDetail}.${warningDetail}`,
  );
}

function assertHookProofs(input: {
  codexHome: string;
  expectedActivationId: string;
  startedAt: Date;
}): void {
  const identity = currentCodexPluginIdentity();
  for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
    const path = nodePath.join(input.codexHome, 'safeword/hook-proof-v2', `${event}.json`);
    if (!existsSync(path)) throw new Error(`Headless Codex task did not exercise ${event}.`);
    const proof = parseJsonFile(path);
    if (!isHookProofFile(proof) || proof.event !== event) {
      throw new Error(`Headless Codex task wrote malformed ${event} proof.`);
    }
    if (
      proof.plugin_version !== identity.plugin_version ||
      proof.manifest_sha256 !== identity.manifest_sha256
    ) {
      throw new Error(`Headless Codex task wrote stale ${event} plugin identity.`);
    }
    if (proof.activation_id !== input.expectedActivationId) {
      throw new Error(`Headless Codex task wrote ${event} proof for another activation ID.`);
    }
    const recordedAt = Date.parse(proof.recorded_at);
    if (!Number.isFinite(recordedAt) || recordedAt < input.startedAt.getTime()) {
      throw new Error(`Headless Codex task did not write a current ${event} timestamp.`);
    }
  }
}

function assertActivationState(input: {
  activation: ExpectedActivation;
  codexHome: string;
  expectedActivationId: string;
}): void {
  const pendingPath = nodePath.join(input.codexHome, 'safeword/activation-pending-v2.json');
  const receiptPath = nodePath.join(input.codexHome, 'safeword/activation-current-v1.json');
  if (input.activation === 'pending') {
    if (!existsSync(pendingPath) || existsSync(receiptPath)) {
      throw new Error('Headless Codex task incorrectly changed pending activation state.');
    }
    return;
  }
  if (existsSync(pendingPath) || !existsSync(receiptPath)) {
    throw new Error('Fresh Codex host did not complete activation.');
  }
  const receipt = parseJsonFile(receiptPath);
  const identity = currentCodexPluginIdentity();
  if (
    !isActivationReceiptFile(receipt) ||
    receipt.plugin_version !== identity.plugin_version ||
    receipt.manifest_sha256 !== identity.manifest_sha256 ||
    receipt.activation_id !== input.expectedActivationId
  ) {
    throw new Error('Fresh Codex host wrote an invalid activation receipt.');
  }
}

export function runHeadlessCodexActivationCheck(
  options: HeadlessCodexActivationCheckOptions,
): HeadlessCodexActivationCheckResult {
  const codexBinary = options.codexBinary ?? 'codex';
  const model = options.model ?? DEFAULT_CODEX_ACTIVATION_CHECK_MODEL;
  const environment = { ...process.env, ...options.environment };
  const codexHome = environment.CODEX_HOME;
  if (codexHome === undefined || codexHome.trim() === '') {
    throw new Error('CODEX_HOME is required for an isolated headless activation check.');
  }
  const codexVersion = runCodexVersion(codexBinary, environment);
  const startedAt = new Date();
  const result = spawnSync(
    codexBinary,
    [
      'exec',
      '--json',
      '--ephemeral',
      '--dangerously-bypass-hook-trust',
      '--dangerously-bypass-approvals-and-sandbox',
      '-m',
      model,
      '-C',
      options.cwd,
      HEADLESS_CHECK_PROMPT,
    ],
    {
      cwd: options.cwd,
      encoding: 'utf8',
      env: environment,
      timeout: options.timeoutMilliseconds ?? 180_000,
    },
  );
  if (result.error !== undefined) {
    throw new Error(`Could not run the headless Codex activation task.`, { cause: result.error });
  }
  const events = parseCodexJsonLines(result.stdout);
  const warnings = splitWarnings(result.stderr);
  assertCodexRunSucceeded({
    status: result.status,
    events,
    model,
    codexVersion,
    warnings,
  });
  assertHookProofs({
    codexHome,
    expectedActivationId: options.expectedActivationId,
    startedAt,
  });
  assertActivationState({
    activation: options.expectedActivation,
    codexHome,
    expectedActivationId: options.expectedActivationId,
  });
  const proof = observeCodexHookProof(environment);
  if (proof.status !== 'current') {
    throw new Error(`Headless Codex task left hook proof ${proof.status}.`);
  }
  return {
    activation: options.expectedActivation,
    codexVersion,
    model,
    proof,
    warnings,
  };
}
