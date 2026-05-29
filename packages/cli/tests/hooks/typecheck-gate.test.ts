/**
 * Unit tests for the implement-phase-stop typecheck gate (ticket SW1SE5,
 * test-definitions.md Rule 1). The pure decision logic — given a project
 * dir, a list of changed files, and the current phase, decide whether to
 * run `tsc --noEmit` and which `tsconfig.json` to use (find-up).
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateImplementStopTypecheck,
  runIncrementalTypecheck,
  shouldRunTypecheck,
  type TypecheckRunResult,
} from '../../templates/hooks/lib/typecheck-gate.js';

/** Build a temp TS project whose node_modules/.bin/tsc points at the repo's real tsc. */
function makeProjectWithRealTsc(tsFileName: string, tsFileBody: string): string {
  const cliTsc = nodePath.resolve(import.meta.dirname, '../../node_modules/.bin/tsc');
  expect(existsSync(cliTsc)).toBe(true); // fail loud if tsc isn't installed (not a silent skip)
  const project = mkdtempSync(nodePath.join(tmpdir(), 'tcrun-'));
  mkdirSync(nodePath.join(project, 'node_modules/.bin'), { recursive: true });
  symlinkSync(realpathSync(cliTsc), nodePath.join(project, 'node_modules/.bin/tsc'));
  writeFileSync(
    nodePath.join(project, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true } }),
  );
  writeFileSync(nodePath.join(project, tsFileName), tsFileBody);
  return project;
}

function makeProject(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'tcgate-'));
}

function touch(absolutePath: string): void {
  mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, '');
}

describe('shouldRunTypecheck (Rule 1 — run-gate)', () => {
  it('runs when root tsconfig.json exists and a .ts file changed', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPath).toBe(nodePath.join(projectDirectory, 'tsconfig.json'));
    }
  });

  it('skips when no tsconfig.json exists anywhere above the changed file', () => {
    const projectDirectory = makeProject();
    // No tsconfig anywhere.

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(false);
  });

  it('skips when zero TS files changed this session', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['README.md', 'src/notes.json'],
      phase: 'implement',
    });

    expect(result.run).toBe(false);
  });

  it('finds a package-level tsconfig via find-up when no root tsconfig exists (monorepo)', () => {
    const projectDirectory = makeProject();
    // No root tsconfig; package-level one only.
    touch(nodePath.join(projectDirectory, 'packages/cli/tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['packages/cli/src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPath).toBe(
        nodePath.join(projectDirectory, 'packages/cli/tsconfig.json'),
      );
    }
  });

  it('treats .tsx / .mts / .cts as TypeScript files', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['App.tsx', 'node.mts', 'legacy.cts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
  });

  it('skips at done phase even when a TS file changed and tsconfig exists', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'done',
    });

    expect(result.run).toBe(false);
  });
});

describe('evaluateImplementStopTypecheck (Rules 2 + 4 — surface as advice)', () => {
  /** A gate-passing project: tsconfig present + a changed .ts file. */
  function gatePassingInput(): { projectDirectory: string; changedFiles: string[]; phase: string } {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));
    return { projectDirectory, changedFiles: ['src/foo.ts'], phase: 'implement' };
  }

  it('surfaces the tsc output as advice when the check fails (Rule 2)', () => {
    const runner = (): TypecheckRunResult => ({
      available: true,
      ok: false,
      output: 'src/foo.ts(1,7): error TS2322: Type "number" is not assignable to type "string".',
    });

    const { advice } = evaluateImplementStopTypecheck(gatePassingInput(), runner);

    expect(advice).not.toBeNull();
    expect(advice).toContain('error TS2322');
    expect(advice).toContain('src/foo.ts');
  });

  it('returns no advice when tsc passes (Rule 2 — clean)', () => {
    const runner = (): TypecheckRunResult => ({ available: true, ok: true, output: '' });

    expect(evaluateImplementStopTypecheck(gatePassingInput(), runner).advice).toBeNull();
  });

  it('does not run tsc and returns no advice at done phase (Rule 4)', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));
    let ran = false;
    const runner = (): TypecheckRunResult => {
      ran = true;
      return { available: true, ok: false, output: 'should not be called' };
    };

    const { advice } = evaluateImplementStopTypecheck(
      { projectDirectory, changedFiles: ['src/foo.ts'], phase: 'done' },
      runner,
    );

    expect(advice).toBeNull();
    expect(ran).toBe(false);
  });

  it('returns no advice when no tsc binary is available', () => {
    const runner = (): TypecheckRunResult => ({ available: false, ok: false, output: '' });

    expect(evaluateImplementStopTypecheck(gatePassingInput(), runner).advice).toBeNull();
  });
});

describe('runIncrementalTypecheck (real tsc — integration)', () => {
  it('reports a type error from a real tsc run', () => {
    const project = makeProjectWithRealTsc('bad.ts', 'const x: string = 1;\nexport {};\n');

    const result = runIncrementalTypecheck(project, nodePath.join(project, 'tsconfig.json'));

    expect(result.available).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/bad\.ts/);
    expect(result.output).toMatch(/error TS/);
  });

  it('reports ok for clean types', () => {
    const project = makeProjectWithRealTsc('good.ts', 'const x: string = "ok";\nexport { x };\n');

    const result = runIncrementalTypecheck(project, nodePath.join(project, 'tsconfig.json'));

    expect(result.available).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('reports unavailable when no tsc binary exists in the project', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'tcrun-'));
    writeFileSync(nodePath.join(project, 'tsconfig.json'), '{}');

    const result = runIncrementalTypecheck(project, nodePath.join(project, 'tsconfig.json'));

    expect(result.available).toBe(false);
  });

  it('does not write a .tsbuildinfo into the project (cache goes to temp)', () => {
    const project = makeProjectWithRealTsc('good.ts', 'export const x: string = "ok";\n');

    runIncrementalTypecheck(project, nodePath.join(project, 'tsconfig.json'));

    const stray = readdirSync(project).filter(name => name.endsWith('.tsbuildinfo'));
    expect(stray).toEqual([]);
  });
});
