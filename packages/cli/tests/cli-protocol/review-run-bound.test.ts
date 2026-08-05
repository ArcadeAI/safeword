import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

const CAPABILITIES: Readonly<Record<string, string>> = {
  claude:
    '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model',
  codex:
    '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --model --output-schema',
};

/**
 * Reviewers that record the route they were launched as and then never answer,
 * so a test can see exactly which routes the run reached before it stopped.
 */
function installSilentReviewers(directory: string): string {
  const bin = nodePath.join(
    tmpdir(),
    `safeword-runbound-${Buffer.from(directory).toString('hex')}`,
    'bin',
  );
  mkdirSync(bin, { recursive: true });
  for (const agent of ['claude', 'codex']) {
    const executable = nodePath.join(bin, agent);
    writeFileSync(
      executable,
      String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${CAPABILITIES[agent]}'
  exit 0
fi
model=default
previous=''
for argument in "$@"; do
  if [ "$previous" = "--model" ]; then model="$argument"; fi
  previous="$argument"
done
printf '%s %s\n' '${agent}' "$model" >> "$SAFEWORD_REVIEW_ROUTE_LOG"
# Never answer, and leave a child holding the pipes open — cleanup must
# reach the whole group, not just the process it launched.
while true; do /bin/sleep 5; done
`,
      { mode: 0o755 },
    );
    chmodSync(executable, 0o755);
  }
  return bin;
}

async function runWithBounds(bounds: {
  readonly attemptMs: string;
  readonly runBoundMs: string;
}): Promise<{ routes: string[]; payload: { data: Record<string, unknown> } }> {
  const directory = createTemporaryDirectory();
  const routeLog = nodePath.join(directory, 'routes.log');
  writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ crossAgentReviewAlternateModel: { codex: 'alternate-model' } }),
  );
  const bin = installSilentReviewers(directory);

  const result = await runCli(
    [
      'review',
      'run',
      'quality-review',
      'review-input.md',
      '--json',
      '--no-input',
      '--cwd',
      directory,
    ],
    {
      cwd: directory,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: 'claude',
        SAFEWORD_REVIEW_ROUTE_LOG: routeLog,
        SAFEWORD_REVIEW_TIMEOUT_MS: bounds.attemptMs,
        SAFEWORD_REVIEW_RUN_BOUND_MS: bounds.runBoundMs,
        SAFEWORD_NO_UPDATE_CHECK: '1',
      },
    },
  );

  const routes = existsSync(routeLog)
    ? readFileSync(routeLog, 'utf8').split('\n').filter(Boolean)
    : [];
  return { routes, payload: JSON.parse(result.stdout) as { data: Record<string, unknown> } };
}

describe('the run bound across routes', () => {
  it('tries every route in order when the bound allows it', async () => {
    const { routes, payload } = await runWithBounds({ attemptMs: '700', runBoundMs: '6000' });

    expect(routes).toEqual([
      'codex default', // the assigned reviewer on its usual model
      'codex alternate-model', // the same reviewer, alternate model
      'claude default', // last resort: the author's own runtime
    ]);
    expect(payload.data.independence).toBe('none');
  });

  it('stops starting routes once the bound cannot fund another one', async () => {
    // One attempt consumes the bound, leaving too little for a real second try.
    const { routes, payload } = await runWithBounds({ attemptMs: '700', runBoundMs: '900' });

    expect(routes).toEqual(['codex default']);
    expect(payload.data.independence).toBe('none');
  });
});
