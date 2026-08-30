import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');

interface Check {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
}

const checks: readonly Check[] = [
  { name: 'build', command: 'bun', args: ['run', 'build'] },
  {
    name: 'runtime, aliases, help, capabilities, fixtures, and documentation',
    command: nodePath.join(packageRoot, 'node_modules/.bin/vitest'),
    args: [
      'run',
      '--maxWorkers=1',
      'tests/cli-protocol/cli-contract.test.ts',
      'tests/cli-protocol/cli-program.test.ts',
      'tests/cli-protocol/cli-wiring.test.ts',
      'tests/cli-protocol/help-aliases.test.ts',
      'tests/cli-protocol/catalog.test.ts',
      'tests/cli-protocol/machine-contract.test.ts',
      'tests/cli-protocol/cli-documentation-contract.test.ts',
      'tests/generated-tree-differences.test.ts',
    ],
  },
  {
    name: 'generated CLI reference',
    command: 'bun',
    args: ['scripts/generate-cli-reference.ts', '--check'],
  },
  {
    name: 'canonical CLI terminology',
    command: 'bun',
    args: ['scripts/check-cli-terminology.ts'],
  },
  {
    name: 'generated Claude plugin',
    command: 'bun',
    args: ['scripts/generate-claude-plugin.ts', '--check'],
  },
  {
    name: 'generated Codex plugin',
    command: 'bun',
    args: ['scripts/generate-codex-plugin.ts', '--check'],
  },
  {
    name: 'Claude plugin release contract',
    command: 'bun',
    args: ['scripts/check-claude-plugin-release.ts'],
  },
];

const failures: { readonly name: string; readonly output: string }[] = [];
for (const check of checks) {
  const result = spawnSync(check.command, [...check.args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_NO_UPDATE_CHECK: '1' },
    timeout: 180_000,
  });
  if (result.status === 0) {
    console.log(`✓ ${check.name}`);
    continue;
  }
  failures.push({
    name: check.name,
    output: [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim(),
  });
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\nCLI contract failed: ${failure.name}\n${failure.output}`);
  }
  process.exitCode = 1;
} else {
  console.log('CLI contract is consistent.');
}
