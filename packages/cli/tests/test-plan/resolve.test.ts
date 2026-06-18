import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { type Language, type PlanEntry, resolveTestPlan } from '../../src/test-plan/resolve';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { force: true, recursive: true });
});

/** Build a temp repo from a map of relative path → file contents. */
function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-plan-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const abs = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const allTools = (): boolean => true;
const onlyTools =
  (...names: string[]) =>
  (tool: string): boolean =>
    names.includes(tool);

function entryFor(plan: PlanEntry[], language: Language): PlanEntry | undefined {
  return plan.find(planEntry => planEntry.language === language);
}
function languages(plan: PlanEntry[]): Language[] {
  return plan.map(planEntry => planEntry.language);
}

describe('resolveTestPlan — every detected language appears (no first-match)', () => {
  it('a JS+Python repo yields exactly a javascript and a python entry', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      'pyproject.toml': '[project]\nname = "x"\n',
    });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(languages(plan).toSorted()).toEqual(['javascript', 'python']);
    expect(plan).toHaveLength(2);
  });

  it('a Go+Rust repo yields both a go and a rust entry', () => {
    const root = makeRepo({ 'go.mod': 'module x\n', 'Cargo.toml': '[package]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'go')).toBeDefined();
    expect(entryFor(plan, 'rust')).toBeDefined();
  });

  it('a package.json with an empty scripts object contributes no javascript entry', () => {
    const root = makeRepo({
      'go.mod': 'module x\n',
      'package.json': JSON.stringify({ scripts: {} }),
    });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'go')).toBeDefined();
    expect(entryFor(plan, 'javascript')).toBeUndefined();
  });

  it('a malformed manifest is skipped without dropping other languages', () => {
    const root = makeRepo({ 'go.mod': 'module x\n', 'package.json': '{ this is not json' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'go')).toBeDefined();
    expect(entryFor(plan, 'javascript')).toBeUndefined();
  });

  it('a repo with no recognized manifest yields an empty plan', () => {
    const root = makeRepo({ 'README.md': '# hi\n' });
    expect(resolveTestPlan(root, { isToolAvailable: allTools })).toEqual([]);
  });
});

describe('resolveTestPlan — the command reflects the detected runner', () => {
  it('python with a tox.ini runs tox', () => {
    const root = makeRepo({ 'pyproject.toml': '[project]\n', 'tox.ini': '[tox]\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'python')?.command).toBe('tox');
  });

  it('python with no pytest falls back to unittest', () => {
    const root = makeRepo({ 'pyproject.toml': '[project]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('python') });
    expect(entryFor(plan, 'python')?.command).toBe('python -m unittest discover');
  });

  it('prefers python3 for the unittest fallback when available', () => {
    const root = makeRepo({ 'pyproject.toml': '[project]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('python3') });
    expect(entryFor(plan, 'python')?.command).toBe('python3 -m unittest discover');
  });

  it('detects pytest configured via setup.cfg [tool:pytest]', () => {
    const root = makeRepo({
      'pyproject.toml': '[project]\nname="x"\n',
      'setup.cfg': '[tool:pytest]\naddopts = -q\n',
    });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('python', 'python3') });
    expect(entryFor(plan, 'python')?.command).toBe('pytest');
  });

  it('a uv-locked python repo runs pytest through uv', () => {
    const root = makeRepo({
      'pyproject.toml': '[tool.pytest.ini_options]\n',
      'uv.lock': '',
    });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('uv', 'pytest') });
    expect(entryFor(plan, 'python')?.command).toBe('uv run pytest');
  });

  it('rust uses nextest when it is installed', () => {
    const root = makeRepo({ 'Cargo.toml': '[package]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('cargo', 'cargo-nextest') });
    expect(entryFor(plan, 'rust')?.command).toBe(
      'cargo nextest run --workspace && cargo test --doc',
    );
  });

  it('rust falls back to cargo test --workspace without nextest', () => {
    const root = makeRepo({ 'Cargo.toml': '[package]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('cargo') });
    expect(entryFor(plan, 'rust')?.command).toBe('cargo test --workspace');
  });

  it('a go workspace expands its modules in the emitted command', () => {
    const root = makeRepo({ 'go.mod': 'module x\n', 'go.work': 'go 1.22\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'go')?.command).toBe("go test $(go list -f '{{.Dir}}/...' -m | xargs)");
  });

  it('a pnpm JS repo runs its test script through pnpm', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      'pnpm-lock.yaml': '',
    });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'javascript')?.command).toBe('pnpm run test');
  });
});

describe('resolveTestPlan — missing toolchains stay visible', () => {
  it('a go repo with no go binary still appears, marked unavailable', () => {
    const root = makeRepo({ 'go.mod': 'module x\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools() });
    const go = entryFor(plan, 'go');
    expect(go).toBeDefined();
    expect(go?.available).toBe(false);
  });
});

describe('resolveTestPlan — nested and vendored manifests', () => {
  it('a manifest in a sub-directory is discovered', () => {
    const root = makeRepo({ 'services/api/pyproject.toml': '[project]\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'python')).toBeDefined();
  });

  it('a manifest inside an excluded directory is ignored', () => {
    const root = makeRepo({ 'target/dep/Cargo.toml': '[package]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'rust')).toBeUndefined();
  });

  it('runs a nested Go module in its own directory, not the repo root', () => {
    const root = makeRepo({ 'services/api/go.mod': 'module example\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    const go = entryFor(plan, 'go');
    expect(go?.cwd).toBe(nodePath.join(root, 'services/api'));
    expect(go?.command).toBe('go test ./...');
  });

  it('runs a nested Rust crate in its own directory', () => {
    const root = makeRepo({ 'crates/core/Cargo.toml': '[package]\nname="x"\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: onlyTools('cargo') });
    expect(entryFor(plan, 'rust')?.cwd).toBe(nodePath.join(root, 'crates/core'));
  });

  it('keeps cwd at the repo root for a root-level manifest', () => {
    const root = makeRepo({ 'go.mod': 'module x\n' });
    const plan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(plan, 'go')?.cwd).toBe(root);
  });
});

describe('resolveTestPlan — verify plan (kind: verify)', () => {
  it('prefers test:ci over test and test:done', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({
        scripts: { 'test:ci': 'vitest run', test: 'vitest', 'test:done': 'vitest run hooks/' },
      }),
    });
    const plan = resolveTestPlan(root, { kind: 'verify', isToolAvailable: allTools });
    expect(entryFor(plan, 'javascript')?.command).toContain('test:ci');
  });

  it('falls back to test when test:ci absent', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({
        scripts: { test: 'vitest run', 'test:done': 'vitest run hooks/' },
      }),
    });
    const plan = resolveTestPlan(root, { kind: 'verify', isToolAvailable: allTools });
    expect(entryFor(plan, 'javascript')?.command).toContain('run test');
  });

  it('falls back to test:done when test and test:ci both absent', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { 'test:done': 'vitest run hooks/' } }),
    });
    const plan = resolveTestPlan(root, { kind: 'verify', isToolAvailable: allTools });
    expect(entryFor(plan, 'javascript')?.command).toContain('test:done');
  });

  it('does not pick test:done over test (unlike kind: test)', () => {
    const scripts = { test: 'vitest run', 'test:done': 'vitest run hooks/' };
    const root = makeRepo({ 'package.json': JSON.stringify({ scripts }) });
    const verifyPlan = resolveTestPlan(root, { kind: 'verify', isToolAvailable: allTools });
    const testPlan = resolveTestPlan(root, { isToolAvailable: allTools });
    expect(entryFor(verifyPlan, 'javascript')?.command).toContain('run test');
    expect(entryFor(testPlan, 'javascript')?.command).toContain('test:done');
  });
});

describe('resolveTestPlan — build plan', () => {
  it('emits per-language build commands', () => {
    const root = makeRepo({
      'go.mod': 'module x\n',
      'Cargo.toml': '[package]\nname="x"\n',
      'package.json': JSON.stringify({ scripts: { build: 'tsup' } }),
    });
    const plan = resolveTestPlan(root, { kind: 'build', isToolAvailable: allTools });
    expect(entryFor(plan, 'go')?.command).toBe('go build ./...');
    expect(entryFor(plan, 'rust')?.command).toBe('cargo build --workspace');
    expect(entryFor(plan, 'python')).toBeUndefined();
  });

  it('omits a JS entry when there is no build script', () => {
    const root = makeRepo({
      'go.mod': 'module x\n',
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
    });
    const plan = resolveTestPlan(root, { kind: 'build', isToolAvailable: allTools });
    expect(entryFor(plan, 'go')).toBeDefined();
    expect(entryFor(plan, 'javascript')).toBeUndefined();
  });
});
