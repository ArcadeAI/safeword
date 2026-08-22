import nodePath from 'node:path';

import type { ExecutionMode } from './mode.js';
import {
  type ExclusivePublicationResult,
  filesystemErrorCode,
  isStablePathError,
  nodeRemoteWorkflowFs,
  publishExclusiveFile,
  publishReplacementFile,
  type RemoteWorkflowFs,
} from './remote-workflow-fs.js';
import {
  classifyRemoteWorkflow,
  REMOTE_WORKFLOW_PATH,
  type RemoteWorkflowAction,
  type RemoteWorkflowObservation,
  type RemoteWorkflowState,
} from './remote-workflow-state.js';

export interface RemoteWorkflowLifecycleResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly state: RemoteWorkflowState | 'failed';
  readonly affectedPath?: string | null;
  readonly nextAction?: RemoteWorkflowAction | null;
  readonly effectiveMode?: ExecutionMode;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly operation?: string;
  readonly filesystemCode?: string;
  readonly path?: string;
  readonly warningCode?: 'REMOTE_WORKFLOW_RESIDUE';
  readonly residuePath?: string;
}

// eslint-disable-next-line unicorn/no-null -- Public lifecycle data uses null for no action.
const NO_ACTION = null;

function retryFailure(): RemoteWorkflowLifecycleResult {
  return {
    ok: false,
    changed: false,
    state: 'failed',
    code: 'REMOTE_WORKFLOW_RETRY',
    retryable: true,
  };
}

function classifiedResult(
  observation: Exclude<RemoteWorkflowObservation, { state: 'failed' }>,
  effectiveMode?: ExecutionMode,
): RemoteWorkflowLifecycleResult {
  const desired = observation.state === 'current' || observation.state === 'not_installed';
  return {
    ok: desired,
    changed: false,
    state: observation.state,
    affectedPath: desired ? NO_ACTION : observation.affectedPath,
    nextAction: desired ? NO_ACTION : observation.nextAction,
    ...(!desired && { code: 'REMOTE_WORKFLOW_CONFLICT', retryable: false }),
    ...(desired && effectiveMode !== undefined && { effectiveMode }),
  };
}

function unsafeParent(component: string): RemoteWorkflowLifecycleResult {
  return {
    ok: false,
    changed: false,
    state: 'unsafe_path',
    affectedPath: component,
    nextAction: 'repair_path_and_repeat',
    code: 'REMOTE_WORKFLOW_CONFLICT',
    retryable: false,
  };
}

function inspectCreatedParent(
  path: string,
  component: string,
  filesystem: RemoteWorkflowFs,
): RemoteWorkflowLifecycleResult | undefined {
  try {
    const metadata = filesystem.lstat(path);
    if (metadata === undefined) return retryFailure();
    return metadata.isDirectory() ? undefined : unsafeParent(component);
  } catch (error) {
    return isStablePathError(filesystemErrorCode(error)) ? unsafeParent(component) : retryFailure();
  }
}

function ensureWorkflowParents(
  root: string,
  filesystem: RemoteWorkflowFs,
): RemoteWorkflowLifecycleResult | undefined {
  for (const component of ['.github', '.github/workflows']) {
    const path = nodePath.join(root, component);
    try {
      filesystem.mkdir(path);
    } catch (error) {
      const code = filesystemErrorCode(error);
      if (code !== 'EEXIST') {
        return {
          ok: false,
          changed: false,
          state: 'failed',
          code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
          retryable: false,
          operation: 'mkdir',
          filesystemCode: code,
          path: component,
        };
      }
    }

    const inspectionFailure = inspectCreatedParent(path, component, filesystem);
    if (inspectionFailure !== undefined) return inspectionFailure;
  }
  return undefined;
}

function publicationFailure(
  operation:
    Extract<ExclusivePublicationResult, { published: false }>['operation'] | 'check' | 'rename',
  code: string,
  path: string,
): RemoteWorkflowLifecycleResult {
  return {
    ok: false,
    changed: false,
    state: 'failed',
    code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
    retryable: false,
    operation,
    filesystemCode: code,
    path,
  };
}

function completeSetupUpgrade(
  root: string,
  bundled: string,
  effectiveMode: ExecutionMode,
  filesystem: RemoteWorkflowFs,
): RemoteWorkflowLifecycleResult {
  const publication = publishReplacementFile(
    nodePath.join(root, REMOTE_WORKFLOW_PATH),
    bundled,
    () => {
      const state = classifyRemoteWorkflow(root, bundled, filesystem).state;
      return state === 'managed_outdated' || state === 'not_installed';
    },
    filesystem,
  );
  if (publication.replaced) {
    return {
      ok: true,
      changed: true,
      state: 'current',
      affectedPath: NO_ACTION,
      nextAction: NO_ACTION,
      effectiveMode,
    };
  }
  if (publication.operation === 'check') {
    const observation = classifyRemoteWorkflow(root, bundled, filesystem);
    const result =
      observation.state === 'failed' || observation.state === 'not_installed'
        ? retryFailure()
        : classifiedResult(observation, effectiveMode);
    return withPublicationResidue(result, publication);
  }
  return withPublicationResidue(
    publicationFailure(publication.operation, publication.code, REMOTE_WORKFLOW_PATH),
    publication,
  );
}

function withPublicationResidue(
  result: RemoteWorkflowLifecycleResult,
  publication: { readonly cleanupCode?: string; readonly privatePath: string },
): RemoteWorkflowLifecycleResult {
  return publication.cleanupCode === undefined
    ? result
    : {
        ...result,
        warningCode: 'REMOTE_WORKFLOW_RESIDUE',
        residuePath: publication.privatePath,
      };
}

function completeSetupPublication(
  root: string,
  bundled: string,
  effectiveMode: ExecutionMode,
  filesystem: RemoteWorkflowFs,
): RemoteWorkflowLifecycleResult {
  const publication = publishExclusiveFile(
    nodePath.join(root, REMOTE_WORKFLOW_PATH),
    bundled,
    filesystem,
  );
  if (!publication.published) {
    if (publication.operation === 'create' && publication.code === 'EEXIST') {
      return retryFailure();
    }
    if (publication.operation === 'link' && publication.code === 'EEXIST') {
      const reclassified = classifyRemoteWorkflow(root, bundled, filesystem);
      if (reclassified.state === 'failed') {
        return withPublicationResidue(retryFailure(), publication);
      }
      const retryableStates: RemoteWorkflowState[] = ['not_installed', 'managed_outdated'];
      const result = retryableStates.includes(reclassified.state)
        ? retryFailure()
        : classifiedResult(reclassified, effectiveMode);
      return withPublicationResidue(result, publication);
    }
    return withPublicationResidue(
      publicationFailure(publication.operation, publication.code, REMOTE_WORKFLOW_PATH),
      publication,
    );
  }

  return withPublicationResidue(
    {
      ok: true,
      changed: true,
      state: 'current',
      affectedPath: NO_ACTION,
      nextAction: NO_ACTION,
      effectiveMode,
    },
    publication,
  );
}

export function setupRemoteWorkflow(
  root: string,
  bundled: string,
  effectiveMode: ExecutionMode,
  filesystem: RemoteWorkflowFs = nodeRemoteWorkflowFs,
): RemoteWorkflowLifecycleResult {
  const initial = classifyRemoteWorkflow(root, bundled, filesystem);
  if (initial.state === 'failed') return retryFailure();
  if (initial.state === 'managed_outdated') {
    return completeSetupUpgrade(root, bundled, effectiveMode, filesystem);
  }
  if (initial.state !== 'not_installed') return classifiedResult(initial, effectiveMode);

  const parentFailure = ensureWorkflowParents(root, filesystem);
  if (parentFailure !== undefined) return parentFailure;
  return completeSetupPublication(root, bundled, effectiveMode, filesystem);
}

function disabledResult(changed: boolean): RemoteWorkflowLifecycleResult {
  return {
    ok: true,
    changed,
    state: 'not_installed',
    affectedPath: NO_ACTION,
    nextAction: NO_ACTION,
  };
}

function customerOwnedDisabledResult(): RemoteWorkflowLifecycleResult {
  return {
    ok: true,
    changed: false,
    state: 'customer_owned',
    affectedPath: NO_ACTION,
    nextAction: NO_ACTION,
  };
}

function classifiedDisableResult(
  observation: Exclude<RemoteWorkflowObservation, { state: 'failed' }>,
): RemoteWorkflowLifecycleResult {
  return observation.state === 'customer_owned'
    ? customerOwnedDisabledResult()
    : classifiedResult(observation);
}

export function disableRemoteWorkflow(
  root: string,
  bundled: string,
  filesystem: RemoteWorkflowFs = nodeRemoteWorkflowFs,
): RemoteWorkflowLifecycleResult {
  const initial = classifyRemoteWorkflow(root, bundled, filesystem);
  if (initial.state === 'failed') return retryFailure();
  if (initial.state !== 'current' && initial.state !== 'managed_outdated') {
    return classifiedDisableResult(initial);
  }

  const revalidated = classifyRemoteWorkflow(root, bundled, filesystem);
  if (revalidated.state === 'failed') return retryFailure();
  if (revalidated.state !== 'current' && revalidated.state !== 'managed_outdated') {
    return classifiedDisableResult(revalidated);
  }

  try {
    filesystem.unlink(nodePath.join(root, REMOTE_WORKFLOW_PATH));
    return disabledResult(true);
  } catch (error) {
    const code = filesystemErrorCode(error);
    if (code === 'ENOENT') return disabledResult(false);
    return {
      ok: false,
      changed: false,
      state: revalidated.state,
      affectedPath: REMOTE_WORKFLOW_PATH,
      nextAction: 'repair_path_and_repeat',
      code: 'REMOTE_WORKFLOW_REMOVAL_FAILED',
      retryable: false,
      operation: 'unlink',
      filesystemCode: code,
      path: REMOTE_WORKFLOW_PATH,
    };
  }
}
