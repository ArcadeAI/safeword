import { buildRustSandboxRunPlan } from '../src/executor';
import { validateRustTaskManifest } from '../src/dataset';

const dockerImage =
  'rust:1.96@sha256:6df234c1eb92b0545468fab8c18fc5f9adfb994e7d4f67d81d45fe2fcabf5657';

const task = () =>
  validateRustTaskManifest({
    tasks: [
      {
        id: 'fd-fix-hidden-files',
        repository: {
          id: 'sharkdp/fd',
          url: 'https://github.com/sharkdp/fd',
          ref: '3b3e328b5c15b019d25692e8686aafd9f9b69282',
        },
        split: 'train',
        prompt: 'Fix the hidden-file traversal regression without changing public CLI semantics.',
        sandbox: {
          runner: { kind: 'docker', image: dockerImage },
          timeoutSeconds: 900,
          resources: { cpus: 2, memoryMb: 4096 },
          network: 'none',
          mounts: [
            { purpose: 'repo', target: '/workspace/repo', mode: 'ro' },
            { purpose: 'scratch', target: '/workspace/scratch', mode: 'rw' },
          ],
          allowDockerSocket: false,
          privileged: false,
          userIsolation: 'non-root',
        },
        commands: ['cargo test --locked'],
        oracle: { kind: 'cargo-test', command: 'cargo test --locked' },
      },
    ],
  })[0];

const prefetchOnlyTask = () =>
  validateRustTaskManifest({
    tasks: [
      {
        ...task(),
        sandbox: {
          ...task().sandbox,
          network: 'prefetch-only',
        },
      },
    ],
  })[0];

describe('buildRustSandboxRunPlan', () => {
  it('plans pinned checkout, worktree copy, patch apply, and oracle execution order', () => {
    const plan = buildRustSandboxRunPlan({
      task: task(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-001',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.paths.source).toBe('/tmp/safeword-rust-runs/run-001/source');
    expect(plan.paths.worktree).toBe('/tmp/safeword-rust-runs/run-001/worktree');
    expect(plan.paths.cache).toBe('/tmp/safeword-rust-runs/run-001/cache');
    expect(plan.steps.map(step => step.kind)).toEqual([
      'checkout',
      'copy-worktree',
      'prepare-cache',
      'apply-patch',
      'docker-run',
      'cleanup-cache',
    ]);
    expect(plan.steps[0]).toMatchObject({
      kind: 'checkout',
      repositoryUrl: 'https://github.com/sharkdp/fd',
      ref: '3b3e328b5c15b019d25692e8686aafd9f9b69282',
      destination: '/tmp/safeword-rust-runs/run-001/source',
    });
    expect(plan.steps[3]).toMatchObject({
      kind: 'apply-patch',
      patchFile: '/tmp/candidate.patch',
      cwd: '/tmp/safeword-rust-runs/run-001/worktree',
    });
    expect(plan.oracleCommands).toEqual(['cargo test --locked']);
  });

  it('omits patch application for no-patch baseline plans', () => {
    const plan = buildRustSandboxRunPlan({
      task: task(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-baseline',
    });

    expect(plan.steps.map(step => step.kind)).toEqual([
      'checkout',
      'copy-worktree',
      'prepare-cache',
      'docker-run',
      'cleanup-cache',
    ]);
    expect(plan.patch).toEqual({ kind: 'none' });
  });

  it('plans dependency prefetch before patch application when network policy allows it', () => {
    const plan = buildRustSandboxRunPlan({
      task: prefetchOnlyTask(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-prefetch',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.steps.map(step => step.kind)).toEqual([
      'checkout',
      'copy-worktree',
      'prepare-cache',
      'dependency-prefetch',
      'apply-patch',
      'docker-run',
      'cleanup-cache',
    ]);
    expect(plan.prefetch).toMatchObject({
      command: 'cargo fetch --locked',
      timeoutSeconds: 900,
      networkMode: 'bridge',
    });
    expect(plan.prefetch?.argv).toEqual(expect.arrayContaining(['--network', 'bridge']));
    expect(plan.prefetch?.argv).toEqual(
      expect.arrayContaining([
        '--cidfile',
        '/tmp/safeword-rust-runs/run-prefetch/cache/prefetch.cid',
      ]),
    );
    expect(plan.cache).toEqual({
      kind: 'docker-volume',
      name: 'safeword-rust-run-prefetch-cache',
      target: '/workspace/cache',
    });
    expect(plan.prefetch?.argv.join(' ')).toContain('cargo fetch --locked');
    expect(plan.prefetch?.argv.join(' ')).toContain('CARGO_HOME=/workspace/cache/cargo-home');
  });

  it('uses unlocked dependency prefetch for tasks without a locked oracle', () => {
    const unlockedTask = validateRustTaskManifest({
      tasks: [
        {
          ...prefetchOnlyTask(),
          commands: ['cargo test --workspace'],
          oracle: { kind: 'cargo-test', command: 'cargo test --workspace' },
        },
      ],
    })[0];

    const plan = buildRustSandboxRunPlan({
      task: unlockedTask,
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-unlocked-prefetch',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.prefetch?.command).toBe('cargo fetch');
    expect(plan.prefetch?.argv.join(' ')).toContain('cargo fetch');
    expect(plan.prefetch?.argv.join(' ')).not.toContain('cargo fetch --locked');
  });

  it('builds a Docker command with resource limits and no unsafe host access', () => {
    const plan = buildRustSandboxRunPlan({
      task: task(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-001',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.docker.timeoutSeconds).toBe(900);
    expect(plan.docker.argv).toEqual(
      expect.arrayContaining([
        'docker',
        'run',
        '--rm',
        '--cidfile',
        '/tmp/safeword-rust-runs/run-001/cache/oracle.cid',
        '--network',
        'none',
        '--cpus',
        '2',
        '--memory',
        '4096m',
        '--user',
        '1000:1000',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--workdir',
        '/workspace/scratch',
        dockerImage,
      ]),
    );
    expect(plan.docker.argv).not.toContain('timeout');
    expect(plan.docker.argv).toContain(
      'type=bind,source=/tmp/safeword-rust-runs/run-001/worktree,target=/workspace/repo,readonly',
    );
    expect(plan.docker.argv).toContain(
      'type=volume,source=safeword-rust-run-001-cache,target=/workspace/cache',
    );
    expect(plan.docker.argv.join(' ')).not.toContain(
      'type=bind,source=/tmp/safeword-rust-runs/run-001/cache,target=/workspace/cache',
    );
    expect(plan.docker.argv).toEqual(
      expect.arrayContaining(['--tmpfs', '/workspace/scratch:rw,exec,mode=1777']),
    );
    const bashIndex = plan.docker.argv.indexOf('/bin/bash');
    expect(plan.docker.argv.slice(bashIndex, bashIndex + 2)).toEqual(['/bin/bash', '-c']);
    expect(plan.docker.argv).not.toContain('-lc');
    expect(plan.docker.argv.join(' ')).toContain(
      'mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR" "$TMPDIR" "/workspace/scratch/repo"',
    );
    expect(plan.docker.argv.join(' ')).toContain(
      'cp -a "/workspace/repo/." "/workspace/scratch/repo"',
    );
    expect(plan.docker.argv.join(' ')).toContain('cd "/workspace/scratch/repo"');
    expect(plan.docker.argv.join(' ')).toContain('cargo test --locked');
    expect(plan.docker.argv).not.toContain('--privileged');
    expect(plan.docker.argv.join(' ')).not.toContain('/var/run/docker.sock');
  });

  it('creates and cleans up a per-run Docker cache volume', () => {
    const plan = buildRustSandboxRunPlan({
      task: task(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-001',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.steps).toEqual(
      expect.arrayContaining([
        {
          kind: 'prepare-cache',
          path: '/tmp/safeword-rust-runs/run-001/cache',
          volumeName: 'safeword-rust-run-001-cache',
          image: dockerImage,
        },
        {
          kind: 'cleanup-cache',
          volumeName: 'safeword-rust-run-001-cache',
        },
      ]),
    );
  });

  it('runs the Docker oracle phase with no network after prefetch policy handling', () => {
    const plan = buildRustSandboxRunPlan({
      task: prefetchOnlyTask(),
      runRoot: '/tmp/safeword-rust-runs',
      runId: 'run-prefetch',
      patchFile: '/tmp/candidate.patch',
    });

    expect(plan.docker.networkPolicy).toBe('prefetch-only');
    expect(plan.docker.argv).toEqual(expect.arrayContaining(['--network', 'none']));
    expect(plan.docker.argv).not.toContain('prefetch-only');
    expect(plan.docker.argv.join(' ')).toContain('CARGO_HOME=/workspace/cache/cargo-home');
  });

  it('rejects run ids that would escape the run root', () => {
    expect(() =>
      buildRustSandboxRunPlan({
        task: task(),
        runRoot: '/tmp/safeword-rust-runs',
        runId: '../escape',
        patchFile: '/tmp/candidate.patch',
      }),
    ).toThrow(/runId must be a safe path segment/);
  });
});
