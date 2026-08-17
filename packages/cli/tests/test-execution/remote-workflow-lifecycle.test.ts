import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  disableRemoteWorkflow,
  setupRemoteWorkflow,
} from '../../src/test-execution/remote-workflow-lifecycle';
import { REMOTE_WORKFLOW_PATH } from '../../src/test-execution/remote-workflow-state';

const bundled = 'name: Safeword tests\n';
const roots: string[] = [];
// eslint-disable-next-line unicorn/no-null -- Public lifecycle data represents no action with null.
const NONE = null;

function fixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-workflow-lifecycle-'));
  roots.push(root);
  return root;
}

function workflowPath(root: string): string {
  return nodePath.join(root, REMOTE_WORKFLOW_PATH);
}

function writeWorkflow(root: string, content: string): void {
  const path = workflowPath(root);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe('remote workflow lifecycle', () => {
  it('sets up the complete workflow without changing execution preference', () => {
    const root = fixture();

    expect(setupRemoteWorkflow(root, bundled, 'local')).toEqual({
      ok: true,
      changed: true,
      state: 'current',
      affectedPath: NONE,
      nextAction: NONE,
      effectiveMode: 'local',
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(bundled);
  });

  it('preserves a customer workflow during setup and disable', () => {
    const root = fixture();
    writeWorkflow(root, 'name: customer\n');

    expect(setupRemoteWorkflow(root, bundled, 'remote-preferred')).toMatchObject({
      ok: false,
      state: 'customer_owned',
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
    expect(disableRemoteWorkflow(root, bundled)).toEqual({
      ok: true,
      changed: false,
      state: 'customer_owned',
      affectedPath: NONE,
      nextAction: NONE,
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe('name: customer\n');
  });

  it('disables only the current workflow and converges when repeated', () => {
    const root = fixture();
    writeWorkflow(root, bundled.replaceAll('\n', '\r\n'));

    expect(disableRemoteWorkflow(root, bundled)).toMatchObject({
      ok: true,
      changed: true,
      state: 'not_installed',
    });
    expect(existsSync(workflowPath(root))).toBe(false);
    expect(disableRemoteWorkflow(root, bundled)).toMatchObject({
      ok: true,
      changed: false,
      state: 'not_installed',
    });
  });
});
