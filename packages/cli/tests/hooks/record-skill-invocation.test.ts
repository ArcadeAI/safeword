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
const beforeShellAdapterPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/cursor/before-shell-execution.ts',
);
const codexPreToolPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/codex/pre-tool-quality.ts',
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

function envWithoutRunIdentity(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.CLAUDE_SESSION_ID;
  delete environment.CLAUDE_CODE_SESSION_ID;
  delete environment.CODEX_THREAD_ID;
  delete environment.SAFEWORD_AGENT_RUNTIME;
  return environment;
}

function runCursorBeforeShell(input: {
  projectDirectory: string;
  command: string;
  conversationId: string;
}): void {
  const result = spawnSync('bun', [beforeShellAdapterPath], {
    cwd: input.projectDirectory,
    input: JSON.stringify({
      conversation_id: input.conversationId,
      command: input.command,
      workspace_roots: [input.projectDirectory],
    }),
    encoding: 'utf8',
    env: {
      ...envWithoutRunIdentity(),
      CLAUDE_PROJECT_DIR: input.projectDirectory,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout) as { permission?: string }).toEqual({ permission: 'allow' });
}

function runCodexPreTool(input: {
  projectDirectory: string;
  command: string;
  sessionId: string;
}): void {
  const result = spawnSync('bun', [codexPreToolPath], {
    cwd: input.projectDirectory,
    input: JSON.stringify({
      session_id: input.sessionId,
      tool_name: 'Bash',
      tool_input: { command: input.command },
    }),
    encoding: 'utf8',
    env: {
      ...envWithoutRunIdentity(),
      CLAUDE_PROJECT_DIR: input.projectDirectory,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  expect(result.status).toBe(0);
}

function installedProofCommand(projectDirectory: string, skillName: string): string {
  return `bun "${projectDirectory}/.safeword/hooks/record-skill-invocation.ts" "${projectDirectory}" ${skillName}`;
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

  it('records Codex proof after the PreToolUse hook binds the current session id', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCodexPreTool({
      projectDirectory,
      command: installedProofCommand(projectDirectory, 'quality-review'),
      sessionId: 'codex-session-uuid',
    });

    const output = execFileSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(output.trim()).toBe('[skill-invocation-log] quality-review ✓');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent).toMatch(/ codex-session-uuid quality-review$/m);
  });

  it('does not bind Codex proof when a shell command only mentions the helper', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCodexPreTool({
      projectDirectory,
      command: `echo "${installedProofCommand(projectDirectory, 'quality-review')}"`,
      sessionId: 'codex-session-uuid',
    });

    const result = spawnSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('does not let a Codex proof cache satisfy a different skill', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCodexPreTool({
      projectDirectory,
      command: installedProofCommand(projectDirectory, 'quality-review'),
      sessionId: 'codex-session-uuid',
    });

    const result = spawnSync('bun', [helperPath, projectDirectory, 'audit'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('records Cursor proof after beforeShellExecution binds the current conversation id', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCursorBeforeShell({
      projectDirectory,
      command: installedProofCommand(projectDirectory, 'quality-review'),
      conversationId: 'cursor-conversation-uuid',
    });

    const output = execFileSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(output.trim()).toBe('[skill-invocation-log] quality-review ✓');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent).toMatch(/ cursor-conversation-uuid quality-review$/m);
  });

  it('does not bind Cursor proof when a shell command only mentions the helper', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCursorBeforeShell({
      projectDirectory,
      command: `echo "${installedProofCommand(projectDirectory, 'quality-review')}"`,
      conversationId: 'cursor-conversation-uuid',
    });

    const result = spawnSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('does not bind Cursor proof for a helper-looking path that is not the helper', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCursorBeforeShell({
      projectDirectory,
      command: `bun "${projectDirectory}/.safeword/hooks/record-skill-invocation.ts.bak" "${projectDirectory}" quality-review`,
      conversationId: 'cursor-conversation-uuid',
    });

    const result = spawnSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('does not replay a Cursor proof cache for a different skill', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCursorBeforeShell({
      projectDirectory,
      command: installedProofCommand(projectDirectory, 'quality-review'),
      conversationId: 'cursor-conversation-uuid',
    });

    const result = spawnSync('bun', [helperPath, projectDirectory, 'audit'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });
    const retryOriginalSkill = spawnSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no proof logged');
    expect(retryOriginalSkill.status).toBe(0);
    expect(retryOriginalSkill.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('consumes Cursor proof cache after one successful helper run', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });

    runCursorBeforeShell({
      projectDirectory,
      command: installedProofCommand(projectDirectory, 'quality-review'),
      conversationId: 'cursor-conversation-uuid',
    });

    const firstOutput = execFileSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });
    const secondResult = spawnSync('bun', [helperPath, projectDirectory, 'quality-review'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(firstOutput.trim()).toBe('[skill-invocation-log] quality-review ✓');
    expect(secondResult.status).toBe(0);
    expect(secondResult.stdout).toContain('no proof logged');
    const logContent = readFileSync(
      nodePath.join(projectDirectory, '.project', 'skill-invocations.log'),
      'utf8',
    );
    expect(logContent.match(/quality-review/g)).toHaveLength(1);
  });

  it('does not reuse stale Cursor identity cache entries for local shell runs', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));
    const projectMetadataDirectory = nodePath.join(projectDirectory, '.project');
    mkdirSync(projectMetadataDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(projectMetadataDirectory, 'cursor-run-identity.json'),
      JSON.stringify({
        id: 'old-cursor-conversation',
        skillName: 'verify',
        recordedAt: '2000-01-01T00:00:00.000Z',
      }),
    );

    const result = spawnSync('bun', [helperPath, projectDirectory, 'verify'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no run identity');
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectMetadataDirectory, 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('exits 0 and skips when no session id is available (non-Claude runtime graceful)', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'record-skill-'));

    const result = spawnSync('bun', [helperPath, projectDirectory, 'verify'], {
      encoding: 'utf8',
      env: envWithoutRunIdentity(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no run identity');
    expect(result.stdout).toContain('no proof logged');
    expect(existsSync(nodePath.join(projectDirectory, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });
});
