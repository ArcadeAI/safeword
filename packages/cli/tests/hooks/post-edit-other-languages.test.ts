import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.ts';

const hooks = path.resolve(__dirname, '../../templates/hooks');
const cli = path.resolve(__dirname, '../../src/cli.ts');
const roots: string[] = [];
const markers: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const marker of markers.splice(0)) rmSync(marker, { force: true });
});

const rustCase = { name: 'Rust', extension: 'rs', lint: true, format: true } as const;
const shellCase = { name: 'shell', extension: 'sh', lint: true, format: true } as const;
const sqlHostCase = {
  name: 'SQL host Prettier',
  extension: 'sql',
  lint: false,
  format: true,
} as const;
const cases = [
  rustCase,
  { name: 'Go', extension: 'go', lint: true, format: true },
  { name: 'SQL opt-in', extension: 'sql', lint: true, format: false },
  sqlHostCase,
  { name: 'Markdown', extension: 'md', lint: false, format: true },
  { name: 'JSON', extension: 'json', lint: false, format: true },
  { name: 'CSS', extension: 'css', lint: false, format: true },
  { name: 'YAML', extension: 'yml', lint: false, format: true },
  { name: 'HTML', extension: 'html', lint: false, format: true },
  shellCase,
  { name: 'Go formatting only', extension: 'go', lint: false, format: true },
] as const;

const checkersByExtension: Record<string, string[]> = {
  rs: ['cargo clippy', 'rustfmt'],
  go: ['golangci-lint fmt', 'golangci-lint run'],
  sh: ['shellcheck', 'bunx prettier'],
};

function fixture(testCase: (typeof cases)[number]) {
  const root = mkdtempSync(path.join(tmpdir(), 'post-edit-other-'));
  roots.push(root);
  const write = (name: string, contents: string) => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
    return target;
  };
  const file = write(`pending.${testCase.extension}`, 'unfinished source\n');
  const sibling = write(`sibling.${testCase.extension}`, 'unrelated source\n');
  write('.safeword/.prettierrc', '{}');
  write('.safeword/config.json', '{"sql":{"fix":true},"selfReport":{"capture":false}}');
  write('.safeword/sqlfluff.cfg', '[sqlfluff]\n');
  write('.safeword/.golangci.yml', 'version: "2"\nissues: {fix: true}\n');
  write('Cargo.toml', '[package]\nname = "fixture"\nversion = "0.1.0"\n');
  if (testCase.name === 'SQL host Prettier')
    write('package.json', '{"devDependencies":{"prettier-plugin-sql":"*"}}');
  // Only the external tools are doubled. Each writer destroys the fixture,
  // while each checker emits its own diagnostic through its native channel.
  const mutate = String.raw`printf 'rewritten\n' > pending.${testCase.extension}`;
  const tools: Record<string, string> = {
    bunx: `case "$*" in *--check*) echo 'checking formatting'; echo format-diagnostic >&2; exit 1;; *) ${mutate};; esac`,
    shellcheck: 'echo lint-diagnostic; exit 1',
    sqlfluff: `case "$1" in fix) ${mutate};; esac; echo lint-diagnostic; exit 1`,
    cargo: String.raw`case "$*" in *--fix*) ${mutate}; printf 'rewritten\n' > sibling.rs;; esac; echo lint-diagnostic >&2; exit 0`,
    rustfmt: `case "$*" in *--check*) echo format-diagnostic >&2; exit 1;; *) ${mutate};; esac`,
    'golangci-lint': String.raw`case "$1" in version) echo 2.13.2; exit 0;; fmt) case "$*" in *--diff*) echo format-diagnostic;; *) ${mutate};; esac; exit 0;; run) case "$*" in *--fix=false*) ;; *) ${mutate}; printf 'rewritten\n' > sibling.go;; esac; if [ "$GO_LINT_CLEAN" = 1 ]; then exit 0; fi; echo lint-diagnostic; exit 1;; esac`,
  };
  for (const [tool, script] of Object.entries(tools)) {
    chmodSync(
      write(`bin/${tool}`, `#!/bin/sh\nprintf '%s\\n' "${tool} $*" >> checker-trace\n${script}\n`),
      0o755,
    );
  }
  const env = {
    ...process.env,
    CLAUDE_PROJECT_DIR: root,
    SAFEWORD_PLUGIN_CLI: cli,
    GO_LINT_CLEAN: testCase.name === 'Go formatting only' ? '1' : '',
    PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
  };
  return { root, file, sibling, env };
}

describe.each(['claude', 'cursor'])('%s non-mutating language checks', host => {
  it.each(cases)('preserves edited and sibling bytes for $name', testCase => {
    const { root, file, sibling, env } = fixture(testCase);
    const id = path.basename(root);
    if (host === 'cursor') markers.push(cursorEditedMarkerPath({ conversation_id: id }));
    const result = spawnSync(
      'bun',
      [path.join(hooks, host === 'claude' ? 'post-tool-lint.ts' : 'cursor/after-file-edit.ts')],
      {
        cwd: root,
        input: JSON.stringify({
          tool_input: { file_path: file },
          file_path: file,
          conversation_id: id,
          workspace_roots: [root],
        }),
        env,
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe('unfinished source\n');
    expect(readFileSync(sibling, 'utf8')).toBe('unrelated source\n');
    // A skipped hook cannot pass on preserved bytes alone, including Cursor's
    // intentionally silent feedback path: witness its actual external tools.
    const trace = readFileSync(path.join(root, 'checker-trace'), 'utf8');
    const checkers =
      testCase.name === 'SQL opt-in'
        ? ['sqlfluff']
        : (checkersByExtension[testCase.extension] ?? ['bunx prettier']);
    for (const checker of checkers)
      expect(
        trace.split('\n').some(line => line === checker || line.startsWith(`${checker} `)),
      ).toBe(true);
    if (host === 'claude') {
      if (testCase.lint) expect(result.stdout).toContain('lint-diagnostic');
      if (testCase.format) expect(result.stdout).toContain('format-diagnostic');
    }
  });
});

it('retains explicit Rust fix mode including its existing package-wide scope', () => {
  const { root, file, sibling, env } = fixture(rustCase);
  const result = spawnSync(
    'bun',
    [
      '-e',
      `const {lintFile}=await import(${JSON.stringify(path.join(hooks, 'lib/lint.ts'))}); await lintFile(${JSON.stringify(file)},${JSON.stringify(root)});`,
    ],
    { cwd: root, env, encoding: 'utf8', timeout: 15_000 },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe('rewritten\n');
  expect(readFileSync(sibling, 'utf8')).toBe('rewritten\n');
});

it('retains SQL formatting feedback when the fallback linter is unavailable', () => {
  const { root, file, sibling, env } = fixture(sqlHostCase);
  const runtime = spawnSync('bun', ['-p', 'process.execPath'], { encoding: 'utf8' });
  expect(runtime.status, runtime.stderr).toBe(0);
  rmSync(path.join(root, 'bin/sqlfluff'));
  const result = spawnSync(runtime.stdout.trim(), [path.join(hooks, 'post-tool-lint.ts')], {
    cwd: root,
    input: JSON.stringify({ tool_input: { file_path: file } }),
    env: { ...env, PATH: path.join(root, 'bin') },
    encoding: 'utf8',
    timeout: 15_000,
  });
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe('unfinished source\n');
  expect(readFileSync(sibling, 'utf8')).toBe('unrelated source\n');
  expect(result.stdout).toContain('format-diagnostic');
  expect(result.stdout).toContain('SQL/dbt');
});

it('keeps shell lint feedback without parser errors when Prettier has no shell plugin', () => {
  const { root, file, env } = fixture(shellCase);
  writeFileSync(
    path.join(root, 'bin/bunx'),
    '#!/bin/sh\n[ "$1" = prettier ] || exit 2\nshift\nexec "$PRETTIER_SMOKE_BIN" "$@"\n',
  );
  const result = spawnSync(
    'bun',
    [
      '-e',
      `const {lintFile}=await import(${JSON.stringify(path.join(hooks, 'lib/lint.ts'))}); console.log(JSON.stringify(await lintFile(${JSON.stringify(file)},${JSON.stringify(root)},{fix:false})));`,
    ],
    {
      cwd: root,
      env: {
        ...env,
        PRETTIER_SMOKE_BIN: path.resolve(__dirname, '../../../../node_modules/.bin/prettier'),
      },
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe('unfinished source\n');
  expect(JSON.parse(result.stdout)).toEqual({ warnings: [], errors: 'lint-diagnostic' });
});
