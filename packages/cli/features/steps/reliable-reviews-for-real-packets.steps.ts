import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

const CAPABILITIES = {
  claude:
    '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model',
  codex:
    '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --model --output-schema',
} as const;

type Agent = keyof typeof CAPABILITIES;
type Behaviour =
  | 'answers'
  | 'never answers'
  | 'answers only with a model'
  | 'answers off contract'
  | 'no typed output'
  | 'emits a credential';

const CREDENTIAL = 'sk-live-do-not-leak-9f3a';

interface ReviewScenario {
  /** The reviewed project. Reviewer executables must live outside it. */
  project: string;
  binaries: string[];
  environment: Record<string, string>;
}

type ReviewWorld = SafewordWorld & { review?: ReviewScenario };

function state(world: SafewordWorld): ReviewScenario {
  const world_ = world as ReviewWorld;
  if (world_.review !== undefined) return world_.review;
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-bdd-'));
  writeFileSync(nodePath.join(project, 'review-input.md'), 'bounded review input\n');
  world_.review = {
    project,
    binaries: [],
    environment: {
      SAFEWORD_AGENT_RUNTIME: 'claude',
      SAFEWORD_REVIEW_TIMEOUT_MS: '900',
      SAFEWORD_REVIEW_RUN_BOUND_MS: '6000',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  };
  return world_.review;
}

function behaviourScript(agent: Agent, behaviour: Behaviour): string {
  // Each runtime is parsed differently: Codex answers with JSONL events, Claude
  // with a single JSON envelope. A fake that emits the wrong one is rejected as
  // invalid output, which quietly turns a "reviewer answered" fixture into a
  // "reviewer failed" one.
  const body = String.raw`payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
answer=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"AGENT","verdict":"approve","summary":"reviewed","findings":[]}' "$dispatch_id")`
    .split('AGENT')
    .join(agent);
  const emit =
    agent === 'codex'
      ? String.raw`escaped=$(printf '%s' "$answer" | sed 's/"/\\"/g')
printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"`
      : String.raw`printf '%s\n' "$answer"`;
  const answer = `${body}\n${emit}`;

  if (behaviour === 'answers') return answer;
  if (behaviour === 'never answers') return 'exec /bin/sleep 3600';
  if (behaviour === 'answers only with a model') {
    return `if ! printf '%s' "$*" | /usr/bin/grep -q -- '--model'; then\n  printf 'default model unavailable\\n' >&2\n  exit 7\nfi\n${answer}`;
  }
  if (behaviour === 'emits a credential') {
    return `printf 'trace token=${CREDENTIAL}\\n' >&2\nprintf 'not-a-review\\n'`;
  }
  return String.raw`printf 'not-a-review\n'`;
}
function installReviewer(
  current: ReviewScenario,
  agent: Agent,
  behaviour: Behaviour,
  label: string = agent,
): void {
  const host = mkdtempSync(nodePath.join(tmpdir(), `safeword-bin-${label}-`));
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });
  const capabilities = behaviour === 'no typed output' ? '--json --sandbox' : CAPABILITIES[agent];
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${capabilities}'
  exit 0
fi
${behaviourScript(agent, behaviour)}
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  current.binaries.push(bin);
}

function writeConfig(current: ReviewScenario, config: Record<string, unknown>): void {
  mkdirSync(nodePath.join(current.project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(current.project, '.safeword', 'config.json'),
    JSON.stringify(config, undefined, 2),
  );
}

async function runReview(world: SafewordWorld): Promise<void> {
  const current = state(world);
  const environment: Record<string, string> = {
    ...current.environment,
    PATH: [...current.binaries, '/usr/bin', '/bin'].join(':'),
    HOME: process.env.HOME ?? '',
  };
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        CLI_PATH,
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        current.project,
      ],
      { cwd: current.project, env: environment, timeout: 60_000 },
    );
    world.result = { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    world.result = {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      exitCode: failure.code ?? 1,
    };
  }
}

interface ReviewPayload {
  findings: { message: string }[];
  recovery: { description: string }[];
  data: Record<string, unknown>;
}

function payload(world: SafewordWorld): ReviewPayload {
  try {
    return JSON.parse(world.result.stdout) as ReviewPayload;
  } catch {
    throw new Error(
      `no result envelope on stdout (exit ${world.result.exitCode}): ${world.result.stderr.trim().slice(0, 200)}`,
    );
  }
}

/** True when the run produced no verified cross-agent review, however it ended. */
function reviewedIndependently(world: SafewordWorld): boolean {
  try {
    return payload(world).data.independence === 'cross-agent';
  } catch {
    return false;
  }
}

function explanation(world: SafewordWorld): string {
  return payload(world)
    .findings.map(finding => finding.message)
    .join(' ');
}

After(function (this: SafewordWorld) {
  const current = (this as ReviewWorld).review;
  if (current === undefined) return;
  rmSync(current.project, { recursive: true, force: true });
  for (const bin of current.binaries) {
    rmSync(nodePath.dirname(bin), { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- Given

Given('a reviewer that answers well inside its deadline', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers');
});

Given('a review packet larger than the accepted maximum', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'answers');
  writeFileSync(nodePath.join(current.project, 'review-input.md'), 'x'.repeat(1024 * 1024 + 1));
});

Given('an explicitly configured attempt deadline', function (this: SafewordWorld) {
  state(this).environment.SAFEWORD_REVIEW_TIMEOUT_MS = '120000';
});

Given('a reviewer that never answers', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'never answers');
});

Given('no later route can complete either', function (this: SafewordWorld) {
  state(this);
});

Given(
  'two installed reviewer executables that both accept the review contract',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'never answers', 'stale');
  },
);

Given('the first executable never answers', function (this: SafewordWorld) {
  state(this);
});

Given('the second executable answers promptly', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers', 'working');
});

Given('two installed reviewer executables that never answer', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'never answers', 'first');
  installReviewer(current, 'codex', 'never answers', 'second');
});

Given(
  'a reviewer that never answers and leaves a grandchild grouped with it',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'never answers');
  },
);

Given(
  'a reviewer that answers only after it was stopped for running out of time',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'never answers');
  },
);

Given(
  'an installed Codex reviewer that answers in the review result contract',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'answers');
  },
);

Given('the review result contract cannot be written', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'answers');
  const readonly = nodePath.join(current.project, 'readonly');
  mkdirSync(readonly, { recursive: true });
  chmodSync(readonly, 0o500);
  current.environment.TMPDIR = readonly;
});

Given(
  'an installed reviewer executable that cannot produce typed output',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'no typed output', 'old');
  },
);

Given('a second installed reviewer executable that can', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers', 'new');
});

Given(
  'every installed reviewer executable cannot produce typed output',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'no typed output', 'old');
  },
);

Given('a reviewer answer that follows the result contract', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers');
});

Given(
  'a reviewer answer whose finding severity the contract does not permit',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'answers off contract');
  },
);

Given('a configured alternate model for the reviewer agent', function (this: SafewordWorld) {
  writeConfig(state(this), { crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } });
});

Given('a configured alternate model within the accepted grammar', function (this: SafewordWorld) {
  writeConfig(state(this), { crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } });
});

Given('a configured alternate model outside the accepted grammar', function (this: SafewordWorld) {
  writeConfig(state(this), { crossAgentReviewAlternateModel: { codex: '--help' } });
});

Given("the reviewer agent's default model never answers", function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers only with a model');
});

Given("the reviewer agent's alternate model answers promptly", function (this: SafewordWorld) {
  state(this);
});

Given(
  "neither the reviewer agent's default nor alternate model answers",
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'never answers');
  },
);

Given("the author's own runtime answers promptly", function (this: SafewordWorld) {
  installReviewer(state(this), 'claude', 'answers');
});

Given(
  "the reviewer agent's alternate model completed the review",
  async function (this: SafewordWorld) {
    const current = state(this);
    writeConfig(current, { crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } });
    installReviewer(current, 'codex', 'answers only with a model');
    await runReview(this);
  },
);

Given("only the author's own runtime completed the review", async function (this: SafewordWorld) {
  installReviewer(state(this), 'claude', 'answers');
  await runReview(this);
});

Given('a required cross-agent review policy', function (this: SafewordWorld) {
  writeConfig(state(this), { crossAgentReview: 'require' });
});

Given('a preferred cross-agent review policy', function (this: SafewordWorld) {
  writeConfig(state(this), { crossAgentReview: 'prefer' });
});

Given('no route ever answers', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'never answers');
  installReviewer(current, 'claude', 'never answers');
});

Given(
  'the run bound is reached while an early route is still working',
  function (this: SafewordWorld) {
    const current = state(this);
    installReviewer(current, 'codex', 'never answers');
    installReviewer(current, 'claude', 'answers');
    current.environment.SAFEWORD_REVIEW_RUN_BOUND_MS = '1000';
  },
);

Given('the assigned reviewer timed out', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'never answers');
});

Given(
  "the fallback reviewer's answer did not follow the result contract",
  function (this: SafewordWorld) {
    installReviewer(state(this), 'claude', 'answers off contract');
  },
);

Given('a reviewer that fails while emitting a credential', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'never answers');
  installReviewer(current, 'claude', 'emits a credential');
});

Given(
  'a Claude-authored change and a configured alternate model for the reviewer agent',
  function (this: SafewordWorld) {
    const current = state(this);
    current.environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    writeConfig(current, { crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } });
  },
);

// ----------------------------------------------------------------- When

When('the independent review runs', async function (this: SafewordWorld) {
  await runReview(this);
});

When('a builder runs the public review command', async function (this: SafewordWorld) {
  await runReview(this);
});

When('the attempt deadline is derived', async function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers');
  await runReview(this);
});

When('the answer is checked', async function (this: SafewordWorld) {
  await runReview(this);
});

When('the review result is reported', function (this: SafewordWorld) {
  state(this);
});

When('the exhausted-route result is reported', async function (this: SafewordWorld) {
  await runReview(this);
});

// ----------------------------------------------------------------- Then

Then("the review returns the reviewer's verdict", function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'cross-agent');
});

Then('no reviewer is asked to review it', function (this: SafewordWorld) {
  assert.equal(reviewedIndependently(this), false);
});

Then('the configured deadline is used', function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'cross-agent');
});

Then('the assigned reviewer route is reported as timed out', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'timed_out');
});

Then("the review returns the second executable's verdict", function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'cross-agent');
});

Then(
  'no process grouped with that reviewer is still running afterwards',
  function (this: SafewordWorld) {
    assert.equal(payload(this).data.independence, 'none');
  },
);

Then('the review is reported as timed out', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'timed_out');
});

Then("the review returns the Codex reviewer's verdict", function (this: SafewordWorld) {
  assert.equal(payload(this).data.actual_reviewer, 'codex');
});

Then('the review reports that no compatible reviewer is installed', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'not_installed');
});

Then('the answer is accepted', function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'cross-agent');
});

Then('the answer is rejected as invalid reviewer output', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'invalid_output');
});

Then("the review returns the alternate model's verdict", function (this: SafewordWorld) {
  const data = payload(this).data;
  assert.equal(data.independence, 'cross-agent');
  assert.equal(data.reviewer_model, 'vendor-model-2');
});

Then('the review reports that the check was not independent', function (this: SafewordWorld) {
  assert.notEqual(payload(this).data.independence, 'cross-agent');
});

Then('the result reports a full cross-agent check', function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'cross-agent');
});

Then('the result names the model it asked to review', function (this: SafewordWorld) {
  assert.equal(payload(this).data.reviewer_model, 'vendor-model-2');
});

Then('the result does not report a full cross-agent check', function (this: SafewordWorld) {
  assert.notEqual(payload(this).data.independence, 'cross-agent');
});

Then('the reviewer is asked to review on that model', function (this: SafewordWorld) {
  assert.equal(payload(this).data.reviewer_model, 'vendor-model-2');
});

Then(
  'the reviewer is never asked for a review on an alternate model',
  function (this: SafewordWorld) {
    assert.equal(payload(this).data.reviewer_model, undefined);
  },
);

Then('the alternate model still receives its own attempt', function (this: SafewordWorld) {
  // The first route being stopped at its own budget is what leaves the second
  // one able to answer at all.
  assert.equal(payload(this).data.reviewer_model, 'vendor-model-2');
});

Then('the routes were attempted in their fixed order', function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'none');
});

Then("the author's own runtime is never attempted", function (this: SafewordWorld) {
  assert.equal(payload(this).data.independence, 'none');
});

Then('the command reports a full cross-agent check by Codex', function (this: SafewordWorld) {
  const data = payload(this).data;
  assert.equal(data.independence, 'cross-agent');
  assert.equal(data.actual_reviewer, 'codex');
});

Then('the command reports the required check as unsatisfied', function (this: SafewordWorld) {
  assert.equal(payload(this).data.status, 'blocked');
});

Then('the explanation says the assigned reviewer ran out of time', function (this: SafewordWorld) {
  assert.match(explanation(this), /ran out of time/iu);
});

Then(
  "the explanation says the fallback reviewer's answer could not be accepted",
  function (this: SafewordWorld) {
    assert.match(explanation(this), /could not be accepted/iu);
  },
);

Then('the result offers exactly one next step to take', function (this: SafewordWorld) {
  assert.equal(payload(this).recovery.length, 1);
});

Then('the result records no verdict', function (this: SafewordWorld) {
  assert.equal(payload(this).data.reviewer_output, undefined);
});

Then(
  'the explanation names only the route and its classified cause',
  function (this: SafewordWorld) {
    assert.match(explanation(this), /No independent check was recorded\./u);
  },
);

Then(
  'the explanation contains neither that output nor the credential',
  function (this: SafewordWorld) {
    const rendered = JSON.stringify(payload(this));
    assert.ok(!rendered.includes(CREDENTIAL));
    assert.ok(!rendered.includes('not-a-review'));
  },
);

Then('the review returns a verdict', function (this: SafewordWorld) {
  assert.notEqual(payload(this).data.reviewer_output, undefined);
});

Then('the result reports that the check was not independent', function (this: SafewordWorld) {
  assert.notEqual(payload(this).data.independence, 'cross-agent');
});

Then('the required cross-agent check is not satisfied', function (this: SafewordWorld) {
  assert.equal(payload(this).data.status, 'blocked');
});
