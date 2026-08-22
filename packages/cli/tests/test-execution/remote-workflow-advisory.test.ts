import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { remoteWorkflowUninstallFinding } from '../../src/commands/test-execution';
import { nodeRemoteWorkflowFs } from '../../src/test-execution/remote-workflow-fs';

const roots: string[] = [];
const workflowPath = '.github/workflows/safeword-remote-tests.yml';

function fixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-workflow-advisory-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe('remote workflow uninstall advisory', () => {
  it.each(['not installed', 'customer owned', 'unsafe path', 'indeterminate'] as const)(
    'stays silent for %s observation',
    observation => {
      const root = fixture();
      const destination = nodePath.join(root, workflowPath);
      if (observation === 'customer owned') {
        mkdirSync(nodePath.dirname(destination), { recursive: true });
        writeFileSync(destination, 'name: customer\n');
      } else if (observation === 'unsafe path') {
        symlinkSync(root, nodePath.join(root, '.github'));
      }

      const filesystem =
        observation === 'indeterminate'
          ? {
              ...nodeRemoteWorkflowFs,
              lstat: () => {
                throw Object.assign(new Error('read failed'), { code: 'EIO' });
              },
            }
          : nodeRemoteWorkflowFs;
      expect(remoteWorkflowUninstallFinding(root, filesystem)).toBeUndefined();
    },
  );
});
