/**
 * Unit tests for the implement-phase-stop typecheck gate (ticket SW1SE5,
 * test-definitions.md Rule 1). The pure decision logic — given a project
 * dir, a list of changed files, and the current phase, decide whether to
 * run `tsc --noEmit` and which `tsconfig.json` to use (find-up).
 */

import { execSync } from 'node:child_process';
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
  changedFilesSinceHead,
  evaluateImplementStopTypecheck,
  resolveConfigCoverage,
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
      expect(result.tsconfigPaths).toEqual([nodePath.join(projectDirectory, 'tsconfig.json')]);
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
      expect(result.tsconfigPaths).toEqual([
        nodePath.join(projectDirectory, 'packages/cli/tsconfig.json'),
      ]);
    }
  });

  it('returns a config for every package that changed, not just the first', () => {
    // Regression: the gate used to return on the first changed file that found
    // any tsconfig, so a second package's types were never checked at all — a
    // silent pass, which reads as "clean".
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'packages/alpha/tsconfig.json'));
    touch(nodePath.join(projectDirectory, 'packages/beta/tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['packages/alpha/src/a.ts', 'packages/beta/src/b.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPaths).toEqual([
        nodePath.join(projectDirectory, 'packages/alpha/tsconfig.json'),
        nodePath.join(projectDirectory, 'packages/beta/tsconfig.json'),
      ]);
    }
  });

  it('ignores changed files inside node_modules', () => {
    // A project whose .gitignore misses node_modules reports vendored files as
    // changed. They are a dependency's code, never the developer's change — and
    // find-up from one lands on that dependency's own tsconfig.
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['node_modules/@cucumber/gherkin/src/index.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(false);
  });

  it('never returns a tsconfig that lives inside node_modules', () => {
    // Typechecking a dependency's config reports errors in code the developer
    // does not own and cannot fix (missing peer @types, unresolved `extends`).
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));
    touch(nodePath.join(projectDirectory, 'node_modules/@cucumber/gherkin/tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/mine.ts', 'node_modules/@cucumber/gherkin/src/index.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPaths).toEqual([nodePath.join(projectDirectory, 'tsconfig.json')]);
    }
  });

  it('deduplicates when several changed files resolve to the same config', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/a.ts', 'src/nested/b.ts', 'other/c.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPaths).toEqual([nodePath.join(projectDirectory, 'tsconfig.json')]);
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
    let isRan = false;
    const runner = (): TypecheckRunResult => {
      isRan = true;
      return { available: true, ok: false, output: 'should not be called' };
    };

    const { advice } = evaluateImplementStopTypecheck(
      { projectDirectory, changedFiles: ['src/foo.ts'], phase: 'done' },
      runner,
    );

    expect(advice).toBeNull();
    expect(isRan).toBe(false);
  });

  it('returns no advice when no tsc binary is available', () => {
    const runner = (): TypecheckRunResult => ({ available: false, ok: false, output: '' });

    expect(evaluateImplementStopTypecheck(gatePassingInput(), runner).advice).toBeNull();
  });

  it('stays silent on config-level tsc failures with no file diagnostic (e.g. TS18003)', () => {
    // tsc can fail for non-type reasons (e.g. a tsconfig that matches no files).
    // Those aren't type errors in the changed code — don't surface them.
    const runner = (): TypecheckRunResult => ({
      available: true,
      ok: false,
      output: "error TS18003: No inputs were found in config file 'tsconfig.json'.",
    });

    expect(evaluateImplementStopTypecheck(gatePassingInput(), runner).advice).toBeNull();
  });
});

describe('evaluateImplementStopTypecheck — config coverage', () => {
  const failingRunner = (): TypecheckRunResult => ({
    available: true,
    ok: false,
    output: 'packages/cli/src/other.ts(1,7): error TS2322: Type error in an untouched file.',
  });

  /** Safeword's own shape: a root config whose `include` misses the changed file. */
  function hookChangeInput(): { projectDirectory: string; changedFiles: string[]; phase: string } {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));
    return {
      projectDirectory,
      changedFiles: ['.safeword/hooks/lib/changed.ts'],
      phase: 'implement',
    };
  }

  it('does not run a config that covers none of the changed files', () => {
    // The real failure: a change under .safeword/hooks finds the root tsconfig,
    // whose include is packages/*/src/**/*. Typechecking it reported errors in
    // ~30 untouched files and checked none of the changed ones.
    let isRan = false;
    const runner = (): TypecheckRunResult => {
      isRan = true;
      return failingRunner();
    };

    const { advice } = evaluateImplementStopTypecheck(hookChangeInput(), runner, () => false);

    expect(advice).toBeNull();
    expect(isRan).toBe(false);
  });

  it('runs a config that does cover a changed file', () => {
    const { advice } = evaluateImplementStopTypecheck(hookChangeInput(), failingRunner, () => true);

    expect(advice).toContain('error TS2322');
  });

  it('runs when coverage cannot be determined, degrading to the prior behavior', () => {
    // Unknown coverage must not suppress the check: the filter is the new part,
    // so when it cannot do its job it should never hide what tsc already found.
    const coverageUnknown: boolean | undefined = undefined;

    const { advice } = evaluateImplementStopTypecheck(
      hookChangeInput(),
      failingRunner,
      () => coverageUnknown,
    );

    expect(advice).toContain('error TS2322');
  });

  it('surfaces advice from every covered config, not just the first', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'packages/alpha/tsconfig.json'));
    touch(nodePath.join(projectDirectory, 'packages/beta/tsconfig.json'));
    const runner = (_projectDirectory: string, tsconfigPath: string): TypecheckRunResult => ({
      available: true,
      ok: false,
      output: tsconfigPath.includes('alpha')
        ? 'packages/alpha/src/a.ts(1,7): error TS1111: alpha broke.'
        : 'packages/beta/src/b.ts(1,7): error TS2222: beta broke.',
    });

    const { advice } = evaluateImplementStopTypecheck(
      {
        projectDirectory,
        changedFiles: ['packages/alpha/src/a.ts', 'packages/beta/src/b.ts'],
        phase: 'implement',
      },
      runner,
      () => true,
    );

    expect(advice).toContain('alpha broke');
    expect(advice).toContain('beta broke');
  });
});

describe('resolveConfigCoverage (real tsc — integration)', () => {
  /** Root config that only includes packages/*, mirroring safeword's own layout. */
  function projectWithNarrowRootConfig(): string {
    const cliTsc = nodePath.resolve(import.meta.dirname, '../../node_modules/.bin/tsc');
    expect(existsSync(cliTsc)).toBe(true);
    const project = mkdtempSync(nodePath.join(tmpdir(), 'tccov-'));
    mkdirSync(nodePath.join(project, 'node_modules/.bin'), { recursive: true });
    symlinkSync(realpathSync(cliTsc), nodePath.join(project, 'node_modules/.bin/tsc'));
    writeFileSync(
      nodePath.join(project, 'tsconfig.json'),
      JSON.stringify({ include: ['packages/*/src/**/*'] }),
    );
    touch(nodePath.join(project, 'packages/cli/src/real.ts'));
    touch(nodePath.join(project, '.safeword/hooks/lib/changed.ts'));
    return project;
  }

  it('reports uncovered for a changed file outside the config include', () => {
    const project = projectWithNarrowRootConfig();

    const covered = resolveConfigCoverage(project, nodePath.join(project, 'tsconfig.json'), [
      '.safeword/hooks/lib/changed.ts',
    ]);

    expect(covered).toBe(false);
  });

  it('reports covered for a changed file inside the config include', () => {
    const project = projectWithNarrowRootConfig();

    const covered = resolveConfigCoverage(project, nodePath.join(project, 'tsconfig.json'), [
      'packages/cli/src/real.ts',
    ]);

    expect(covered).toBe(true);
  });

  it('returns undefined when no tsc binary exists to resolve the config', () => {
    const project = makeProject();
    touch(nodePath.join(project, 'tsconfig.json'));

    expect(
      resolveConfigCoverage(project, nodePath.join(project, 'tsconfig.json'), ['src/foo.ts']),
    ).toBeUndefined();
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

describe('changedFilesSinceHead (git diff source)', () => {
  function gitInit(directory: string): void {
    execSync('git init -q && git config user.email t@e && git config user.name t', {
      cwd: directory,
    });
  }

  it('lists modified tracked files and untracked files, relative to the repo', () => {
    const repo = mkdtempSync(nodePath.join(tmpdir(), 'tcdiff-'));
    gitInit(repo);
    writeFileSync(nodePath.join(repo, 'committed.ts'), 'export const a = 1;\n');
    execSync('git add . && git commit -qm base', { cwd: repo });
    // Modify the committed file + add a new untracked one.
    writeFileSync(nodePath.join(repo, 'committed.ts'), 'export const a = 2;\n');
    writeFileSync(nodePath.join(repo, 'fresh.ts'), 'export const b = 3;\n');

    const changed = changedFilesSinceHead(repo);

    expect(changed).toContain('committed.ts');
    expect(changed).toContain('fresh.ts');
  });

  it('returns an empty list outside a git repo (degrades, never throws)', () => {
    const notARepo = mkdtempSync(nodePath.join(tmpdir(), 'tcnogit-'));
    expect(changedFilesSinceHead(notARepo)).toEqual([]);
  });
});

describe('end-to-end: git diff → tsc → advice (Rules 2 + 4 wired)', () => {
  /** Real git repo + real tsc; commit a clean baseline, leave an erroring file uncommitted. */
  function repoWithUncommittedError(): string {
    const project = makeProjectWithRealTsc('bad.ts', 'export const x: string = "ok";\n');
    execSync('git init -q && git config user.email t@e && git config user.name t', {
      cwd: project,
    });
    // Commit a clean baseline (gitignore node_modules so the symlink isn't tracked).
    writeFileSync(nodePath.join(project, '.gitignore'), 'node_modules\n*.tsbuildinfo\n');
    execSync('git add . && git commit -qm base', { cwd: project });
    // Now introduce a type error in the tracked file (uncommitted).
    writeFileSync(nodePath.join(project, 'bad.ts'), 'export const x: string = 1;\n');
    return project;
  }

  it('surfaces the tsc error as advice when an uncommitted TS change breaks types', () => {
    const project = repoWithUncommittedError();

    const { advice } = evaluateImplementStopTypecheck({
      projectDirectory: project,
      changedFiles: changedFilesSinceHead(project),
      phase: 'implement',
    });

    expect(advice).not.toBeNull();
    expect(advice).toMatch(/bad\.ts/);
    expect(advice).toMatch(/error TS/);
  });

  it('stays silent at done phase even with the same broken change (Rule 4)', () => {
    const project = repoWithUncommittedError();

    const { advice } = evaluateImplementStopTypecheck({
      projectDirectory: project,
      changedFiles: changedFilesSinceHead(project),
      phase: 'done',
    });

    expect(advice).toBeNull();
  });
});
