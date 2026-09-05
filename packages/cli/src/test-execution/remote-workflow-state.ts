import { createHash } from 'node:crypto';
import nodePath from 'node:path';

import {
  filesystemErrorCode,
  isStablePathError,
  nodeRemoteWorkflowFs,
  type RemoteWorkflowFs,
} from './remote-workflow-fs.js';

export const REMOTE_WORKFLOW_PATH = '.github/workflows/safeword-remote-tests.yml';

export type RemoteWorkflowState =
  'not_installed' | 'current' | 'managed_outdated' | 'customer_owned' | 'unsafe_path';
export type RemoteWorkflowAction =
  | 'install_remote_tests'
  | 'upgrade_remote_tests'
  | 'move_aside_and_repeat'
  | 'repair_path_and_repeat';

// Before changing the bundled workflow, freeze the former current bytes as the
// next numbered fixture and append the successor here. Never infer ownership
// from markers or runtime config.
export const REMOTE_WORKFLOW_RELEASE_MANIFEST = [
  {
    version: 1,
    normalizedSha256: 'ee9b263ac749f74cfa4423f4a8930f03a357e2d823c4ac271517e81c98fecd27',
  },
  {
    version: 2,
    normalizedSha256: 'f5898559f4d57c39a7887e7061d50ebaa2cbaf86159d7c93555a6c32c6d909d9',
  },
  {
    version: 3,
    normalizedSha256: '20846fed2fa9d655c2bba660cd5f7f2fd712c34ac92523d6c40846e9a8477baf',
  },
] as const;

const HISTORICAL_MANAGED_DIGESTS = new Set<string>(
  REMOTE_WORKFLOW_RELEASE_MANIFEST.slice(0, -1).map(release => release.normalizedSha256),
);

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

// eslint-disable-next-line unicorn/no-null -- Public JSON uses null for an absent action.
const NO_ACTION = null;

function observationError(error: unknown, path: string): RemoteWorkflowObservation {
  const code = filesystemErrorCode(error);
  return isStablePathError(code)
    ? { state: 'unsafe_path', affectedPath: path, nextAction: 'repair_path_and_repeat' }
    : { state: 'failed', code, path };
}

function indeterminateError(error: unknown, path: string): RemoteWorkflowObservationFailure {
  return { state: 'failed', code: filesystemErrorCode(error), path };
}

function normalizeLineEndings(content: string): string {
  return content.replaceAll('\r\n', '\n');
}

type WorkflowRead = { readonly content: string } | { readonly failure: RemoteWorkflowObservation };

function workflowDigest(content: string): string {
  return createHash('sha256').update(normalizeLineEndings(content)).digest('hex');
}

function readOpenedWorkflow(descriptor: number, filesystem: RemoteWorkflowFs): WorkflowRead {
  const metadata = filesystem.fstat(descriptor);
  if (!metadata.isFile()) {
    return {
      failure: {
        state: 'unsafe_path',
        affectedPath: REMOTE_WORKFLOW_PATH,
        nextAction: 'repair_path_and_repeat',
      },
    };
  }
  return { content: filesystem.read(descriptor) };
}

function readRegularFile(path: string, filesystem: RemoteWorkflowFs): WorkflowRead {
  let descriptor: number | undefined;
  let result: WorkflowRead;
  try {
    descriptor = filesystem.openRead(path);
  } catch (error) {
    return { failure: observationError(error, REMOTE_WORKFLOW_PATH) };
  }
  try {
    result = readOpenedWorkflow(descriptor, filesystem);
  } catch (error) {
    result = { failure: indeterminateError(error, REMOTE_WORKFLOW_PATH) };
  }
  if (descriptor !== undefined) {
    try {
      filesystem.close(descriptor);
    } catch (error) {
      if (!('failure' in result)) {
        result = { failure: indeterminateError(error, REMOTE_WORKFLOW_PATH) };
      }
    }
  }
  return result;
}

function inspectParents(
  root: string,
  filesystem: RemoteWorkflowFs,
): RemoteWorkflowObservation | undefined {
  const components = ['.github', '.github/workflows'] as const;
  for (const component of components) {
    try {
      const metadata = filesystem.lstat(nodePath.join(root, component));
      if (metadata === undefined) {
        return {
          state: 'not_installed',
          affectedPath: REMOTE_WORKFLOW_PATH,
          nextAction: 'install_remote_tests',
        };
      }
      if (!metadata.isDirectory()) {
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

function inspectWorkflowEntry(root: string, filesystem: RemoteWorkflowFs): WorkflowEntryInspection {
  const destination = nodePath.join(root, REMOTE_WORKFLOW_PATH);
  try {
    const metadata = filesystem.lstat(destination);
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
    if (!metadata.isFile()) {
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

export function classifyRemoteWorkflow(
  root: string,
  bundled: string,
  filesystem: RemoteWorkflowFs = nodeRemoteWorkflowFs,
): RemoteWorkflowObservation {
  const parentObservation = inspectParents(root, filesystem);
  if (parentObservation !== undefined) return parentObservation;

  const entryObservation = inspectWorkflowEntry(root, filesystem);
  if (entryObservation.kind === 'observation') return entryObservation.value;

  const destination = nodePath.join(root, REMOTE_WORKFLOW_PATH);
  const observed = readRegularFile(destination, filesystem);
  if ('failure' in observed) return observed.failure;
  const observedDigest = workflowDigest(observed.content);
  if (observedDigest === workflowDigest(bundled)) {
    return { state: 'current', affectedPath: NO_ACTION, nextAction: NO_ACTION };
  }
  if (HISTORICAL_MANAGED_DIGESTS.has(observedDigest)) {
    return {
      state: 'managed_outdated',
      affectedPath: REMOTE_WORKFLOW_PATH,
      nextAction: 'upgrade_remote_tests',
    };
  }
  return {
    state: 'customer_owned',
    affectedPath: REMOTE_WORKFLOW_PATH,
    nextAction: 'move_aside_and_repeat',
  };
}
