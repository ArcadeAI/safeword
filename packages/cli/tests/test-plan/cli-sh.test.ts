import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../helpers.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { force: true, recursive: true });
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

async function renderSh(root: string, kind: 'test' | 'build' = 'test'): Promise<string> {
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
    const stdout = execSync('bash', { input: script, cwd, encoding: 'utf8' });
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

  it('eval of an empty plan is a clean no-op (exit zero)', async () => {
    const root = makeRepo({ 'README.md': '# hi\n' });
    const sh = await renderSh(root);
    expect(sh).toBe('');
    expect(evalScript(sh, root).code).toBe(0);
  });
});
