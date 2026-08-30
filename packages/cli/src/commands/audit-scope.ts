/** Emit the packaged shell contract consumed by the audit workflow. */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';

function auditScopePath(): string {
  const packageRoot =
    nodePath.basename(import.meta.dirname) === 'dist'
      ? nodePath.dirname(import.meta.dirname)
      : nodePath.resolve(import.meta.dirname, '../..');
  return nodePath.join(packageRoot, 'templates/hooks/lib/audit-scope.sh');
}

export function observeAuditScope(): Promise<CliResult> {
  const path = auditScopePath();
  if (!existsSync(path)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'AUDIT_SCOPE_RUNTIME_MISSING',
            message: `Packaged audit scope is missing: ${path}`,
            retryable: false,
          },
        ],
      }),
    );
  }

  return Promise.resolve(
    createResult({
      state: 'healthy',
      presentation: { kind: 'raw', body: readFileSync(path, 'utf8') },
      data: { command: 'project audit-scope' },
    }),
  );
}
