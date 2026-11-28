import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

it('Cucumber resolves each required portable profile before loading support or launching hosts', () => {
  const repo = nodePath.resolve(import.meta.dirname, '../../../..');
  const ids = [
    'codex-0.167.0-portable-components',
    'cursor-cli-2026.11.05-86047df-portable-components',
    'cursor-ide-3.29.9-portable-components',
  ];
  const result = spawnSync(
    nodePath.join(repo, 'scripts/dev'),
    [
      'node',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `
        import { loadConfiguration } from '@cucumber/cucumber/api';
        const rows = [];
        for (const id of ${JSON.stringify(ids)}) {
          const { useConfiguration } = await loadConfiguration({
            file: 'packages/cli/tests/fixtures/host-contract/cucumber.portable-components.mjs',
            profiles: [id],
          });
          rows.push({ id, paths: useConfiguration.paths, imports: useConfiguration.import,
            parameters: useConfiguration.worldParameters });
        }
        console.log(JSON.stringify(rows));
      `,
    ],
    {
      cwd: repo,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        SAFEWORD_CODEX_TEST_CONFIG: '/unexecuted/codex-fixture.json',
        SAFEWORD_CURSOR_CLI: '/unexecuted/cursor',
        SAFEWORD_CURSOR_TEST_CONFIG: '/unexecuted/cursor-fixture.json',
      },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, `CUCUMBER_PORTABLE_PROFILE_UNAVAILABLE: ${result.stderr}`).toBe(0);
  const rows = JSON.parse(result.stdout.trim());
  expect(rows.map((row: { id: string }) => row.id)).toEqual(ids);
  const feature = readFileSync(
    nodePath.join(repo, 'features/consistent-host-contract.feature'),
    'utf8',
  ).split('\n');
  for (const [index, row] of rows.entries()) {
    expect(row.paths).toHaveLength(1);
    const [file, line] = row.paths[0].split(':', 2);
    expect(nodePath.resolve(repo, file)).toBe(
      nodePath.join(repo, 'features/consistent-host-contract.feature'),
    );
    expect(
      feature[Number(line) - 1]
        ?.split('|')
        .slice(1, -1)
        .map(cell => cell.trim()),
    ).toEqual(
      [
        ['Codex', '0.167.0', 'CLI'],
        ['Cursor', '2026.11.05-86047df', 'CLI'],
        ['Cursor', '3.29.9', 'IDE'],
      ][index],
    );
    expect(row.imports).toEqual([nodePath.join(repo, 'steps/consistent-host-portable.steps.ts')]);
    expect(row.parameters).toEqual({
      portableRuntime: index === 2 ? 'IDE' : 'CLI',
      codexFixtureFile: '/unexecuted/codex-fixture.json',
      cursorCli: '/unexecuted/cursor',
      cursorFixtureFile: '/unexecuted/cursor-fixture.json',
    });
  }
});
