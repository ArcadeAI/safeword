import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runRecordSkillInvocation } from '../../src/commands/record-skill-invocation.js';
import { createTemporaryDirectory } from '../helpers.js';

afterEach(() => vi.unstubAllEnvs());

describe('project record-skill-invocation', () => {
  it('reports no proof recorded when the current run has no identity', async () => {
    for (const name of ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID']) {
      vi.stubEnv(name, undefined);
    }
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');

    const result = await runRecordSkillInvocation(cwd, 'verify', undefined);

    expect(result).toMatchObject({ state: 'healthy', changed: false });
    expect(result.findings.map(finding => finding.code)).toContain(
      'SKILL_INVOCATION_IDENTITY_MISSING',
    );
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('does not create state through a direct helper in an unenrolled repository', () => {
    const cwd = createTemporaryDirectory();
    const helper = nodePath.resolve(
      import.meta.dirname,
      '../../templates/hooks/record-skill-invocation.ts',
    );

    const result = spawnSync('bun', [helper, cwd, 'verify', 'session-1'], {
      cwd,
      encoding: 'utf8',
    });

    expect(`${result.stdout}${result.stderr}`).toMatch(/not enrolled/iu);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('verify ✓');
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.safeword'))).toBe(false);
  });

  it('does not enroll a repository as a side effect of workflow logging', async () => {
    const cwd = createTemporaryDirectory();

    const result = await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(result.state).toBe('healthy');
    expect(result.findings.map(finding => finding.code)).toEqual(['PROJECT_NOT_ENROLLED']);
    expect(result.nextActions).toEqual([]);
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.safeword'))).toBe(false);
  });

  it('creates missing runtime state and its precise ignore rule without installing', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');

    const result = await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(result.state).toBe('changed');
    expect(readFileSync(nodePath.join(cwd, '.project/skill-invocations.log'), 'utf8')).toContain(
      'session-1 verify',
    );
    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toContain(
      '/skill-invocations.log',
    );
    expect(existsSync(nodePath.join(cwd, '.safeword/hooks'))).toBe(false);
  });

  it('reuses an existing framework directory without changing its sibling content', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(cwd, '.project/customer-note.txt'), 'keep exactly\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(readFileSync(nodePath.join(cwd, '.project/customer-note.txt'), 'utf8')).toBe(
      'keep exactly\n',
    );
    expect(readFileSync(nodePath.join(cwd, '.project/skill-invocations.log'), 'utf8')).toContain(
      'session-1 verify',
    );
  });

  it('does not invent authored knowledge or project configuration during lazy state creation', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(existsSync(nodePath.join(cwd, '.project/personas.md'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.project/surfaces.md'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.safeword/config.json'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.project/skill-invocations.log'))).toBe(true);
  });

  it('appends one precise state rule while preserving customer ignore content', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(cwd, '.project/.gitignore'), 'customer-cache/\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toBe(
      'customer-cache/\n/skill-invocations.log\n',
    );
  });

  it('does not duplicate an existing exact transient-state ignore rule', async () => {
    const cwd = createTemporaryDirectory();
    execFileSync('git', ['init', '--quiet'], { cwd });
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(cwd, '.project/.gitignore'), '/skill-invocations.log\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toBe(
      '/skill-invocations.log\n',
    );
  });

  it('preserves a broader customer ignore rule without adding a duplicate', async () => {
    const cwd = createTemporaryDirectory();
    execFileSync('git', ['init', '--quiet'], { cwd });
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(cwd, '.project/.gitignore'), '/*\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toBe('/*\n');
  });

  it('updates existing framework state without replacing in-flight values', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');
    writeFileSync(
      nodePath.join(cwd, '.project/skill-invocations.log'),
      'prior-session quality-review\n',
    );
    writeFileSync(nodePath.join(cwd, '.project/.gitignore'), '/skill-invocations.log\n');

    await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    const updated = readFileSync(nodePath.join(cwd, '.project/skill-invocations.log'), 'utf8');
    expect(updated.startsWith('prior-session quality-review\n')).toBe(true);
    expect(updated).toContain('session-1 verify\n');
    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toBe(
      '/skill-invocations.log\n',
    );
  });
});
