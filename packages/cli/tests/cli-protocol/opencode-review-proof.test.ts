import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

type Agent = keyof typeof REVIEWER_CAPABILITIES;
type Behavior =
  | 'approve'
  | 'process'
  | 'retry'
  | 'malformed'
  | 'incomplete'
  | 'oversized'
  | 'missing'
  | 'contradictory'
  | 'packet'
  | 'source'
  | 'timeout'
  | 'tool';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) removeTemporaryDirectory(directory);
  directories.length = 0;
});

// Real CLI, detached worker, routing and evidence checks; only reviewer processes are doubled.
function fixture(
  options: {
    author?: string;
    policy?: 'prefer' | 'require';
    reviewers?: Partial<Record<Agent, Behavior>>;
    alternate?: boolean;
    remainingBudget?: number;
  } = {},
) {
  const cwd = createTemporaryDirectory();
  const bin = createTrustedReviewerDirectory('opencode-proof-');
  directories.push(cwd, bin);
  const target = nodePath.join(cwd, 'review-input.md');
  const log = nodePath.join(cwd, 'requests.jsonl');
  const tool = nodePath.join(cwd, 'tool-executed');
  writeFileSync(target, 'original review source\n');
  mkdirSync(nodePath.join(cwd, '.safeword'));
  writeFileSync(
    nodePath.join(cwd, '.safeword', 'config.json'),
    JSON.stringify({
      crossAgentReview: options.policy ?? 'require',
      ...(options.alternate && { crossAgentReviewAlternateModel: { codex: 'retry-model' } }),
    }),
  );
  const reviewers = Object.entries(options.reviewers ?? { opencode: 'approve' });
  const clock = nodePath.join(cwd, 'clock.cjs');
  if (options.remainingBudget !== undefined) {
    // The worker inherits this clock double; reviewer processes do not inherit NODE_OPTIONS.
    writeFileSync(
      clock,
      `const fs = require('node:fs');
const base = Date.now();
Date.now = () => base + (fs.existsSync(${JSON.stringify(log)}) ? ${270_000 - (options.remainingBudget ?? 0)} : 0);
`,
    );
  }
  for (const [agent, behavior] of reviewers) {
    writeFileSync(
      nodePath.join(bin, agent),
      String.raw`#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES[agent as Agent])}); process.exit(0); }
if (args.includes('--version')) { console.log('${agent} 1.0.0'); process.exit(0); }
const agent = ${JSON.stringify(agent)};
const behavior = ${JSON.stringify(behavior)};
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ agent, args }) + '\n');
const prompt = fs.readFileSync(0, 'utf8');
const dispatch = /"dispatch_id":"([^"]+)"/.exec(prompt)?.[1];
if (behavior === 'process' || (behavior === 'retry' && !args.includes('--model'))) { console.error('review crashed'); process.exit(7); }
if (behavior === 'timeout') { setInterval(() => {}, 1000); }
else if (behavior === 'malformed') console.log('not-json');
else if (behavior === 'incomplete') console.log(JSON.stringify({ type: 'text', part: { type: 'text', text: '{}' } }));
else if (behavior === 'oversized') process.stdout.write('x'.repeat(1024 * 1024 + 1));
else {
  if (behavior === 'packet') fs.writeFileSync('review-input.md', 'mutated packet');
  if (behavior === 'source') fs.writeFileSync(${JSON.stringify(target)}, 'mutated source');
  if (behavior === 'tool') {
    const permission = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT || '{}').permission;
    console.log(JSON.stringify({ type: 'tool_use', part: { type: 'tool', tool: 'write' } }));
    if (permission?.['*'] !== 'deny') fs.writeFileSync(${JSON.stringify(tool)}, 'executed');
  }
  const output = { schema_version: 1, dispatch_id: dispatch, reviewer_agent: agent, verdict: 'approve', summary: 'reviewed', findings: [] };
  if (behavior === 'missing') delete output.reviewer_agent;
  if (behavior === 'contradictory') output.reviewer_agent = 'codex';
  console.log(JSON.stringify(agent === 'opencode' ? { type: 'text', part: { type: 'text', time: { end: 1 }, text: JSON.stringify(output) } } : output));
}
`,
      { mode: 0o755 },
    );
  }
  return {
    target,
    tool,
    requests: () =>
      existsSync(log)
        ? readFileSync(log, 'utf8')
            .trim()
            .split('\n')
            .map(line => (JSON.parse(line) as { agent: Agent }).agent)
        : [],
    async run() {
      const result = await runCli(
        [
          'review',
          'run',
          'quality-review',
          'review-input.md',
          '--json',
          '--no-input',
          '--cwd',
          cwd,
        ],
        {
          cwd,
          env: {
            PATH: `${bin}:/usr/bin:/bin`,
            XDG_CONFIG_HOME: nodePath.join(cwd, 'profile'),
            SAFEWORD_AGENT_RUNTIME: options.author ?? 'claude',
            SAFEWORD_NO_UPDATE_CHECK: '1',
            ...(options.remainingBudget !== undefined && {
              NODE_OPTIONS: `--require=${clock}`,
              SAFEWORD_REVIEW_RUN_BOUND_MS: '270000',
              SAFEWORD_REVIEW_TIMEOUT_MS: '60000',
            }),
            ...(Object.values(options.reviewers ?? {}).includes('timeout') && {
              SAFEWORD_REVIEW_TIMEOUT_MS: '5000',
            }),
          },
        },
      );
      return { ...result, payload: JSON.parse(result.stdout) };
    },
  };
}

describe('OpenCode behavior proof through the built CLI', () => {
  it.each([
    { author: 'claude', reviewer: 'codex' },
    { author: 'codex', reviewer: 'claude' },
    { author: 'opencode', reviewer: 'claude' },
  ] as const)(
    'keeps $reviewer preferred for $author while OpenCode is available',
    async ({ author, reviewer }) => {
      const test = fixture({
        author,
        reviewers: { claude: 'approve', codex: 'approve', opencode: 'approve' },
      });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.payload.data).toMatchObject({
        actual_reviewer: reviewer,
        independence: 'cross-agent',
      });
      expect(test.requests()).toEqual([reviewer]);
    },
  );

  it('completes the eligible Codex retry before considering OpenCode', async () => {
    const test = fixture({ alternate: true, reviewers: { codex: 'retry', opencode: 'approve' } });
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.payload.data).toMatchObject({
      actual_reviewer: 'codex',
      independence: 'cross-agent',
    });
    expect(test.requests()).toEqual(['codex', 'codex']);
  });

  it('starts OpenCode when exactly one minimum route budget remains', async () => {
    const test = fixture({
      remainingBudget: 60_000,
      reviewers: { codex: 'process', opencode: 'approve' },
    });
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.payload.data).toMatchObject({
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
    });
    expect(test.requests()).toEqual(['codex', 'opencode']);
  });

  it.each(['prefer', 'require'] as const)(
    'does not launch OpenCode below the minimum route budget under %s',
    async policy => {
      const test = fixture({
        policy,
        remainingBudget: 59_999,
        reviewers: { codex: 'process', opencode: 'approve' },
      });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.payload.data).toMatchObject({ review_policy: policy, independence: 'none' });
      expect(result.payload.findings).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'REVIEW_ROUTES_EXHAUSTED' })]),
      );
      expect(test.requests()).toEqual(['codex']);
    },
  );

  it.each([
    { author: 'codex', failed: 'claude', reviewer: 'opencode' },
    { author: 'opencode', failed: 'claude', reviewer: 'codex' },
  ] as const)(
    'uses $reviewer independently for $author after $failed fails',
    async ({ author, failed, reviewer }) => {
      const reviewers: Partial<Record<Agent, Behavior>> = {
        claude: 'process',
        codex: 'approve',
        opencode: 'approve',
      };
      const test = fixture({
        author,
        reviewers,
      });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.payload.data).toMatchObject({
        actual_reviewer: reviewer,
        independence: 'cross-agent',
      });
      expect(test.requests()).toEqual([failed, reviewer]);
    },
  );

  it.each(['prefer', 'require'] as const)(
    'retains degraded feedback after OpenCode failure under %s',
    async policy => {
      const test = fixture({ policy, reviewers: { claude: 'approve', opencode: 'process' } });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(policy === 'prefer' ? 0 : 2);
      expect(result.payload.data).toMatchObject({
        actual_reviewer: 'claude',
        independence: 'degraded',
        independent_fallback_failure: 'process_failed',
        reviewer_output: { reviewer_agent: 'claude', summary: 'reviewed' },
      });
      expect(test.requests()).toEqual(['opencode', 'claude']);
    },
  );

  it.each(['prefer', 'require'] as const)(
    'never treats OpenCode self-review as independent under %s',
    async policy => {
      const test = fixture({ author: 'opencode', policy });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(policy === 'prefer' ? 0 : 2);
      expect(result.payload.data).toMatchObject({
        actual_reviewer: 'opencode',
        independence: 'degraded',
      });
      expect(test.requests()).toEqual(['opencode']);
    },
  );

  it('accepts one closed OpenCode result as required independent evidence', async () => {
    const test = fixture();
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.payload.data).toMatchObject({
      status: 'approved',
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
    });
    expect(test.requests()).toEqual(['opencode']);
  });

  it.each([
    { behavior: 'malformed', failure: 'invalid_output' },
    { behavior: 'incomplete', failure: 'invalid_output' },
    { behavior: 'oversized', failure: 'invalid_output' },
    { behavior: 'missing', failure: 'REVIEWER_PROVENANCE_MISSING' },
    { behavior: 'contradictory', failure: 'REVIEWER_PROVENANCE_CONTRADICTORY' },
    { behavior: 'process', failure: 'process_failed' },
    { behavior: 'timeout', failure: 'timed_out' },
  ] as const)(
    'rejects OpenCode $behavior output without independent evidence',
    async ({ behavior, failure }) => {
      const test = fixture({ reviewers: { opencode: behavior } });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.payload.data).toMatchObject({
        independence: 'none',
        independent_fallback_failure: failure,
      });
      expect(result.payload.data).not.toHaveProperty('reviewer_output');
      expect(test.requests()).toEqual(['opencode']);
    },
  );

  it('denies a requested OpenCode tool before accepting its complete result', async () => {
    const test = fixture({ reviewers: { opencode: 'tool' } });
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.payload.data).toMatchObject({
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
    });
    expect(existsSync(test.tool)).toBe(false);
    expect(test.requests()).toEqual(['opencode']);
  });

  it('rejects OpenCode packet mutation without changing the reviewed source', async () => {
    const test = fixture({ reviewers: { opencode: 'packet' } });
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(1);
    expect(result.payload).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEWER_WRITE_ATTEMPT' }],
      data: { independence: 'none' },
    });
    expect(readFileSync(test.target, 'utf8')).toBe('original review source\n');
  });

  it('marks OpenCode review stale when the reviewed source changes', async () => {
    const test = fixture({ reviewers: { opencode: 'source' } });
    const result = await test.run();
    expect(result.exitCode, result.stdout).toBe(2);
    expect(result.payload).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_STALE' }],
      data: { status: 'stale' },
    });
    expect(result.payload.data.independence).toBe('none');
  });

  it.each(['cursor', 'unknown'])(
    'rejects unsupported author %s without launching OpenCode',
    async author => {
      const test = fixture({ author });
      const result = await test.run();
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.payload.data).toMatchObject({ author_agent: author, independence: 'none' });
      expect(result.payload.findings).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'REVIEW_ROUTES_EXHAUSTED' })]),
      );
      expect(test.requests()).toEqual([]);
    },
  );
});
