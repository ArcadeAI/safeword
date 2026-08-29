import { execFile } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveHostToolchain } from '../../templates/hooks/lib/host-toolchain.ts';

const execFileAsync = promisify(execFile);
const HOST_TOOLCHAIN_MODULE = path.resolve(
  __dirname,
  '../../templates/hooks/lib/host-toolchain.ts',
);
const LINT_MODULE = path.resolve(__dirname, '../../templates/hooks/lib/lint.ts');

async function runLintFile(
  projectRoot: string,
  file: string,
  environment: NodeJS.ProcessEnv = {},
): Promise<{ warnings: string[]; errors?: string }> {
  const script = `
    const { lintFile } = await import(${JSON.stringify(LINT_MODULE)});
    console.log(JSON.stringify(await lintFile(${JSON.stringify(file)}, ${JSON.stringify(projectRoot)})));
  `;
  const { stdout } = await execFileAsync('bun', ['-e', script], {
    cwd: projectRoot,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot, ...environment },
  });
  return JSON.parse(stdout) as { warnings: string[]; errors?: string };
}

describe('host JavaScript toolchain resolution', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('uses a nested Biome owner with a root-hoisted local executable', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-'));
    directories.push(projectRoot);
    const workspace = path.join(projectRoot, 'apps', 'web');
    const file = path.join(workspace, 'src', 'component.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    mkdirSync(path.dirname(file), { recursive: true });
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(path.join(workspace, 'biome.jsonc'), '{\n  "linter": {}\n}\n');
    writeFileSync(file, 'export const component = 1;\n');
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);

    expect(resolveHostToolchain(file, projectRoot)).toEqual({
      kind: 'biome',
      cwd: realpathSync(workspace),
      executable: path.join(realpathSync(projectRoot), 'node_modules', '.bin', 'biome'),
      relativeFile: 'src/component.ts',
    });
  });

  it.each(['biome.json', 'biome.jsonc', '.biome.json', '.biome.jsonc'])(
    'recognizes direct Biome from %s',
    configFile => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-config-'));
      directories.push(projectRoot);
      const file = path.join(projectRoot, 'source.ts');
      const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
      mkdirSync(path.dirname(executable), { recursive: true });
      writeFileSync(path.join(projectRoot, configFile), '{}\n');
      writeFileSync(file, 'export const source = 1;\n');
      writeFileSync(executable, '#!/bin/sh\nexit 0\n');
      chmodSync(executable, 0o755);

      expect(resolveHostToolchain(file, projectRoot)).toMatchObject({ kind: 'biome' });
    },
  );

  it('keeps a malformed nested Biome config as the nearest owner and surfaces its diagnostic', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-invalid-nested-'));
    directories.push(projectRoot);
    const workspace = path.join(projectRoot, 'apps', 'web');
    const file = path.join(workspace, 'source.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(executable), { recursive: true });
    mkdirSync(workspace, { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(path.join(workspace, 'biome.json'), '{ invalid nested config\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(
      executable,
      `#!/bin/sh\nprintf '%s|%s\\n' "$PWD" "$*" >> ${JSON.stringify(log)}\necho nested biome config is invalid >&2\nexit 1\n`,
    );
    chmodSync(executable, 0o755);

    expect(resolveHostToolchain(file, projectRoot)).toMatchObject({
      kind: 'biome',
      cwd: realpathSync(workspace),
      relativeFile: 'source.ts',
    });
    expect(await runLintFile(projectRoot, file)).toMatchObject({
      errors: 'nested biome config is invalid',
    });
    expect(readFileSync(log, 'utf8').trim()).toBe(
      `${realpathSync(workspace)}|check --write -- source.ts`,
    );
  });

  it('does not select a sibling workspace Biome owner', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-sibling-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, 'apps', 'api', 'source.ts');
    const sibling = path.join(projectRoot, 'apps', 'web');
    const siblingExecutable = path.join(sibling, 'node_modules', '.bin', 'biome');
    mkdirSync(path.dirname(file), { recursive: true });
    mkdirSync(path.dirname(siblingExecutable), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(path.join(sibling, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(siblingExecutable, '#!/bin/sh\nexit 0\n');
    chmodSync(siblingExecutable, 0o755);

    expect(resolveHostToolchain(file, projectRoot)).toMatchObject({
      kind: 'unavailable',
      cwd: realpathSync(projectRoot),
      owner: 'biome',
    });
  });

  it('uses an existing Ultracite installation without changing project-owned files', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-ownership-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, 'source.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'ultracite');
    const ownedPaths = [
      path.join(projectRoot, 'biome.jsonc'),
      path.join(projectRoot, 'package.json'),
      path.join(projectRoot, '.vscode', 'settings.json'),
      path.join(projectRoot, '.claude', 'settings.json'),
    ] as const;
    mkdirSync(path.dirname(executable), { recursive: true });
    mkdirSync(path.dirname(ownedPaths[2]), { recursive: true });
    mkdirSync(path.dirname(ownedPaths[3]), { recursive: true });
    writeFileSync(ownedPaths[0], '{ "extends": ["ultracite/core"] }\n');
    writeFileSync(ownedPaths[1], '{ "devDependencies": { "ultracite": "7.0.0" } }\n');
    writeFileSync(ownedPaths[2], '{ "editor.formatOnSave": true }\n');
    writeFileSync(ownedPaths[3], '{ "hooks": {} }\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    const before = ownedPaths.map(ownedPath => readFileSync(ownedPath, 'utf8'));
    await runLintFile(projectRoot, file);

    expect(ownedPaths.map(ownedPath => readFileSync(ownedPath, 'utf8'))).toEqual(before);
  });

  it.each([
    { configurationFile: 'biome.json', preset: 'ultracite/core', commented: false },
    { configurationFile: '.biome.json', preset: 'ultracite/core', commented: false },
    { configurationFile: 'biome.jsonc', preset: 'ultracite/biome/core', commented: true },
    { configurationFile: '.biome.jsonc', preset: 'ultracite/biome/core', commented: true },
  ])(
    'recognizes $configurationFile with $preset before direct Biome',
    async ({ configurationFile, preset, commented }) => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-jsonc-'));
      directories.push(projectRoot);
      const workspace = path.join(projectRoot, 'apps', 'web');
      const file = path.join(workspace, 'source.ts');
      const executable = path.join(workspace, 'node_modules', '.bin', 'ultracite');
      mkdirSync(path.dirname(executable), { recursive: true });
      writeFileSync(
        path.join(workspace, configurationFile),
        commented
          ? `{\n  // host preset\n  "extends": ["${preset}",],\n}\n`
          : `${JSON.stringify({ extends: [preset] })}\n`,
      );
      writeFileSync(file, 'export const source = 1;\n');
      writeFileSync(executable, '#!/bin/sh\nexit 0\n');
      chmodSync(executable, 0o755);
      const script = `
      const { resolveHostToolchain } = await import(${JSON.stringify(HOST_TOOLCHAIN_MODULE)});
      console.log(JSON.stringify(resolveHostToolchain(${JSON.stringify(file)}, ${JSON.stringify(projectRoot)})));
    `;

      const { stdout } = await execFileAsync('bun', ['-e', script]);
      const result = JSON.parse(stdout) as { kind: string; relativeFile: string };

      expect(result).toMatchObject({ kind: 'ultracite', relativeFile: 'source.ts' });
    },
  );

  it('rejects a Biome configuration symlink that resolves outside the project root', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-contained-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'host-toolchain-outside-'));
    directories.push(projectRoot, outside);
    const file = path.join(projectRoot, 'source.ts');
    const outsideConfig = path.join(outside, 'biome.json');
    mkdirSync(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(outsideConfig, '{}\n');
    symlinkSync(outsideConfig, path.join(projectRoot, 'biome.json'));

    expect(resolveHostToolchain(file, projectRoot)).toBeUndefined();
  });

  it('warns and skips every formatter when an edited-file symlink resolves outside the project root', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-file-escape-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'host-toolchain-file-escape-outside-'));
    const globalBin = mkdtempSync(path.join(tmpdir(), 'host-toolchain-file-escape-bin-'));
    directories.push(projectRoot, outside, globalBin);
    const outsideFile = path.join(outside, 'source.ts');
    const linkedFile = path.join(projectRoot, 'linked.ts');
    const hostExecutable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    const hostLog = path.join(projectRoot, 'host-invocations.log');
    const genericLog = path.join(projectRoot, 'generic-invocations.log');
    mkdirSync(path.dirname(hostExecutable), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(outsideFile, 'export const source = 1;\n');
    symlinkSync(outsideFile, linkedFile);
    writeFileSync(hostExecutable, `#!/bin/sh\necho host >> ${JSON.stringify(hostLog)}\n`);
    writeFileSync(
      path.join(globalBin, 'bunx'),
      `#!/bin/sh\necho generic >> ${JSON.stringify(genericLog)}\n`,
    );
    chmodSync(hostExecutable, 0o755);
    chmodSync(path.join(globalBin, 'bunx'), 0o755);
    expect(
      await runLintFile(projectRoot, linkedFile, {
        PATH: `${globalBin}:${process.env.PATH ?? ''}`,
      }),
    ).toMatchObject({
      warnings: [expect.stringMatching(/outside.*Safeword project root/i)],
    });
    expect(() => readFileSync(hostLog, 'utf8')).toThrow();
    expect(() => readFileSync(genericLog, 'utf8')).toThrow();
  });

  it('rejects a local launcher symlink that resolves outside the project root', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-executable-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'host-toolchain-executable-outside-'));
    directories.push(projectRoot, outside);
    const file = path.join(projectRoot, 'source.ts');
    const outsideBiome = path.join(outside, 'biome');
    const launcher = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    mkdirSync(path.dirname(launcher), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(outsideBiome, '#!/bin/sh\nexit 0\n');
    chmodSync(outsideBiome, 0o755);
    symlinkSync(outsideBiome, launcher);

    expect(resolveHostToolchain(file, projectRoot)).toMatchObject({
      kind: 'unavailable',
      owner: 'biome',
    });
  });

  it('runs direct Biome as exact argv arrays in owner cwd without hostile overrides', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-runner-'));
    directories.push(projectRoot);
    const workspace = path.join(projectRoot, 'apps', 'web');
    const file = path.join(workspace, 'src', '-generated.ts');
    const executable = path.join(workspace, 'node_modules', '.bin', 'biome');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(file), { recursive: true });
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(file, 'export const component = 1;\n');
    writeFileSync(
      executable,
      `#!/bin/sh\nprintf '%s|%s|%s|%s\\n' "$PWD" "$*" "\${BIOME_CONFIG_PATH-unset}" "\${BIOME_BINARY-unset}" >> ${JSON.stringify(log)}\n`,
    );
    chmodSync(executable, 0o755);
    const script = `
      const { runHostToolchain } = await import(${JSON.stringify(HOST_TOOLCHAIN_MODULE)});
      await runHostToolchain({
        kind: 'biome', cwd: ${JSON.stringify(workspace)}, executable: ${JSON.stringify(executable)}, relativeFile: 'src/-generated.ts',
      });
    `;

    await execFileAsync('bun', ['-e', script], {
      env: { ...process.env, BIOME_CONFIG_PATH: '/outside/config', BIOME_BINARY: '/outside/biome' },
    });

    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      `${realpathSync(workspace)}|check --write -- src/-generated.ts|unset|unset`,
      `${realpathSync(workspace)}|check -- src/-generated.ts|unset|unset`,
    ]);
  });

  it('routes a direct-Biome edit through lintFile instead of Safeword ESLint', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-lint-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, 'source.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\n`);
    chmodSync(executable, 0o755);
    expect(await runLintFile(projectRoot, file, { SAFEWORD_NO_AUTO_UPGRADE: '1' })).toEqual({
      warnings: [],
    });
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'check --write -- source.ts',
      'check -- source.ts',
    ]);
  });

  it('keeps a config-excluded file with its selected Biome owner', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-excluded-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, 'generated.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(
      path.join(projectRoot, 'biome.json'),
      '{ "files": { "includes": ["!generated.ts"] } }\n',
    );
    writeFileSync(file, 'export const generated = 1;\n');
    writeFileSync(executable, `#!/bin/sh\necho "$*" >> ${JSON.stringify(log)}\n`);
    chmodSync(executable, 0o755);
    await runLintFile(projectRoot, file);

    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'check --write -- generated.ts',
      'check -- generated.ts',
    ]);
  });

  it('warns instead of using a PATH Biome when the recognized owner lacks a local executable', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-missing-'));
    const globalBin = mkdtempSync(path.join(tmpdir(), 'host-toolchain-global-'));
    directories.push(projectRoot, globalBin);
    const file = path.join(projectRoot, 'source.ts');
    const log = path.join(projectRoot, 'global-invocations.log');
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const source = 1;\n');
    const globalBiome = path.join(globalBin, 'biome');
    writeFileSync(globalBiome, `#!/bin/sh\necho invoked >> ${JSON.stringify(log)}\n`);
    chmodSync(globalBiome, 0o755);
    expect(
      await runLintFile(projectRoot, file, { PATH: `${globalBin}:${process.env.PATH ?? ''}` }),
    ).toMatchObject({
      warnings: [expect.stringMatching(/no project-local executable/i)],
    });
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('surfaces a failing final Biome check through lintFile', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-diagnostic-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, 'source.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(
      executable,
      '#!/bin/sh\nif [ "$1" = "check" ] && [ "$2" != "--write" ]; then echo source.ts: failed-check >&2; exit 1; fi\n',
    );
    chmodSync(executable, 0o755);
    expect(await runLintFile(projectRoot, file)).toMatchObject({
      errors: 'source.ts: failed-check',
    });
  });

  it('excludes a Safeword-owned generated JavaScript file from host dispatch', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-generated-'));
    directories.push(projectRoot);
    const file = path.join(projectRoot, '.safeword', 'generated.ts');
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(file), { recursive: true });
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{}\n');
    writeFileSync(file, 'export const generated = 1;\n');
    writeFileSync(executable, `#!/bin/sh\necho invoked >> ${JSON.stringify(log)}\n`);
    chmodSync(executable, 0o755);
    expect(await runLintFile(projectRoot, file)).toEqual({ warnings: [] });
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it.each([
    { preset: 'legacy v6', configuration: 'ultracite/core' },
    { preset: 'current', configuration: 'ultracite/biome/core' },
  ])(
    'runs the $preset Ultracite preset through exact fix and check argv arrays',
    async testCase => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-ultracite-'));
      directories.push(projectRoot);
      const workspace = path.join(projectRoot, 'apps', 'web');
      const file = path.join(workspace, '-generated.ts');
      const executable = path.join(workspace, 'node_modules', '.bin', 'ultracite');
      const log = path.join(projectRoot, 'invocations.log');
      mkdirSync(path.dirname(executable), { recursive: true });
      writeFileSync(
        path.join(workspace, 'biome.json'),
        JSON.stringify({ extends: [testCase.configuration] }),
      );
      writeFileSync(file, 'export const generated = 1;\n');
      writeFileSync(
        executable,
        `#!/bin/sh\nprintf '%s|%s|%s|%s\\n' "$PWD" "$*" "\${BIOME_CONFIG_PATH-unset}" "\${BIOME_BINARY-unset}" >> ${JSON.stringify(log)}\n`,
      );
      chmodSync(executable, 0o755);
      const script = `
      const { resolveHostToolchain, runHostToolchain } = await import(${JSON.stringify(HOST_TOOLCHAIN_MODULE)});
      await runHostToolchain(resolveHostToolchain(${JSON.stringify(file)}, ${JSON.stringify(projectRoot)}));
    `;

      await execFileAsync('bun', ['-e', script], {
        env: {
          ...process.env,
          BIOME_CONFIG_PATH: '/outside/config',
          BIOME_BINARY: '/outside/biome',
        },
      });

      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
        `${realpathSync(workspace)}|fix -- -generated.ts|unset|unset`,
        `${realpathSync(workspace)}|check -- -generated.ts|unset|unset`,
      ]);
    },
  );

  it('lets project-local Ultracite invoke its sibling project-local Biome', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-ultracite-child-'));
    const globalBin = mkdtempSync(path.join(tmpdir(), 'host-toolchain-ultracite-global-'));
    directories.push(projectRoot, globalBin);
    const file = path.join(projectRoot, 'source.ts');
    const localBin = path.join(projectRoot, 'node_modules', '.bin');
    const ultracitePackage = path.join(projectRoot, 'node_modules', 'ultracite', 'cli.sh');
    const localBiomeLog = path.join(projectRoot, 'local-biome.log');
    const globalBiomeLog = path.join(projectRoot, 'global-biome.log');
    mkdirSync(localBin, { recursive: true });
    mkdirSync(path.dirname(ultracitePackage), { recursive: true });
    writeFileSync(path.join(projectRoot, 'biome.json'), '{ "extends": ["ultracite/core"] }\n');
    writeFileSync(file, 'export const source = 1;\n');
    writeFileSync(ultracitePackage, '#!/bin/sh\nbiome "$@"\n');
    writeFileSync(
      path.join(localBin, 'biome'),
      `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(localBiomeLog)}\n`,
    );
    writeFileSync(
      path.join(globalBin, 'biome'),
      `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(globalBiomeLog)}\nexit 1\n`,
    );
    chmodSync(ultracitePackage, 0o755);
    chmodSync(path.join(localBin, 'biome'), 0o755);
    chmodSync(path.join(globalBin, 'biome'), 0o755);
    symlinkSync(ultracitePackage, path.join(localBin, 'ultracite'));

    expect(
      await runLintFile(projectRoot, file, {
        PATH: `${globalBin}:${process.env.PATH ?? ''}`,
      }),
    ).toEqual({ warnings: [] });
    expect(readFileSync(localBiomeLog, 'utf8').trim().split('\n')).toEqual([
      'fix -- source.ts',
      'check -- source.ts',
    ]);
    expect(() => readFileSync(globalBiomeLog, 'utf8')).toThrow();
  });

  it('surfaces a failed host fix without running the later check', async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'host-toolchain-failure-'));
    directories.push(projectRoot);
    const executable = path.join(projectRoot, 'node_modules', '.bin', 'ultracite');
    const log = path.join(projectRoot, 'invocations.log');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(
      executable,
      `#!/bin/sh\necho "$*" >> ${JSON.stringify(log)}\necho fix-failed >&2\nexit 1\n`,
    );
    chmodSync(executable, 0o755);
    const script = `
      const { runHostToolchain } = await import(${JSON.stringify(HOST_TOOLCHAIN_MODULE)});
      console.log(JSON.stringify(await runHostToolchain({
        kind: 'ultracite', cwd: ${JSON.stringify(projectRoot)}, executable: ${JSON.stringify(executable)}, relativeFile: 'source.ts',
      })));
    `;

    const { stdout } = await execFileAsync('bun', ['-e', script]);

    expect(JSON.parse(stdout) as { errors?: string }).toMatchObject({ errors: 'fix-failed' });
    expect(readFileSync(log, 'utf8').trim()).toBe('fix -- source.ts');
  });
});
