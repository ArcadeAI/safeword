import type { ExecutionMode } from './mode.js';

export function setupRemoteWorkflow(
  _root: string,
  _bundled: string,
  _effectiveMode: ExecutionMode,
): never {
  throw new Error('Not implemented');
}

export function disableRemoteWorkflow(_root: string, _bundled: string): never {
  throw new Error('Not implemented');
}
