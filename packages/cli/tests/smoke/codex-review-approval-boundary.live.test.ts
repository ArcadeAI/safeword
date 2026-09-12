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
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
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

describe.skipIf(!CAN_RUN)('live smoke: installed Codex review approval boundary', () => {
  it('allows only non-executing review dispatches for the installed runtime', () => {
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
    const rulesDirectory = nodePath.join(codexHome, 'rules');
    const rules = readdirSync(rulesDirectory)
      .filter(name => name.endsWith('.rules'))
      .map(name => nodePath.join(rulesDirectory, name));
    // This is the exact argv shape submitted to Codex after wrapping the
    // command with the explicit environment required by the installed rule.
    const prefix = ['/usr/bin/env', 'SAFEWORD_REVIEW_PROGRESS=1', bun, runtime, 'review'];

    for (const kind of ['quality-review', 'scenario-gate', 'plan-implementation']) {
      const result = decision(codex, rules, [
        ...prefix,
        'run',
        kind,
        '--agent-handoff',
        '--json',
        '--context',
        'README.md',
        '--',
        'packages/cli/package.json',
      ]);
      expect(result.decision).toBe('allow');
      expect(result.matchedRules).toEqual(expect.any(Array));
      expect(result.matchedRules?.length).toBeGreaterThan(0);
    }
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
        '--proof-target',
        'packages/cli/package.json',
      ],
      [bun, '-e', 'console.log("unrelated")'],
    ]) {
      const result = decision(codex, rules, command);
      expect(result.matchedRules).toEqual([]);
      expect(result.decision).not.toBe('allow');
    }
  });
});
