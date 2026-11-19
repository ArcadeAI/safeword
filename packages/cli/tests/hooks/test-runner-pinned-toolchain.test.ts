import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  let originalEnvironment: Record<string, string | undefined>;

  /** A fake `mise` that answers `mise -C <project> bin-paths` with the pinned bin directory. */
  function installFakeMise(behavior: 'pinned' | 'fails'): void {
    const fakeMiseDirectory = path.join(root, 'mise-bin');
    mkdirSync(fakeMiseDirectory, { recursive: true });
    const answer =
      behavior === 'pinned'
        ? `[ "$1" = "-C" ] && [ "$2" = "${project}" ] && [ "$3" = "bin-paths" ] && echo "${pinnedBin}" && exit 0\nexit 3`
        : `echo "mise ERROR Config files in ${project}/mise.toml are not trusted." >&2\nexit 1`;
    const fakeMise = path.join(fakeMiseDirectory, 'mise');
    writeFileSync(fakeMise, `#!/bin/sh\necho "$@" >> "${miseCalls}"\n${answer}\n`);
    chmodSync(fakeMise, 0o755);
    process.env.PATH = [staleBin, fakeMiseDirectory, process.env.PATH].join(path.delimiter);
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
    for (const directory of [project, pinnedBin, staleBin])
      mkdirSync(directory, { recursive: true });
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
      SAFEWORD_FAKE_TOOLS: process.env.SAFEWORD_FAKE_TOOLS,
    };
    process.env.SAFEWORD_CLI = path.resolve(import.meta.dirname, '../../src/cli.ts');
    process.env.SAFEWORD_FAKE_TOOLS = 'all';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('puts the pinned tool directories ahead of a stale PATH entry', () => {
    writeFileSync(path.join(project, 'mise.toml'), '[tools]\nbun = "1.4.4"\n');
    installFakeMise('pinned');

    const { pinned, stale } = testCommandPathPositions();

    expect(pinned).toBeGreaterThanOrEqual(0);
    expect(pinned).toBeLessThan(stale);
  });

  it('leaves PATH alone and does not ask mise when the project pins nothing', () => {
    installFakeMise('pinned');

    const { pinned, stale } = testCommandPathPositions();

    expect(pinned).toBe(-1);
    expect(stale).toBeGreaterThanOrEqual(0);
    expect(existsSync(miseCalls)).toBe(false);
  });

  it('falls back to the inherited PATH and says why when mise cannot resolve the pin', () => {
    writeFileSync(path.join(project, 'mise.toml'), '[tools]\nbun = "1.4.4"\n');
    installFakeMise('fails');

    const { pinned, stale, output } = testCommandPathPositions();

    expect(pinned).toBe(-1);
    expect(stale).toBeGreaterThanOrEqual(0);
    expect(output).toContain('Pinned toolchain not applied');
    expect(output).toContain('are not trusted');
  });
});
