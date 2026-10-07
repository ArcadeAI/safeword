import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableCodexReviewApproval } from '../../src/codex-plugin/review-approval.js';

const roots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function temporaryRoot(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-delivery-'));
  roots.push(root);
  return root;
}

describe('review delivery regressions', () => {
  it('preserves every original config byte when adding explicit approvals', () => {
    const home = temporaryRoot();
    const original = 'model = "configured"\n\n# Keep trailing whitespace\n  \n\n';
    const config = nodePath.join(home, 'config.toml');
    writeFileSync(config, original);
    expect(enableCodexReviewApproval({ CODEX_HOME: home })).toBe(true);
    expect(readFileSync(config, 'utf8').startsWith(original)).toBe(true);
  });

  it.each(['stdin', 'SIGTERM'] as const)(
    'ends a login process and removes its temporary directory on server %s shutdown',
    async shutdown => {
      const root = temporaryRoot();
      const project = nodePath.join(root, 'project');
      mkdirSync(project);
      const pidFile = nodePath.join(root, 'login.json');
      const cli = nodePath.join(root, 'claude');
      writeFileSync(
        cli,
        `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({pid:process.pid,cwd:process.cwd()}));process.stdout.write('Open https://claude.com/cai/oauth/authorize?state=test\\n');setInterval(()=>{},1000);\n`,
        { mode: 0o700 },
      );
      const loginModule = fileURLToPath(
        new URL('../../src/codex-plugin/reviewer-login.ts', import.meta.url),
      );
      const serverModule = fileURLToPath(
        new URL('../../src/codex-plugin/review-mcp.ts', import.meta.url),
      );
      const runner = nodePath.join(root, 'server.ts');
      writeFileSync(
        runner,
        `import * as login from ${JSON.stringify(loginModule)};import * as server from ${JSON.stringify(serverModule)};await login.startReviewerLogin('shutdown','claude',${JSON.stringify(project)});await server.runReviewMcpServer('--codex');`,
      );
      const parent = spawn('bun', [runner], {
        env: { ...process.env, PATH: `${root}${nodePath.delimiter}${process.env.PATH ?? ''}` },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      children.push(parent);
      let output = '';
      parent.stdout.on('data', chunk => {
        output += String(chunk);
      });
      parent.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`,
      );
      let errors = '';
      parent.stderr.on('data', chunk => {
        errors += String(chunk);
      });
      await vi.waitFor(
        () => {
          if (parent.exitCode !== null) throw new Error(errors);
          expect(existsSync(pidFile)).toBe(true);
          expect(output).toContain('"name":"safeword-review"');
        },
        { timeout: 5000 },
      );
      const login = JSON.parse(readFileSync(pidFile, 'utf8')) as { pid: number; cwd: string };
      if (shutdown === 'stdin') parent.stdin.end();
      else parent.kill('SIGTERM');
      await vi.waitFor(
        () => {
          expect(() => process.kill(login.pid, 0)).toThrow();
          expect(existsSync(login.cwd)).toBe(false);
        },
        { timeout: 5000 },
      );
    },
  );
});
