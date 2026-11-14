// Counterfactual test discrimination, not a claim of historical test-first work.
// Mutate only an isolated copy of the built CLI; leave source and live dist intact.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cli = path.join(root, 'packages/cli');
const mode = process.argv[2];
if (!['repeat', 'recovery'].includes(mode)) throw new Error('Expected repeat or recovery');
const copy = mkdtempSync(path.join(cli, '.test-tmp/approval-red-'));
try {
  for (const entry of ['dist', 'templates', 'package.json']) cpSync(path.join(cli, entry), path.join(copy, entry), { recursive: true });
  symlinkSync(path.join(cli, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
  const chunk = readdirSync(path.join(copy, 'dist')).find(name => /^plan-approval-.+\.js$/u.test(name));
  if (!chunk) throw new Error('Approval bundle missing');
  const target = path.join(copy, 'dist', chunk);
  const source = readFileSync(target, 'utf8');
  const from = mode === 'repeat'
    ? '? executionDiscoveryNotice(discovery) : ""'
    : 'function currentApprovalResult(context, achievedIndependence) {';
  const to = mode === 'repeat'
    ? '? "" : ""'
    : `${from}\n  if (readFileSync(context.ticketPath, "utf8").includes("### Execution discovery requiring fresh planning review")) return void 0;`;
  if (source.split(from).length !== 2) throw new Error('Mutation must identify one exact site');
  writeFileSync(target, source.replace(from, () => to));
  console.log(`Counterfactual ${mode}: ${mode === 'repeat' ? 'omit retained discovery' : 'refuse reuse of prior human approval after repair'}`);
  const result = spawnSync(process.execPath, [
    path.join(cli, 'node_modules/.bin/vitest'), 'run',
    'tests/integration/plan-design-approval.test.ts', '-t',
    'routes .* repair to .* through the installed CLI',
  ], { cwd: cli, env: { ...process.env, SAFEWORD_TEST_CLI_ROOT: copy }, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(copy, { recursive: true, force: true });
}
