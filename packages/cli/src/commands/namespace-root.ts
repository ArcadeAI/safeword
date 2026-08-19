/**
 * `safeword project namespace-root` — print the resolved namespace root, or
 * (with `--key`) a configurable project-knowledge path within it. Raw-text
 * output: skills embed this in shell captures (e.g. `NS_ROOT="$(... )"`),
 * mirroring the hook-side `resolve-namespace-root.ts` script this replaces
 * for hosts with no project-local `.safeword/hooks/` to shell out to.
 */

import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  type ConfiguredPathKey,
  resolveConfiguredPath,
  resolveNamespaceRoot,
} from '../utils/configured-paths.js';

const CONFIGURED_PATH_KEYS: ReadonlySet<string> = new Set([
  'principles',
  'personas',
  'glossary',
  'surfaces',
  'architecture',
]);

export function observeNamespaceRoot(
  cwd: string,
  options: Readonly<Record<string, unknown>>,
): Promise<CliResult> {
  const keyValue = typeof options.key === 'string' ? options.key : undefined;
  if (keyValue !== undefined && !CONFIGURED_PATH_KEYS.has(keyValue)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'NAMESPACE_ROOT_KEY_INVALID',
            message: `Unknown namespace-root key "${keyValue}".`,
            retryable: false,
          },
        ],
      }),
    );
  }

  const body =
    keyValue === undefined
      ? resolveNamespaceRoot(cwd)
      : resolveConfiguredPath(cwd, keyValue as ConfiguredPathKey);

  return Promise.resolve(
    createResult({
      state: 'healthy',
      // Raw stdout stays absolute: skills capture it in shell substitutions.
      // The envelope carries the project-relative form so machine output is
      // identical across checkouts.
      presentation: { kind: 'raw', body },
      data: {
        command: 'project namespace-root',
        key: keyValue,
        path: nodePath.relative(cwd, body),
      },
    }),
  );
}
