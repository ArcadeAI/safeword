import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});
function metadata(path: string): {
  content: string;
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const content = readFileSync(path, 'utf8');
  const match = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(content);
  if (!match?.groups) throw new Error(`Missing frontmatter: ${path}`);
  return {
    content,
    frontmatter: parse(match.groups.metadata ?? '') as Record<string, unknown>,
    body: match.groups.body ?? '',
  };
}
function run(directory: string, args: string[]): void {
  const parent = nodePath.dirname(directory);
  const result = spawnSync('bun', args, {
    cwd: directory,
    env: {
      ...process.env,
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      CODEX_HOME: nodePath.join(parent, 'codex-profile'),
      CLAUDE_CONFIG_DIR: nodePath.join(parent, 'claude-profile'),
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  expect(
    result.status,
    `HOST_CONTRACT_PROOF_UNAVAILABLE: ${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`,
  ).toBe(0);
}
describe('canonical workflow purpose reaches installed Cursor rules', () => {
  it.each([
    ['debug', 'safeword-debugging'],
    ['bdd', 'bdd-core'],
  ])(
    'derives the %s rule purpose from its canonical workflow',
    (skill, rule) => {
      const directory = createContractRepoFixture();
      fixtures.push(directory);
      cpSync(
        nodePath.resolve(import.meta.dirname, '../../dist'),
        nodePath.join(directory, 'packages/cli/dist'),
        { recursive: true },
      );
      const source = nodePath.join(directory, `packages/cli/templates/skills/${skill}/SKILL.md`);
      const original = metadata(source);
      const marker = `Canonical rule purpose: ${randomUUID()}`;
      original.frontmatter.description = marker;
      writeFileSync(source, `---\n${stringify(original.frontmatter)}---\n${original.body}`);
      run(directory, ['packages/cli/scripts/generate-cursor-wrappers.ts']);
      rmSync(nodePath.join(directory, '.cursor/rules'), { recursive: true });
      run(directory, [
        'packages/cli/src/cli.ts',
        'install',
        '--agents',
        'cursor',
        '--no-input',
        '--no-modify',
        '--offline',
        '--json',
      ]);
      expect(
        readFileSync(nodePath.join(directory, `.safeword/skills/${skill}/SKILL.md`), 'utf8'),
      ).toContain(marker);
      const installed = metadata(nodePath.join(directory, `.cursor/rules/${rule}.mdc`));
      expect(
        installed.frontmatter.description,
        'RULE_METADATA_OWNER_DRIFT: Cursor rule still authors a separate workflow purpose',
      ).toBe(marker);
      expect(installed.body.trim()).toBe(`@.safeword/skills/${skill}/SKILL.md`);
    },
    90_000,
  );
});
