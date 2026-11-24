import path from 'node:path';

import { SOULLESS_RETROSPECTIVE_POLICY } from './retrospective-policy.js';
import type { RetrospectiveProofRequest } from './retrospective-proof.js';

export interface ElectronProofRequest extends RetrospectiveProofRequest {
  readonly testLine: number;
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Electron proof request must contain typed objects.');
  }
  const fields = Object.keys(value);
  const missing = keys.filter(key => !fields.includes(key));
  const unsupported = fields.filter(field => !keys.includes(field));
  if (missing.length > 0 || unsupported.length > 0) {
    throw new Error(
      `Electron proof request contains missing fields: ${JSON.stringify(missing)}; unsupported fields: ${JSON.stringify(unsupported)}.`,
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0;
    if (code < 32 || code === 127) return false;
  }
  return true;
}

export function containedElectronInput(value: unknown): value is string {
  return (
    text(value) &&
    !path.isAbsolute(value) &&
    !value.includes('\\') &&
    value.split('/').every(part => !['', '.', '..'].includes(part))
  );
}

function requireScenario(request: Record<string, unknown>): void {
  if (
    request.ticketId !== SOULLESS_RETROSPECTIVE_POLICY.ticketId ||
    typeof request.scenario !== 'string' ||
    !([...SOULLESS_RETROSPECTIVE_POLICY.scenarios] as string[]).includes(request.scenario)
  )
    throw new Error('Electron proof request is outside the approved migration scenarios.');
}

function requireSelection(request: Record<string, unknown>): void {
  if (
    !containedElectronInput(request.testFile) ||
    !/^packages\/desktop\/tests\/electron\/[^/]+\.electron\.spec\.ts$/u.test(request.testFile) ||
    !text(request.testFullName) ||
    !request.testFullName.startsWith(` ${path.posix.basename(request.testFile)} `) ||
    !request.testFullName.endsWith(` ${String(request.scenario)}`) ||
    !Number.isSafeInteger(request.testLine) ||
    Number(request.testLine) < 1
  )
    throw new Error('Electron proof request needs one exact Electron test declaration.');
}

function requireInputs(request: Record<string, unknown>): void {
  if (
    !containedElectronInput(request.implementationPath) ||
    !request.implementationPath.startsWith('packages/desktop/src/') ||
    !/\.tsx?$/u.test(request.implementationPath)
  )
    throw new Error('Electron mutation must target contained desktop production source.');
  if (
    !Array.isArray(request.supportFiles) ||
    request.supportFiles.length === 0 ||
    request.supportFiles.some(file => !containedElectronInput(file)) ||
    new Set(request.supportFiles).size !== request.supportFiles.length
  )
    throw new Error('Electron proof needs distinct contained support files.');
}

function requireMutation(request: Record<string, unknown>): void {
  const mutation = record(request.mutation, [
    'before',
    'after',
    'expectedFailure',
    'assertionLocation',
  ]);
  if (
    typeof mutation.before !== 'string' ||
    mutation.before === '' ||
    typeof mutation.after !== 'string' ||
    mutation.before === mutation.after ||
    typeof mutation.expectedFailure !== 'string' ||
    mutation.expectedFailure.trim() === '' ||
    !text(mutation.assertionLocation)
  )
    throw new Error('Electron mutation needs a behavior removal and declared assertion.');
  requireAssertion(mutation.assertionLocation, request.testFile);
}

function requireAssertion(assertion: string, testFile: unknown): void {
  const location = /^(.*):([1-9]\d*)$/u.exec(assertion);
  if (location?.[1] !== testFile || !Number.isSafeInteger(Number(location?.[2]))) {
    throw new Error('Electron mutation assertion must belong to the selected test file.');
  }
}

/** No request can substitute a shell command, working directory, or runner. */
export function parseElectronProofRequest(input: unknown): ElectronProofRequest {
  const request = record(input, [
    'ticketId',
    'scenario',
    'testFile',
    'testLine',
    'testFullName',
    'implementationPath',
    'mutation',
    'supportFiles',
  ]);
  requireScenario(request);
  requireSelection(request);
  requireInputs(request);
  requireMutation(request);
  return request as unknown as ElectronProofRequest;
}
