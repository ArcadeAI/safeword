import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repositoriesBySplit, validateRustTaskManifest } from '../src/dataset';

const repoRoot = join(import.meta.dirname, '../../../..');

const completeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'fd-fix-hidden-files',
  repository: {
    id: 'sharkdp/fd',
    url: 'https://github.com/sharkdp/fd',
    ref: '0123456789abcdef0123456789abcdef01234567',
  },
  split: 'train',
  prompt: 'Fix the hidden-file traversal regression without changing public CLI semantics.',
  sandbox: {
    runner: {
      kind: 'docker',
      image: 'rust:1.96@sha256:1111111111111111111111111111111111111111111111111111111111111111',
    },
    timeoutSeconds: 900,
    resources: { cpus: 2, memoryMb: 4096 },
    network: 'none',
    mounts: [
      { purpose: 'repo', target: '/workspace/repo', mode: 'ro' },
      { purpose: 'scratch', target: '/workspace/scratch', mode: 'rw' },
    ],
    allowDockerSocket: false,
    privileged: false,
    userIsolation: 'rootless',
  },
  commands: ['cargo test --locked'],
  oracle: {
    kind: 'cargo-test',
    command: 'cargo test --locked',
  },
  ...overrides,
});

describe('experiment scaffold', () => {
  it('keeps experiment dependencies out of the shipped CLI package', () => {
    const experimentPackage = JSON.parse(
      readFileSync(join(repoRoot, 'experiments/gepa-language-skills/rust/package.json'), 'utf8'),
    ) as Record<string, unknown>;
    const cliPackage = JSON.parse(
      readFileSync(join(repoRoot, 'packages/cli/package.json'), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>;

    expect(experimentPackage.private).toBe(true);
    expect(String(experimentPackage.comment)).toContain('NOT a workspace member');

    const cliDependencyNames = new Set([
      ...Object.keys(cliPackage.dependencies ?? {}),
      ...Object.keys(cliPackage.devDependencies ?? {}),
      ...Object.keys(cliPackage.optionalDependencies ?? {}),
    ]);
    for (const experimentOnly of ['gepa', 'datasets', 'litellm', 'mlflow', 'pyarrow', 'wandb']) {
      expect(cliDependencyNames.has(experimentOnly)).toBe(false);
    }
  });
});

describe('validateRustTaskManifest', () => {
  it('accepts whole-repository splits with no repository leakage', () => {
    const tasks = validateRustTaskManifest({
      tasks: [
        completeTask(),
        completeTask({
          id: 'ripgrep-validation',
          repository: {
            id: 'BurntSushi/ripgrep',
            url: 'https://github.com/BurntSushi/ripgrep',
            ref: '2222222222222222222222222222222222222222',
          },
          split: 'validation',
        }),
        completeTask({
          id: 'cargo-heldout',
          repository: {
            id: 'rust-lang/cargo',
            url: 'https://github.com/rust-lang/cargo',
            ref: '3333333333333333333333333333333333333333',
          },
          split: 'heldout',
        }),
      ],
    });

    expect(repositoriesBySplit(tasks)).toEqual({
      train: ['sharkdp/fd'],
      validation: ['BurntSushi/ripgrep'],
      heldout: ['rust-lang/cargo'],
    });
  });

  it('rejects a repository that appears in more than one split', () => {
    expect(() =>
      validateRustTaskManifest({
        tasks: [
          completeTask(),
          completeTask({
            id: 'fd-heldout',
            split: 'heldout',
          }),
        ],
      }),
    ).toThrow(/repository "sharkdp\/fd" appears in multiple splits: train, heldout/);
  });

  it('requires sandbox metadata and an executable oracle for every task', () => {
    expect(() =>
      validateRustTaskManifest({
        tasks: [
          completeTask({
            sandbox: {
              runner: {
                kind: 'docker',
                image:
                  'rust@sha256:1111111111111111111111111111111111111111111111111111111111111111',
              },
              timeoutSeconds: 0,
              resources: { cpus: 0, memoryMb: 0 },
              network: 'default',
              mounts: [{ purpose: 'repo', target: '/workspace/repo', mode: 'rw' }],
              allowDockerSocket: true,
              privileged: true,
              userIsolation: 'root',
            },
            commands: [],
            oracle: { kind: 'cargo-test', command: '' },
          }),
        ],
      }),
    ).toThrow(
      /tasks\[0\]\.sandbox\.runner\.image must include a tag and sha256 digest.*tasks\[0\]\.sandbox\.allowDockerSocket must be false.*tasks\[0\]\.sandbox\.privileged must be false.*tasks\[0\]\.oracle\.command is required/s,
    );
  });

  it('rejects digest-pinned runner images that omit the tag configuration', () => {
    expect(() =>
      validateRustTaskManifest({
        tasks: [
          completeTask({
            sandbox: {
              ...completeTask().sandbox,
              runner: {
                kind: 'docker',
                image:
                  'rust@sha256:1111111111111111111111111111111111111111111111111111111111111111',
              },
            },
          }),
        ],
      }),
    ).toThrow(/tasks\[0\]\.sandbox\.runner\.image must include a tag and sha256 digest/);
  });

  it('rejects local runners that do not prove sandbox isolation', () => {
    expect(() =>
      validateRustTaskManifest({
        tasks: [
          completeTask({
            sandbox: {
              ...completeTask().sandbox,
              runner: { kind: 'local', command: 'bash', version: '5.2.21' },
            },
          }),
        ],
      }),
    ).toThrow(/tasks\[0\]\.sandbox\.runner\.kind must be docker/);
  });

  it('rejects writable host mounts except scratch space', () => {
    expect(() =>
      validateRustTaskManifest({
        tasks: [
          completeTask({
            sandbox: {
              ...completeTask().sandbox,
              mounts: [
                { purpose: 'repo', target: '/workspace/repo', mode: 'ro' },
                { purpose: 'scratch', target: '/workspace/scratch', mode: 'rw' },
                { purpose: 'cache', target: '/workspace/cache', mode: 'rw' },
              ],
            },
          }),
        ],
      }),
    ).toThrow(/tasks\[0\]\.sandbox\.mounts\[2\]\.mode must be ro unless purpose is scratch/);
  });
});
