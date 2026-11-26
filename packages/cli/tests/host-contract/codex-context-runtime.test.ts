import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { initGitRepo, retroDraft } from '../helpers.js';
it('preserves emitted Codex startup, prompt, lint and quality-state context in an owned project', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'codex-context-'));
  try {
    const project = nodePath.join(root, 'project'),
      plugin = nodePath.join(root, 'plugin');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(project, '.project'));
    mkdirSync(nodePath.join(root, 'tmp'));
    initGitRepo(project);
    writeFileSync(nodePath.join(project, 'notes.txt'), 'baseline\n');
    for (const args of [
      ['add', 'notes.txt'],
      ['commit', '-qm', 'fixture baseline'],
    ])
      expect(spawnSync('git', args, { cwd: project }).status).toBe(0);
    writeFileSync(
      nodePath.join(project, '.safeword/SAFEWORD.md'),
      'CUSTOM-PROJECT-CONTEXT-MUST-NOT-APPEAR\n',
    );
    cpSync(nodePath.resolve(import.meta.dirname, '../../codex-plugin'), plugin, {
      recursive: true,
    });
    const manifest = JSON.parse(readFileSync(nodePath.join(plugin, 'hooks.json'), 'utf8'));
    const runHook = (event: string, extra: Record<string, unknown> = {}) => {
      const group = manifest.hooks[event][0];
      expect(group.hooks).toHaveLength(1);
      const result = spawnSync('sh', ['-c', group.hooks[0].command], {
        cwd: plugin,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          PATH: process.env.PATH,
          TZ: 'UTC',
          HOME: nodePath.join(root, 'home'),
          XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
          CODEX_HOME: nodePath.join(root, 'profile'),
          PLUGIN_ROOT: plugin,
          TMPDIR: nodePath.join(root, 'tmp'),
          SAFEWORD_NO_AUTO_UPGRADE: '1',
          SAFEWORD_SKIP_INSTALL: '1',
        },
        input: JSON.stringify({
          cwd: project,
          session_id: 'context-session',
          hook_event_name: event,
          ...extra,
        }),
      });
      assert.equal(
        result.error,
        undefined,
        `CODEX_COMPONENT_UNAVAILABLE: ${result.error?.message}`,
      );
      return result;
    };
    const invoke = (event: string, extra: Record<string, unknown> = {}) => {
      const result = runHook(event, extra);
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    const resourceHandbook = nodePath.join(plugin, 'resources/SAFEWORD.md');
    const startup = () =>
      JSON.parse(invoke('SessionStart', { source: 'startup' })).hookSpecificOutput
        .additionalContext;
    const context = startup();
    expect(context).toContain(resourceHandbook);
    expect(context).not.toContain('CUSTOM-PROJECT-CONTEXT-MUST-NOT-APPEAR');
    const handbook = nodePath.join(plugin, 'templates/SAFEWORD.md');
    const handbookBytes = readFileSync(handbook);
    const resourceHandbookBytes = readFileSync(resourceHandbook);
    rmSync(handbook);
    rmSync(resourceHandbook);
    const missing = runHook('SessionStart');
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('missing its packaged handbook');
    expect(missing.stdout).toBe('');
    writeFileSync(handbook, handbookBytes);
    writeFileSync(resourceHandbook, resourceHandbookBytes);
    const dispatcher = nodePath.join(plugin, 'templates/hooks/session-codex-start.ts');
    const dispatcherBytes = readFileSync(dispatcher);
    rmSync(dispatcher);
    expect(startup()).toContain(resourceHandbook);
    writeFileSync(dispatcher, dispatcherBytes);

    // Substitute only the clock at the copied canonical owner, not its result.
    const timestamp = nodePath.join(plugin, 'templates/hooks/prompt-timestamp.ts');
    const timestampBytes = readFileSync(timestamp, 'utf8');
    writeFileSync(
      timestamp,
      timestampBytes.replace('new Date()', () => "new Date('2026-01-02T03:04:05.000Z')"),
    );
    const timestampContext = JSON.parse(invoke('UserPromptSubmit')).hookSpecificOutput
      .additionalContext;
    expect(timestampContext, 'CODEX_CANONICAL_TIMESTAMP_BYPASSED').toContain(
      '(2026-01-02T03:04:05.000Z) | Local: 03:04 AM UTC',
    );
    expect(timestampContext).toContain('Current time: Friday, January 2, 2026');
    writeFileSync(timestamp, timestampBytes);
    spoolDrafts(project, 'context-session', [retroDraft('retro:aaaaaaaaaaaa')]);
    const prompt = () =>
      JSON.parse(invoke('UserPromptSubmit')).hookSpecificOutput.additionalContext;
    expect(prompt()).toContain("Safeword's retro spooled 1 unfiled finding");
    expect(prompt()).not.toContain('unfiled finding');
    const promptQueue = nodePath.join(project, '.project/codex-prompt-context.txt');
    writeFileSync(promptQueue, 'OWNED PROMPT CONTEXT\n');
    expect(prompt()).toContain('OWNED PROMPT CONTEXT');
    rmSync(promptQueue);
    expect(prompt()).not.toContain('OWNED PROMPT CONTEXT');
    expect(invoke('PostToolUse', { tool_name: 'Write', tool_input: {} })).toBe('');
    const postQueue = nodePath.join(project, '.project/codex-post-tool-guidance.txt');
    writeFileSync(postQueue, 'OWNED POST CONTEXT\n');
    expect(
      JSON.parse(invoke('PostToolUse', { tool_name: 'Write', tool_input: {} })).hookSpecificOutput
        .additionalContext,
    ).toBe('OWNED POST CONTEXT');
    rmSync(postQueue);
    expect(invoke('PostToolUse', { tool_name: 'Write', tool_input: {} })).toBe('');
    const stopQueue = nodePath.join(project, '.project/codex-stop-continuation.txt');
    writeFileSync(stopQueue, 'Owned project follow-up.\n');
    // Real child reentry no-op: no extraction/model/filing can run on this input.
    expect(JSON.parse(invoke('Stop', { stop_hook_active: true }))).toEqual({
      decision: 'block',
      reason: 'Owned project follow-up.',
    });
    const stopChild = nodePath.join(plugin, 'templates/hooks/codex/stop.ts'),
      stopBytes = readFileSync(stopChild);
    rmSync(stopChild);
    expect(JSON.parse(invoke('Stop', { stop_hook_active: true }))).toEqual({
      decision: 'block',
      reason: 'Owned project follow-up.',
    });
    rmSync(stopQueue);
    expect(JSON.parse(invoke('Stop', { stop_hook_active: true }))).toEqual({});
    writeFileSync(stopChild, stopBytes);
    writeFileSync(nodePath.join(project, 'biome.json'), '{}\n'); // Known host, intentionally unavailable local executable; no download fallback.
    const file = nodePath.join(project, 'example.ts');
    writeFileSync(file, 'export const example = 1;\n');
    const feedback = JSON.parse(
      invoke('PostToolUse', { tool_name: 'Write', tool_input: { file_path: file } }),
    );
    expect(feedback.hookSpecificOutput.additionalContext).toContain('no project-local executable');
    const statePath = nodePath.join(project, '.project/quality-state-codex-context-session.json');
    expect(existsSync(statePath)).toBe(true);
    const ticket = nodePath.join(project, '.project/tickets/FIX123-synthetic/ticket.md');
    mkdirSync(nodePath.dirname(ticket), { recursive: true });
    writeFileSync(ticket, '---\nid: FIX123\ntype: task\nstatus: in_progress\n---\n');
    writeFileSync(nodePath.join(project, 'notes.txt'), 'changed\nsecond line\n');
    const editTicket = () =>
      invoke('PostToolUse', { tool_name: 'Write', tool_input: { file_path: ticket } });
    editTicket();
    expect(JSON.parse(readFileSync(statePath, 'utf8'))).toMatchObject({
      activeTicket: 'FIX123',
      locSinceCommit: 3,
    });
    writeFileSync(ticket, '---\nid: FIX123\ntype: task\nstatus: backlog\n---\n');
    editTicket();
    expect(JSON.parse(readFileSync(statePath, 'utf8')).activeTicket).toBeNull();
    const skill = nodePath.join(project, '.agents/skills/golang-pro');
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      nodePath.join(skill, 'SKILL.md'),
      '---\nname: golang-pro\ndescription: "Owned Go concurrency guidance."\n---\n',
    );
    const goFile = nodePath.join(project, 'example.go');
    writeFileSync(goFile, 'package example\n');
    const editGo = () =>
      JSON.parse(invoke('PostToolUse', { tool_name: 'Write', tool_input: { file_path: goFile } }))
        .hookSpecificOutput.additionalContext;
    expect(editGo()).toContain('Owned Go concurrency guidance.');
    expect(editGo()).not.toContain('Owned Go concurrency guidance.');
    expect(JSON.parse(readFileSync(statePath, 'utf8'))).toMatchObject({
      locSinceCommit: 3,
    });
    expect(JSON.parse(readFileSync(statePath, 'utf8')).activeTicket).toBeNull();
    expect(existsSync(nodePath.join(project, '.project/quality-state-context-session.json'))).toBe(
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
