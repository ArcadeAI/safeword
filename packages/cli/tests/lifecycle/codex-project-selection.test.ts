import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithoutInstall, testCliPath } from '../helpers.js';

it.each([
  { selection: [], bootstrap: true },
  { selection: ['--agents=codex'], bootstrap: true },
  { selection: ['--agents=opencode'], bootstrap: false },
  { selection: ['--agents=none'], bootstrap: false },
])('plans project startup hooks according to $selection', ({ selection, bootstrap }) => {
  const cwd = createTemporaryDirectory();
  const preview = spawnSync(
    process.execPath,
    [testCliPath, 'plan', 'install', ...selection, '--json'],
    { cwd, encoding: 'utf8' },
  );
  expect(preview.status, preview.stderr).toBe(2);
  const report = JSON.parse(preview.stdout);
  expect(report).toMatchObject({ ok: true, state: 'action_required', errors: [] });
  const files = report.data.plan.effects.files as { target: string }[];
  expect(files.some(effect => effect.target === '.codex/config.toml')).toBe(bootstrap);
  expect(existsSync(path.join(cwd, '.codex/config.toml'))).toBe(false);
});

it('preserves an existing Codex configuration when only project setup is selected', async () => {
  const cwd = createTemporaryDirectory();
  mkdirSync(path.join(cwd, '.codex'));
  const config = path.join(cwd, '.codex/config.toml');
  const original = 'model = "user-choice"\n';
  writeFileSync(config, original);
  const result = await runCliWithoutInstall(
    ['install', '--agents=none', '--offline', '--no-input', '--json'],
    { cwd },
  );
  expect(result.exitCode).toBe(0);
  expect(readFileSync(config, 'utf8')).toBe(original);
  expect(JSON.parse(result.stdout).findings).not.toContainEqual(
    expect.objectContaining({ code: 'SETUP_CODEX_PLUGIN_HANDOFF' }),
  );
});
