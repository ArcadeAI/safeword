import { execFile, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../../../..');
const CLI = path.join(REPO, 'packages/cli/src/cli.ts');
const HOOK = path.join(REPO, 'packages/cli/templates/hooks/post-tool-lint.ts');
const directories: string[] = [];
function fixture() {
  const prefix = path.join(tmpdir(), 'go-lint-lifetime-');
  const root = realpathSync(mkdtempSync(prefix));
  directories.push(root);
  mkdirSync(path.join(root, '.safeword'));
  mkdirSync(path.join(root, 'pkg'));
  mkdirSync(path.join(root, 'bin'));
  writeFileSync(path.join(root, '.safeword/config.json'), '{"selfReport":{"capture":false}}');
  writeFileSync(
    path.join(root, '.safeword/.golangci.yml'),
    'version: "2"\nrun: {relative-path-mode: wd}\n',
  );
  const file = path.join(root, 'pkg/value.go');
  writeFileSync(file, 'package value\n');
  const binary = path.join(root, 'bin/golangci-lint');
  writeFileSync(
    binary,
    String.raw`#!/bin/sh
printf '%s|%s\n' "$PWD" "$*" >> "$GO_LINT_TRACE"
case "$1" in
  version) if [ -n "$GO_LINT_REMOVE_PACKAGE" ]; then mv -- "$GO_LINT_REMOVE_PACKAGE" "$GO_LINT_REMOVE_PACKAGE-moved"; fi; printf '2.13.2\n'; exit 0 ;;
  fmt) if [ "$GO_LINT_FORMAT_FAIL" = 1 ]; then printf 'formatter unavailable\n' >&2; exit 2; fi; exit 0 ;;
  run)
    if [ "$GO_LINT_HOLD" = 1 ]; then printf '%s' "$$" > "$GO_LINT_READY"; exec sleep 60; fi
    if [ "$GO_LINT_BLOCK_CLEANUP" = 1 ]; then rm -- "$3"; mkdir -- "$3"; fi
    printf '%s\n' "$GO_LINT_DIAGNOSTIC"; exit 1 ;;
esac
`,
  );
  chmodSync(binary, 0o755);
  const env = {
    ...process.env,
    PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    CLAUDE_PROJECT_DIR: root,
    SAFEWORD_PLUGIN_CLI: CLI,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    GO_LINT_TRACE: path.join(root, 'trace'),
    GO_LINT_READY: path.join(root, 'ready'),
    GO_LINT_DIAGNOSTIC: `${file}:1:1: sample issue (govet)`,
  };
  return { root, file, env };
}
async function until(predicate: () => boolean): Promise<void> {
  await expect.poll(predicate, { timeout: 10_000, interval: 10 }).toBe(true);
}
async function runHook(root: string, file: string, env: NodeJS.ProcessEnv) {
  const child = execFile('bun', [HOOK], { cwd: root, env });
  child.stdin?.end(JSON.stringify({ tool_input: { file_path: file } }));
  return new Promise<string>((resolve, reject) => {
    let output = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', status => {
      if (status === 0) resolve(output);
      else reject(new Error(`Hook exited ${status}`));
    });
  });
}
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Go lint process boundary', () => {
  it('retains formatter warnings alongside package diagnostics in the real hook', async () => {
    const { root, file, env } = fixture();
    const output = await runHook(root, file, { ...env, GO_LINT_FORMAT_FAIL: '1' });
    const context = JSON.parse(output).hookSpecificOutput.additionalContext as string;
    expect(context).toContain('formatter unavailable');
    expect(context).toContain('sample issue');
    const trace = readFileSync(env.GO_LINT_TRACE, 'utf8');
    const packageCommands = trace
      .trim()
      .split('\n')
      .filter(line => /\|(?:fmt|run) /.test(line));
    expect(packageCommands).toHaveLength(2);
    expect(packageCommands[0]).toContain(`${path.dirname(file)}|fmt --config `);
    expect(packageCommands[0]).toContain(` ${file}`);
    expect(packageCommands[1]).toContain(`${path.dirname(file)}|run --config `);
    expect(trace).toContain(`${path.dirname(file)}|run --config `);
    expect(trace).toContain(`--path-prefix ${root} .`);
    expect(trace).not.toContain('--fix');
    expect(readdirSync(root).some(name => name.startsWith('.safeword-go-lint-'))).toBe(false);
  });

  it('removes the prepared config when the package directory disappears before spawning', async () => {
    const { root, file, env } = fixture();
    const output = await runHook(root, file, {
      ...env,
      GO_LINT_REMOVE_PACKAGE: path.dirname(file),
    });
    expect(output).toContain('Go lint could not run');
    expect(output).toContain('ENOENT');
    expect(readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-'))).toEqual([]);
    expect(readFileSync(env.GO_LINT_TRACE, 'utf8')).toContain('|version --short');
  });

  it('preserves findings when the configured report destination cannot be written', async () => {
    const { root, file, env } = fixture();
    const report = path.join(root, 'report-directory');
    mkdirSync(report);
    writeFileSync(
      path.join(root, '.safeword/.golangci.yml'),
      JSON.stringify({
        version: '2',
        run: { 'relative-path-mode': 'wd' },
        output: { formats: { text: { path: report } } },
      }),
    );
    const output = await runHook(root, file, env);
    expect(output).toContain('Go lint report could not be written');
    expect(output).toContain('sample issue');
    expect(readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-'))).toEqual([]);
  });

  it('reports cleanup failure while retaining package findings', async () => {
    const { root, file, env } = fixture();
    const output = await runHook(root, file, { ...env, GO_LINT_BLOCK_CLEANUP: '1' });
    expect(output).toContain('Go lint temporary config cleanup failed');
    expect(output).toContain('sample issue');
    expect(readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-'))).toHaveLength(1);
  });

  it('caps the full context payload while admitting omitted findings', async () => {
    const { root, file, env } = fixture();
    const output = await runHook(root, file, { ...env, GO_LINT_DIAGNOSTIC: 'x'.repeat(25_000) });
    const context = JSON.parse(output).hookSpecificOutput.additionalContext as string;
    expect(Buffer.byteLength(context)).toBeLessThanOrEqual(16 * 1024);
    expect(context).toContain('truncated');
    expect(context).toContain('not all findings');
  });

  it('reports an older helper rather than reverting to incomplete file lint', async () => {
    const { root, file, env } = fixture();
    const old = path.join(root, 'old-cli.ts');
    writeFileSync(old, 'console.error("unknown command go-lint"); process.exit(1);');
    expect(await runHook(root, file, { ...env, SAFEWORD_PLUGIN_CLI: old })).toContain(
      'align hooks and runtime',
    );
    expect(readFileSync(env.GO_LINT_TRACE, 'utf8')).not.toContain('|run ');
  });

  it.each([
    'not JSON',
    '{"warnings":[42]}',
    '{"warnings":[],"errors":42}',
    '{"warnings":[],"diagnosticContext":42}',
  ])('warns on malformed helper output without falling back to file lint: %s', async output => {
    const { root, file, env } = fixture();
    const helper = path.join(root, 'invalid-cli.ts');
    writeFileSync(helper, `process.stdout.write(${JSON.stringify(output)});`);
    expect(await runHook(root, file, { ...env, SAFEWORD_PLUGIN_CLI: helper })).toContain(
      'Go lint helper returned an invalid result',
    );
    expect(readFileSync(env.GO_LINT_TRACE, 'utf8')).not.toContain('|run ');
  });

  it('uses the selected Cursor workspace even when the launch directory differs', async () => {
    const { root, file, env } = fixture();
    const launch = path.dirname(root);
    const child = execFile(
      'bun',
      [path.join(REPO, 'packages/cli/templates/hooks/cursor/after-file-edit.ts')],
      {
        cwd: launch,
        env: { ...env, CLAUDE_PROJECT_DIR: launch },
      },
    );
    child.stdin?.end(
      JSON.stringify({ workspace_roots: [root], file_path: file, conversation_id: 'go-context' }),
    );
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`Cursor exit ${code}`));
      });
    });
    expect(readFileSync(env.GO_LINT_TRACE, 'utf8')).toContain(
      `${path.dirname(file)}|run --config ${root}/.safeword-go-lint-`,
    );
  });

  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'] as const)(
    'cleans the exact config and linter child on %s',
    async signal => {
      const { root, file, env } = fixture();
      const child = spawn(
        'bun',
        [CLI, 'hook', 'go-lint', '--file', file, '--project-root', root, '--original-cwd', root],
        {
          cwd: root,
          env: { ...env, GO_LINT_HOLD: '1' },
          stdio: 'ignore',
        },
      );
      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          child.on('error', reject);
          child.on('exit', (code, received) => {
            resolve({ code, signal: received });
          });
        },
      );
      try {
        await until(() => existsSync(env.GO_LINT_READY));
        expect(
          readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-')),
        ).toHaveLength(1);
        const linterPid = Number(readFileSync(env.GO_LINT_READY, 'utf8'));
        child.kill(signal);
        const termination = await exited;
        expect(termination.signal).toBe(signal);
        expect(
          readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-')),
        ).toHaveLength(0);
        await until(() => {
          try {
            process.kill(linterPid, 0);
            return false;
          } catch {
            return true;
          }
        });
      } finally {
        child.kill('SIGKILL');
      }
    },
  );
});
