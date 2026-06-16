import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { nativeTestCommand, runTests } from '../../../../.safeword/hooks/lib/test-runner';

const temporaryDirectories: string[] = [];

function makeProject(scripts: Record<string, string>): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-runner-'));
  temporaryDirectories.push(directory);
  writeFileSync(nodePath.join(directory, 'package-lock.json'), '{}\n');
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    `${JSON.stringify({ scripts }, undefined, 2)}\n`,
  );
  return directory;
}

/** Make a temp project with the given manifest files (and no package.json). */
function makeManifestProject(files: Record<string, string>): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-test-'));
  temporaryDirectories.push(directory);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(nodePath.join(directory, name), content);
  }
  return directory;
}

const allAvailable = (): boolean => true;
const noneAvailable = (): boolean => false;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('runTests', () => {
  it('blocks when the Gherkin acceptance lane fails after primary tests pass', () => {
    const project = makeProject({
      'test:done': 'node -e "console.log(\'PRIMARY_OK\')"',
      'test:bdd': 'node -e "console.error(\'BDD_FAIL\'); process.exit(1)"',
    });

    const result = runTests(project);

    expect(result.skipped).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.output).toContain('test:bdd');
    expect(result.output).toContain('BDD_FAIL');
  });

  it('passes when both primary tests and the Gherkin acceptance lane pass', () => {
    const project = makeProject({
      test: 'node -e "console.log(\'PRIMARY_OK\')"',
      'test:bdd': 'node -e "console.log(\'BDD_OK\')"',
    });

    const result = runTests(project);

    expect(result.skipped).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.output).toContain('test');
    expect(result.output).toContain('test:bdd');
  });

  it('skips when the project has no runnable test scripts', () => {
    const project = makeProject({});

    const result = runTests(project);

    expect(result).toEqual({ passed: true, output: '', skipped: true });
  });

  it('keeps the template and dogfood runner aligned', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const template = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/hooks/lib/test-runner.ts'),
      'utf8',
    );
    const dogfood = readFileSync(
      nodePath.join(repoRoot, '.safeword/hooks/lib/test-runner.ts'),
      'utf8',
    );

    expect(dogfood).toBe(template);
  });
});

describe('nativeTestCommand', () => {
  it('routes go.mod to `go test ./...` when go is available', () => {
    const project = makeManifestProject({ 'go.mod': 'module example\n' });
    expect(nativeTestCommand(project, allAvailable)).toEqual({
      script: 'go test',
      command: 'go test ./...',
    });
  });

  it('routes Cargo.toml to `cargo test` when cargo is available', () => {
    const project = makeManifestProject({ 'Cargo.toml': '[package]\nname = "x"\n' });
    expect(nativeTestCommand(project, allAvailable)).toEqual({
      script: 'cargo test',
      command: 'cargo test',
    });
  });

  it('prefers `uv run pytest` for a uv-locked Python project', () => {
    const project = makeManifestProject({ 'pyproject.toml': '', 'uv.lock': '' });
    expect(nativeTestCommand(project, allAvailable)).toEqual({
      script: 'pytest',
      command: 'uv run pytest',
    });
  });

  it('prefers `poetry run pytest` for a poetry-locked Python project', () => {
    const project = makeManifestProject({ 'pyproject.toml': '', 'poetry.lock': '' });
    expect(nativeTestCommand(project, allAvailable)).toEqual({
      script: 'pytest',
      command: 'poetry run pytest',
    });
  });

  it('falls back to bare `pytest` when the lock PM runner is unavailable', () => {
    const project = makeManifestProject({ 'pyproject.toml': '', 'uv.lock': '' });
    const onlyPytest = (tool: string): boolean => tool === 'pytest';
    expect(nativeTestCommand(project, onlyPytest)).toEqual({ script: 'pytest', command: 'pytest' });
  });

  it('skips (undefined) when a manifest is present but its toolchain is absent', () => {
    const goProject = makeManifestProject({ 'go.mod': 'module example\n' });
    const pyProject = makeManifestProject({ 'pyproject.toml': '' });
    expect(nativeTestCommand(goProject, noneAvailable)).toBeUndefined();
    expect(nativeTestCommand(pyProject, noneAvailable)).toBeUndefined();
  });

  it('returns undefined when no supported manifest is present', () => {
    const project = makeManifestProject({ 'README.md': '# hi\n' });
    expect(nativeTestCommand(project, allAvailable)).toBeUndefined();
  });
});

describe('runTests native fallback', () => {
  it('never blocks a non-JS project: skips when toolchain absent, else runs it', () => {
    // pyproject present, no JS test script. The done gate must never block on a
    // missing toolchain — so this either skips, or (if pytest is installed in
    // this environment) actually runs pytest.
    const project = makeManifestProject({ 'pyproject.toml': '' });

    const result = runTests(project);

    if (result.skipped) {
      expect(result).toEqual({ passed: true, output: '', skipped: true });
    } else {
      expect(result.output).toContain('pytest');
    }
  });
});
