import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const helperPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/record-skill-invocation.ts',
);
const resolverPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/resolve-namespace-root.ts',
);

function runHelper(projectDirectory: string, skillName: string, sessionId = 'session-abc'): string {
  return execFileSync('bun', [helperPath, projectDirectory, skillName], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
  });
}

describe('record-skill-invocation helper (88QCHJ)', () => {
  it('prints the configured namespace root for command snippets', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-notes' } }),
    );

    const output = execFileSync('bun', [resolverPath, projectDirectory], {
      encoding: 'utf8',
    });

    expect(output).toBe(nodePath.join(projectDirectory, 'team-notes'));
  });

  it('writes the invocation under a configured namespace root and prints success', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-notes' } }),
    );

    const output = runHelper(projectDirectory, 'verify');

    expect(output.trim()).toBe('[skill-invocation-log] verify ✓');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, 'team-notes', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z session-abc verify\n$/,
    );
  });

  it('prefers an explicit session id argument over the environment fallback', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.project'), { recursive: true });

    const output = execFileSync(
      'bun',
      [helperPath, projectDirectory, 'verify', 'explicit-session'],
      {
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_SESSION_ID: 'env-session' },
      },
    );

    expect(output.trim()).toBe('[skill-invocation-log] verify ✓');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent).toMatch(/ explicit-session verify$/m);
    expect(logContent).not.toContain('env-session');
  });

  it('appends audit after verify without overwriting the existing log', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.project'), { recursive: true });

    runHelper(projectDirectory, 'verify', 'session-one');
    runHelper(projectDirectory, 'audit', 'session-one');

    const lines = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    )
      .trim()
      .split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/ session-one verify$/);
    expect(lines[1]).toMatch(/ session-one audit$/);
  });

  it('rejects invalid skill names before writing to the log', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));

    const result = spawnSync('bun', [helperPath, projectDirectory, '../verify'], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_SESSION_ID: 'session-abc' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid skill name "../verify"');
  });

  it('falls back to CLAUDE_CODE_SESSION_ID when CLAUDE_SESSION_ID is empty (remote container)', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.project'), { recursive: true });

    const output = execFileSync('bun', [helperPath, projectDirectory, 'verify'], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: 'remote-session-uuid' },
    });

    expect(output.trim()).toBe('[skill-invocation-log] verify ✓');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent).toMatch(/ remote-session-uuid verify$/m);
  });

  it('fails closed when no session id is available', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    const env = { ...process.env };
    delete env.CLAUDE_SESSION_ID;
    delete env.CLAUDE_CODE_SESSION_ID;

    const result = spawnSync('bun', [helperPath, projectDirectory, 'verify'], {
      encoding: 'utf8',
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing session id for skill invocation log');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });
});
