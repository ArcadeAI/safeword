import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

// Supporting real-host controls; never a replacement for the contracted IDE rows.
const executable = process.env.SAFEWORD_CURSOR_CLI;
assert.ok(executable && nodePath.isAbsolute(executable), 'Set SAFEWORD_CURSOR_CLI to Cursor CLI');
const version = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 20_000 });
assert.equal(version.status, 0, 'Cursor CLI version probe failed');
const observedVersion = version.stdout.trim();
assert.ok(observedVersion);
const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cursor-cli-controls-'));
const fixtures = nodePath.resolve(import.meta.dirname, '../tests/fixtures/host-contract');
const escapedQuote = String.raw`'\''`;
const quote = (value: string): string => `'${value.replaceAll("'", () => escapedQuote)}'`;
const observer = `bun ${quote(nodePath.join(fixtures, 'cursor-write-observer.ts'))} native-cli-control`;
const control = `bun ${quote(nodePath.join(fixtures, 'cursor-cli-boundary-control.ts'))}`;
const results: object[] = [];

for (const mode of ['control-allow', 'control-deny', 'shared-allow', 'shared-deny'] as const) {
  const disposition = mode.endsWith('allow') ? 'allow' : 'deny';
  const shared = mode.startsWith('shared');
  const run = nodePath.join(root, mode);
  const workspace = nodePath.join(run, 'workspace');
  const plugin = nodePath.join(run, 'plugin');
  for (const directory of [
    nodePath.join(workspace, '.cursor'),
    nodePath.join(workspace, '.host-contract'),
    nodePath.join(plugin, '.cursor-plugin'),
    nodePath.join(plugin, 'hooks'),
    nodePath.join(run, 'profile'),
    nodePath.join(workspace, '.safeword'),
    nodePath.join(workspace, '.project/tickets/sentinel-write'),
  ])
    mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(workspace, '.safeword/config.json'),
    JSON.stringify({
      autoUpgrade: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  writeFileSync(
    nodePath.join(workspace, '.cursor/cli.json'),
    JSON.stringify({ permissions: { allow: ['Shell(printf)'], deny: [] } }),
  );
  writeFileSync(
    nodePath.join(plugin, '.cursor-plugin/plugin.json'),
    JSON.stringify({ name: 'safeword-cli-boundary-control', hooks: './hooks/hooks.json' }),
  );
  writeFileSync(
    nodePath.join(plugin, 'hooks/hooks.json'),
    JSON.stringify({
      version: 1,
      hooks: {
        sessionStart: [{ command: observer }],
        preToolUse: [{ command: observer }],
        beforeShellExecution: [{ command: `${control} ${shared ? 'shared' : disposition}` }],
        afterShellExecution: [{ command: observer }],
        stop: [{ command: observer }],
      },
    }),
  );
  const marker = `CLI_${randomUUID()}`;
  const relativeTarget =
    !shared || disposition === 'deny'
      ? '.project/tickets/sentinel-write/ticket.md'
      : 'sentinel.txt';
  const command = `printf ${marker} > ${relativeTarget}`;
  const prompt =
    `Run exactly one Shell attempt with this command: ${command}\n` +
    'Do not read files, use other tools, or retry after denial. Then finish with one sentence.';
  const args = [
    '--workspace',
    workspace,
    '--plugin-dir',
    plugin,
    '--trust',
    '--print',
    '--output-format',
    'stream-json',
  ];
  if (process.env.SAFEWORD_CURSOR_CLI_MODEL)
    args.push('--model', process.env.SAFEWORD_CURSOR_CLI_MODEL);
  args.push(prompt);
  const result: SpawnSyncReturns<string> = spawnSync(executable, args, {
    cwd: workspace,
    env: {
      ...process.env,
      CURSOR_CONFIG_DIR: nodePath.join(run, 'profile'),
      CLAUDE_CONFIG_DIR: nodePath.join(run, 'foreign-claude'),
    },
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  writeFileSync(nodePath.join(run, 'stdout.jsonl'), result.stdout ?? '');
  writeFileSync(nodePath.join(run, 'stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, 0, `CURSOR_CLI_UNAVAILABLE: incomplete run; evidence: ${run}`);
  const decisionFile = nodePath.join(workspace, '.host-contract/boundary-decisions.jsonl');
  assert.ok(existsSync(decisionFile), `CURSOR_CLI_UNAVAILABLE: plugin hook did not run: ${run}`);
  const decisions = readFileSync(decisionFile, 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          event: string;
          version: string;
          command: string;
          decision: { permission: string };
        },
    );
  assert.equal(decisions.length, 1, 'Expected exactly one native shell permission decision');
  const observed = decisions[0];
  assert.ok(observed);
  assert.equal(observed.event, 'beforeShellExecution');
  assert.equal(observed.version, observedVersion);
  assert.equal(observed.command, command);
  assert.equal(observed.decision.permission, disposition);
  if (shared && disposition === 'deny') {
    assert.match(JSON.stringify(observed.decision), /Shell commands can't change.*ticket/u);
  }
  const target = nodePath.join(workspace, relativeTarget);
  if (disposition === 'allow') {
    const observations = readFileSync(
      nodePath.join(workspace, '.host-contract/write-observations.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            event: string;
            source: string;
            version: string;
            command?: string;
          },
      );
    assert.equal(
      observations.filter(
        row =>
          row.event === 'afterShellExecution' &&
          row.source === 'native-cli-control' &&
          row.version === observedVersion &&
          row.command === command,
      ).length,
      1,
      'The exact allowed shell command must actually execute',
    );
    assert.equal(readFileSync(target, 'utf8'), marker);
  } else assert.equal(existsSync(target), false, 'Native CLI denial must prevent the write');
  results.push({ mode, version: observedVersion, runtime: 'CLI', evidence: run });
  console.log(`Cursor CLI ${mode} passed: ${run}`);
}
writeFileSync(nodePath.join(root, 'result.json'), JSON.stringify({ results }, undefined, 2));
console.log(
  `CLI controls passed; Safeword native guard conformance remains unproved. Evidence: ${root}`,
);
