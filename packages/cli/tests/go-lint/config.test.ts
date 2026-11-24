import { spawnSync } from 'node:child_process';
import {
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

import { prepareGoLintConfig } from '../../src/go-lint/config.js';

const directories: string[] = [];
function fixture(
  config: string,
  name = '.safeword/.golangci.yml',
): { root: string; file: string; source: string } {
  const prefix = path.join(tmpdir(), 'go-lint-config-');
  const root = realpathSync(mkdtempSync(prefix));
  directories.push(root);
  const file = path.join(root, 'apps/engine/value.go');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, 'package engine\n');
  const source = path.join(root, name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, config);
  return { root, file, source };
}
interface EffectiveConfig {
  linters: {
    enable: string[];
    exclusions: { paths: string[] };
    settings: {
      depguard: { rules: { main: { files: string[]; deny: { desc: string }[] } } };
      goheader: { 'template-path': string };
      gocritic: { settings: { ruleguard: { rules: string } } };
    };
  };
  output: { formats: { text: { path: string }; json: { path: string } } };
}
function effective(prepared: ReturnType<typeof prepareGoLintConfig>): EffectiveConfig {
  if (!prepared.temporary) throw new Error('Expected a temporary config');
  return JSON.parse(readFileSync(prepared.temporary, 'utf8')) as EffectiveConfig;
}
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Go configuration context', () => {
  it.each(['json', 'toml', 'yaml', 'yml'])(
    'selects %s before lower-priority formats in the same directory',
    extension => {
      const formats = [
        ['json', '{"version":"2"}'],
        ['toml', 'version = "2"\n'],
        ['yaml', 'version: "2"\n'],
        ['yml', 'version: "2"\n'],
      ];
      const { root, file, source } = fixture('version: "2"\n', `.golangci.${extension}`);
      const first = formats.findIndex(([name]) => name === extension);
      for (const [name, content] of formats.slice(first)) {
        writeFileSync(path.join(root, `.golangci.${name}`), content ?? '');
      }
      const prepared = prepareGoLintConfig(file, root, root);
      try {
        expect(prepared.source).toBe(source);
      } finally {
        prepared.cleanup();
      }
    },
  );

  it('keeps YAML merge-key exclusions without changing the source config', () => {
    const text = `version: "2"
run:
  relative-path-mode: wd
common: &common
  paths: [^apps/engine/]
linters:
  default: none
  enable: [govet]
  exclusions:
    <<: *common
`;
    const { root, file, source } = fixture(text);
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      expect(prepared.base).toBe(root);
      expect(effective(prepared).linters.exclusions.paths).toEqual(['^apps/engine/']);
      expect(readFileSync(source, 'utf8')).toBe(text);
    } finally {
      prepared.cleanup();
    }
    expect(readdirSync(root).some(name => name.startsWith('.safeword-go-lint-'))).toBe(false);
  });

  it('preserves Viper case-insensitive configuration keys', () => {
    const { root, file } = fixture(
      'VERSION: "2"\nRUN: {RELATIVE-PATH-MODE: wd}\nLINTERS: {ENABLE: [govet]}\n',
    );
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      expect(prepared.base).toBe(root);
      expect(effective(prepared).linters.enable).toEqual(['govet']);
    } finally {
      prepared.cleanup();
    }
  });

  it('uses distinct temporary configs for concurrent edits', () => {
    const { root, file } = fixture('version: "2"\nrun: { relative-path-mode: wd }\n');
    const first = prepareGoLintConfig(file, root, root);
    const second = prepareGoLintConfig(file, root, root);
    expect(first.temporary).not.toBe(second.temporary);
    first.cleanup();
    first.cleanup();
    expect(effective(second)).toHaveProperty('run.relative-path-mode', 'cfg');
    second.cleanup();
  });

  it('freezes only interpolated selectors and leaves literal rule text intact', () => {
    const { root, file, source } = fixture(
      JSON.stringify({
        version: '2',
        run: { 'relative-path-mode': 'wd' },
        linters: {
          settings: {
            depguard: {
              rules: {
                main: {
                  files: ['${config-path}/policy/*.go'],
                  deny: [{ pkg: 'fmt', desc: '${config-path} literal' }],
                },
              },
            },
            goheader: { 'template-path': 'header.txt' },
            gocritic: { settings: { ruleguard: { rules: 'rules/*.go,${base-path}/second.go' } } },
          },
        },
      }),
    );
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      const settings = effective(prepared).linters.settings;
      expect(settings.depguard.rules.main.files).toEqual([`${path.dirname(source)}/policy/*.go`]);
      expect(settings.depguard.rules.main.deny[0]?.desc).toBe('${config-path} literal');
      expect(settings.goheader['template-path']).toBe(path.join(root, 'header.txt'));
      expect(settings.gocritic.settings.ruleguard.rules).toBe(
        `${root}/rules/*.go,${root}/second.go`,
      );
    } finally {
      prepared.cleanup();
    }
  });

  it('leaves unsupported config-path selectors literal for golangci-lint v2.0', () => {
    const { root, file } = fixture(
      'version: "2"\nlinters:\n  settings:\n    depguard:\n      rules:\n        main:\n          files: ["${config-path}/*.go", "${base-path}/*.go"]\n',
    );
    const prepared = prepareGoLintConfig(file, root, root, false);
    try {
      expect(effective(prepared).linters.settings.depguard.rules.main.files).toEqual([
        '${config-path}/*.go',
        `${path.join(root, '.safeword')}/*.go`,
      ]);
    } finally {
      prepared.cleanup();
    }
  });

  it('parses a customer TOML config without requiring a hook-side dependency', () => {
    const { root, file } = fixture(
      'version = "2"\n[run]\nrelative-path-mode = "wd"\n[linters]\ndefault = "none"\nenable = ["govet"]\n',
      '.golangci.toml',
    );
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      expect(effective(prepared).linters.enable).toEqual(['govet']);
    } finally {
      prepared.cleanup();
    }
  });

  it('keeps original report destinations while capturing hook text', () => {
    const { root, file } = fixture(
      JSON.stringify({
        version: '2',
        output: {
          formats: {
            text: { path: 'lint.txt' },
            json: { path: 'reports/lint.json' },
          },
        },
      }),
    );
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      expect(prepared.textReport).toBe(path.join(root, 'lint.txt'));
      expect(effective(prepared).output.formats.text.path).toBe('stdout');
      expect(effective(prepared).output.formats.json.path).toBe(
        path.join(root, 'reports/lint.json'),
      );
    } finally {
      prepared.cleanup();
    }
  });

  it.each(['value: .nan', 'value: 0777', 'value: &loop [*loop]', 'value: !!binary SGVsbG8='])(
    'rejects lossy input rather than discarding policy: %s',
    value => {
      const { root, file } = fixture(`version: "2"\n${value}\n`);
      expect(() => prepareGoLintConfig(file, root, root)).toThrow();
      expect(
        readdirSync(path.join(root, '.safeword')).some(name =>
          name.startsWith('.safeword-go-lint-'),
        ),
      ).toBe(false);
    },
  );

  it('removes a partially written temporary config after a real filesystem write failure', () => {
    const text = JSON.stringify({ version: '2', value: 'x'.repeat(64 * 1024) });
    const { root, file, source } = fixture(text);
    const runner = path.join(root, 'write-limit.ts');
    writeFileSync(
      runner,
      `
      import { prepareGoLintConfig } from ${JSON.stringify(path.resolve(__dirname, '../../src/go-lint/config.ts'))};
      try {
        prepareGoLintConfig(${JSON.stringify(file)}, ${JSON.stringify(root)}, ${JSON.stringify(root)});
        process.exitCode = 1;
      } catch (error) {
        console.log(error.code);
      }
    `,
    );
    // Ignore SIGXFSZ so the kernel's file-size limit becomes a catchable write error.
    // The limit applies only to the child, after its fixture and source config exist.
    const result = spawnSync(
      'sh',
      ['-c', 'trap "" XFSZ; ulimit -f 1; exec "$@"', 'write-limit', 'bun', runner],
      {
        encoding: 'utf8',
        cwd: root,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('EFBIG');
    expect(
      readdirSync(path.dirname(source)).filter(name => name.startsWith('.safeword-go-lint-')),
    ).toEqual([]);
    expect(readFileSync(source, 'utf8')).toBe(text);
  });

  it('prefers the caller config over a nested host config in fallback mode', () => {
    const { root, file, source } = fixture('version: "2"\n', '.golangci.yml');
    writeFileSync(path.join(path.dirname(file), '.golangci.yml'), 'version: "1"\n');
    const prepared = prepareGoLintConfig(file, root, root);
    try {
      expect(prepared.source).toBe(source);
    } finally {
      prepared.cleanup();
    }
  });
});
