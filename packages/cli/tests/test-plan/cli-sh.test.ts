import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { observeTestPlan } from '../../src/commands/test-plan.js';
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
  kind: 'test' | 'build' | 'verify' | 'typecheck' | 'deps' | 'bdd' = 'test',
): Promise<string> {
  const result = await runCli(['test-plan', '--kind', kind, '--format', 'sh'], {
    cwd: root,
    env: { SAFEWORD_FAKE_TOOLS: 'all' },
  });
  expect(result.exitCode).toBe(0);
  return result.stdout;
}

async function renderUnavailableSh(root: string, kind: 'typecheck' | 'deps'): Promise<string> {
  const result = await runCli(['test-plan', '--kind', kind, '--format', 'sh'], {
    cwd: root,
    env: { SAFEWORD_FAKE_TOOLS: 'only:go' },
  });
  expect(result.exitCode).toBe(0);
  return result.stdout;
}

async function renderJson(
  root: string,
  kind: 'typecheck' | 'deps',
  availableTools: string,
): Promise<Record<string, unknown>> {
  const result = await runCli(['project', 'test-plan', '--kind', kind, '--json'], {
    cwd: root,
    env: { SAFEWORD_FAKE_TOOLS: availableTools },
  });
  expect(result.exitCode).toBe(2);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

/** Eval a rendered script in bash; return { stdout, code }. */
function evalScript(
  script: string,
  cwd: string,
  options: { conditional?: boolean; path?: string } = {},
): { stdout: string; stderr: string; code: number } {
  const arguments_ = options.conditional
    ? ['-c', 'if eval "$1"; then exit 0; else exit 23; fi', 'safeword-test', script]
    : [];
  const result = spawnSync('bash', arguments_, {
    input: options.conditional ? undefined : script,
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: options.path ?? process.env.PATH },
  });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status ?? 1 };
}

describe('safeword test-plan', () => {
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

  it('renders --kind deps for Go as a pinned govulncheck scan', async () => {
    const sh = await renderSh(makeRepo({ 'go.mod': 'module x\n' }), 'deps');
    expect(sh).toContain('go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 ./...');
  });

  it('reports the exact unavailable Python dependency scanner without blaming Go', async () => {
    const output = await renderJson(
      makeRepo({
        'requirements.txt': 'requests==2.32.0\n',
        'checker/go.mod': 'module x\n',
      }),
      'deps',
      'only:go',
    );

    expect(output).toMatchObject({
      state: 'action_required',
      findings: [
        {
          code: 'TEST_PLAN_RUNNER_UNAVAILABLE',
          severity: 'warning',
          message: 'Python dependency lane skipped: pip-audit is not installed.',
          metadata: { kind: 'deps', language: 'python', runner: 'pip-audit' },
        },
      ],
    });
  });

  it('reports configured Python typechecking as an evidence gap when mypy is missing', async () => {
    const output = await renderJson(
      makeRepo({ 'mypy.ini': '[mypy]\nstrict = True\n' }),
      'typecheck',
      'only:python3',
    );

    expect(output).toMatchObject({
      findings: [
        {
          code: 'TEST_PLAN_RUNNER_UNAVAILABLE',
          severity: 'warning',
          message: 'Python typecheck lane skipped: mypy is not installed.',
          metadata: { kind: 'typecheck', language: 'python', runner: 'mypy' },
        },
      ],
    });
  });

  it('renders an unavailable dependency runner as a visible failing shell lane', async () => {
    const root = makeRepo({ 'requirements.txt': 'requests==2.32.0\n' });
    const sh = await renderUnavailableSh(root, 'deps');

    expect(sh).toContain('Python dependency lane skipped: pip-audit is not installed.');
    expect(sh).not.toContain('set -e');
    const evaluation = evalScript(sh, root);
    expect(evaluation.code).not.toBe(0);
    expect(evaluation.stderr).toBe('Python dependency lane skipped: pip-audit is not installed.\n');
  });

  it('runs later lanes without letting them mask an earlier failure in conditional eval', async () => {
    const root = makeRepo({
      'requirements.txt': 'requests==2.32.0\n',
      'service/go.mod': 'module example.com/service\n',
      'bin/go': '#!/bin/sh\necho RAN_GO\n',
    });
    chmodSync(nodePath.join(root, 'bin/go'), 0o755);
    const sh = await renderUnavailableSh(root, 'deps');
    const evaluation = evalScript(sh, root, {
      conditional: true,
      path: `${nodePath.join(root, 'bin')}:${process.env.PATH ?? ''}`,
    });

    expect(evaluation.code).toBe(23);
    expect(evaluation.stdout).toContain('RAN_GO');
    expect(evaluation.stderr).toContain(
      'Python dependency lane skipped: pip-audit is not installed.',
    );
  });

  it('does not leak accumulator variables into the caller shell', async () => {
    const root = makeRepo({ 'go.mod': 'module example.com/service\n' });
    const sh = await renderSh(root);
    const evaluation = evalScript(
      `${sh}printf '%s|%s\\n' "\${safeword_plan_status-unset}" "\${safeword_lane_status-unset}"`,
      root,
    );

    expect(evaluation.stdout).toContain('unset|unset');
  });

  it.each([
    ['--kind', 'unknown', 'TEST_PLAN_KIND_INVALID'],
    ['--format', 'unknown', 'TEST_PLAN_FORMAT_INVALID'],
  ])('rejects invalid %s values through the public CLI', async (flag, value, code) => {
    const result = await runCli(['project', 'test-plan', flag, value, '--json'], {
      cwd: makeRepo({ 'package.json': '{"private":true}\n' }),
    });

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ errors: [{ code }] });
  });

  it('rejects a non-string kind instead of silently running tests', async () => {
    const result = await observeTestPlan(
      makeRepo({ 'package.json': '{"scripts":{"test":"vitest"}}' }),
      undefined,
      { kind: true },
    );
    expect(result).toMatchObject({
      state: 'failed',
      errors: [{ code: 'TEST_PLAN_KIND_INVALID', message: 'Test-plan kind must be a string.' }],
    });
  });

  it('does not interpolate repository-controlled manifest text into commands', async () => {
    const marker = '$(touch MANIFEST_INJECTED)';
    const root = makeRepo({
      'package.json': JSON.stringify({ name: marker, scripts: { test: 'vitest' } }),
      'service/go.mod': `module ${marker}\n`,
      'worker/pyproject.toml': `[project]\nname = "${marker}"\n`,
    });

    const sh = await renderSh(root);
    expect(sh).not.toContain(marker);
  });

  it('renders --kind deps for uv projects as uv audit', async () => {
    const sh = await renderSh(
      makeRepo({ 'pyproject.toml': '[project]\nname="x"\n', 'uv.lock': 'version = 1\n' }),
      'deps',
    );
    expect(sh).toContain('uv audit');
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
    expect(sh).toContain('m$(touch INJECTED)d');
    expect(sh).toContain('go test');
    evalScript(sh, root);
    // The quoted literal directory must resolve without evaluating its name.
    expect(existsSync(nodePath.join(root, 'INJECTED'))).toBe(false);
  });

  it('eval of an empty plan is a clean no-op (exit zero)', async () => {
    const root = makeRepo({ 'README.md': '# hi\n' });
    const sh = await renderSh(root);
    expect(sh).toBe('');
    expect(evalScript(sh, root).code).toBe(0);
  });

  it('treats a detected JavaScript manifest without a suite as an explicit empty plan', async () => {
    const root = makeRepo({ 'package.json': '{"private":true}\n' });
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

  it('renders --kind verify as the JS test lane used by the closing gate', async () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest', verify: 'echo WRONG' } }),
    });
    const sh = await renderSh(root, 'verify');
    expect(sh).toContain('run test');
    expect(sh).not.toContain('run verify');
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
