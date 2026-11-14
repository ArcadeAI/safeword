import { execFile, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const REPO = path.resolve(__dirname, '../../../..');
const HOOK = path.join(REPO, 'packages/cli/templates/hooks/post-tool-lint.ts');
const CLI = path.join(REPO, 'packages/cli/src/cli.ts');
const LINTER = process.env.SAFEWORD_GO_LINT_BIN ?? 'golangci-lint';
const GO = process.env.SAFEWORD_GO_TEST_GO ?? 'go';
const available =
  spawnSync(LINTER, ['version'], { encoding: 'utf8' }).status === 0 &&
  spawnSync(GO, ['version'], { encoding: 'utf8' }).status === 0;
if (!available && process.env.SAFEWORD_REQUIRE_GO_LINT === '1') {
  throw new Error('Go lint integration proof requires Go and golangci-lint on PATH');
}
const directories: string[] = [];
function write(root: string, name: string, text: string): string {
  const file = path.join(root, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}
function fixture(): string {
  const prefix = path.join(tmpdir(), 'safeword-go-context-');
  const root = realpathSync(mkdtempSync(prefix));
  directories.push(root);
  write(root, '.safeword/config.json', JSON.stringify({ selfReport: { capture: false } }));
  write(
    root,
    '.safeword/.golangci.yml',
    JSON.stringify({
      version: '2',
      linters: { default: 'none', enable: ['govet'] },
      formatters: { enable: ['gofmt'] },
    }),
  );
  write(root, 'apps/engine/go.mod', 'module example.com/engine\n\ngo 1.23\n');
  return root;
}
function environment(root: string): NodeJS.ProcessEnv {
  const toolPaths = [LINTER, GO].filter(path.isAbsolute).map(file => path.dirname(file));
  return {
    ...process.env,
    PATH: [...toolPaths, process.env.PATH].join(path.delimiter),
    CLAUDE_PROJECT_DIR: root,
    SAFEWORD_PLUGIN_CLI: CLI,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    GOTOOLCHAIN: 'local',
    // The compatibility lane selects its own Go binary, which must discover its own root.
    GOROOT: process.env.SAFEWORD_GO_TEST_GO ? undefined : process.env.GOROOT,
    GOPROXY: 'off',
  };
}
async function hook(root: string, file: string): Promise<string> {
  const child = execFile('bun', [HOOK], {
    cwd: root,
    env: environment(root),
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  child.stdin?.end(JSON.stringify({ tool_input: { file_path: file } }));
  return await new Promise<string>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr));
    });
  });
}
function context(output: string): string {
  return (JSON.parse(output) as { hookSpecificOutput: { additionalContext: string } })
    .hookSpecificOutput.additionalContext;
}
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!available)('Go post-edit package context (real Go and golangci-lint)', () => {
  it('loads sibling declarations when the edited file is a package test', async () => {
    const root = fixture();
    write(root, 'apps/engine/value.go', 'package engine\n\nfunc Value() int { return 42 }\n');
    const file = write(
      root,
      'apps/engine/value_test.go',
      'package engine\n\nimport "testing"\n\nfunc TestValue(t *testing.T) { if Value()!=42 { t.Fatal("bad value") } }\n',
    );
    await execute(GO, ['test', '.'], { cwd: path.dirname(file), env: environment(root) });
    expect(await hook(root, file)).toBe('');
  });

  it('resolves internal imports inside a nested module', async () => {
    const root = fixture();
    write(
      root,
      'apps/engine/internal/identity/value.go',
      'package identity\n\nfunc Value() int { return 42 }\n',
    );
    const file = write(
      root,
      'apps/engine/internal/service/value.go',
      'package service\n\nimport "example.com/engine/internal/identity"\n\nfunc Value() int { return identity.Value() }\n',
    );
    await execute(GO, ['test', '.'], { cwd: path.dirname(file), env: environment(root) });
    expect(await hook(root, file)).toBe('');
  });

  it('retains package scope and the actual sibling source path in feedback', async () => {
    const root = fixture();
    const sibling = write(
      root,
      'apps/engine/value.go',
      'package engine\n\nimport "fmt"\n\nfunc Value() int { fmt.Printf("%d", "text"); return 42 }\n',
    );
    const file = write(
      root,
      'apps/engine/value_test.go',
      'package engine\n\nimport "testing"\n\nfunc TestValue(t *testing.T) { if Value()!=42 { t.Fatal("bad value") } }\n',
    );
    const before = readFileSync(sibling, 'utf8');
    const feedback = context(await hook(root, file));
    expect(feedback).toContain(`Go lint findings for package ${path.dirname(file)}`);
    expect(feedback).toContain(sibling);
    expect(feedback).toContain('govet');
    expect(feedback).not.toContain('after auto-fix');
    expect(readFileSync(sibling, 'utf8')).toBe(before);
  });

  it('preserves working-directory exclusions while loading the complete package', async () => {
    const root = fixture();
    write(
      root,
      '.safeword/.golangci.yml',
      JSON.stringify({
        version: '2',
        run: { 'relative-path-mode': 'wd' },
        linters: {
          default: 'none',
          enable: ['govet'],
          exclusions: { rules: [{ path: '^apps/engine/', linters: ['govet'] }] },
        },
      }),
    );
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\n\nimport "fmt"\n\nfunc Value() { fmt.Printf("%d", "text") }\n',
    );
    expect(await hook(root, file)).toBe('');
    write(
      root,
      '.safeword/.golangci.yml',
      'version: "2"\nlinters: {default: none, enable: [govet]}\n',
    );
    expect(context(await hook(root, file))).toContain('govet');
    expect(readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-'))).toEqual([]);
  });

  it('retains a relative header resource with the default cfg path mode', async () => {
    const root = fixture();
    write(root, 'header.txt', 'Copyright Example');
    write(
      root,
      '.safeword/.golangci.yml',
      JSON.stringify({
        version: '2',
        linters: {
          default: 'none',
          enable: ['goheader'],
          settings: { goheader: { 'template-path': 'header.txt' } },
        },
      }),
    );
    const file = write(
      root,
      'apps/engine/value.go',
      '// Copyright Example\npackage engine\n\nfunc Value() int { return 42 }\n',
    );
    expect(await hook(root, file)).toBe('');
    write(
      root,
      'apps/engine/value.go',
      '// Copyright Different\npackage engine\n\nfunc Value() int { return 42 }\n',
    );
    expect(context(await hook(root, file))).toContain('goheader');
  });

  it('retains genuine sibling type errors without changing the sibling', async () => {
    const root = fixture();
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\n\nfunc Value() int { return 42 }\n',
    );
    const sibling = write(root, 'apps/engine/bad.go', 'package engine\n\nvar Bad = Undefined\n');
    const before = readFileSync(sibling, 'utf8');
    const feedback = context(await hook(root, file));
    expect(feedback).toContain('undefined: Undefined');
    expect(feedback).toContain(sibling);
    expect(feedback).toContain('may predate');
    expect(readFileSync(sibling, 'utf8')).toBe(before);
  });

  it('formats the edited file while leaving fixable lint findings for the user', async () => {
    const root = fixture();
    write(
      root,
      '.safeword/.golangci.yml',
      JSON.stringify({
        version: '2',
        linters: { default: 'none', enable: ['misspell'] },
        formatters: { enable: ['gofmt'] },
      }),
    );
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\n\n// Value returns teh value.\nfunc Value()int{return 42}\n',
    );
    expect(context(await hook(root, file))).toContain('misspell');
    expect(readFileSync(file, 'utf8')).toContain('func Value() int { return 42 }');
    expect(readFileSync(file, 'utf8')).toContain('teh');
  });

  it('warns on malformed policy without formatting or hiding the failure', async () => {
    const root = fixture();
    write(root, '.safeword/.golangci.yml', 'version: "2"\nlinters: [unterminated\n');
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\nfunc Value()int{return 42}\n',
    );
    const before = readFileSync(file, 'utf8');
    expect(await hook(root, file)).toContain('Go lint could not run');
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(
      readdirSync(path.join(root, '.safeword')).filter(name =>
        name.startsWith('.safeword-go-lint-'),
      ),
    ).toEqual([]);
  });

  it('refuses an edited symlink whose target is outside the project', async () => {
    const root = fixture();
    const outside = fixture();
    const target = write(outside, 'outside.go', 'package outside\n\nfunc Value()int{return 1}\n');
    const before = readFileSync(target, 'utf8');
    const file = path.join(root, 'outside.go');
    symlinkSync(target, file);
    expect(await hook(root, file)).toMatch(/outside.*project root/i);
    expect(readFileSync(target, 'utf8')).toBe(before);
  });
  it('preserves native config-path selector behavior on the installed linter version', async () => {
    const root = fixture();
    rmSync(path.join(root, '.safeword/.golangci.yml'));
    const config = write(
      root,
      '.golangci.yml',
      'version: "2"\nlinters:\n  default: none\n  enable: [depguard]\n  settings:\n    depguard:\n      rules:\n        main:\n          files: ["${config-path}/apps/engine/*.go"]\n          deny:\n            - pkg: fmt\n              desc: forbidden in this fixture\n',
    );
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\n\nimport "fmt"\n\nfunc Value() { fmt.Println("hi") }\n',
    );
    const native = spawnSync(LINTER, ['run', '--config', config, '.'], {
      cwd: path.dirname(file),
      env: environment(root),
      encoding: 'utf8',
    });
    expect([0, 1]).toContain(native.status);
    const feedback = await hook(root, file);
    expect(feedback.includes('forbidden in this fixture')).toBe(
      native.stdout.includes('forbidden in this fixture'),
    );
    expect(feedback).not.toContain('Go lint could not run');
    const version = spawnSync(LINTER, ['version', '--short'], { encoding: 'utf8' }).stdout;
    expect(native.stdout.includes('forbidden in this fixture')).toBe(!/^v?2\.0\./.test(version));
  });
  it('preserves go.work resolution without visiting unrelated packages', async () => {
    const root = fixture();
    write(root, 'libs/shared/go.mod', 'module example.com/shared\n\ngo 1.23\n');
    write(root, 'libs/shared/value.go', 'package shared\n\nconst Value = 42\n');
    write(root, 'go.work', 'go 1.23\n\nuse (\n ./apps/engine\n ./libs/shared\n)\n');
    write(root, 'apps/engine/unrelated/bad.go', 'package unrelated\nvar Bad = Undefined\n');
    const file = write(
      root,
      'apps/engine/value.go',
      'package engine\n\nimport "example.com/shared"\n\nfunc Value() int { return shared.Value }\n',
    );
    expect(await hook(root, file)).toBe('');
  });

  it.each(['yes', 'no', 'on', 'off'])(
    'preserves native test-policy behavior for the legacy YAML scalar %s',
    async scalar => {
      const root = fixture();
      const config = write(
        root,
        '.safeword/.golangci.yml',
        `version: "2"\nrun:\n  tests: ${scalar}\nlinters: {default: none, enable: [govet]}\nformatters: {enable: [gofmt]}\n`,
      );
      const file = write(
        root,
        'apps/engine/value.go',
        'package engine\n\nfunc Value() int { return 42 }\n',
      );
      const marker = 'legacy-boolean-policy';
      write(
        root,
        'apps/engine/value_test.go',
        `package engine\nimport "fmt"\nimport "testing"\nfunc TestValue(t *testing.T) { fmt.Printf("%d", "${marker}") }\n`,
      );
      const native = spawnSync(LINTER, ['run', '--config', config, '.'], {
        cwd: path.dirname(file),
        env: environment(root),
        encoding: 'utf8',
      });
      expect([0, 1, 3]).toContain(native.status);
      const feedback = await hook(root, file);
      if (native.status === 3) {
        expect(`${native.stdout}${native.stderr}`).toContain('tests');
        expect(feedback).toContain('tests');
        expect(feedback).toMatch(/failed|could not run/);
      } else {
        expect(feedback.includes(marker)).toBe(native.stdout.includes(marker));
        if (native.status === 0) expect(feedback).toBe('');
        else expect(feedback).toContain('govet');
      }
    },
  );

  it.each(['cfg', 'gomod', 'gitroot'] as const)(
    'freezes the original %s matching base',
    async mode => {
      const root = fixture();
      write(root, 'go.mod', 'module example.com/outer\n\ngo 1.23\n');
      if (mode === 'gitroot') {
        await execute('git', ['init', '-q'], { cwd: root });
        await execute('git', ['init', '-q'], { cwd: path.join(root, 'apps/engine') });
      }
      write(
        root,
        '.safeword/.golangci.yml',
        JSON.stringify({
          version: '2',
          run: { 'relative-path-mode': mode },
          linters: {
            default: 'none',
            enable: ['govet'],
            exclusions: {
              rules: [
                {
                  path: mode === 'cfg' ? String.raw`^\.\./apps/engine/` : '^apps/engine/',
                  linters: ['govet'],
                },
              ],
            },
          },
        }),
      );
      write(root, 'apps/engine/helper.go', 'package engine\n\nfunc helper() int { return 42 }\n');
      const file = write(
        root,
        'apps/engine/value.go',
        'package engine\n\nimport "fmt"\n\nfunc Value() int { fmt.Printf("%d", "text"); return helper() }\n',
      );
      expect(await hook(root, file)).toBe('');
      write(
        root,
        '.safeword/.golangci.yml',
        JSON.stringify({
          version: '2',
          run: { 'relative-path-mode': mode },
          linters: { default: 'none', enable: ['govet'] },
        }),
      );
      const feedback = context(await hook(root, file));
      expect(feedback).toContain('govet');
      expect(feedback).toContain(file);
      expect(readdirSync(root).filter(name => name.startsWith('.safeword-go-lint-'))).toEqual([]);
      expect(
        readdirSync(path.join(root, '.safeword')).filter(name =>
          name.startsWith('.safeword-go-lint-'),
        ),
      ).toEqual([]);
    },
  );
});
