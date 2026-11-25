import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { CURSOR_PLUGIN_LAYOUT } from '../schema.js';
import { cursorPluginBindings } from './bindings.js';

const binding = cursorPluginBindings().find(row => row.id === process.argv[2]);
if (!binding || process.argv.length !== 3) throw new Error('Unknown canonical Cursor hook binding');
const root = nodePath.resolve(import.meta.dirname, '..');
const input = readFileSync(0, 'utf8');
function inputWorkspace(raw: string): string | undefined {
  try {
    const payload = JSON.parse(raw) as { workspace_roots?: unknown[] };
    const workspace = payload.workspace_roots?.[0];
    return typeof workspace === 'string' ? workspace : undefined;
  } catch {
    return undefined;
  }
}
// Decode only the working directory. The shared adapter still owns malformed
// input policy and receives the original bytes, unchanged.
const workspace = inputWorkspace(input);
const cwd = workspace && nodePath.isAbsolute(workspace) ? workspace : process.cwd();
const result = spawnSync(
  process.execPath,
  [nodePath.join(root, CURSOR_PLUGIN_LAYOUT.templates, 'hooks', binding.path), ...binding.args],
  {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: cwd,
      SAFEWORD_AGENT_RUNTIME: 'cursor',
      SAFEWORD_PLUGIN_CLI: nodePath.join(root, CURSOR_PLUGIN_LAYOUT.runtime),
      CURSOR_PLUGIN_ROOT: root,
      CLAUDE_PLUGIN_ROOT: root,
    },
  },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) process.stderr.write(`${result.error.message}\n`);
process.exitCode = result.status ?? 1;
