/**
 * Command tests for `safeword autonomy` (ticket HPQ43R). Drives the built CLI
 * against a temp project to prove the user-facing show/set surface and the
 * invalid-preset rejection. The policy resolution rules themselves are unit-
 * tested in `src/utils/autonomy-policy*.test.ts`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';

function configPath(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'config.json');
}

describe('safeword autonomy', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('show defaults to Full review (every axis ask) when no policy is set', async () => {
    const result = await runCli(['autonomy', 'show'], { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('execution: ask');
    expect(result.stdout).toContain('intent-and-scope: ask');
  });

  it('set records a valid preset in committed config and show reflects it', async () => {
    const set = await runCli(['autonomy', 'set', 'Hands-off'], { cwd });
    expect(set.exitCode).toBe(0);
    const config = JSON.parse(readFileSync(configPath(cwd), 'utf8')) as {
      autonomy?: { preset?: string };
    };
    expect(config.autonomy?.preset).toBe('Hands-off');

    const show = await runCli(['autonomy', 'show'], { cwd });
    expect(show.stdout).toContain('execution: autonomous');
  });

  it('set preserves unrelated config fields', async () => {
    writeFileSync(configPath(cwd), JSON.stringify({ installedPacks: ['typescript'] }));
    await runCli(['autonomy', 'set', 'Guard the contract'], { cwd });
    const config = JSON.parse(readFileSync(configPath(cwd), 'utf8')) as {
      installedPacks?: string[];
      autonomy?: { preset?: string };
    };
    expect(config.installedPacks).toEqual(['typescript']);
    expect(config.autonomy?.preset).toBe('Guard the contract');
  });

  it('set rejects an unknown preset without writing config', async () => {
    const result = await runCli(['autonomy', 'set', 'Reckless'], { cwd });
    expect(result.exitCode).toBe(1);
    expect(existsSync(configPath(cwd))).toBe(false);
  });

  it('override changes one axis and show reflects it, keeping the preset for the rest', async () => {
    await runCli(['autonomy', 'set', 'Hands-off'], { cwd });
    const result = await runCli(['autonomy', 'override', 'irreversible-design', 'ask'], { cwd });
    expect(result.exitCode).toBe(0);
    const show = await runCli(['autonomy', 'show'], { cwd });
    expect(show.stdout).toContain('irreversible-design: ask');
    expect(show.stdout).toContain('execution: autonomous');
  });

  it('override --personal wins over the project policy and writes the personal config', async () => {
    await runCli(['autonomy', 'set', 'Full review'], { cwd });
    const result = await runCli(['autonomy', 'override', 'execution', 'autonomous', '--personal'], {
      cwd,
    });
    expect(result.exitCode).toBe(0);
    expect(existsSync(nodePath.join(cwd, '.safeword', 'config.local.json'))).toBe(true);
    const show = await runCli(['autonomy', 'show'], { cwd });
    expect(show.stdout).toContain('execution: autonomous');
    expect(show.stdout).toContain('intent-and-scope: ask');
  });

  it('override rejects an unknown axis or posture', async () => {
    const badAxis = await runCli(['autonomy', 'override', 'vibes', 'ask'], { cwd });
    expect(badAxis.exitCode).toBe(1);
    const badPosture = await runCli(['autonomy', 'override', 'execution', 'sometimes'], { cwd });
    expect(badPosture.exitCode).toBe(1);
    expect(existsSync(configPath(cwd))).toBe(false);
  });
});
