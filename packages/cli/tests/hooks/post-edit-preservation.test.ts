import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.ts';

const hooks = path.resolve(__dirname, '../../templates/hooks');
const directories: string[] = [];
const markers: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  for (const marker of markers.splice(0)) rmSync(marker, { force: true });
});

describe.each(['claude', 'cursor'])('%s post-edit preservation', surface => {
  it.each(['eslint', 'biome', 'ultracite'])(
    'keeps unfinished imports and unrelated lines with %s',
    owner => {
      const root = mkdtempSync(path.join(tmpdir(), 'post-edit-preservation-'));
      directories.push(root);
      const marker = cursorEditedMarkerPath({ conversation_id: path.basename(root) });
      if (surface === 'cursor') markers.push(marker);
      const bin = path.join(root, 'node_modules', '.bin');
      mkdirSync(bin, { recursive: true });
      mkdirSync(path.join(root, '.safeword'));
      if (owner !== 'eslint') {
        writeFileSync(
          path.join(root, 'biome.json'),
          owner === 'ultracite' ? '{"extends":["ultracite/core"]}' : '{}',
        );
      }
      const file = path.join(root, 'pending.ts');
      const original = 'import { pending } from "./dependency";\nexport const unrelated={ x:1 };\n';
      writeFileSync(file, original);
      // Mock only the external tool process. Mutating invocations destroy the
      // fixture, so either hook forgetting check-only mode fails this test.
      const tool = path.join(bin, owner === 'eslint' ? 'bunx' : owner);
      const witness = path.join(root, 'checker-ran');
      writeFileSync(
        tool,
        '#!/bin/sh\nprintf "%s\\n" "$*" >> checker-ran\ncase "$*" in *--fix*|*--write*|fix*) echo rewritten > pending.ts;; esac\necho pending-import-diagnostic\nexit 1\n',
      );
      chmodSync(tool, 0o755);
      const result = spawnSync(
        'bun',
        [
          path.join(
            hooks,
            surface === 'claude' ? 'post-tool-lint.ts' : 'cursor/after-file-edit.ts',
          ),
        ],
        {
          cwd: root,
          input: JSON.stringify({
            tool_input: { file_path: file },
            file_path: file,
            workspace_roots: [root],
            conversation_id: path.basename(root),
          }),
          encoding: 'utf8',
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: root,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          },
          timeout: 15_000,
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(witness)).toBe(true);
      expect(readFileSync(witness, 'utf8')).toContain('pending.ts');
      expect(readFileSync(file, 'utf8')).toBe(original);
      if (surface === 'claude') {
        const output = JSON.parse(result.stdout) as {
          hookSpecificOutput: { additionalContext: string };
        };
        expect(output.hookSpecificOutput.additionalContext).toContain('pending-import-diagnostic');
      } else {
        expect(existsSync(marker)).toBe(true);
      }
    },
  );
});
