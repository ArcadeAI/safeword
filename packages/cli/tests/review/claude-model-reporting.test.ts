import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { initializeWorkflowGit } from '../helpers/codex-workflow-git.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Mock only the external reviewer executable; actual CLI worker, packet, signing
// and current-source status are real. These events are NONRECEIPTS, not live models.
it.each(['current', 'auxiliary', 'mixed', 'usage-only'])(
  'reports the original Claude model through normal signed status: %s',
  mode => {
    const root = mkdtempSync(path.join(tmpdir(), 'claude-reporting-'));
    const bin = mkdtempSync(path.join(repo, 'node_modules/.cache/claude-reporting-'));
    roots.push(root, bin);
    const project = path.join(root, 'project');
    mkdirSync(project);
    mkdirSync(path.join(project, '.safeword'));
    writeFileSync(path.join(project, 'subject.ts'), 'export const answer = 42;\n');
    writeFileSync(
      path.join(project, '.safeword/config.json'),
      JSON.stringify({
        crossAgentReview: 'prefer',
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'claude-opus-5' }] },
      }),
    );
    initializeWorkflowGit(project, root, ['subject.ts', '.safeword/config.json']);
    const executable = path.join(bin, 'claude');
    writeFileSync(
      executable,
      String.raw`#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', s => input += s);
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').at(-1));
  fs.writeFileSync(${JSON.stringify(path.join(root, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));
  const model = 'claude-opus-5';
  const output = { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude', verdict: 'approve', summary: 'CONTROL only', findings: [] };
  const streaming = process.argv[process.argv.indexOf('--output-format') + 1] === 'stream-json' && process.argv.includes('--verbose');
  if (streaming && '${mode}' !== 'usage-only') console.log(JSON.stringify({ type: 'assistant', message: { model } }));
  if (streaming && '${mode}' === 'mixed') console.log(JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5' } }));
  console.log(JSON.stringify({ type: 'result', subtype: 'success', structured_output: output,
    modelUsage: { main: { provider: 'firstParty', canonicalModel: model }, ...('${mode}' === 'auxiliary' ? { helper: { provider: 'firstParty', canonicalModel: 'claude-haiku-5' } } : {}) } }));
});
`,
    );
    chmodSync(executable, 0o700);
    const selected = spawnSync(
      path.join(repo, 'scripts/dev'),
      ['bun', '--print', 'process.execPath'],
      { encoding: 'utf8' },
    );
    expect(selected.status).toBe(0);
    const cli = path.join(repo, 'packages/cli/dist/cli.js');
    const env = {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      CODEX_HOME: path.join(root, 'profile'),
      XDG_STATE_HOME: path.join(root, 'state'),
      SAFEWORD_REVIEW_KEY_ROOT: path.join(root, 'state'),
      SAFEWORD_REVIEW_FOREGROUND_MS: '65000',
      SAFEWORD_REVIEW_RUN_BOUND_MS: '4000',
      SAFEWORD_REVIEW_TIMEOUT_MS: '3000',
    };
    const run = (...args: string[]) =>
      spawnSync(selected.stdout.trim(), [cli, ...args], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 15_000,
      });
    const dispatch = run(
      'review',
      'run',
      'quality-review',
      '--agent-handoff',
      '--json',
      '--',
      'subject.ts',
    );
    expect(dispatch.status, dispatch.stderr).toBe(0);
    const id = JSON.parse(dispatch.stdout).data.review_id;
    const status = run('review', 'status', id, '--json');
    expect(status.status, status.stderr).toBe(0);
    const data = JSON.parse(status.stdout).data;
    expect(data).toMatchObject({ status: 'approved', actual_reviewer: 'claude' });
    if (mode === 'current' || mode === 'auxiliary') {
      expect(data.confirmed_reviewer_model, 'CLAUDE_MODEL_NOT_OBSERVED').toEqual({
        provider: 'anthropic',
        model: 'claude-opus-5',
      });
      const args = JSON.parse(readFileSync(path.join(root, 'argv.json'), 'utf8')) as string[];
      expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
      expect(args).toContain('--verbose');
    } else expect(data.confirmed_reviewer_model).toBeUndefined();
  },
  25_000,
);
