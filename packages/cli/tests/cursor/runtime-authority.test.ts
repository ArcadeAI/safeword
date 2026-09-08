import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertCursorRuntimeAuthority,
  type RuntimeAuthorityAsset,
} from '../../src/plugin-runtime-authority.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  SKIP_INSTALL_ENV,
} from '../helpers.js';

const project = createTemporaryDirectory();
const catalogue: RuntimeAuthorityAsset[] = [];

beforeAll(() => {
  const cli = nodePath.resolve(import.meta.dirname, '../../src/cli.ts');
  const result = spawnSync(
    'bun',
    [cli, 'install', '--agents=cursor', '--no-modify', '--no-input', '--json'],
    {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, ...SKIP_INSTALL_ENV },
    },
  );
  expect(result.status, result.stderr || result.stdout).toBe(0);
  catalogue.push(
    ...['.safeword/skills', '.cursor'].flatMap(root =>
      readdirSync(nodePath.join(project, root), { recursive: true, encoding: 'utf8' })
        .filter(path => /\.mdc?$/u.test(path))
        .map(path => ({
          relativePath: `${root}/${path}`,
          content: readFileSync(nodePath.join(project, root, path), 'utf8'),
        })),
    ),
  );
});

afterAll(() => {
  removeTemporaryDirectory(project);
});

describe('Cursor runtime authority', () => {
  it("accepts the generated Cursor catalogue's project authority", () => {
    expect(() => {
      assertCursorRuntimeAuthority(catalogue);
    }).not.toThrow();
  });

  it.each([
    'bun "${CLAUDE_PLUGIN_ROOT}/runtime/cli.js" project audit-scope',
    'npx tsx "${CLAUDE_PLUGIN_ROOT}/runtime/cli.js"',
    'bunx safeword --config "$CODEX_HOME/config.toml"',
    'python3 .codex/helper.py',
    'deno run .opencode/helper.ts',
    '. "$CODEX_HOME/lib.sh"',
    'CLI="${CLAUDE_PLUGIN_ROOT}/runtime/cli.js"\nbun "$CLI"',
    '.claude/skills/helper.sh',
    'ls ~/.claude/projects/; python3 .codex/helper.py',
    'bun .claude/projects/helper.ts',
    'bun "${CODEX_HOME:-$HOME/.codex}/sessions/../plugins/cache/helper.ts"',
  ])('rejects cross-host runtime regardless of command shape: %s', command => {
    const assets = catalogue.map(asset =>
      asset.relativePath === '.safeword/skills/audit/SKILL.md'
        ? {
            ...asset,
            content: `${asset.content}\n${command}\n`,
          }
        : asset,
    );
    expect(() => {
      assertCursorRuntimeAuthority(assets);
    }).toThrow('.safeword/skills/audit/SKILL.md');
  });
});
