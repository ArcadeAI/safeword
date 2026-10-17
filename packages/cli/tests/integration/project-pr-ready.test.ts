import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  testCliPath as CLI,
  writeTestFile,
} from '../helpers.js';

const directories: string[] = [];
const TICKET = '.project/tickets/READY-delivery/ticket.md';

afterEach(() => {
  for (const directory of directories.splice(0)) removeTemporaryDirectory(directory);
});

describe('project pr-ready validation (#5511)', () => {
  it('selects the delivery worktree with --cwd from the launch checkout', () => {
    const project = fixture();
    const result = project.run(project.launch, {}, ['--cwd', project.delivery]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      changed: true,
      data: { project_directory: realpathSync(project.delivery) },
    });
    expect(project.calls().map(call => call.cwd)).toEqual([
      realpathSync(project.delivery),
      realpathSync(project.delivery),
    ]);
  });

  it.each(['subdirectory', 'symlink'])('uses the delivery root from a %s', spelling => {
    const project = fixture();
    const nested = nodePath.join(project.delivery, 'nested');
    mkdirSync(nested);
    const alias = nodePath.join(project.parent, 'delivery-alias');
    symlinkSync(nested, alias);
    const result = project.run(spelling === 'subdirectory' ? nested : alias);
    expect(result.status, result.stderr).toBe(0);
    expect(project.calls().map(call => call.cwd)).toEqual([
      realpathSync(project.delivery),
      realpathSync(project.delivery),
    ]);
  });

  it('does not use a verified launch checkout to authorize an unfinished delivery', () => {
    const project = fixture();
    writeTestFile(
      project.delivery,
      TICKET,
      '---\nid: READY\ntype: task\nphase: implement\nstatus: in_progress\n---\n',
    );
    const result = project.run();
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PR_READY_NOT_FINISHED' }],
      data: { project_directory: realpathSync(project.delivery) },
    });
    expect(project.calls()).toEqual([]);
  });

  it.each(['missing', 'stale'])('refuses a %s readiness receipt', kind => {
    const project = fixture();
    const receiptPath = nodePath.join(project.delivery, '.project/readiness-ticket.json');
    if (kind === 'missing') rmSync(receiptPath);
    else
      writeTestFile(
        project.delivery,
        '.project/readiness-ticket.json',
        JSON.stringify({
          schema_version: 1,
          ticket_id: 'READY',
          head_sha: head(project.launch),
        }),
      );
    const result = project.run();
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PR_READY_NOT_FINISHED' }],
    });
    expect(project.calls()).toEqual([]);
  });

  it.each([
    ['malformed', 'PR_READY_INVALID_RESPONSE'],
    ['missing-fields', 'PR_READY_INVALID_RESPONSE'],
    ['view-fail', 'PR_READY_INSPECTION_FAILED'],
    ['commit-during-view', 'PR_READY_EVIDENCE_CHANGED'],
    ['reopen-ticket', 'PR_READY_EVIDENCE_CHANGED'],
  ])('refuses promotion after %s', (mode, code) => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_MODE: mode });
    const output = JSON.parse(result.stdout);
    expect(result.status, result.stderr).toBe(1);
    expect(output).toMatchObject({
      ok: false,
      state: 'failed',
      changed: false,
      errors: [{ code }],
    });
    expect(output.effects.network).toEqual([
      { kind: 'github-pull-request', target: 'current-branch', operation: 'inspect' },
    ]);
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
  });

  /* eslint-disable unicorn/no-null -- Invalid external JSON must retain explicit null fields. */
  it.each<[string, Record<string, unknown>]>([
    ['zero PR number', { number: 0 }],
    ['negative PR number', { number: -1 }],
    ['fractional PR number', { number: 37.5 }],
    ['unsafe PR number', { number: Number.MAX_SAFE_INTEGER + 1 }],
    ['string PR number', { number: '37' }],
    ['null PR number', { number: null }],
    ['string draft flag', { isDraft: 'true' }],
    ['null draft flag', { isDraft: null }],
    ['null head', { headRefOid: null }],
    ['null state', { state: null }],
  ])('refuses metadata containing %s', (_description, metadata) => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_METADATA: JSON.stringify(metadata) });

    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'PR_READY_INVALID_RESPONSE' }],
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
  });
  /* eslint-enable unicorn/no-null */

  it.each(['CLOSED', 'MERGED'])('refuses a %s pull request', state => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_STATE: state });
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      errors: [{ code: 'PR_READY_NOT_OPEN' }],
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
  });

  it('refuses a changed HEAD even when readiness is refreshed during inspection', () => {
    const project = fixture();
    const inspectedHead = head(project.delivery);
    const result = project.run(undefined, { GH_TEST_MODE: 'refresh-readiness-during-view' });

    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'PR_READY_EVIDENCE_CHANGED' }],
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
    expect(head(project.delivery)).not.toBe(inspectedHead);
    const receiptPath = nodePath.join(project.delivery, '.project/readiness-ticket.json');
    const refreshedReceipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    expect(refreshedReceipt).toMatchObject({ head_sha: head(project.delivery) });
  });

  it('refuses a PR head different from the verified local commit', () => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_HEAD: 'a'.repeat(40) });
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      errors: [{ code: 'PR_READY_HEAD_MISMATCH' }],
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
  });

  it('checks evidence before skipping mutation for an already-Ready PR', () => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_MODE: 'already-ready' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, changed: false });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
    rmSync(nodePath.join(project.delivery, '.project/readiness-ticket.json'));
    const refused = project.run(undefined, { GH_TEST_MODE: 'already-ready' });
    expect(refused.status).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PR_READY_NOT_FINISHED' }],
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view']);
  });

  it('reports a failed Ready operation without claiming success', () => {
    const project = fixture();
    const result = project.run(undefined, { GH_TEST_MODE: 'ready-fail' });
    const output = JSON.parse(result.stdout);
    expect(result.status, result.stderr).toBe(1);
    expect(output).toMatchObject({
      ok: false,
      state: 'failed',
      changed: false,
      errors: [{ code: 'PR_READY_PROMOTION_FAILED' }],
    });
    expect(output.effects.network).toEqual([
      { kind: 'github-pull-request', target: 'current-branch', operation: 'inspect' },
      { kind: 'github-pull-request', target: '37', operation: 'mark-ready' },
    ]);
    expect(project.calls().map(call => call.args[1])).toEqual(['view', 'ready']);
  });

  it('uses an explicit PR number and refuses inconsistent lookup results', () => {
    const project = fixture();
    expect(project.run(undefined, {}, ['37']).status).toBe(0);
    expect(project.calls()[0]?.args).toEqual([
      'pr',
      'view',
      '37',
      '--json',
      'number,headRefOid,isDraft,state',
    ]);
    const wrong = project.run(undefined, {}, ['42']);
    expect(JSON.parse(wrong.stdout)).toMatchObject({
      ok: false,
      errors: [{ code: 'PR_READY_INVALID_RESPONSE' }],
    });
    expect(project.calls().filter(call => call.args[1] === 'ready')).toHaveLength(1);
  });

  it('ignores unrelated session state when selecting readiness evidence', () => {
    const project = fixture();
    writeTestFile(
      project.delivery,
      '.project/quality-state-undefined.json',
      JSON.stringify({ activeTicket: 'OTHER' }),
    );
    const result = project.run();
    expect(result.status, result.stderr).toBe(0);
    expect(project.calls().map(call => call.cwd)).toEqual([
      realpathSync(project.delivery),
      realpathSync(project.delivery),
    ]);
  });

  it('promotes with inherited Git configuration stripped from child processes', () => {
    const project = fixture();
    const result = project.run(undefined, {
      GH_TEST_MODE: 'inspect-environment',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'invalid',
      GIT_CONFIG_VALUE_0: 'true',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      changed: true,
      data: { project_directory: realpathSync(project.delivery) },
    });
    expect(project.calls().map(call => call.args[1])).toEqual(['view', 'ready']);
    expect(project.calls().map(call => call.inheritedContext)).toEqual([[], []]);
  });

  it.each([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_CEILING_DIRECTORIES',
    'GH_REPO',
    'GH_HOST',
  ])('rejects a %s repository override', variable => {
    const project = fixture();
    const result = project.run(undefined, { [variable]: project.launch });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PR_READY_CONTEXT_OVERRIDE' }],
    });
    expect(project.calls()).toEqual([]);
  });

  it('makes no GitHub call in offline mode', () => {
    const project = fixture();
    const result = project.run(undefined, {}, ['--offline']);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'CLI_ONLINE_REQUIRED' }],
    });
    expect(project.calls()).toEqual([]);
  });

  it.each(['0', '-3', 'other-branch', '--repo=other/repo'])(
    'rejects invalid selector %s',
    selector => {
      const project = fixture();
      const result = project.run(undefined, {}, [selector]);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: false,
        errors: [{ code: 'CLI_ARGUMENT_INVALID' }],
      });
      expect(project.calls()).toEqual([]);
    },
  );

  it('does not fall back to the launch checkout for an unenrolled worktree', () => {
    const project = fixture();
    rmSync(nodePath.join(project.delivery, '.safeword/SAFEWORD.md'));
    const result = project.run();
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PR_READY_NOT_ENROLLED' }],
    });
    expect(project.calls()).toEqual([]);
  });
});

function head(directory: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
}

function receipt(directory: string): void {
  writeTestFile(
    directory,
    '.project/readiness-ticket.json',
    JSON.stringify({
      schema_version: 1,
      ticket_id: 'READY',
      head_sha: head(directory),
    }),
  );
}

function fixture() {
  const parent = createTemporaryDirectory();
  directories.push(parent);
  const launch = nodePath.join(parent, 'launch');
  const delivery = nodePath.join(parent, 'delivery');
  mkdirSync(launch);
  initGitRepo(launch);
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: launch });
  writeTestFile(launch, '.safeword/SAFEWORD.md', '# Safeword\n');
  writeTestFile(launch, TICKET, '---\nid: READY\ntype: task\nphase: done\nstatus: done\n---\n');
  writeTestFile(
    launch,
    '.project/tickets/READY-delivery/verify.md',
    '**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  execFileSync('git', ['add', '.'], { cwd: launch });
  execFileSync('git', ['commit', '-qm', 'verified delivery'], { cwd: launch });
  execFileSync('git', ['worktree', 'add', '-q', '-b', 'delivery', delivery], { cwd: launch });
  execFileSync('git', ['commit', '--allow-empty', '-qm', 'different launch head'], { cwd: launch });
  receipt(launch);
  receipt(delivery);
  const bin = nodePath.join(parent, 'bin');
  const log = nodePath.join(parent, 'gh.jsonl');
  const executable = nodePath.join(bin, 'gh');
  writeTestFile(
    parent,
    'bin/gh',
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const cp = require('node:child_process');",
      'const args = process.argv.slice(2);',
      'const call = { cwd: process.cwd(), args };',
      "if (process.env.GH_TEST_MODE === 'inspect-environment') call.inheritedContext = Object.keys(process.env).filter(name => name.startsWith('GIT_') || name === 'CLAUDE_PROJECT_DIR').sort();",
      String.raw`fs.appendFileSync(process.env.GH_TEST_LOG, JSON.stringify(call) + '\n');`,
      "if (args[1] === 'view') {",
      "  if (process.env.GH_TEST_MODE === 'view-fail') { console.error('lookup failed'); process.exit(7); }",
      "  if (process.env.GH_TEST_MODE === 'malformed') { console.log('invalid JSON'); process.exit(0); }",
      "  const sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();",
      "  if (['commit-during-view', 'refresh-readiness-during-view'].includes(process.env.GH_TEST_MODE)) cp.execFileSync('git', ['commit', '--allow-empty', '-qm', 'new head']);",
      "  if (process.env.GH_TEST_MODE === 'refresh-readiness-during-view') {",
      "    const path = '.project/readiness-ticket.json';",
      "    const receipt = JSON.parse(fs.readFileSync(path, 'utf8'));",
      "    receipt.head_sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();",
      '    fs.writeFileSync(path, JSON.stringify(receipt));',
      '  }',
      String.raw`  if (process.env.GH_TEST_MODE === 'reopen-ticket') fs.writeFileSync('.project/tickets/READY-delivery/ticket.md', '---\nid: READY\ntype: task\nphase: implement\nstatus: in_progress\n---\n');`,
      "  if (process.env.GH_TEST_MODE === 'missing-fields') { console.log('{}'); process.exit(0); }",
      "  const record = { number: 37, headRefOid: process.env.GH_TEST_HEAD || sha, isDraft: process.env.GH_TEST_MODE !== 'already-ready', state: process.env.GH_TEST_STATE || 'OPEN' };",
      "  console.log(JSON.stringify({ ...record, ...JSON.parse(process.env.GH_TEST_METADATA || '{}') }));",
      "} else if (args[1] === 'ready') {",
      "  if (process.env.GH_TEST_MODE === 'ready-fail') { console.error('promotion failed'); process.exit(9); }",
      "  console.log('Ready');",
      '} else { process.exit(8); }',
    ].join('\n'),
  );
  chmodSync(executable, 0o755);
  const run = (cwd = delivery, extra: NodeJS.ProcessEnv = {}, args: string[] = []) =>
    spawnSync(process.execPath, [CLI, '--json', '--no-input', 'project', 'pr-ready', ...args], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: launch,
        PATH: bin + nodePath.delimiter + (process.env.PATH ?? ''),
        GH_TEST_LOG: log,
        ...extra,
      },
    });
  const calls = (): { cwd: string; args: string[]; inheritedContext?: string[] }[] => {
    try {
      return readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };
  return { launch, delivery, parent, run, calls };
}

describe('project pr-ready worktree enforcement (#5511)', () => {
  it('promotes from the actual worktree despite an unrelated launch checkout', () => {
    const project = fixture();
    writeTestFile(
      project.launch,
      TICKET,
      '---\nid: READY\ntype: task\nphase: implement\nstatus: in_progress\n---\n',
    );
    const result = project.run();

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, changed: true });
    expect(project.calls()).toEqual([
      {
        cwd: realpathSync(project.delivery),
        args: ['pr', 'view', '--json', 'number,headRefOid,isDraft,state'],
      },
      { cwd: realpathSync(project.delivery), args: ['pr', 'ready', '37'] },
    ]);
  });
});
