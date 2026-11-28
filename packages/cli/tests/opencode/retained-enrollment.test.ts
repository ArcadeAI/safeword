import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { openCodeProfilePaths } from '../../src/opencode/config-root.js';
import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import {
  openCodeV2EnrollmentPath,
  readOpenCodeV2Enrollment,
} from '../../src/opencode/v2-enrollment.js';
import { stageOpenCodeV2Profile } from '../../src/opencode/v2-profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';

it('refreshes only the exact prior enrollment and same selected tuple, preserving ordinary refusal', () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'opencode-enrollment-refresh-'));
  const root = realpathSync(temporary);
  try {
    const profile = nodePath.join(root, 'profile'),
      project = nodePath.join(root, 'project'),
      candidate = nodePath.join(root, 'candidate');
    for (const directory of [
      profile,
      nodePath.join(project, '.safeword'),
      nodePath.join(candidate, 'runtime'),
    ])
      mkdirSync(directory, { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'Synthetic\n');
    writeFileSync(nodePath.join(candidate, 'index.js'), 'initial-entry');
    const runtime = nodePath.join(candidate, 'runtime/cli.js');
    writeFileSync(runtime, 'initial-runtime');
    const selection = {
      projectDirectory: project,
      packageDirectory: candidate,
      epoch: 'owned-fixture',
    };
    expect(installOpenCodeProfile(profile, { nativeV2: selection }).state).toBe('changed');
    const settings = nodePath.join(profile, 'opencode.jsonc');
    const userSettings = readFileSync(settings, 'utf8').replace('{', '{\n  "theme": "custom",');
    writeFileSync(settings, userSettings);
    const previous = readOpenCodeV2Enrollment(profile, project, candidate, layout);
    assert.ok(previous);
    const file = openCodeV2EnrollmentPath(profile, project, layout),
      before = readFileSync(file, 'utf8');
    writeFileSync(runtime, 'next-runtime');
    expect(installOpenCodeProfile(profile, { nativeV2: selection }).state).toBe('failed');
    expect(readFileSync(file, 'utf8')).toBe(before);
    const lock = openCodeProfilePaths(profile).lock;
    expect(
      stageOpenCodeV2Profile(profile, lock, selection, { ...previous, epoch: 'foreign' }).state,
    ).toBe('failed');
    expect(
      stageOpenCodeV2Profile(profile, lock, { ...selection, epoch: 'foreign' }, previous).state,
    ).toBe('failed');
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(
      stageOpenCodeV2Profile(profile, lock, selection, previous).state,
      'EXPECTED_NATIVE_ENROLLMENT_REFRESH_MISSING',
    ).toBe('changed');
    const current = readOpenCodeV2Enrollment(profile, project, candidate, layout);
    expect(current?.runtime_sha256).not.toBe(previous?.runtime_sha256);
    expect(current?.epoch).toBe('owned-fixture');
    expect(stageOpenCodeV2Profile(profile, lock, selection).state).toBe('healthy');
    const refreshed = readFileSync(file, 'utf8');
    writeFileSync(runtime, 'third-runtime');
    expect(stageOpenCodeV2Profile(profile, lock, selection, previous).state).toBe('failed');
    expect(readFileSync(file, 'utf8')).toBe(refreshed);
    expect(readFileSync(settings, 'utf8')).toBe(userSettings);
    expect(stageOpenCodeV2Profile(profile, lock, selection, current).state).toBe('changed');
    expect(readOpenCodeV2Enrollment(profile, project, candidate, layout)?.epoch).toBe(
      'owned-fixture',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('preserves a conflicting plugin declaration during enrollment', () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'opencode-enrollment-conflict-'));
  const root = realpathSync(temporary);
  try {
    const profile = nodePath.join(root, 'profile');
    const project = nodePath.join(root, 'project');
    const candidate = nodePath.join(root, 'package');
    mkdirSync(profile);
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# enrolled');
    mkdirSync(nodePath.join(candidate, 'runtime'), { recursive: true });
    writeFileSync(nodePath.join(candidate, layout.entry), 'entry');
    writeFileSync(nodePath.join(candidate, layout.runtime), 'runtime');
    const path = nodePath.join(profile, 'opencode.jsonc');
    const original = JSON.stringify({
      plugins: ['unrelated', { package: candidate, options: { custom: true } }],
    });
    writeFileSync(path, original);
    const result = installOpenCodeProfile(profile, {
      nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'fixture' },
    });
    expect(result.state).toBe('failed');
    expect(JSON.stringify(result)).toContain('different declaration');
    expect(readFileSync(path, 'utf8')).toBe(original);
    expect(existsSync(openCodeV2EnrollmentPath(profile, project, layout))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
