import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  nodeRemoteWorkflowFs,
  type RemoteWorkflowFs,
} from '../../src/test-execution/remote-workflow-fs';
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

function withFilesystem(overrides: Partial<RemoteWorkflowFs>): RemoteWorkflowFs {
  return { ...nodeRemoteWorkflowFs, ...overrides };
}

function failure(code: string): Error {
  return Object.assign(new Error(code), { code });
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

  it.each([
    ['workflows directory is a file', '.github/workflows'],
    ['workflow is a symlink', WORKFLOW_PATH],
  ] as const)('reports unsafe when the %s', (_name, affectedPath) => {
    const root = fixture();
    mkdirSync(nodePath.join(root, '.github'));
    if (affectedPath === '.github/workflows') {
      writeFileSync(nodePath.join(root, affectedPath), 'customer');
    } else {
      mkdirSync(nodePath.join(root, '.github/workflows'));
      symlinkSync(root, nodePath.join(root, WORKFLOW_PATH));
    }

    expect(classifyRemoteWorkflow(root, bundled)).toEqual({
      state: 'unsafe_path',
      affectedPath,
      nextAction: 'repair_path_and_repeat',
    });
  });

  it.each(['EACCES', 'ELOOP', 'ENAMETOOLONG', 'ENOTDIR'])(
    'classifies stable path error %s as unsafe',
    code => {
      const root = fixture();
      const filesystem = withFilesystem({
        lstat: () => {
          throw failure(code);
        },
      });

      expect(classifyRemoteWorkflow(root, bundled, filesystem)).toEqual({
        state: 'unsafe_path',
        affectedPath: '.github',
        nextAction: 'repair_path_and_repeat',
      });
    },
  );

  it('returns a failed observation for an indeterminate path error', () => {
    const root = fixture();
    const filesystem = withFilesystem({
      lstat: () => {
        throw failure('EIO');
      },
    });

    expect(classifyRemoteWorkflow(root, bundled, filesystem)).toEqual({
      state: 'failed',
      code: 'EIO',
      path: '.github',
    });
  });

  it('returns a failed observation rather than throwing when close fails', () => {
    const root = fixture();
    writeWorkflow(root, bundled);
    const filesystem = withFilesystem({
      close: () => {
        throw failure('EIO');
      },
    });

    expect(classifyRemoteWorkflow(root, bundled, filesystem)).toEqual({
      state: 'failed',
      code: 'EIO',
      path: WORKFLOW_PATH,
    });
  });

  it.each(['read', 'close'] as const)(
    'treats descriptor-level %s permission errors as indeterminate',
    method => {
      const root = fixture();
      writeWorkflow(root, bundled);
      const filesystem = withFilesystem({
        [method]: () => {
          throw failure('EACCES');
        },
      });

      expect(classifyRemoteWorkflow(root, bundled, filesystem)).toEqual({
        state: 'failed',
        code: 'EACCES',
        path: WORKFLOW_PATH,
      });
    },
  );

  it('classifies an implausible byte length without reading the file', () => {
    const root = fixture();
    writeWorkflow(root, 'x');
    const filesystem = withFilesystem({
      read: () => {
        throw failure('read should not run');
      },
    });

    expect(classifyRemoteWorkflow(root, bundled, filesystem)).toEqual({
      state: 'customer_owned',
      affectedPath: WORKFLOW_PATH,
      nextAction: 'move_aside_and_repeat',
    });
  });
});
