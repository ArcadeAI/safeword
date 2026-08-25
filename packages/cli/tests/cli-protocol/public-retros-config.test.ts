import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

describe('project public-retros', () => {
  const projectUUID = '11111111-2222-3333-4444-555555555555';

  it.each([
    ['off', true, false],
    ['off', undefined, false],
    ['off', false, false],
    ['on', false, true],
    ['on', undefined, true],
    ['on', true, true],
  ] as const)(
    'turns collection %s from %s without changing the project identity',
    async (state, initialValue, storedValue) => {
      const directory = createTemporaryDirectory();
      const configPath = nodePath.join(directory, '.safeword/config.json');
      mkdirSync(nodePath.dirname(configPath), { recursive: true });
      const config: Record<string, unknown> = {
        projectUUID,
      };
      if (initialValue !== undefined) config.publicRetrospectiveCollection = initialValue;
      writeFileSync(configPath, `${JSON.stringify(config)}\n`);

      const result = await runCliWithoutInstall(
        ['project', 'public-retros', state, '--json', '--cwd', directory],
        { cwd: directory },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({
        projectUUID,
        publicRetrospectiveCollection: storedValue,
      });
    },
  );

  it.each([['invalid'], ['OFF'], []] as const)(
    'rejects invalid state arguments without changing valid configuration',
    async (...state) => {
      const directory = createTemporaryDirectory();
      const configPath = nodePath.join(directory, '.safeword/config.json');
      mkdirSync(nodePath.dirname(configPath), { recursive: true });
      const original = `${JSON.stringify({ projectUUID })}\n`;
      writeFileSync(configPath, original);

      const result = await runCliWithoutInstall(
        ['project', 'public-retros', ...state, '--json', '--cwd', directory],
        { cwd: directory },
      );

      expect(result.exitCode).not.toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ state: 'failed', changed: false });
      expect(readFileSync(configPath, 'utf8')).toBe(original);
    },
  );

  it.each([
    ['missing', undefined],
    ['unparseable', '{not json'],
  ] as const)('rejects %s configuration without changing it', async (_condition, content) => {
    const directory = createTemporaryDirectory();
    const configPath = nodePath.join(directory, '.safeword/config.json');
    mkdirSync(nodePath.dirname(configPath), { recursive: true });
    if (content !== undefined) writeFileSync(configPath, content);

    const result = await runCliWithoutInstall(
      ['project', 'public-retros', 'off', '--json', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'failed', changed: false });
    if (content === undefined) expect(existsSync(configPath)).toBe(false);
    else expect(readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('creates nothing outside a SafeWord project', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCliWithoutInstall(
      ['project', 'public-retros', 'off', '--json', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'failed', changed: false });
    expect(existsSync(nodePath.join(directory, '.safeword'))).toBe(false);
  });
});
