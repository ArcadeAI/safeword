import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../helpers.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  const directories = [...temporaryDirectories];
  temporaryDirectories.length = 0;
  for (const dir of directories) rmSync(dir, { force: true, recursive: true });
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-sh-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const abs = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

async function renderSh(
  root: string,
  kind: 'test' | 'build' | 'typecheck' | 'deps' | 'bdd' = 'test',
): Promise<string> {
  const result = await runCli(['test-plan', '--kind', kind, '--format', 'sh'], {
    cwd: root,
    env: { SAFEWORD_FAKE_TOOLS: 'all' },
  });
  expect(result.exitCode).toBe(0);
  return result.stdout;
}

/** Eval a rendered script in bash; return { stdout, code }. */
function evalScript(script: string, cwd: string): { stdout: string; code: number } {
  try {
    const stdout = execSync('bash', {
      input: script,
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, code: 0 };
  } catch (error) {
    const err = error as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? '', code: err.status ?? 1 };
  }
}

describe('safeword test-plan --format sh', () => {
  it('renders a Go repo as a runnable go test command', async () => {
    const sh = await renderSh(makeRepo({ 'go.mod': 'module x\n' }));
    expect(sh).toContain('go test ./...');
  });

  it('renders --kind build as a go build command', async () => {
    const sh = await renderSh(makeRepo({ 'go.mod': 'module x\n' }), 'build');
    expect(sh).toContain('go build');
  });

  // These two route through the CLI `parseKind` boundary (cli → parseKind →
  // resolver), which the resolver-level unit tests bypass by calling
  // resolveTestPlan directly. They prove `--kind typecheck` and `--kind deps`
  // are parsed and dispatched for real, not just handled inside the resolver.
  it('renders --kind typecheck for Rust as the strict workspace clippy gate', async () => {
    const sh = await renderSh(makeRepo({ 'Cargo.toml': '[package]\nname="x"\n' }), 'typecheck');
    expect(sh).toContain('cargo clippy --workspace --all-targets --all-features -- -D warnings');
  });

  it('renders --kind deps for Rust as the cargo-deny advisories gate', async () => {
    const sh = await renderSh(makeRepo({ 'Cargo.toml': '[package]\nname="x"\n' }), 'deps');
    expect(sh).toContain('cargo deny check advisories');
  });

  it('eval runs the resolved suite and exits zero on success', async () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'echo RAN_SUITE' } }),
    });
    const { stdout, code } = evalScript(await renderSh(root), root);
    expect(stdout).toContain('RAN_SUITE');
    expect(code).toBe(0);
  });

  it('eval exits non-zero when a suite fails', async () => {
    const root = makeRepo({ 'package.json': JSON.stringify({ scripts: { test: 'exit 1' } }) });
    const { code } = evalScript(await renderSh(root), root);
    expect(code).not.toBe(0);
  });

  it('does not execute a command substitution in a maliciously-named directory', async () => {
    // A nested Go module under a dir named with $(...). Eval must NOT run it.
    const root = makeRepo({ 'm$(touch INJECTED)d/go.mod': 'module x\n' });
    const sh = await renderSh(root);
    const { code } = evalScript(sh, root);
    // cd may fail (the literal dir name won't match a shell-expanded one), but
    // the injection must not have fired.
    expect(existsSync(nodePath.join(root, 'INJECTED'))).toBe(false);
    expect(typeof code).toBe('number');
  });

  it('eval of an empty plan is a clean no-op (exit zero)', async () => {
    const root = makeRepo({ 'README.md': '# hi\n' });
    const sh = await renderSh(root);
    expect(sh).toBe('');
    expect(evalScript(sh, root).code).toBe(0);
  });

  // --kind bdd/typecheck flow through parseKind (commands/test-plan.ts) — a seam
  // the resolve() unit tests bypass. These guard that the CLI accepts the kind and
  // renders the right lane; a regressed parseKind would silently fall back to
  // `test` and emit the wrong suite (the verify skill runs exactly this path).
  it('renders --kind bdd as the JS test:bdd lane', async () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest', 'test:bdd': 'cucumber-js' } }),
    });
    expect(await renderSh(root, 'bdd')).toContain('run test:bdd');
  });

  it('renders --kind bdd as the Python behave lane when behave is configured', async () => {
    const root = makeRepo({ 'pyproject.toml': '[project]\nname="x"\n[tool.behave]\n' });
    expect(await renderSh(root, 'bdd')).toContain('behave');
  });

  it('renders --kind typecheck as `mypy .` when mypy is configured', async () => {
    const root = makeRepo({ 'pyproject.toml': '[project]\nname="x"\n[tool.mypy]\n' });
    expect(await renderSh(root, 'typecheck')).toContain('mypy .');
  });
});
