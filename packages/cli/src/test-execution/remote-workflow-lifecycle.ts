import { lstatSync, mkdirSync, unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import type { ExecutionMode } from './mode.js';
import { type PublicationHooks, publishExclusiveFile } from './remote-workflow-fs.js';
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

export interface RemoteWorkflowLifecycleHooks {
  readonly publication?: PublicationHooks;
  readonly beforeDisableRecheck?: () => void;
  readonly unlink?: (path: string) => void;
}

// eslint-disable-next-line unicorn/no-null -- Public lifecycle data uses null for no action.
const NO_ACTION = null;

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

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
  options: { readonly forDisable?: boolean; readonly effectiveMode?: ExecutionMode } = {},
): RemoteWorkflowLifecycleResult {
  const customerAbsent = options.forDisable === true && observation.state === 'customer_owned';
  const desired =
    observation.state === 'current' || observation.state === 'not_installed' || customerAbsent;
  return {
    ok: desired,
    changed: false,
    state: observation.state,
    affectedPath: desired ? NO_ACTION : observation.affectedPath,
    nextAction: desired ? NO_ACTION : observation.nextAction,
    ...(!desired && { code: 'REMOTE_WORKFLOW_CONFLICT', retryable: false }),
    ...(options.effectiveMode !== undefined && { effectiveMode: options.effectiveMode }),
  };
}

function ensureWorkflowParents(root: string): RemoteWorkflowLifecycleResult | undefined {
  for (const component of ['.github', '.github/workflows']) {
    const path = nodePath.join(root, component);
    try {
      mkdirSync(path);
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') {
        return {
          ok: false,
          changed: false,
          state: 'failed',
          code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
          retryable: false,
          operation: 'mkdir',
          path: component,
        };
      }
    }

    try {
      const metadata = lstatSync(path);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
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
    } catch {
      return retryFailure();
    }
  }
  return undefined;
}

function publicationFailure(
  operation: string,
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

function completeSetupPublication(
  root: string,
  bundled: string,
  effectiveMode: ExecutionMode,
  hooks: RemoteWorkflowLifecycleHooks,
): RemoteWorkflowLifecycleResult {
  const publication = publishExclusiveFile(
    nodePath.join(root, REMOTE_WORKFLOW_PATH),
    bundled,
    hooks.publication,
  );
  if (!publication.published) {
    if (publication.operation === 'create' && publication.code === 'EEXIST') return retryFailure();
    if (publication.operation === 'link' && publication.code === 'EEXIST') {
      const reclassified = classifyRemoteWorkflow(root, bundled);
      return reclassified.state === 'failed' || reclassified.state === 'not_installed'
        ? retryFailure()
        : classifiedResult(reclassified, { effectiveMode });
    }
    return publicationFailure(publication.operation, publication.code, publication.privatePath);
  }

  return {
    ok: true,
    changed: true,
    state: 'current',
    affectedPath: NO_ACTION,
    nextAction: NO_ACTION,
    effectiveMode,
    ...(publication.cleanupCode !== undefined && {
      warningCode: 'REMOTE_WORKFLOW_RESIDUE' as const,
      residuePath: publication.privatePath,
    }),
  };
}

export function setupRemoteWorkflow(
  root: string,
  bundled: string,
  effectiveMode: ExecutionMode,
  hooks: RemoteWorkflowLifecycleHooks = {},
): RemoteWorkflowLifecycleResult {
  const initial = classifyRemoteWorkflow(root, bundled);
  if (initial.state === 'failed') return retryFailure();
  if (initial.state !== 'not_installed') return classifiedResult(initial, { effectiveMode });

  const parentFailure = ensureWorkflowParents(root);
  if (parentFailure !== undefined) return parentFailure;
  return completeSetupPublication(root, bundled, effectiveMode, hooks);
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

export function disableRemoteWorkflow(
  root: string,
  bundled: string,
  hooks: RemoteWorkflowLifecycleHooks = {},
): RemoteWorkflowLifecycleResult {
  const initial = classifyRemoteWorkflow(root, bundled);
  if (initial.state === 'failed') return retryFailure();
  if (initial.state !== 'current') return classifiedResult(initial, { forDisable: true });

  hooks.beforeDisableRecheck?.();
  const finalObservation = classifyRemoteWorkflow(root, bundled);
  if (finalObservation.state === 'failed') return retryFailure();
  if (finalObservation.state !== 'current') {
    return classifiedResult(finalObservation, { forDisable: true });
  }

  try {
    (hooks.unlink ?? unlinkSync)(nodePath.join(root, REMOTE_WORKFLOW_PATH));
    return disabledResult(true);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return disabledResult(false);
    return {
      ok: false,
      changed: false,
      state: 'current',
      affectedPath: REMOTE_WORKFLOW_PATH,
      nextAction: 'repair_path_and_repeat',
      code: 'REMOTE_WORKFLOW_REMOVAL_FAILED',
      retryable: false,
      operation: 'unlink',
      filesystemCode: errorCode(error),
      path: REMOTE_WORKFLOW_PATH,
    };
  }
}
