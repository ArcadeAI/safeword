import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { installOpenCodeProfile, uninstallOpenCodeProfile } from '../../src/opencode/profile.js';
import { openCodeV2EnrollmentPath } from '../../src/opencode/v2-enrollment.js';
import { observeOpenCodeV2Removal } from '../../src/opencode/v2-profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';

function publicUninstall(project: string, profile: string, ...options: string[]) {
  const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
  const result = spawnSync(
    process.execPath,
    [cli, 'uninstall', '--agents=opencode', '--offline', '--json', ...options],
    {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: nodePath.dirname(profile),
        CODEX_HOME: nodePath.join(nodePath.dirname(profile), 'codex'),
        CLAUDE_CONFIG_DIR: nodePath.join(nodePath.dirname(profile), 'claude'),
        OPENCODE_CONFIG_DIR: profile,
      },
      timeout: 30_000,
    },
  );
  expect(result.error).toBeUndefined();
  return JSON.parse(result.stdout) as {
    state: string;
    findings: { code: string }[];
    next_actions: unknown[];
    data: { plan: { id: string; effects: { destructive: { target: string }[] } } };
  };
}

it('removes only the selected OpenCode enrollment and drops the shared entry after its last user', () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'opencode-profile-removal-'));
  const root = realpathSync(temporary);
  try {
    const profile = nodePath.join(root, 'profile');
    const config = nodePath.join(profile, 'opencode.jsonc');
    const candidate = nodePath.join(root, 'candidate');
    const first = nodePath.join(root, 'first');
    const second = nodePath.join(root, 'second');
    mkdirSync(nodePath.join(candidate, 'runtime'), { recursive: true });
    mkdirSync(profile);
    writeFileSync(nodePath.join(candidate, layout.entry), 'entry');
    writeFileSync(nodePath.join(candidate, layout.runtime), 'runtime');
    writeFileSync(config, '{"theme":"custom","plugins":["unrelated"]}\n');
    chmodSync(config, 0o640);
    for (const projectDirectory of [first, second]) {
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(projectDirectory, '.safeword/SAFEWORD.md'), 'fixture');
      expect(
        installOpenCodeProfile(profile, {
          nativeV2: { projectDirectory, packageDirectory: candidate, epoch: 'fixture' },
        }).state,
      ).toBe('changed');
    }
    expect(statSync(config).mode & 0o777).toBe(0o640);
    const firstEnrollment = openCodeV2EnrollmentPath(profile, first, layout);
    const secondEnrollment = openCodeV2EnrollmentPath(profile, second, layout);
    const original = readFileSync(config, 'utf8').replace('"theme"', '// User note\n  "theme"');
    writeFileSync(config, original);
    const sibling = readFileSync(secondEnrollment);
    const sharedPlan = observeOpenCodeV2Removal(profile, second);
    expect(sharedPlan?.fingerprint).toBeDefined();
    expect(sharedPlan?.declaration).toBeUndefined();
    const preview = publicUninstall(first, profile);
    expect(
      preview.data.plan.effects.destructive.filter(effect => effect.target.startsWith(profile)),
    ).toEqual([expect.objectContaining({ target: firstEnrollment })]);
    expect(publicUninstall(first, profile, '--yes', '--plan', preview.data.plan.id).state).toBe(
      'changed',
    );
    expect(existsSync(firstEnrollment)).toBe(false);
    expect(readFileSync(secondEnrollment)).toEqual(sibling);
    expect(readFileSync(config, 'utf8')).toBe(original);
    expect(
      uninstallOpenCodeProfile(profile, second, { fingerprint: sharedPlan?.fingerprint }).findings,
    ).toContainEqual(expect.objectContaining({ code: 'PLAN_STALE' }));
    expect(readFileSync(secondEnrollment)).toEqual(sibling);
    expect(readFileSync(config, 'utf8')).toBe(original);
    const lastPreview = publicUninstall(second, profile);
    expect(
      lastPreview.data.plan.effects.destructive.filter(effect => effect.target.startsWith(profile)),
    ).toEqual([
      expect.objectContaining({ target: secondEnrollment }),
      expect.objectContaining({ target: config }),
    ]);
    const edited = original.replace('"profileDirectory"', '"customOption"');
    writeFileSync(config, edited);
    const refusal = publicUninstall(second, profile, '--yes', '--plan', lastPreview.data.plan.id);
    expect(refusal.findings).toContainEqual(
      expect.objectContaining({ code: 'OPENCODE_V2_REMOVAL_UNAVAILABLE' }),
    );
    expect(refusal.next_actions).toEqual([]);
    expect(existsSync(nodePath.join(second, '.safeword/SAFEWORD.md'))).toBe(true);
    expect(readFileSync(config, 'utf8')).toBe(edited);
    expect(readFileSync(secondEnrollment)).toEqual(sibling);
    writeFileSync(config, original);
    rmSync(candidate, { recursive: true });
    expect(uninstallOpenCodeProfile(profile, second).state).toBe('changed');
    expect(existsSync(secondEnrollment)).toBe(false);
    const finalConfig = readFileSync(config, 'utf8');
    expect(finalConfig).toContain('// User note');
    expect(statSync(config).mode & 0o777).toBe(0o640);
    expect(JSON.parse(finalConfig.replace('// User note', ''))).toEqual({
      theme: 'custom',
      plugins: ['unrelated'],
    });
    expect(uninstallOpenCodeProfile(profile, second).state).toBe('healthy');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
