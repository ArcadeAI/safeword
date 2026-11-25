import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { setupReconcileTest } from '../helpers.js';
import { characterizeCursorStopOptions } from '../helpers/cursor-stop-options.js';
const roots: string[] = [];
function readVersion(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}
function characterizeStop(project: string, command: string, env: NodeJS.ProcessEnv) {
  writeFileSync(
    nodePath.join(project, '.safeword/config.json'),
    JSON.stringify({
      terminalHandoffCorrection: true,
      selfReport: { capture: false, file: false, surface: false },
    }),
  );
  const transcript = nodePath.join(project, 'synthetic-transcript.jsonl');
  writeFileSync(
    transcript,
    `${JSON.stringify({ role: 'assistant', content: 'I changed the implementation and tests. All of the feature is complete.' })}\n`,
  );
  const invoke = (loop_count: number, status = 'completed') =>
    spawnSync('sh', ['-c', command], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({
        workspace_roots: [project],
        conversation_id: 'cursor-feedback',
        generation_id: 'cursor-feedback-turn',
        transcript_path: transcript,
        loop_count,
        status,
      }),
    });
  const correction = invoke(0);
  expect(correction.status, correction.stderr).toBe(0);
  expect(JSON.parse(correction.stdout).followup_message).toContain(
    'terminal-handoff/v1 correction',
  );
  for (const result of [invoke(1), invoke(0, 'aborted')]) {
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
  }
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it.each(['project', 'native'] as const)(
  'characterizes installed Cursor %s shared quality and feedback delegates',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-quality-owner-'));
    roots.push(root);
    const project = nodePath.join(root, 'project'),
      plugin = nodePath.join(root, 'plugin');
    mkdirSync(project);
    const env = {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
      CLAUDE_PROJECT_DIR: project,
      CURSOR_PLUGIN_ROOT: plugin,
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    };
    let manifestPath: string;
    if (delivery === 'project') {
      const installed = await setupReconcileTest(project);
      expect(installed.result.applied).toBe(true);
      manifestPath = nodePath.join(project, '.cursor/hooks.json');
    } else {
      mkdirSync(nodePath.join(project, '.safeword'));
      copyFileSync(
        nodePath.resolve(import.meta.dirname, '../../templates/SAFEWORD.md'),
        nodePath.join(project, '.safeword/SAFEWORD.md'),
      );
      const generated = spawnSync(
        'bun',
        [
          nodePath.resolve(import.meta.dirname, '../../scripts/generate-cursor-plugin.ts'),
          '--output',
          plugin,
        ],
        { cwd: project, env, encoding: 'utf8', timeout: 120_000 },
      );
      expect(generated.status, generated.stderr).toBe(0);
      manifestPath = nodePath.join(plugin, 'hooks/hooks.json');
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      hooks: Record<string, { command: string; matcher?: string }[]>;
    };
    // Exercise actual emitted library adapters; substitute only the external lint process.
    const upgrade = manifest.hooks.sessionStart?.[1];
    assert.ok(upgrade);
    const version = nodePath.join(project, '.safeword/version');
    const beforeVersion = readVersion(version);
    const disabledUpgrade = spawnSync('sh', ['-c', upgrade.command], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({ workspace_roots: [project], conversation_id: 'cursor-feedback' }),
    });
    expect(disabledUpgrade.status, disabledUpgrade.stderr).toBe(0);
    expect(disabledUpgrade.stdout).toBe('');
    expect(readVersion(version)).toBe(beforeVersion);
    expect(existsSync(nodePath.join(project, '.safeword/.update-cache.json'))).toBe(false);
    writeFileSync(nodePath.join(project, 'biome.json'), '{}');
    const bin = nodePath.join(project, 'node_modules/.bin');
    mkdirSync(bin, { recursive: true });
    const tool = nodePath.join(bin, 'biome');
    writeFileSync(
      tool,
      '#!/usr/bin/env bun\nimport {appendFileSync} from "node:fs";appendFileSync("lint-observation.json",JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+"\\n");\n',
    );
    chmodSync(tool, 0o755);
    const edited = nodePath.join(project, 'sample.ts');
    writeFileSync(edited, 'const sample = 1;\n');
    const lint = manifest.hooks.afterFileEdit?.[0];
    assert.ok(lint);
    const lintResult = spawnSync('sh', ['-c', lint.command], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({
        workspace_roots: [project],
        file_path: edited,
        conversation_id: 'cursor-feedback',
        generation_id: 'cursor-feedback-turn',
      }),
    });
    expect(lintResult.status, lintResult.stderr).toBe(0);
    expect(lintResult.stdout).toBe('');
    const observationPath = nodePath.join(project, 'lint-observation.json');
    const observations = readFileSync(observationPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(observations).toEqual([
      { cwd: realpathSync(project), args: ['check', '--write', '--', 'sample.ts'] },
      { cwd: realpathSync(project), args: ['check', '--', 'sample.ts'] },
    ]);
    const start = manifest.hooks.sessionStart?.[0];
    assert.ok(start);
    const context = spawnSync('sh', ['-c', start.command], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({ workspace_roots: [project], conversation_id: 'cursor-feedback' }),
    });
    expect(context.status, context.stderr).toBe(0);
    expect(JSON.parse(context.stdout).additional_context).toContain('Before non-trivial work');
    for (const event of ['preToolUse', 'beforeShellExecution']) {
      const rows = manifest.hooks[event];
      expect(rows).toHaveLength(1);
      const hook = rows?.[0];
      assert.ok(hook, 'CURSOR_FIXTURE_UNAVAILABLE: missing route');
      if (event === 'preToolUse') expect(hook.matcher).toBe('Write');
      const invoke = (denied: boolean) => {
        const result = spawnSync('sh', ['-c', hook.command], {
          cwd: project,
          env,
          encoding: 'utf8',
          timeout: 30_000,
          input: JSON.stringify({
            conversation_id: 'cursor-quality',
            workspace_roots: [project],
            cwd: project,
            ...(event === 'preToolUse'
              ? {
                  tool_name: 'Write',
                  tool_input: {
                    file_path: nodePath.join(
                      project,
                      '.project',
                      denied ? 'tickets/example/test-definitions.md' : 'notes.md',
                    ),
                    content: 'synthetic',
                  },
                }
              : { command: denied ? 'pkill bun' : 'echo synthetic-control' }),
          }),
        });
        assert.equal(
          result.error,
          undefined,
          `CURSOR_FIXTURE_UNAVAILABLE: ${result.error?.message}`,
        );
        expect(result.status, result.stderr).toBe(0);
        return JSON.parse(result.stdout) as { permission: string; user_message?: string };
      };
      expect(invoke(true)).toMatchObject({
        permission: 'deny',
        user_message: expect.stringContaining(
          event === 'preToolUse'
            ? 'Cannot create test definitions without a ticket spec.'
            : 'Broad process kill blocked: `pkill bun`',
        ),
      });
      expect(invoke(false)).toMatchObject({ permission: 'allow' });
    }
    const invokePost = (matcher: string, file: string) => {
      const hook = manifest.hooks.postToolUse?.find(row => row.matcher === matcher);
      assert.ok(hook);
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          conversation_id: 'cursor-feedback',
          workspace_roots: [project],
          tool_name: 'Write',
          tool_input: { file_path: file },
        }),
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    // The canonical accumulator intentionally skips repositories without a HEAD.
    // This Git history is confined to the disposable fixture, with a private HOME.
    for (const args of [
      ['init'],
      [
        '-c',
        'user.name=Synthetic',
        '-c',
        'user.email=synthetic@localhost',
        'commit',
        '--allow-empty',
        '-m',
        'synthetic baseline',
      ],
    ]) {
      const git = spawnSync('git', args, { cwd: project, env, encoding: 'utf8' });
      expect(git.status, git.stderr).toBe(0);
    }
    const ticket = nodePath.join(project, '.project/tickets/ABC123-synthetic/ticket.md');
    mkdirSync(nodePath.dirname(ticket), { recursive: true });
    writeFileSync(ticket, '---\nid: ABC123\nstatus: in_progress\nphase: implement\n---\n');
    const bindings = () =>
      readdirSync(nodePath.join(project, '.project'))
        .filter(name => name.startsWith('quality-state-') && name.endsWith('.json'))
        .map(name => JSON.parse(readFileSync(nodePath.join(project, '.project', name), 'utf8')))
        .filter(state => state.activeTicket === 'ABC123');
    expect(bindings()).toEqual([]);
    expect(
      existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')),
      'CURSOR_FIXTURE_MISSING_ENROLLMENT_MARKER',
    ).toBe(true);
    invokePost('Write|Shell', ticket);
    expect(bindings()).toHaveLength(1);
    const skill = nodePath.join(project, '.agents/skills/golang-pro');
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      nodePath.join(skill, 'SKILL.md'),
      '---\nname: golang-pro\ndescription: Build Go code.\n---\n',
    );
    const nudge = invokePost('Write', nodePath.join(project, 'sample.go'));
    expect(nudge.additional_context).toContain('golang-pro');
    expect(invokePost('Write', nodePath.join(project, 'sample.go'))).toEqual({});
    const stops = manifest.hooks.stop;
    assert.ok(stops);
    const stop = stops[0];
    assert.ok(stop);
    characterizeStop(project, stop.command, env);
    characterizeCursorStopOptions(project, stop.command, env);
  },
  120_000,
);
