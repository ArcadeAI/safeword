/**
 * Real-collaborator test for the lint hook's SQL branch in a host-owned repo
 * (#636/#638): prettier-plugin-sql present, no .safeword/sqlfluff.cfg (setup
 * suppresses it by design). When the host prettier run fails, the hook must
 * surface prettier's error to the agent and return — NOT fall through to the
 * sqlfluff/auto-upgrade path, which would fire a network upgrade attempt on
 * every failing SQL edit.
 *
 * lint.ts imports Bun's `$`, so it can't be imported under the node-based
 * vitest process — the hook runs in a `bun` subprocess instead, with cwd at
 * the repo root so `bunx prettier` resolves the repo's local install
 * (no network).
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const LINT_MODULE = path.resolve(__dirname, '../../templates/hooks/lib/lint.ts');

describe('lintFile SQL branch — host-owned prettier formatting', () => {
  let directory: string;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'lint-sql-host-'));
    // Host owns SQL formatting: plugin installed, sqlfluff config absent.
    mkdirSync(path.join(directory, 'node_modules', 'prettier-plugin-sql'), { recursive: true });
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('surfaces the prettier error and does not fall through to the upgrade path when prettier fails', async () => {
    // Valid SQL, but the temp dir has no prettier config declaring the sql
    // plugin — prettier exits non-zero ("No parser could be inferred"), the
    // same failure shape as an unparseable agent edit.
    const sqlFile = path.join(directory, 'query.sql');
    writeFileSync(sqlFile, 'select 1;\n');

    const script = `
      const { lintFile } = await import(${JSON.stringify(LINT_MODULE)});
      const result = await lintFile(${JSON.stringify(sqlFile)}, ${JSON.stringify(directory)});
      console.log(JSON.stringify(result));
    `;
    const { stdout } = await execFileAsync('bun', ['-e', script], {
      cwd: REPO_ROOT,
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      timeout: 60_000,
    });

    const result = JSON.parse(stdout.trim()) as { warnings: string[]; errors?: string };
    // The agent gets prettier's parse error instead of silence.
    expect(result.errors).toMatch(/parser/i);
    // No fall-through side effects: ensurePackInstalled would have created or
    // touched .safeword/ via `safeword upgrade` + git; the guard returns first.
    expect(existsSync(path.join(directory, '.safeword'))).toBe(false);
  }, 90_000);
});
