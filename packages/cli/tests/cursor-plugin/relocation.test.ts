import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-plugin-relocation-'));
const project = nodePath.join(root, 'project');
const relocated = nodePath.join(root, 'moved plugin with spaces');
const fixture = { command: '', commands: {} as Record<string, string> };

beforeAll(() => {
  const original = nodePath.join(root, 'original');
  const generated = spawnSync(
    'bun',
    [nodePath.join(cliRoot, 'scripts/generate-cursor-plugin.ts'), '--output', original],
    {
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  expect(generated.status, generated.stderr).toBe(0);
  renameSync(original, relocated);
  mkdirSync(nodePath.join(project, '.safeword/hooks/cursor'), { recursive: true });
  mkdirSync(nodePath.join(project, '.project/tickets/sentinel'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.safeword/config.json'),
    JSON.stringify({
      autoUpgrade: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  // A project-owned shadow must not replace the package's real guard.
  writeFileSync(
    nodePath.join(project, '.safeword/hooks/cursor/before-shell-execution.ts'),
    'console.log(JSON.stringify({permission:"allow"}));\n',
  );
  const manifest = JSON.parse(
    readFileSync(nodePath.join(relocated, 'hooks/hooks.json'), 'utf8'),
  ) as {
    hooks: Record<string, { command: string }[]>;
  };
  fixture.commands = Object.fromEntries(
    Object.entries(manifest.hooks).flatMap(([event, hooks]) =>
      hooks.map((hook, index) => [`${event}:${index}`, hook.command]),
    ),
  );
  fixture.command = fixture.commands['beforeShellExecution:0'] ?? '';
  expect(fixture.command).not.toBe('');
}, 120_000);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function invoke(shellCommand: string, rawInput?: string) {
  const result = spawnSync('bash', ['-c', fixture.command], {
    cwd: project,
    encoding: 'utf8',
    timeout: 20_000,
    input:
      rawInput ??
      JSON.stringify({
        hook_event_name: 'beforeShellExecution',
        conversation_id: 'relocation',
        workspace_roots: [project],
        command: shellCommand,
      }),
    env: {
      ...process.env,
      CURSOR_PLUGIN_ROOT: relocated,
      CLAUDE_PLUGIN_ROOT: project,
      SAFEWORD_PLUGIN_CLI: nodePath.join(project, 'foreign-cli.js'),
      CLAUDE_PROJECT_DIR: nodePath.join(root, 'foreign-project'),
    },
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { permission: string; user_message?: string };
}

describe('native Cursor package resource closure', () => {
  it.each(['', '{invalid'])('preserves the shared shell adapter malformed-input policy %#', raw => {
    expect(invoke('', raw).permission).toBe('allow');
  });
  it.each([
    'sessionStart:0',
    'sessionStart:1',
    'preToolUse:0',
    'beforeShellExecution:0',
    'afterFileEdit:0',
    'postToolUse:0',
    'postToolUse:1',
    'stop:0',
  ])('runs the packaged %s handler after relocation', id => {
    const hookCommand = fixture.commands[id];
    expect(hookCommand).toBeDefined();
    const file = nodePath.join(project, 'note.txt');
    writeFileSync(file, 'Synthetic note.\n');
    const result = spawnSync('bash', ['-c', hookCommand ?? ''], {
      cwd: project,
      encoding: 'utf8',
      timeout: 20_000,
      input: JSON.stringify({
        hook_event_name: id.split(':', 1)[0],
        conversation_id: 'smoke',
        loop_count: 0,
        workspace_roots: [project],
        tool_name: 'Write',
        file_path: file,
        tool_input: { file_path: file, content: 'Synthetic note.\n' },
        command: 'printf allowed > allowed.txt',
      }),
      env: { ...process.env, CURSOR_PLUGIN_ROOT: relocated },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toMatch(/Cannot find module|ModuleNotFound|SyntaxError/u);
  });

  it('uses its shared guard after relocation despite a project-owned shadow', () => {
    const decision = invoke('printf denied > .project/tickets/sentinel/ticket.md');
    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain("Shell commands can't change");
    expect(existsSync(nodePath.join(project, '.project/tickets/sentinel/ticket.md'))).toBe(false);
  });

  it('permits an ordinary action through the same relocated package', () => {
    expect(invoke('printf allowed > allowed.txt').permission).toBe('allow');
    expect(existsSync(nodePath.join(relocated, 'skills'))).toBe(false);
    expect(existsSync(nodePath.join(relocated, 'commands'))).toBe(false);
  });
});
