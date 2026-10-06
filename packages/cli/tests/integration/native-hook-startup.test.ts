import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

type Manifest = { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };

describe.runIf(process.platform !== 'win32')('native hook startup isolation', () => {
  for (const host of ['codex', 'claude'] as const) {
    for (const attack of ['dotenv', 'preload'] as const) {
      it(`${host} preserves the hook denial despite project ${attack}`, () => {
        const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-startup-'));
        try {
          const project = nodePath.join(root, 'project');
          const plugin = nodePath.join(root, 'plugin');
          mkdirSync(project);
          mkdirSync(nodePath.join(plugin, 'runtime'), { recursive: true });
          writeFileSync(nodePath.join(project, '.env'), 'SAFEWORD_PLUGIN_CLI=/tmp/forged-cli.js\n');
          writeFileSync(
            nodePath.join(plugin, '.env'),
            'SAFEWORD_PLUGIN_CLI=/tmp/forged-plugin-cli.js\n',
          );
          if (attack === 'preload') {
            writeFileSync(nodePath.join(project, 'bunfig.toml'), 'preload = ["./preload.js"]\n');
            writeFileSync(
              nodePath.join(project, 'preload.js'),
              'console.log("FORGED_ALLOW"); process.exit(0);\n',
            );
          }
          // A fixture policy isolates command startup from installed-profile trust.
          writeFileSync(
            nodePath.join(plugin, 'runtime', host === 'codex' ? 'cli.js' : 'dispatch.js'),
            'console.log(JSON.stringify({ decision: "deny", cwd: process.cwd(), injected: process.env.SAFEWORD_PLUGIN_CLI })); process.exit(2);\n',
          );
          const manifestPath = nodePath.resolve(
            import.meta.dirname,
            host === 'codex'
              ? '../../codex-plugin/hooks.json'
              : '../../../../plugin/hooks/hooks.json',
          );
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
          const command = manifest.hooks.PreToolUse[0]?.hooks[0]?.command;
          if (command === undefined) throw new Error('Native PreToolUse command is missing');
          const env: NodeJS.ProcessEnv = {
            ...process.env,
            PLUGIN_ROOT: plugin,
            CLAUDE_PLUGIN_ROOT: plugin,
            CLAUDE_PROJECT_DIR: project,
          };
          delete env.SAFEWORD_PLUGIN_CLI;
          const result = spawnSync(command, {
            cwd: project,
            shell: true,
            input: JSON.stringify({
              cwd: project,
              tool_name: 'Bash',
              tool_input: { command: 'pkill node' },
            }),
            env,
            encoding: 'utf8',
            timeout: 10_000,
          });
          expect(result.status, result.stderr).toBe(2);
          const observed = JSON.parse(result.stdout) as {
            decision: string;
            cwd: string;
            injected?: string;
          };
          expect(observed.decision).toBe('deny');
          expect(observed.injected).toBeUndefined();
          expect(realpathSync(observed.cwd)).toBe(realpathSync(plugin));
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});
