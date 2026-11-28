import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { retroDraft, setupReconcileTest } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it.each(['legacy', 'native'] as const)(
  'characterizes installed %s prompt context and Stop denial/bounded filing',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prompt-stop-'));
    roots.push(root);
    const project = nodePath.join(root, 'project'),
      plugin = nodePath.join(root, 'plugin');
    mkdirSync(project);
    const env = {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_PLUGIN_ROOT: plugin,
      CLAUDE_CONFIG_DIR: nodePath.join(root, 'config'),
      CLAUDE_PLUGIN_DATA: nodePath.join(root, 'data'),
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
    };
    let manifestPath: string;
    if (delivery === 'legacy') {
      const installed = await setupReconcileTest(project);
      expect(installed.result.applied).toBe(true);
      manifestPath = nodePath.join(project, '.claude/settings.json');
    } else {
      mkdirSync(nodePath.join(project, '.safeword'));
      cpSync(nodePath.resolve(import.meta.dirname, '../../../../plugin'), plugin, {
        recursive: true,
      });
      manifestPath = nodePath.join(plugin, 'hooks/hooks.json');
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const invoke = (event: 'UserPromptSubmit' | 'Stop', owner: string) => {
      const hook = manifest.hooks[event]
        .flatMap((row: { hooks: { command: string }[] }) => row.hooks)
        .find((row: { command: string }) =>
          delivery === 'native' && event === 'UserPromptSubmit'
            ? row.command.endsWith('UserPromptSubmit --event-group')
            : row.command.includes(`/${owner}`),
        );
      assert.ok(hook);
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          cwd: project,
          session_id: 'synthetic-stop',
          hook_event_name: event,
          prompt: 'synthetic question',
        }),
      });
      assert.equal(result.error, undefined);
      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    const context = invoke('UserPromptSubmit', 'prompt-timestamp.ts');
    expect(context).toMatch(/Current time:.*\d{4}-\d{2}-\d{2}T/u);
    const reminders =
      delivery === 'native' ? context : invoke('UserPromptSubmit', 'prompt-questions.ts');
    expect(reminders).toContain('Contribute before asking');
    const ticket = nodePath.join(project, '.project/tickets/ABC123-synthetic');
    mkdirSync(ticket, { recursive: true });
    const ticketPath = nodePath.join(ticket, 'ticket.md');
    const writePhase = (phase: string) => {
      writeFileSync(
        ticketPath,
        `---\nid: ABC123\ntype: feature\nphase: ${phase}\nstatus: in_progress\n---\n# Synthetic\n`,
      );
    };
    writePhase('implement');
    writeFileSync(nodePath.join(ticket, 'spec.md'), '# Synthetic spec\n');
    writeFileSync(
      nodePath.join(ticket, 'test-definitions.md'),
      '# Test Definitions\n\n## Rule: synthetic\n\n- [ ] Scenario one\n',
    );
    writeFileSync(
      nodePath.join(project, '.project/quality-state-synthetic-stop.json'),
      JSON.stringify({ activeTicket: 'ABC123' }),
    );
    const blocked = JSON.parse(invoke('Stop', 'stop-quality.ts'));
    expect(blocked.decision).toBe('block');
    expect(blocked.reason).toContain('Feature at implement phase requires impl-plan.md');
    expect(blocked.reason).toContain('plan-implementation phase');
    writePhase('clarify');
    expect(invoke('Stop', 'stop-quality.ts')).toBe('');
    // The existing filing owner requests continuation, never performs the external filing here.
    spoolDrafts(project, 'synthetic-stop', [retroDraft('retro:aaaaaaaaaaaa')]);
    for (let attempt = 0; attempt < 2; attempt++) {
      const filing = JSON.parse(invoke('Stop', 'stop-retro-filing.ts'));
      expect(filing.decision).toBe('block');
      expect(filing.reason).toContain('safeword-retro-filer');
      expect(filing.reason).toContain('synthetic-stop.jsonl');
      expect(filing.reason).toContain('then end the turn');
    }
    expect(invoke('Stop', 'stop-retro-filing.ts')).toBe('');
  },
);
