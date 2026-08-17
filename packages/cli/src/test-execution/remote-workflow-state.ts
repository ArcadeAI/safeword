import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export const REMOTE_WORKFLOW_PATH = '.github/workflows/safeword-tests.yml';

export type RemoteWorkflowState = 'not_installed' | 'current' | 'customer_owned' | 'unsafe_path';
export type RemoteWorkflowAction =
  'install_remote_tests' | 'move_aside_and_repeat' | 'repair_path_and_repeat';

export interface RemoteWorkflowClassification {
  readonly state: RemoteWorkflowState;
  readonly affectedPath: string | null;
  readonly nextAction: RemoteWorkflowAction | null;
}

export interface RemoteWorkflowObservationFailure {
  readonly state: 'failed';
  readonly code: string;
  readonly path: string;
}

export type RemoteWorkflowObservation =
  RemoteWorkflowClassification | RemoteWorkflowObservationFailure;

const STABLE_PATH_ERRORS = new Set(['EACCES', 'ELOOP', 'ENOTDIR']);
// eslint-disable-next-line unicorn/no-null -- Public JSON uses null for an absent action.
const NO_ACTION = null;

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

function observationError(error: unknown, path: string): RemoteWorkflowObservation {
  const code = errorCode(error);
  return STABLE_PATH_ERRORS.has(code)
    ? { state: 'unsafe_path', affectedPath: path, nextAction: 'repair_path_and_repeat' }
    : { state: 'failed', code, path };
}

function normalizeLineEndings(content: string): string {
  return content.replaceAll('\r\n', '\n');
}

type WorkflowRead = { readonly content: string } | { readonly failure: RemoteWorkflowObservation };

function readRegularFile(path: string): WorkflowRead {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!fstatSync(descriptor).isFile()) {
      return {
        failure: {
          state: 'unsafe_path',
          affectedPath: REMOTE_WORKFLOW_PATH,
          nextAction: 'repair_path_and_repeat',
        },
      };
    }
    return { content: readFileSync(descriptor, 'utf8') };
  } catch (error) {
    return { failure: observationError(error, REMOTE_WORKFLOW_PATH) };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function inspectParents(root: string): RemoteWorkflowObservation | undefined {
  const components = ['.github', '.github/workflows'] as const;
  for (const component of components) {
    try {
      const metadata = lstatSync(nodePath.join(root, component), { throwIfNoEntry: false });
      if (metadata === undefined) {
        return {
          state: 'not_installed',
          affectedPath: REMOTE_WORKFLOW_PATH,
          nextAction: 'install_remote_tests',
        };
      }
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        return {
          state: 'unsafe_path',
          affectedPath: component,
          nextAction: 'repair_path_and_repeat',
        };
      }
    } catch (error) {
      return observationError(error, component);
    }
  }
  return undefined;
}

type WorkflowEntryInspection =
  | { readonly kind: 'regular' }
  | { readonly kind: 'observation'; readonly value: RemoteWorkflowObservation };

function inspectWorkflowEntry(root: string): WorkflowEntryInspection {
  const destination = nodePath.join(root, REMOTE_WORKFLOW_PATH);
  try {
    const metadata = lstatSync(destination, { throwIfNoEntry: false });
    if (metadata === undefined) {
      return {
        kind: 'observation',
        value: {
          state: 'not_installed',
          affectedPath: REMOTE_WORKFLOW_PATH,
          nextAction: 'install_remote_tests',
        },
      };
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      return {
        kind: 'observation',
        value: {
          state: 'unsafe_path',
          affectedPath: REMOTE_WORKFLOW_PATH,
          nextAction: 'repair_path_and_repeat',
        },
      };
    }
  } catch (error) {
    return { kind: 'observation', value: observationError(error, REMOTE_WORKFLOW_PATH) };
  }
  return { kind: 'regular' };
}

export function classifyRemoteWorkflow(root: string, bundled: string): RemoteWorkflowObservation {
  const parentObservation = inspectParents(root);
  if (parentObservation !== undefined) return parentObservation;

  const entryObservation = inspectWorkflowEntry(root);
  if (entryObservation.kind === 'observation') return entryObservation.value;

  const destination = nodePath.join(root, REMOTE_WORKFLOW_PATH);
  const observed = readRegularFile(destination);
  if ('failure' in observed) return observed.failure;
  return normalizeLineEndings(observed.content) === normalizeLineEndings(bundled)
    ? { state: 'current', affectedPath: NO_ACTION, nextAction: NO_ACTION }
    : {
        state: 'customer_owned',
        affectedPath: REMOTE_WORKFLOW_PATH,
        nextAction: 'move_aside_and_repeat',
      };
}
