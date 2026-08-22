import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  nodeRemoteWorkflowFs,
  type RemoteWorkflowFs,
} from '../../src/test-execution/remote-workflow-fs';
import {
  disableRemoteWorkflow,
  setupRemoteWorkflow,
} from '../../src/test-execution/remote-workflow-lifecycle';
import { REMOTE_WORKFLOW_PATH } from '../../src/test-execution/remote-workflow-state';

const bundled = 'name: Safeword tests\n';
const releasedV1 = readFileSync(
  nodePath.join(process.cwd(), 'tests', 'fixtures', 'remote-workflow-v1.yml'),
  'utf8',
);
const currentWorkflow = readFileSync(
  nodePath.join(process.cwd(), 'templates', 'workflows', 'remote-tests.yml'),
  'utf8',
);
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

  it('reports an already-current workflow as a successful setup no-op', () => {
    const root = fixture();
    writeWorkflow(root, bundled);

    expect(setupRemoteWorkflow(root, bundled, 'remote-preferred')).toEqual({
      ok: true,
      changed: false,
      state: 'current',
      affectedPath: NONE,
      nextAction: NONE,
      effectiveMode: 'remote-preferred',
    });
  });

  it('atomically upgrades the exact released predecessor', () => {
    const root = fixture();
    writeWorkflow(root, releasedV1);

    expect(setupRemoteWorkflow(root, currentWorkflow, 'remote-preferred')).toMatchObject({
      ok: true,
      changed: true,
      state: 'current',
      effectiveMode: 'remote-preferred',
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(currentWorkflow);
  });

  it.each([
    ['LF', releasedV1],
    ['CRLF', releasedV1.replaceAll('\n', '\r\n')],
  ])('upgrades exact released bytes from a %s checkout', (_lineEndings, predecessor) => {
    const root = fixture();
    const directory = nodePath.dirname(workflowPath(root));
    writeWorkflow(root, predecessor);
    expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(predecessor));

    expect(setupRemoteWorkflow(root, currentWorkflow, 'remote-preferred')).toMatchObject({
      ok: true,
      changed: true,
      state: 'current',
    });
    expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(currentWorkflow));
    expect(readdirSync(directory)).toEqual([nodePath.basename(REMOTE_WORKFLOW_PATH)]);
  });

  it.each([
    ['LF', `${releasedV1}\r`],
    ['CRLF', `${releasedV1.replaceAll('\n', '\r\n')}\r`],
  ])('preserves a lone-CR customer edit from a %s checkout', (_lineEndings, customerBytes) => {
    const root = fixture();
    const directory = nodePath.dirname(workflowPath(root));
    writeWorkflow(root, customerBytes);
    expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(customerBytes));

    expect(setupRemoteWorkflow(root, currentWorkflow, 'remote-preferred')).toMatchObject({
      ok: false,
      changed: false,
      state: 'customer_owned',
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
    expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(customerBytes));
    expect(readdirSync(directory)).toEqual([nodePath.basename(REMOTE_WORKFLOW_PATH)]);
  });

  it.each([
    ['LF', `${releasedV1}\r`],
    ['CRLF', `${releasedV1.replaceAll('\n', '\r\n')}\r`],
  ])(
    'does not disable a lone-CR customer edit from a %s checkout',
    (_lineEndings, customerBytes) => {
      const root = fixture();
      writeWorkflow(root, customerBytes);
      expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(customerBytes));

      expect(disableRemoteWorkflow(root, currentWorkflow)).toMatchObject({
        ok: false,
        changed: false,
        state: 'customer_owned',
        code: 'REMOTE_WORKFLOW_CONFLICT',
      });
      expect(readFileSync(workflowPath(root))).toEqual(Buffer.from(customerBytes));
    },
  );

  it('preserves a customer workflow during setup and disable', () => {
    const root = fixture();
    writeWorkflow(root, 'name: customer\n');

    expect(setupRemoteWorkflow(root, bundled, 'remote-preferred')).toMatchObject({
      ok: false,
      state: 'customer_owned',
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
    expect(disableRemoteWorkflow(root, bundled)).toEqual({
      ok: false,
      changed: false,
      state: 'customer_owned',
      affectedPath: REMOTE_WORKFLOW_PATH,
      nextAction: 'move_aside_and_repeat',
      code: 'REMOTE_WORKFLOW_CONFLICT',
      retryable: false,
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe('name: customer\n');
  });

  it('reports an unsafe path during disable without changing it', () => {
    const root = fixture();
    symlinkSync(root, nodePath.join(root, '.github'));

    expect(disableRemoteWorkflow(root, bundled)).toEqual({
      ok: false,
      changed: false,
      state: 'unsafe_path',
      affectedPath: '.github',
      nextAction: 'repair_path_and_repeat',
      code: 'REMOTE_WORKFLOW_CONFLICT',
      retryable: false,
    });
  });

  it('rejects an initially unsafe workflow destination during setup', () => {
    const root = fixture();
    mkdirSync(nodePath.dirname(workflowPath(root)), { recursive: true });
    symlinkSync(root, workflowPath(root));

    expect(setupRemoteWorkflow(root, bundled, 'local')).toMatchObject({
      ok: false,
      state: 'unsafe_path',
      affectedPath: REMOTE_WORKFLOW_PATH,
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
  });

  it.each(['setup', 'disable'] as const)(
    'retries when %s cannot classify the initial path',
    command => {
      const root = fixture();
      const filesystem = withFilesystem({
        lstat: () => {
          throw failure('EIO');
        },
      });

      const result =
        command === 'setup'
          ? setupRemoteWorkflow(root, bundled, 'local', filesystem)
          : disableRemoteWorkflow(root, bundled, filesystem);
      expect(result).toEqual({
        ok: false,
        changed: false,
        state: 'failed',
        code: 'REMOTE_WORKFLOW_RETRY',
        retryable: true,
      });
    },
  );

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

  it('disables the exact released predecessor', () => {
    const root = fixture();
    writeWorkflow(root, releasedV1);

    expect(disableRemoteWorkflow(root, currentWorkflow)).toMatchObject({
      ok: true,
      changed: true,
      state: 'not_installed',
    });
    expect(existsSync(workflowPath(root))).toBe(false);
  });

  it.each([
    ['customer bytes', 'REMOTE_WORKFLOW_CONFLICT', 'name: concurrent customer\n'],
    ['read failure', 'REMOTE_WORKFLOW_RETRY', releasedV1],
  ])('does not disable released v1 after commit-time %s', (change, expectedCode, expectedBytes) => {
    const root = fixture();
    const path = workflowPath(root);
    let reads = 0;
    writeWorkflow(root, releasedV1);

    const filesystem = withFilesystem({
      openRead: candidate => {
        reads += 1;
        if (reads === 2) {
          if (change === 'read failure') throw failure('EIO');
          writeFileSync(candidate, expectedBytes);
        }
        return nodeRemoteWorkflowFs.openRead(candidate);
      },
    });

    expect(disableRemoteWorkflow(root, currentWorkflow, filesystem)).toMatchObject({
      ok: false,
      changed: false,
      code: expectedCode,
    });
    expect(readFileSync(path, 'utf8')).toBe(expectedBytes);
  });

  it('preserves customer bytes that appear at exclusive publication', () => {
    const root = fixture();
    const customer = 'name: concurrent customer\n';

    expect(
      setupRemoteWorkflow(
        root,
        bundled,
        'local',
        withFilesystem({
          link: (privatePath, destination) => {
            writeFileSync(workflowPath(root), customer, { flag: 'wx' });
            nodeRemoteWorkflowFs.link(privatePath, destination);
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      state: 'customer_owned',
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(customer);
  });

  it('accepts current bytes that appear at exclusive publication', () => {
    const root = fixture();
    const filesystem = withFilesystem({
      link: (privatePath, destination) => {
        writeFileSync(destination, bundled, { flag: 'wx' });
        nodeRemoteWorkflowFs.link(privatePath, destination);
      },
    });

    expect(setupRemoteWorkflow(root, bundled, 'remote-preferred', filesystem)).toMatchObject({
      ok: true,
      changed: false,
      state: 'current',
      effectiveMode: 'remote-preferred',
    });
  });

  it.each([
    ['absent', undefined],
    ['indeterminate', 'EIO'],
  ] as const)('retries when an EEXIST publication race becomes %s', (_name, observationCode) => {
    const root = fixture();
    let linkAttempted = false;
    const filesystem = withFilesystem({
      link: () => {
        linkAttempted = true;
        throw failure('EEXIST');
      },
      lstat: path => {
        if (linkAttempted && observationCode !== undefined && path === workflowPath(root)) {
          throw failure(observationCode);
        }
        return nodeRemoteWorkflowFs.lstat(path);
      },
    });

    const result = setupRemoteWorkflow(root, bundled, 'local', filesystem);
    expect(result).toMatchObject({
      ok: false,
      changed: false,
      state: 'failed',
      code: 'REMOTE_WORKFLOW_RETRY',
      retryable: true,
    });
  });

  it('reports unsafe when an EEXIST publication race becomes a symlink', () => {
    const root = fixture();
    const filesystem = withFilesystem({
      link: () => {
        symlinkSync(root, workflowPath(root));
        throw failure('EEXIST');
      },
    });

    const result = setupRemoteWorkflow(root, bundled, 'local', filesystem);
    expect(result).toMatchObject({
      ok: false,
      state: 'unsafe_path',
      affectedPath: REMOTE_WORKFLOW_PATH,
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
  });

  it('retries a private-create EEXIST race without removing the existing entry', () => {
    const root = fixture();
    const privatePath = nodePath.join(root, '.github/workflows/.safeword-concurrent');
    mkdirSync(nodePath.dirname(privatePath), { recursive: true });
    writeFileSync(privatePath, 'concurrent');

    expect(
      setupRemoteWorkflow(
        root,
        bundled,
        'local',
        withFilesystem({ privatePath: () => privatePath }),
      ),
    ).toMatchObject({ code: 'REMOTE_WORKFLOW_RETRY', retryable: true });
    expect(readFileSync(privatePath, 'utf8')).toBe('concurrent');
  });

  it.each([
    ['create', 'openPrivate', 'EACCES'],
    ['write', 'write', 'ENOSPC'],
    ['sync', 'sync', 'EIO'],
    ['close', 'close', 'EIO'],
    ['link', 'link', 'EXDEV'],
  ] as const)('reports failed publication operation %s', (operation, method, code) => {
    const root = fixture();
    const filesystem = withFilesystem({
      [method]: () => {
        throw failure(code);
      },
    });

    const result = setupRemoteWorkflow(root, bundled, 'local', filesystem);
    expect(result).toMatchObject({
      ok: false,
      changed: false,
      state: 'failed',
      code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
      retryable: false,
      operation,
      filesystemCode: code,
      path: REMOTE_WORKFLOW_PATH,
    });
    expect(existsSync(workflowPath(root))).toBe(false);
    if (result.residuePath !== undefined) expect(existsSync(result.residuePath)).toBe(false);
  });

  it.each([
    ['create', 'openPrivate'],
    ['link', 'link'],
  ] as const)('reports %s ENOENT as a non-retryable publication failure', (operation, method) => {
    const root = fixture();
    const filesystem = withFilesystem({
      [method]: () => {
        throw failure('ENOENT');
      },
    });

    expect(setupRemoteWorkflow(root, bundled, 'local', filesystem)).toMatchObject({
      ok: false,
      changed: false,
      state: 'failed',
      code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
      retryable: false,
      operation,
      filesystemCode: 'ENOENT',
      path: REMOTE_WORKFLOW_PATH,
    });
  });

  it.each(['EACCES', 'ENOENT'] as const)(
    'reports mkdir %s as a non-retryable publication failure',
    filesystemCode => {
      const root = fixture();
      const filesystem = withFilesystem({
        mkdir: () => {
          throw failure(filesystemCode);
        },
      });

      expect(setupRemoteWorkflow(root, bundled, 'local', filesystem)).toMatchObject({
        ok: false,
        changed: false,
        state: 'failed',
        code: 'REMOTE_WORKFLOW_PUBLICATION_FAILED',
        retryable: false,
        operation: 'mkdir',
        filesystemCode,
        path: '.github',
      });
    },
  );

  it.each(['current', 'absent'] as const)(
    'converges when disable revalidates the commit-time state as %s',
    commitState => {
      const root = fixture();
      const path = workflowPath(root);
      let workflowInspections = 0;
      let reads = 0;
      writeWorkflow(root, releasedV1);

      const filesystem = withFilesystem({
        lstat: candidate => {
          if (candidate === path) {
            workflowInspections += 1;
            if (workflowInspections === 2 && commitState === 'absent') rmSync(candidate);
          }
          return nodeRemoteWorkflowFs.lstat(candidate);
        },
        openRead: candidate => {
          reads += 1;
          if (reads === 2 && commitState === 'current') writeFileSync(candidate, currentWorkflow);
          return nodeRemoteWorkflowFs.openRead(candidate);
        },
      });

      expect(disableRemoteWorkflow(root, currentWorkflow, filesystem)).toMatchObject({
        ok: true,
        state: 'not_installed',
      });
      expect(existsSync(path)).toBe(false);
    },
  );

  it.each([
    ['customer bytes', 'name: concurrent customer\n'],
    ['read failure', releasedV1],
  ])('does not publish over commit-time %s', (change, expectedBytes) => {
    const root = fixture();
    const path = workflowPath(root);
    const privatePath = nodePath.join(nodePath.dirname(path), '.safeword-attempt');
    let reads = 0;
    writeWorkflow(root, releasedV1);

    const filesystem = withFilesystem({
      privatePath: () => privatePath,
      openRead: candidate => {
        reads += 1;
        if (reads === 2) {
          if (change === 'read failure') throw failure('EIO');
          writeFileSync(candidate, expectedBytes);
        }
        return nodeRemoteWorkflowFs.openRead(candidate);
      },
    });

    expect(
      setupRemoteWorkflow(root, currentWorkflow, 'remote-preferred', filesystem),
    ).toMatchObject({
      ok: false,
      changed: false,
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
    expect(readFileSync(path, 'utf8')).toBe(expectedBytes);
    expect(existsSync(privatePath)).toBe(false);
  });

  it.each(['current', 'absent'] as const)(
    'converges when setup revalidates the commit-time state as %s',
    commitState => {
      const root = fixture();
      const path = workflowPath(root);
      const privatePath = nodePath.join(nodePath.dirname(path), '.safeword-attempt');
      let workflowInspections = 0;
      let reads = 0;
      writeWorkflow(root, releasedV1);

      const filesystem = withFilesystem({
        privatePath: () => privatePath,
        lstat: candidate => {
          if (candidate === path) {
            workflowInspections += 1;
            if (workflowInspections === 2 && commitState === 'absent') rmSync(candidate);
          }
          return nodeRemoteWorkflowFs.lstat(candidate);
        },
        openRead: candidate => {
          reads += 1;
          if (reads === 2 && commitState === 'current') writeFileSync(candidate, currentWorkflow);
          return nodeRemoteWorkflowFs.openRead(candidate);
        },
      });

      expect(
        setupRemoteWorkflow(root, currentWorkflow, 'remote-preferred', filesystem),
      ).toMatchObject({
        ok: true,
        state: 'current',
      });
      expect(readFileSync(path, 'utf8')).toBe(currentWorkflow);
      expect(existsSync(privatePath)).toBe(false);
    },
  );

  it('rejects an unsafe parent that appears during EEXIST recovery', () => {
    const root = fixture();
    const github = nodePath.join(root, '.github');
    const filesystem = withFilesystem({
      mkdir: path => {
        if (path === github) {
          writeFileSync(path, 'customer');
          throw failure('EEXIST');
        }
        nodeRemoteWorkflowFs.mkdir(path);
      },
    });

    expect(setupRemoteWorkflow(root, bundled, 'local', filesystem)).toMatchObject({
      ok: false,
      state: 'unsafe_path',
      affectedPath: '.github',
      code: 'REMOTE_WORKFLOW_CONFLICT',
    });
  });

  it('reports inert private residue without misreporting the installed workflow', () => {
    const root = fixture();
    const cleanupError = Object.assign(new Error('cleanup denied'), { code: 'EACCES' });

    const result = setupRemoteWorkflow(
      root,
      bundled,
      'local',
      withFilesystem({
        unlink: () => {
          throw cleanupError;
        },
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      changed: true,
      state: 'current',
      warningCode: 'REMOTE_WORKFLOW_RESIDUE',
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(bundled);
    expect(result.residuePath).toBeDefined();
    expect(existsSync(result.residuePath ?? '')).toBe(true);
  });

  it('ignores prior inert residue when a later setup succeeds', () => {
    const root = fixture();
    const residue = nodePath.join(root, '.safeword-prior');
    writeFileSync(residue, 'prior');

    expect(setupRemoteWorkflow(root, bundled, 'local')).toMatchObject({
      ok: true,
      changed: true,
      state: 'current',
    });
    expect(readFileSync(residue, 'utf8')).toBe('prior');
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(bundled);
  });

  it('preserves the primary conflict when its private cleanup also fails', () => {
    const root = fixture();
    const customer = 'name: concurrent customer\n';
    const cleanupError = Object.assign(new Error('cleanup denied'), { code: 'EACCES' });

    expect(
      setupRemoteWorkflow(
        root,
        bundled,
        'local',
        withFilesystem({
          link: (privatePath, destination) => {
            writeFileSync(workflowPath(root), customer, { flag: 'wx' });
            nodeRemoteWorkflowFs.link(privatePath, destination);
          },
          unlink: () => {
            throw cleanupError;
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      state: 'customer_owned',
      code: 'REMOTE_WORKFLOW_CONFLICT',
      warningCode: 'REMOTE_WORKFLOW_RESIDUE',
    });
    expect(readFileSync(workflowPath(root), 'utf8')).toBe(customer);
  });

  it.each([
    ['ENOENT', true, true, 'not_installed'],
    ['EACCES', false, false, 'current'],
  ] as const)('reports unlink %s honestly', (code, shouldRemoveFirst, ok, state) => {
    const root = fixture();
    writeWorkflow(root, bundled);

    const result = disableRemoteWorkflow(
      root,
      bundled,
      withFilesystem({
        unlink: path => {
          if (shouldRemoveFirst) rmSync(path);
          throw Object.assign(new Error(`unlink ${code}`), { code });
        },
      }),
    );

    expect(result).toMatchObject({ ok, changed: false, state });
    if (code === 'EACCES') {
      expect(result).toMatchObject({
        code: 'REMOTE_WORKFLOW_REMOVAL_FAILED',
        operation: 'unlink',
        filesystemCode: 'EACCES',
      });
      expect(readFileSync(workflowPath(root), 'utf8')).toBe(bundled);
    } else {
      expect(existsSync(workflowPath(root))).toBe(false);
    }
  });
});
