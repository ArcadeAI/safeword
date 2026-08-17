import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { classifyRemoteWorkflow } from '../../src/test-execution/remote-workflow-state';

const WORKFLOW_PATH = '.github/workflows/safeword-tests.yml';
const bundled = 'name: Safeword tests\n';
const roots: string[] = [];
// eslint-disable-next-line unicorn/no-null -- JSON output deliberately represents no action with null.
const NONE = null;

function fixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-workflow-state-'));
  roots.push(root);
  return root;
}

function writeWorkflow(root: string, content: string): void {
  const path = nodePath.join(root, WORKFLOW_PATH);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe('remote workflow ownership classification', () => {
  it.each([
    ['missing parents', undefined, 'not_installed', WORKFLOW_PATH, 'install_remote_tests'],
    ['current LF bytes', bundled, 'current', NONE, NONE],
    ['current CRLF bytes', bundled.replaceAll('\n', '\r\n'), 'current', NONE, NONE],
    [
      'customer bytes',
      'name: customer\n',
      'customer_owned',
      WORKFLOW_PATH,
      'move_aside_and_repeat',
    ],
  ] as const)('classifies %s', (_name, content, state, affectedPath, nextAction) => {
    const root = fixture();
    if (content !== undefined) writeWorkflow(root, content);

    expect(classifyRemoteWorkflow(root, bundled)).toEqual({ state, affectedPath, nextAction });
  });

  it('reports the first unsafe path component without following it', () => {
    const root = fixture();
    symlinkSync(root, nodePath.join(root, '.github'));

    expect(classifyRemoteWorkflow(root, bundled)).toEqual({
      state: 'unsafe_path',
      affectedPath: '.github',
      nextAction: 'repair_path_and_repeat',
    });
  });
});
