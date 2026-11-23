import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runTests } from '../../templates/hooks/lib/test-runner.ts';

/**
 * The Stop hook runs inside the agent host, whose PATH can lead to a stale global runtime
 * (the desktop app's Bun 1.3.14 cannot read a lockfileVersion 3 bun.lock). A project that pins its
 * tools with mise must have its tests run with those pins, as its own git hooks do.
 */
describe('test runner with a mise-pinned project', () => {
  let root: string;
  let project: string;
  let pinnedBin: string;
  let staleBin: string;
  let miseCalls: string;
  let bunRuntimeCalls: string;
  let originalEnvironment: Record<string, string | undefined>;

  /**
   * A fake `mise` for this project: `config ls --json` reports the given configs (mise prints
   * canonical paths) and `bin-paths` prints the pinned directory, or fails like an untrusted config.
   */
  function installFakeMise(configs: { file: string; tools: string[] }[], binPaths: 'ok' | 'fails') {
    const fakeMiseDirectory = path.join(root, 'mise-bin');
    mkdirSync(fakeMiseDirectory, { recursive: true });
    const configList = JSON.stringify(
      configs.map(({ file, tools }) => ({
        path: path.isAbsolute(file) ? file : path.join(realpathSync(project), file),
        tools,
      })),
    );
    const binPathsAnswer =
      binPaths === 'ok'
        ? `echo "${pinnedBin}"`
        : `echo "mise ERROR Config files in ${project}/mise.toml are not trusted." >&2; exit 1`;
    const fakeMise = path.join(fakeMiseDirectory, 'mise');
    writeFileSync(
      fakeMise,
      [
        '#!/bin/sh',
        `echo "$@" >> "${miseCalls}"`,
        `[ "$1" = "-C" ] && [ "$2" = "${project}" ] || exit 3`,
        'case "$3" in',
        `  config) echo '${configList}' ;;`,
        `  bin-paths) ${binPathsAnswer} ;;`,
        '  *) exit 3 ;;',
        'esac',
        '',
      ].join('\n'),
    );
    chmodSync(fakeMise, 0o755);
    process.env.PATH = [staleBin, fakeMiseDirectory, process.env.PATH].join(path.delimiter);
  }

  /** Whether the runner asked mise for the pinned tool directories. */
  function askedForBinPaths(): boolean {
    return existsSync(miseCalls) && readFileSync(miseCalls, 'utf8').includes('bin-paths');
  }

  /** Which runtime directory served each `bun` the test-plan lookup started. */
  function bunRuntimesUsed(): Set<string> {
    if (!existsSync(bunRuntimeCalls)) return new Set();
    return new Set(readFileSync(bunRuntimeCalls, 'utf8').trim().split('\n'));
  }

  /**
   * Runs the project's tests and returns where the pinned and stale directories sit on the PATH
   * their command saw (-1 when absent). Positions, not the PATH, because test output is truncated.
   */
  function testCommandPathPositions(): { pinned: number; stale: number; output: string } {
    const result = runTests(project);
    expect(result.passed, result.output).toBe(true);
    const positions = /PATH_POSITIONS (\{.*\})/.exec(result.output)?.[1];
    expect(positions, result.output).toBeTypeOf('string');
    const parsed = JSON.parse(positions ?? '{}') as { pinned: number; stale: number };
    return { ...parsed, output: result.output };
  }

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'safeword-pinned-toolchain-'));
    project = path.join(root, 'project');
    pinnedBin = path.join(root, 'pinned', 'bin');
    staleBin = path.join(root, 'stale', 'bin');
    miseCalls = path.join(root, 'mise-calls.log');
    bunRuntimeCalls = path.join(root, 'bun-runtime-calls.log');
    for (const directory of [project, pinnedBin, staleBin])
      mkdirSync(directory, { recursive: true });
    // Both runtime directories carry a working `bun` that records which one ran, as the
    // desktop app's stale Bun and the pinned Bun would both answer to `bun`.
    const realBun = execFileSync('sh', ['-c', 'command -v bun'], { encoding: 'utf8' }).trim();
    for (const [label, directory] of [
      ['pinned', pinnedBin],
      ['stale', staleBin],
    ] as const) {
      const bun = path.join(directory, 'bun');
      writeFileSync(
        bun,
        `#!/bin/sh\necho ${label} >> "${bunRuntimeCalls}"\nexec "${realBun}" "$@"\n`,
      );
      chmodSync(bun, 0o755);
    }
    // A suite's progress output overflows the runner's output budget before its final line.
    const probe = [
      `for (let line = 0; line < 60; line++) console.log('progress '.repeat(10) + line);`,
      `const entries = process.env.PATH.split(${JSON.stringify(path.delimiter)});`,
      `const pinned = entries.indexOf(${JSON.stringify(pinnedBin)});`,
      `const stale = entries.indexOf(${JSON.stringify(staleBin)});`,
      `console.log('PATH_POSITIONS ' + JSON.stringify({ pinned, stale }));`,
    ].join('\n');
    writeFileSync(path.join(project, 'print-path.cjs'), probe);
    writeFileSync(path.join(project, 'package-lock.json'), '{}\n');
    writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({ scripts: { 'test:done': 'node print-path.cjs' } }),
    );
    originalEnvironment = {
      PATH: process.env.PATH,
      SAFEWORD_CLI: process.env.SAFEWORD_CLI,
      SAFEWORD_PLUGIN_CLI: process.env.SAFEWORD_PLUGIN_CLI,
      SAFEWORD_FAKE_TOOLS: process.env.SAFEWORD_FAKE_TOOLS,
    };
    // The production lookup (a plugin host's CLI run by `bun`), not the SAFEWORD_CLI test override.
    Reflect.deleteProperty(process.env, 'SAFEWORD_CLI');
    process.env.SAFEWORD_PLUGIN_CLI = path.resolve(import.meta.dirname, '../../src/cli.ts');
    process.env.SAFEWORD_FAKE_TOOLS = 'all';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  });

  const globalConfig = { file: path.join(homedir(), '.config/mise/config.toml'), tools: ['bun'] };

  it('puts the pinned tool directories ahead of a stale PATH entry', () => {
    // A pin only in mise.local.toml still counts: mise, not a file-name list, decides.
    installFakeMise([{ file: 'mise.local.toml', tools: ['bun'] }, globalConfig], 'ok');

    const { pinned, stale } = testCommandPathPositions();

    expect(pinned).toBeGreaterThanOrEqual(0);
    expect(pinned).toBeLessThan(stale);
    expect(bunRuntimesUsed()).toEqual(new Set(['pinned']));
  });

  it('leaves PATH alone when only configs outside the project pin tools', () => {
    installFakeMise([{ file: 'mise.toml', tools: [] }, globalConfig], 'ok');

    const { pinned, stale } = testCommandPathPositions();

    expect(pinned).toBe(-1);
    expect(stale).toBeGreaterThanOrEqual(0);
    expect(bunRuntimesUsed()).toEqual(new Set(['stale']));
    expect(askedForBinPaths()).toBe(false);
  });

  it('falls back to the inherited PATH and says why when mise cannot resolve the pin', () => {
    installFakeMise([{ file: 'mise.toml', tools: ['bun'] }], 'fails');

    const { pinned, stale, output } = testCommandPathPositions();

    expect(pinned).toBe(-1);
    expect(stale).toBeGreaterThanOrEqual(0);
    expect(bunRuntimesUsed()).toEqual(new Set(['stale']));
    expect(output).toContain('Pinned toolchain not applied');
    expect(output).toContain('are not trusted');
  });

  it('still says why the pin was not applied when the project has no tests to run', () => {
    installFakeMise([{ file: 'mise.toml', tools: ['bun'] }], 'fails');
    writeFileSync(path.join(project, 'package.json'), JSON.stringify({ scripts: {} }));

    const result = runTests(project);

    expect(result.skipped, result.output).toBe(true);
    expect(result.output).toContain('Pinned toolchain not applied');
    expect(result.output).toContain('are not trusted');
  });
});
