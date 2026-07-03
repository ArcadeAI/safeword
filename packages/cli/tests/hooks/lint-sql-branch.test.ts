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
import { promisify } from 'node:util';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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

describe('lintFile SQL branch — sqlfluff dispatch', () => {
  // The breaking dispatch under review: with sql.fix unset the hook must run
  // `sqlfluff lint` (report-only) and must NOT run `sqlfluff fix`; with
  // sql.fix true it runs fix then lint. sqlfluff is stubbed with a PATH shim
  // that records its argv, so the assertion is on the real command dispatch,
  // not a mock of the hook's internals.
  let directory: string;
  let stubBin: string;
  let logFile: string;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'lint-sql-dispatch-'));
    // sqlfluff config present → ensurePackInstalled short-circuits, no upgrade.
    mkdirSync(path.join(directory, '.safeword'), { recursive: true });
    writeFileSync(path.join(directory, '.safeword', 'sqlfluff.cfg'), '[sqlfluff]\n');
    writeFileSync(path.join(directory, 'query.sql'), 'select 1;\n');

    stubBin = path.join(directory, 'stub-bin');
    logFile = path.join(directory, 'sqlfluff-invocations.log');
    mkdirSync(stubBin, { recursive: true });
    const stub = path.join(stubBin, 'sqlfluff');
    writeFileSync(stub, `#!/bin/sh\necho "$@" >> ${JSON.stringify(logFile)}\nexit 0\n`);
    chmodSync(stub, 0o755);
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(logFile, { force: true });
    rmSync(path.join(directory, '.safeword', 'config.json'), { force: true });
  });

  async function runLintFile(): Promise<string[]> {
    const sqlFile = path.join(directory, 'query.sql');
    const script = `
      const { lintFile } = await import(${JSON.stringify(LINT_MODULE)});
      const result = await lintFile(${JSON.stringify(sqlFile)}, ${JSON.stringify(directory)});
      console.log(JSON.stringify(result));
    `;
    await execFileAsync('bun', ['-e', script], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PATH: `${stubBin}${path.delimiter}${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: directory,
      },
      timeout: 60_000,
    });
    return existsSync(logFile)
      ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean)
      : [];
  }

  it('runs sqlfluff lint and NOT fix when sql.fix is unset (the #638 default)', async () => {
    const invocations = await runLintFile();

    expect(invocations.some(line => line.startsWith('lint '))).toBe(true);
    expect(invocations.some(line => line.startsWith('fix '))).toBe(false);
  }, 90_000);

  it('runs sqlfluff fix then lint when sql.fix is opted in', async () => {
    writeFileSync(
      path.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ installedPacks: ['sql'], sql: { fix: true } }),
    );

    const invocations = await runLintFile();

    expect(invocations[0]).toMatch(/^fix /);
    expect(invocations.some(line => line.startsWith('lint '))).toBe(true);
  }, 90_000);
});
