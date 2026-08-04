import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  applyLegacyGlobalGuidanceCleanup,
  observeLegacyGlobalGuidance,
  planLegacyGlobalGuidanceCleanup,
} from '../../src/codex-plugin/legacy-global-guidance.js';
import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';

const exactLegacy = [
  '# Global Instructions for AI Coding Agents',
  '## Feature Development Workflow (CRITICAL - Always Follow)',
  'Search `planning/user-stories/` or `docs/user-stories/`.',
  'Read `~/.agents/coding/guides/testing-methodology.md`.',
].join('\n');

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function historicalLegacy(): string {
  const encoded = readFileSync(
    nodePath.join(import.meta.dirname, '../fixtures/legacy-global-guidance.txt.gz.b64'),
    'utf8',
  );
  return gunzipSync(Buffer.from(encoded.replaceAll(/\s/gu, ''), 'base64')).toString('utf8');
}

function fixture() {
  const root = createTemporaryDirectory();
  const codexHome = nodePath.join(root, 'codex-home');
  mkdirSync(codexHome, { recursive: true });
  const agentsPath = nodePath.join(codexHome, 'AGENTS.md');
  const registeredDigests = new Set([digest(exactLegacy)]);
  return { root, codexHome, agentsPath, registeredDigests };
}

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

describe('legacy Codex profile guidance observation', () => {
  it('uses a non-empty override as the active global instructions file', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const overridePath = nodePath.join(current.codexHome, 'AGENTS.override.md');
    writeFileSync(overridePath, '# My current profile policy');

    expect(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    ).toMatchObject({ state: 'unrelated', path: overridePath });
  });

  it('classifies exact registered content separately from edited legacy content', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);

    expect(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    ).toMatchObject({ state: 'exact_legacy', path: current.agentsPath });

    writeFileSync(current.agentsPath, `${exactLegacy}\nUser addition.`);
    expect(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    ).toMatchObject({ state: 'suspected_legacy', path: current.agentsPath });
  });

  it('does not flag unrelated user-authored guidance', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, '# Always run accessibility tests before release.');

    expect(observeLegacyGlobalGuidance({ CODEX_HOME: current.codexHome })).toMatchObject({
      state: 'unrelated',
      path: current.agentsPath,
    });
  });
});

describe('legacy Codex profile guidance cleanup', () => {
  it('moves confirmed exact content to a fixed recoverable backup', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const observation = observeLegacyGlobalGuidance(
      { CODEX_HOME: current.codexHome },
      { registeredDigests: current.registeredDigests },
    );
    const preview = planLegacyGlobalGuidanceCleanup(observation);

    expect(preview.ok).toBe(true);
    const result = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId: preview.plan?.id ?? '',
      registeredDigests: current.registeredDigests,
    });

    expect(result).toMatchObject({ ok: true, changed: true });
    expect(existsSync(current.agentsPath)).toBe(false);
    expect(readFileSync(`${current.agentsPath}.safeword-legacy.bak`, 'utf8')).toBe(exactLegacy);
  });

  it('refuses stale plans and occupied backup paths without changing either file', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const preview = planLegacyGlobalGuidanceCleanup(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    );

    writeFileSync(current.agentsPath, `${exactLegacy}\nUser edit.`);
    const stale = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId: preview.plan?.id ?? '',
      registeredDigests: current.registeredDigests,
    });
    expect(stale).toMatchObject({ ok: false, code: 'PLAN_STALE' });
    expect(readFileSync(current.agentsPath, 'utf8')).toContain('User edit.');

    writeFileSync(current.agentsPath, exactLegacy);
    writeFileSync(`${current.agentsPath}.safeword-legacy.bak`, 'existing backup');
    const occupied = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId:
        planLegacyGlobalGuidanceCleanup(
          observeLegacyGlobalGuidance(
            { CODEX_HOME: current.codexHome },
            { registeredDigests: current.registeredDigests },
          ),
        ).plan?.id ?? '',
      registeredDigests: current.registeredDigests,
    });
    expect(occupied).toMatchObject({ ok: false, code: 'BACKUP_OCCUPIED' });
    expect(readFileSync(current.agentsPath, 'utf8')).toBe(exactLegacy);
    expect(readFileSync(`${current.agentsPath}.safeword-legacy.bak`, 'utf8')).toBe(
      'existing backup',
    );
  });

  it('verifies the moved artifact and restores content changed at the move boundary', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const preview = planLegacyGlobalGuidanceCleanup(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    );

    const result = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId: preview.plan?.id ?? '',
      registeredDigests: current.registeredDigests,
      beforeMove: sourcePath => {
        writeFileSync(sourcePath, `${exactLegacy}\nBoundary edit.`);
      },
    });

    expect(result).toMatchObject({ ok: false, code: 'SOURCE_CHANGED_DURING_MOVE' });
    expect(readFileSync(current.agentsPath, 'utf8')).toContain('Boundary edit.');
    expect(existsSync(`${current.agentsPath}.safeword-legacy.bak`)).toBe(false);
  });

  it('preserves a concurrently recreated active file and the mismatched moved artifact', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const preview = planLegacyGlobalGuidanceCleanup(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    );

    const result = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId: preview.plan?.id ?? '',
      registeredDigests: current.registeredDigests,
      beforeMove: sourcePath => {
        writeFileSync(sourcePath, `${exactLegacy}\nBoundary edit.`);
      },
      afterMove: sourcePath => {
        writeFileSync(sourcePath, 'concurrent replacement');
      },
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'SOURCE_CHANGED_DURING_MOVE',
      recoveryPath: `${current.agentsPath}.safeword-recovery`,
    });
    expect(readFileSync(current.agentsPath, 'utf8')).toBe('concurrent replacement');
    expect(readFileSync(`${current.agentsPath}.safeword-recovery`, 'utf8')).toContain(
      'Boundary edit.',
    );
  });

  it('does not overwrite a backup created at the move boundary', () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, exactLegacy);
    const preview = planLegacyGlobalGuidanceCleanup(
      observeLegacyGlobalGuidance(
        { CODEX_HOME: current.codexHome },
        { registeredDigests: current.registeredDigests },
      ),
    );

    const result = applyLegacyGlobalGuidanceCleanup({
      environment: { CODEX_HOME: current.codexHome },
      planId: preview.plan?.id ?? '',
      registeredDigests: current.registeredDigests,
      beforeMove: sourcePath => {
        writeFileSync(`${sourcePath}.safeword-legacy.bak`, 'late backup');
      },
    });

    expect(result).toMatchObject({ ok: false, code: 'BACKUP_OCCUPIED' });
    expect(readFileSync(current.agentsPath, 'utf8')).toBe(exactLegacy);
    expect(readFileSync(`${current.agentsPath}.safeword-legacy.bak`, 'utf8')).toBe('late backup');
  });

  it('refuses a public stale plan after exact guidance becomes unrelated', async () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, historicalLegacy());
    const environment = { CODEX_HOME: current.codexHome, SAFEWORD_NO_UPDATE_CHECK: '1' };
    const preview = await runCli(['codex', 'clean-guidance', '--json', '--no-input'], {
      cwd: current.root,
      env: environment,
    });
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    writeFileSync(current.agentsPath, '# Unrelated replacement policy');

    const result = await runCli(
      ['codex', 'clean-guidance', '--yes', '--plan', planId, '--json', '--no-input'],
      { cwd: current.root, env: environment },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(readFileSync(current.agentsPath, 'utf8')).toBe('# Unrelated replacement policy');
  });

  it('does not add profile findings to doctor in an unenrolled repository', async () => {
    const current = fixture();
    roots.push(current.root);
    writeFileSync(current.agentsPath, historicalLegacy());

    const result = await runCli(['doctor', '--json', '--no-input'], {
      cwd: current.root,
      env: { CODEX_HOME: current.codexHome, SAFEWORD_NO_UPDATE_CHECK: '1' },
    });
    const output = JSON.parse(result.stdout) as { findings: { code: string }[] };

    expect(output.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PROJECT_NOT_CONFIGURED' })]),
    );
    expect(output.findings.some(finding => finding.code.includes('GLOBAL_GUIDANCE'))).toBe(false);
  });

  it('publishes a shell-safe recovery command for custom profile paths', async () => {
    const current = fixture();
    roots.push(current.root);
    const codexHome = nodePath.join(current.root, "profile path's $policy");
    mkdirSync(codexHome, { recursive: true });
    const agentsPath = nodePath.join(codexHome, 'AGENTS.md');
    writeFileSync(agentsPath, historicalLegacy());
    const environment = { CODEX_HOME: codexHome, SAFEWORD_NO_UPDATE_CHECK: '1' };
    const preview = await runCli(['codex', 'clean-guidance', '--json', '--no-input'], {
      cwd: current.root,
      env: environment,
    });
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    const applied = await runCli(
      ['codex', 'clean-guidance', '--yes', '--plan', planId, '--json', '--no-input'],
      { cwd: current.root, env: environment },
    );
    const recoveryCommand = (JSON.parse(applied.stdout) as { recovery: { command: string }[] })
      .recovery[0]?.command;

    expect(applied.exitCode).toBe(0);
    expect(recoveryCommand).toContain("'\"'\"'");
    const restored = spawnSync('sh', ['-c', recoveryCommand ?? 'exit 9'], { encoding: 'utf8' });
    expect(restored.status, restored.stderr).toBe(0);
    expect(readFileSync(agentsPath, 'utf8')).toBe(historicalLegacy());
  });
});
