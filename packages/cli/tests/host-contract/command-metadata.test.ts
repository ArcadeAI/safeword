import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

function run(directory: string, args: string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync('bun', args, {
    cwd: directory,
    env: {
      ...process.env,
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      ...environment,
    },
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  expect(
    result.status,
    `HOST_CONTRACT_PROOF_UNAVAILABLE\n${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`,
  ).toBe(0);
}

function changeCanonicalDescription(sourcePath: string, marker: string): void {
  const original = readFileSync(sourcePath, 'utf8');
  const match = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(original);
  if (!match?.groups) throw new Error('Canonical BDD frontmatter is missing');
  const metadata = parse(match.groups.metadata ?? '') as Record<string, unknown>;
  metadata.description = marker;
  writeFileSync(sourcePath, `---\n${stringify(metadata)}---\n${match.groups.body ?? ''}`);
}

describe('canonical command purpose reaches actual delivery', () => {
  it.each(['opencode-v1', 'opencode-v2', 'cursor-legacy'] as const)(
    'derives %s command metadata from the canonical skill',
    delivery => {
      const directory = createContractRepoFixture();
      fixtures.push(directory);
      // Source CLI installation uses the current built candidate dispatcher without writing it.
      symlinkSync(
        nodePath.resolve(import.meta.dirname, '../../dist'),
        nodePath.join(directory, 'packages/cli/dist'),
        'dir',
      );
      const parent = nodePath.dirname(directory);
      const profile = nodePath.join(parent, 'profile');
      mkdirSync(profile);
      const marker = `Canonical command purpose ${randomUUID()}`;
      const sourcePath = nodePath.join(directory, 'packages/cli/templates/skills/bdd/SKILL.md');
      changeCanonicalDescription(sourcePath, marker);

      let workflowPath: string;
      let commandDescription: string;
      if (delivery === 'opencode-v2') {
        const output = nodePath.join(parent, 'native-v2');
        run(
          directory,
          ['packages/cli/scripts/generate-opencode-v2-plugin.ts', '--output', output],
          {},
        );
        workflowPath = nodePath.join(output, 'skills/bdd/SKILL.md');
        const commands = JSON.parse(
          readFileSync(nodePath.join(output, 'commands.json'), 'utf8'),
        ) as { name: string; description: string }[];
        commandDescription = commands.find(command => command.name === 'bdd')?.description ?? '';
      } else {
        const agent = delivery === 'opencode-v1' ? 'opencode' : 'cursor';
        if (agent === 'cursor')
          run(directory, ['packages/cli/scripts/generate-cursor-wrappers.ts'], {});
        run(
          directory,
          [
            'packages/cli/src/cli.ts',
            'install',
            '--agents',
            agent,
            '--no-input',
            '--no-modify',
            '--offline',
            '--json',
          ],
          {
            OPENCODE_CONFIG_DIR: profile,
            CODEX_HOME: nodePath.join(parent, 'codex-profile'),
            CLAUDE_CONFIG_DIR: nodePath.join(parent, 'claude-profile'),
          },
        );
        const commandPath =
          agent === 'opencode'
            ? nodePath.join(profile, 'commands/safeword-bdd.md')
            : nodePath.join(directory, '.cursor/commands/bdd.md');
        workflowPath =
          agent === 'opencode'
            ? nodePath.join(profile, 'skills/safeword-bdd/SKILL.md')
            : nodePath.join(directory, '.safeword/skills/bdd/SKILL.md');
        commandDescription = readFileSync(commandPath, 'utf8');
      }
      // Confirms this delivery loaded the changed canonical root before checking the stale purpose.
      expect(readFileSync(workflowPath, 'utf8')).toContain(marker);
      expect(
        commandDescription,
        `COMMAND_METADATA_OWNER_DRIFT: ${delivery} still authors a separate purpose`,
      ).toContain(marker);
    },
    90_000,
  );
});
