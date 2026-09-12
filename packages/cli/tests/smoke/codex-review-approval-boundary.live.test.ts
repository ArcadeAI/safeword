/**
 * Opt-in live tripwire for the user's installed Codex review rules.
 *
 * Unlike surface-parity tests, this asks the installed Codex binary to evaluate
 * the installed Safeword runtime and real profile rule files. It therefore
 * fails when a plugin upgrade moves the runtime without refreshing the rules.
 *
 * Run with:
 *
 *   SAFEWORD_RUN_CODEX_APPROVAL_BOUNDARY_LIVE=1 bun run --cwd packages/cli test:smoke:live
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

const CAN_RUN = process.env.SAFEWORD_RUN_CODEX_APPROVAL_BOUNDARY_LIVE === '1';

interface InstalledPlugin {
  enabled?: boolean;
  pluginId?: string;
  version?: string;
}

function run(command: string, arguments_: string[]) {
  return spawnSync(command, arguments_, { encoding: 'utf8' });
}

function requireSuccess(result: ReturnType<typeof run>, label: string): string {
  expect(
    result.status,
    `${label} failed\nstdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`,
  ).toBe(0);
  return result.stdout ?? '';
}

function installedSafewordVersion(codex: string): string {
  const output = requireSuccess(run(codex, ['plugin', 'list', '--json']), 'codex plugin list');
  const parsed = JSON.parse(output) as { installed?: InstalledPlugin[] };
  const plugin = parsed.installed?.find(candidate => candidate.pluginId === 'safeword@safeword');
  expect(plugin).toMatchObject({ enabled: true });
  expect(plugin?.version).toEqual(expect.any(String));
  return plugin?.version ?? '';
}

function decision(
  codex: string,
  rules: string[],
  command: string[],
): { decision?: string; matchedRules?: unknown[] } {
  const output = requireSuccess(
    run(codex, ['execpolicy', 'check', ...rules.flatMap(rule => ['--rules', rule]), ...command]),
    `execpolicy check: ${command.join(' ')}`,
  );
  return JSON.parse(output) as { decision?: string; matchedRules?: unknown[] };
}

const ORDINARY_REVIEW_KINDS = ['quality-review', 'scenario-gate', 'plan-implementation'];

function expectOrdinaryDispatchesAllowed(codex: string, rules: string[], prefix: string[]): void {
  const variants = [
    ['--agent-handoff', '--json', '--', 'packages/cli/package.json'],
    [
      '--agent-handoff',
      '--json',
      '--context',
      'README.md',
      '--',
      'packages/cli/package.json',
      'packages/cli/src/review/contract.ts',
    ],
    ['--agent-handoff', '--json', '--quiet', '--', 'packages/cli/package.json'],
  ];
  for (const kind of ORDINARY_REVIEW_KINDS) {
    for (const variant of variants) {
      const result = decision(codex, rules, [...prefix, 'run', kind, ...variant]);
      expect(result.decision).toBe('allow');
      expect(result.matchedRules).toEqual(expect.any(Array));
      expect(result.matchedRules?.length).toBeGreaterThan(0);
    }
  }
}

function expectRuntimeRejectsExecutionOptions(
  codex: string,
  rules: string[],
  prefix: string[],
): void {
  const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-boundary-'));
  writeFileSync(nodePath.join(fixture, 'review-input.md'), 'bounded review input\n');
  try {
    for (const kind of ORDINARY_REVIEW_KINDS) {
      for (const option of [
        ['--execute', '["sh","-c","true"]'],
        ['--proof-cwd', '.'],
        ['--worker-job-id', 'forged-worker'],
      ]) {
        const command = [
          ...prefix,
          'run',
          kind,
          '--json',
          '--no-input',
          '--cwd',
          fixture,
          ...option,
          '--',
          'review-input.md',
        ];
        expect(decision(codex, rules, command).decision).toBe('allow');
        const rejected = run(command[0] ?? '', command.slice(1));
        expect(rejected.status, `${rejected.stdout ?? ''}${rejected.stderr ?? ''}`).not.toBe(0);
        expect(rejected.stdout).toContain('is only valid for executable-red reviews');
        expect(existsSync(nodePath.join(fixture, '.safeword', 'reviews'))).toBe(false);
      }
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe.skipIf(!CAN_RUN)('live smoke: installed Codex review approval boundary', () => {
  it('pre-authorizes ordinary dispatch while the runtime rejects execution-only flags', () => {
    const codex = process.env.SMOKE_CODEX_BIN ?? 'codex';
    const bun = requireSuccess(
      run('bun', ['-e', 'console.log(process.execPath)']),
      'resolve Bun executable',
    ).trim();
    const codexHome = process.env.CODEX_HOME ?? nodePath.join(homedir(), '.codex');
    const version = installedSafewordVersion(codex);
    const runtime = nodePath.join(
      codexHome,
      'plugins/cache/safeword/safeword',
      version,
      'runtime/cli.js',
    );
    if (!existsSync(runtime)) {
      throw new Error(`Installed Safeword runtime not found at ${runtime}`);
    }
    const rulesDirectory = nodePath.join(codexHome, 'rules');
    if (!existsSync(rulesDirectory)) {
      throw new Error(`Codex rules directory not found at ${rulesDirectory}`);
    }
    const rules = readdirSync(rulesDirectory)
      .filter(name => name.endsWith('.rules'))
      .map(name => nodePath.join(rulesDirectory, name));
    if (rules.length === 0) {
      throw new Error(`No Codex rule files found in ${rulesDirectory}`);
    }
    // This is the exact argv shape submitted to Codex after wrapping the
    // command with the explicit environment required by the installed rule.
    const prefix = ['/usr/bin/env', 'SAFEWORD_REVIEW_PROGRESS=1', bun, runtime, 'review'];

    expectOrdinaryDispatchesAllowed(codex, rules, prefix);
    // Prefix policy deliberately authorizes the ordinary review family; the
    // typed runtime owns option-level rejection before any job starts.
    expectRuntimeRejectsExecutionOptions(codex, rules, prefix);
    for (const command of [
      [...prefix, 'status', 'example-id'],
      [
        ...prefix,
        'run',
        'executable-red',
        '--agent-handoff',
        '--json',
        '--execute',
        '["sh","-c","true"]',
        '--scenario',
        'Scenario: example',
        '--ledger',
        'README.md',
        '--proof-cwd',
        '.',
      ],
      [bun, '-e', 'console.log("unrelated")'],
    ]) {
      const result = decision(codex, rules, command);
      expect(result.matchedRules).toEqual([]);
      expect(result.decision).not.toBe('allow');
    }
  });
});
