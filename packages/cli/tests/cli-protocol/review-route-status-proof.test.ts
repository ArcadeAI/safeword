import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

type Reviewer = 'codex' | 'opencode';
type Route = { reviewer: Reviewer; model: string };
const cleanupRoots: string[] = [];

afterEach(() => {
  for (const directory of cleanupRoots) {
    rmSync(directory, { recursive: true, force: true });
  }
  cleanupRoots.length = 0;
});

// Full public CLI wiring; only the external reviewer process is simulated.
function fixture(routes: Route[] = [{ reviewer: 'opencode', model: 'vendor/model-b' }]) {
  const cwd = createTemporaryDirectory();
  const runtimeRoot = createTrustedReviewerDirectory('route-status-proof-');
  cleanupRoots.push(cwd, runtimeRoot);
  const bin = nodePath.join(runtimeRoot, 'bin');
  mkdirSync(bin);
  mkdirSync(nodePath.join(cwd, '.safeword'));
  writeFileSync(
    nodePath.join(cwd, '.safeword/config.json'),
    JSON.stringify({ crossAgentReviewRoutes: { claude: routes } }),
  );
  writeFileSync(nodePath.join(cwd, 'target.md'), 'Review this bounded document.\n');
  const log = nodePath.join(runtimeRoot, 'requests.log');
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    XDG_CONFIG_HOME: nodePath.join(cwd, 'profile'),
    XDG_STATE_HOME: nodePath.join(cwd, 'state'),
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(cwd, 'keys'),
    SAFEWORD_AGENT_RUNTIME: 'claude',
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_REVIEW_PROGRESS: '0',
    SAFEWORD_REVIEW_FOREGROUND_MS: '10000',
  };
  return { cwd, bin, log, env };
}

function installReviewer(
  context: ReturnType<typeof fixture>,
  reviewer: Reviewer = 'opencode',
  options: { modelSelection?: boolean; models?: string[]; failure?: boolean } = {},
): void {
  const capabilities =
    options.modelSelection === false
      ? REVIEWER_CAPABILITIES[reviewer].replace('--model', '')
      : REVIEWER_CAPABILITIES[reviewer];
  writeFileSync(
    nodePath.join(context.bin, reviewer),
    String.raw`#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(${JSON.stringify(capabilities)});
} else if (args.includes('--version')) {
  console.log('${reviewer} 1.0.0');
} else if (args[0] === 'models') {
  console.log(${JSON.stringify((options.models ?? ['vendor/model-b']).join('\n'))});
} else {
  fs.appendFileSync(${JSON.stringify(context.log)}, '${reviewer}\n');
  if (${options.failure === true}) { console.error('review process failed'); process.exit(7); }
  const input = fs.readFileSync(0, 'utf8');
  const dispatch = /"dispatch_id":"([^"]+)"/.exec(input)?.[1];
  const result = { schema_version: 1, dispatch_id: dispatch, reviewer_agent: '${reviewer}', verdict: 'approve', summary: 'reviewed', findings: [] };
  console.log(JSON.stringify(${JSON.stringify(reviewer)} === 'opencode'
    ? { type: 'text', part: { type: 'text', time: { end: 1 }, text: JSON.stringify(result) } }
    : result));
}
`,
    { mode: 0o755 },
  );
}

async function status(context: ReturnType<typeof fixture>) {
  const result = await runCli(['status', '--json', '--no-input', '--cwd', context.cwd], context);
  expect(result.timedOut, result.stderr).toBe(false);
  const payload = JSON.parse(result.stdout);
  // A deliberately minimal project can report unrelated asset drift, not a status failure.
  expect(payload.errors, result.stdout).toEqual([]);
  expect(payload.data.configured).toBe(true);
  return payload.data.review_routes as Record<string, unknown>[];
}

async function review(context: ReturnType<typeof fixture>, exitCode = 0) {
  const result = await runCli(
    ['review', 'run', 'quality-review', 'target.md', '--json', '--no-input', '--cwd', context.cwd],
    context,
  );
  expect(result.timedOut, result.stderr).toBe(false);
  expect(result.exitCode, result.stdout).toBe(exitCode);
  return JSON.parse(result.stdout);
}

describe('ranked review evidence through public status', () => {
  it('reports a catalogued model as compatible but not proven', async () => {
    const context = fixture();
    installReviewer(context);

    expect(await status(context)).toEqual([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        runtime_default: false,
        independence: 'cross-agent',
        installed: true,
        compatibility: 'compatible',
        catalogue: 'catalogued',
        proof: 'unknown',
      },
    ]);
  });

  it('reports a successful public review as proven', async () => {
    const context = fixture();
    installReviewer(context);
    const completed = await review(context);
    expect(completed.data).toMatchObject({
      status: 'approved',
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
    });

    expect(await status(context)).toEqual([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        runtime_default: false,
        independence: 'cross-agent',
        installed: true,
        compatibility: 'compatible',
        catalogue: 'catalogued',
        proof: 'proven',
        proof_observed_at: expect.any(String),
      },
    ]);
  });

  it('reports an unlisted model as installed and compatible but not catalogued', async () => {
    const context = fixture();
    installReviewer(context, 'opencode', { models: ['vendor/another-model'] });

    expect(await status(context)).toMatchObject([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        installed: true,
        compatibility: 'compatible',
        catalogue: 'not_catalogued',
        proof: 'unknown',
      },
    ]);
  });

  it('reports an installed runtime without model selection as incompatible', async () => {
    const context = fixture();
    installReviewer(context, 'opencode', { modelSelection: false });

    expect(await status(context)).toMatchObject([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        installed: true,
        compatibility: 'not_compatible',
        catalogue: 'unavailable',
        proof: 'unknown',
      },
    ]);
  });

  it('reports a missing runtime as not installed', async () => {
    const context = fixture();

    expect(await status(context)).toMatchObject([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        installed: false,
        compatibility: 'not_compatible',
        catalogue: 'unavailable',
        proof: 'unknown',
      },
    ]);
  });

  it('replaces stale proven evidence with the most recent public review failure', async () => {
    const context = fixture();
    installReviewer(context);
    const successfulReview = await review(context);
    expect(successfulReview.data).toMatchObject({
      status: 'approved',
      actual_reviewer: 'opencode',
    });
    expect(await status(context)).toMatchObject([{ proof: 'proven' }]);
    installReviewer(context, 'opencode', { failure: true });
    const failedReview = await review(context, 2);
    expect(failedReview.data).toMatchObject({
      status: 'blocked',
      independence: 'none',
      review_routes: [{ reviewer: 'opencode', model: 'vendor/model-b', failure: 'process_failed' }],
    });

    expect(await status(context)).toMatchObject([
      {
        reviewer: 'opencode',
        model: 'vendor/model-b',
        proof: 'known_failure',
        known_failure: 'process_failed',
        proof_observed_at: expect.any(String),
      },
    ]);
  });

  it('keeps declared route order after observing a failed preferred route', async () => {
    const context = fixture([
      { reviewer: 'codex', model: 'model-a' },
      { reviewer: 'opencode', model: 'vendor/model-b' },
    ]);
    installReviewer(context, 'codex', { failure: true });
    installReviewer(context);
    const firstReview = await review(context);
    expect(firstReview.data).toMatchObject({
      status: 'approved',
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
    });
    expect(await status(context)).toMatchObject([
      {
        reviewer: 'codex',
        model: 'model-a',
        proof: 'known_failure',
        known_failure: 'process_failed',
      },
      { reviewer: 'opencode', model: 'vendor/model-b', proof: 'proven' },
    ]);

    const nextReview = await review(context);
    expect(nextReview.data).toMatchObject({
      status: 'approved',
      actual_reviewer: 'opencode',
      independence: 'cross-agent',
      review_routes: [
        { reviewer: 'codex', model: 'model-a', status: 'attempted', failure: 'process_failed' },
        { reviewer: 'opencode', model: 'vendor/model-b', status: 'attempted' },
      ],
    });
    expect(readFileSync(context.log, 'utf8')).toBe('codex\nopencode\ncodex\nopencode\n');
  });
});
