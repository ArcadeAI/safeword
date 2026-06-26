import { join } from 'node:path';

import type { RustSandboxPolicy, RustTask } from './dataset';

export type RustSandboxStep =
  | {
      kind: 'checkout';
      repositoryUrl: string;
      ref: string;
      destination: string;
    }
  | {
      kind: 'copy-worktree';
      source: string;
      destination: string;
    }
  | {
      kind: 'prepare-cache';
      path: string;
      volumeName: string;
    }
  | {
      kind: 'cleanup-cache';
      volumeName: string;
    }
  | {
      kind: 'dependency-prefetch';
      argv: string[];
    }
  | {
      kind: 'apply-patch';
      patchFile: string;
      cwd: string;
    }
  | {
      kind: 'docker-run';
      argv: string[];
    };

export interface RustSandboxRunPlan {
  taskId: string;
  paths: {
    source: string;
    worktree: string;
    cache: string;
  };
  cache: {
    kind: 'docker-volume';
    name: string;
    target: '/workspace/cache';
  };
  steps: RustSandboxStep[];
  patch: { kind: 'file'; path: string } | { kind: 'none' };
  prefetch?: {
    argv: string[];
    command: RustDependencyPrefetchCommand;
    timeoutSeconds: number;
    networkMode: 'bridge';
  };
  docker: {
    argv: string[];
    timeoutSeconds: number;
    networkPolicy: RustSandboxPolicy['network'];
  };
  oracleCommands: string[];
}

export interface RustSandboxRunPlanInput {
  task: RustTask;
  runRoot: string;
  runId: string;
  patchFile?: string;
}

type RustDependencyPrefetchCommand = 'cargo fetch --locked' | 'cargo fetch';

interface RustDockerArgvInput {
  task: RustTask;
  worktree: string;
  cacheVolumeName: string;
  cidFile: string;
  oracleCommands: string[];
  networkMode: 'none' | 'bridge';
}

export function buildRustSandboxRunPlan(input: RustSandboxRunPlanInput): RustSandboxRunPlan {
  const runId = safePathSegment(input.runId, 'runId');
  const source = join(input.runRoot, runId, 'source');
  const worktree = join(input.runRoot, runId, 'worktree');
  const cache = join(input.runRoot, runId, 'cache');
  const cacheVolumeName = `safeword-rust-${runId}-cache`;
  const oracleCommands = commandsForTask(input.task);
  const prefetch = buildDependencyPrefetch(input.task, worktree, cacheVolumeName, cache);
  const dockerArgv = buildDockerArgv({
    task: input.task,
    worktree,
    cacheVolumeName,
    cidFile: join(cache, 'oracle.cid'),
    oracleCommands,
    networkMode: 'none',
  });
  const steps: RustSandboxStep[] = [
    {
      kind: 'checkout',
      repositoryUrl: input.task.repository.url,
      ref: input.task.repository.ref,
      destination: source,
    },
    {
      kind: 'copy-worktree',
      source,
      destination: worktree,
    },
    {
      kind: 'prepare-cache',
      path: cache,
      volumeName: cacheVolumeName,
    },
    ...(prefetch ? [{ kind: 'dependency-prefetch' as const, argv: prefetch.argv }] : []),
    ...(input.patchFile
      ? [
          {
            kind: 'apply-patch' as const,
            patchFile: input.patchFile,
            cwd: worktree,
          },
        ]
      : []),
    {
      kind: 'docker-run',
      argv: dockerArgv,
    },
    {
      kind: 'cleanup-cache',
      volumeName: cacheVolumeName,
    },
  ];

  return {
    taskId: input.task.id,
    paths: { source, worktree, cache },
    cache: {
      kind: 'docker-volume',
      name: cacheVolumeName,
      target: '/workspace/cache',
    },
    steps,
    patch: input.patchFile ? { kind: 'file', path: input.patchFile } : { kind: 'none' },
    ...(prefetch ? { prefetch } : {}),
    docker: {
      argv: dockerArgv,
      timeoutSeconds: input.task.sandbox.timeoutSeconds,
      networkPolicy: input.task.sandbox.network,
    },
    oracleCommands,
  };
}

function commandsForTask(task: RustTask): string[] {
  if (!task.commands.includes(task.oracle.command)) {
    throw new Error(`oracle command is not allowed for task ${task.id}: ${task.oracle.command}`);
  }

  return [task.oracle.command];
}

function buildDockerArgv(input: RustDockerArgvInput): string[] {
  const { task, worktree, cacheVolumeName, cidFile, oracleCommands, networkMode } = input;
  const repoMount = task.sandbox.mounts.find(
    mount => mount.purpose === 'repo' && mount.mode === 'ro',
  );
  const scratchMount = task.sandbox.mounts.find(
    mount => mount.purpose === 'scratch' && mount.mode === 'rw',
  );

  if (!repoMount || !scratchMount) {
    throw new Error(`task ${task.id} must define read-only repo and writable scratch mounts`);
  }

  const scratchWorktree = `${scratchMount.target}/repo`;

  return [
    'docker',
    'run',
    '--rm',
    '--cidfile',
    cidFile,
    '--network',
    networkMode,
    '--cpus',
    String(task.sandbox.resources.cpus),
    '--memory',
    `${task.sandbox.resources.memoryMb}m`,
    '--user',
    '1000:1000',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--env',
    'HOME=/workspace/scratch',
    '--env',
    'CARGO_HOME=/workspace/cache/cargo-home',
    '--env',
    'CARGO_TARGET_DIR=/workspace/cache/target',
    '--env',
    'TMPDIR=/workspace/scratch/tmp',
    '--mount',
    `type=bind,source=${worktree},target=${repoMount.target},readonly`,
    '--mount',
    `type=volume,source=${cacheVolumeName},target=/workspace/cache`,
    '--tmpfs',
    `${scratchMount.target}:rw,exec,mode=1777`,
    '--workdir',
    scratchMount.target,
    task.sandbox.runner.image,
    '/bin/bash',
    '-c',
    [
      'set -euo pipefail',
      `mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR" "$TMPDIR" "${scratchWorktree}"`,
      `cp -a "${repoMount.target}/." "${scratchWorktree}"`,
      `cd "${scratchWorktree}"`,
      ...oracleCommands,
    ].join('\n'),
  ];
}

function buildDependencyPrefetch(
  task: RustTask,
  worktree: string,
  cacheVolumeName: string,
  cacheStatePath: string,
):
  | {
      argv: string[];
      command: RustDependencyPrefetchCommand;
      timeoutSeconds: number;
      networkMode: 'bridge';
    }
  | undefined {
  if (task.sandbox.network === 'none') return undefined;
  if (task.sandbox.network === 'prefetch-only') {
    const command = prefetchCommandForTask(task);
    return {
      argv: buildDockerArgv({
        task,
        worktree,
        cacheVolumeName,
        cidFile: join(cacheStatePath, 'prefetch.cid'),
        oracleCommands: [command],
        networkMode: 'bridge',
      }),
      command,
      timeoutSeconds: task.sandbox.timeoutSeconds,
      networkMode: 'bridge',
    };
  }

  throw new Error(`unsupported network policy: ${String(task.sandbox.network)}`);
}

function prefetchCommandForTask(task: RustTask): RustDependencyPrefetchCommand {
  return task.oracle.command.includes('--locked') ? 'cargo fetch --locked' : 'cargo fetch';
}

function safePathSegment(raw: string, name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(raw) || raw === '.' || raw === '..') {
    throw new Error(`${name} must be a safe path segment`);
  }

  return raw;
}
