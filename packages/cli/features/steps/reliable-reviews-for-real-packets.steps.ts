import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

// Review scenarios use real subprocess timeouts. Scope their longer budget to
// the steps that invoke the CLI so unrelated Cucumber scenarios still fail fast.
const REVIEW_STEP_TIMEOUT_MS = 40_000;
const REVIEW_PROCESS_TIMEOUT_MS = 35_000;
// Capability probing and the answer share an attempt deadline. Use the
// runtime's normal probe ceiling so classification cases actually reach the
// behavior they describe under suite load. Deadline-specific cases override it.
const FIXTURE_ATTEMPT_TIMEOUT_MS = 5000;
const FIXTURE_RUN_BOUND_MS = 30_000;

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
  | 'fails'
  | 'never answers'
  | 'answers only with a model'
  | 'answers only with the expected model'
  | 'times out on opus and answers on sonnet'
  | 'answers off contract'
  | 'answers after termination'
  | 'leaves a grandchild'
  | 'no typed output'
  | 'emits a credential';

const CREDENTIAL = 'sk-live-do-not-leak-9f3a';

interface ReviewScenario {
  /** The reviewed project. Reviewer executables must live outside it. */
  project: string;
  binaries: string[];
  environment: Record<string, string>;
  launchLog: string;
  packetLog: string;
  elapsedMs?: number;
  targets: string[];
  context: string[];
}

type ReviewWorld = SafewordWorld & { review?: ReviewScenario };

function modelSpecificBehaviour(behaviour: Behaviour, answer: string): string | undefined {
  if (behaviour === 'answers only with a model') {
    return `if ! printf '%s' "$*" | /usr/bin/grep -q -- '--model'; then\n  printf 'default model unavailable\\n' >&2\n  exit 7\nfi\n${answer}`;
  }
  if (behaviour === 'answers only with the expected model') {
    return `model=''\nprevious=''\nfor argument in "$@"; do\n  if [ "$previous" = "--model" ]; then model="$argument"; fi\n  previous="$argument"\ndone\nif [ "$model" != "$SAFEWORD_REVIEW_BDD_EXPECTED_MODEL" ]; then\n  printf 'model unavailable: %s\\n' "$model" >&2\n  exit 7\nfi\n${answer}`;
  }
  if (behaviour === 'times out on opus and answers on sonnet') {
    return String.raw`model=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--model" ]; then model="$argument"; fi
  previous="$argument"
done
if [ "$model" = "opus" ]; then exec /bin/sleep 3600; fi
if [ "$model" != "sonnet" ]; then printf 'unexpected model: %s\n' "$model" >&2; exit 7; fi
${answer}`;
  }
  return undefined;
}

function state(world: SafewordWorld): ReviewScenario {
  const world_ = world as ReviewWorld;
  if (world_.review !== undefined) return world_.review;
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-bdd-'));
  writeFileSync(nodePath.join(project, 'review-input.md'), 'bounded review input\n');
  world_.review = {
    project,
    binaries: [],
    launchLog: nodePath.join(project, 'reviewer-launches.log'),
    packetLog: nodePath.join(project, 'reviewer-packet.txt'),
    targets: ['review-input.md'],
    context: [],
    environment: {
      NODE_ENV: 'test',
      SAFEWORD_AGENT_RUNTIME: 'claude',
      SAFEWORD_REVIEW_TIMEOUT_MS: String(FIXTURE_ATTEMPT_TIMEOUT_MS),
      SAFEWORD_REVIEW_RUN_BOUND_MS: String(FIXTURE_RUN_BOUND_MS),
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
printf '%s' "$payload" > "$SAFEWORD_REVIEW_PROMPT_LOG"
summary=reviewed
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
answer=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"AGENT","verdict":"approve","summary":"%s","findings":[]}' "$dispatch_id" "$summary")`
    .split('AGENT')
    .join(agent);
  const emit =
    agent === 'codex'
      ? String.raw`escaped=$(printf '%s' "$answer" | sed 's/"/\\"/g')
printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"`
      : String.raw`printf '%s\n' "$answer"`;
  const answer = `${body}\n${emit}`;
  const modelBehaviour = modelSpecificBehaviour(behaviour, answer);
  if (modelBehaviour !== undefined) return modelBehaviour;

  if (behaviour === 'answers') return answer;
  if (behaviour === 'fails') return "printf 'reviewer unavailable\\n' >&2\nexit 7";
  if (behaviour === 'never answers') return 'exec /bin/sleep 3600';
  if (behaviour === 'answers after termination') {
    return `${body}\non_term() {\n${emit}\n  exit 0\n}\ntrap on_term TERM INT\nwhile true; do /bin/sleep 5; done`;
  }
  if (behaviour === 'leaves a grandchild') {
    return `/bin/sh -c 'printf "%s" "$$" > "$SAFEWORD_REVIEW_DESCENDANT_PID_FILE"; exec /bin/sleep 3600' &
exec /bin/sleep 3600`;
  }
  if (behaviour === 'emits a credential') {
    return `printf 'trace token=${CREDENTIAL}\\n' >&2\nprintf 'not-a-review\\n'`;
  }
  if (behaviour === 'answers off contract') {
    return `${body}\nanswer=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"approve","summary":"reviewed","findings":[{"severity":"fatal","message":"invalid severity"}]}' "$dispatch_id")\n${emit}`;
  }
  return String.raw`printf 'not-a-review\n'`;
}
function installReviewer(
  current: ReviewScenario,
  agent: Agent,
  behaviour: Behaviour,
  label: string = agent,
): void {
  const host = mkdtempSync(nodePath.join(process.cwd(), `.safeword-bin-${label}-`));
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
printf '%s\t%s\n' '${label}' "$*" >> "$SAFEWORD_REVIEW_LAUNCH_LOG"
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
  const startedAt = performance.now();
  const environment: Record<string, string> = {
    ...current.environment,
    SAFEWORD_REVIEW_LAUNCH_LOG: current.launchLog,
    SAFEWORD_REVIEW_PROMPT_LOG: current.packetLog,
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
        ...current.targets,
        ...(current.context.length > 0 ? ['--context', ...current.context] : []),
        '--json',
        '--no-input',
        '--cwd',
        current.project,
      ],
      { cwd: current.project, env: environment, timeout: REVIEW_PROCESS_TIMEOUT_MS },
    );
    world.result = { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    world.result = {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      exitCode: failure.code ?? 1,
    };
  } finally {
    current.elapsedMs = performance.now() - startedAt;
  }
}

interface ReviewPayload {
  state: string;
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

function explanation(world: SafewordWorld): string {
  return payload(world)
    .findings.map(finding => finding.message)
    .join(' ');
}

function reviewerLaunches(world: SafewordWorld): string[] {
  const launchLog = state(world).launchLog;
  return existsSync(launchLog) ? readFileSync(launchLog, 'utf8').split('\n').filter(Boolean) : [];
}

function reviewerOutput(world: SafewordWorld): Record<string, unknown> {
  const output = payload(world).data.reviewer_output;
  assert.ok(output !== null && typeof output === 'object' && !Array.isArray(output));
  return output as Record<string, unknown>;
}

function assertApprovedCodexVerdict(world: SafewordWorld): void {
  const data = payload(world).data;
  assert.equal(data.independence, 'cross-agent');
  assert.equal(data.actual_reviewer, 'codex');
  assert.equal(data.status, 'approved');

  const output = reviewerOutput(world);
  assert.equal(output.reviewer_agent, 'codex');
  assert.equal(output.verdict, 'approve');
}

function assertReviewRoles(world: SafewordWorld): void {
  assertApprovedCodexVerdict(world);
  // The prompt ends with the serialized packet. Inspect what the real CLI
  // sent, including complete membership, instead of trusting a fixture verdict.
  const prompt = readFileSync(state(world).packetLog, 'utf8');
  const packet = JSON.parse(prompt.trimEnd().split('\n').at(-1) ?? '') as {
    logical_files: { path: string }[];
    context_files: { path: string }[];
  };
  assert.deepEqual(
    packet.logical_files.map(file => file.path),
    ['review-input.md'],
  );
  assert.deepEqual(
    packet.context_files.map(file => file.path),
    ['supporting-evidence.md'],
  );
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
  const current = state(this);
  current.targets = Array.from({ length: 5 }, (_value, index) => `ticket-part-${index + 1}.md`);
  for (const target of current.targets) {
    writeFileSync(nodePath.join(current.project, target), 'x'.repeat(11_800));
  }
  installReviewer(current, 'codex', 'answers');
});

Given('a review packet larger than the accepted maximum', function (this: SafewordWorld) {
  const current = state(this);
  installReviewer(current, 'codex', 'answers');
  writeFileSync(nodePath.join(current.project, 'review-input.md'), 'x'.repeat(1024 * 1024 + 1));
});

Given('an explicitly configured attempt deadline', function (this: SafewordWorld) {
  const current = state(this);
  current.environment.SAFEWORD_REVIEW_TIMEOUT_MS = '3000';
  installReviewer(current, 'codex', 'never answers');
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
    const current = state(this);
    // The first candidate may consume its five-second capability probe budget;
    // leave the second candidate enough time to probe and return a real review.
    current.environment.SAFEWORD_REVIEW_TIMEOUT_MS = '12000';
    installReviewer(current, 'codex', 'never answers', 'stale');
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
    const current = state(this);
    current.environment.SAFEWORD_REVIEW_DESCENDANT_PID_FILE = nodePath.join(
      current.project,
      'descendant.pid',
    );
    installReviewer(current, 'codex', 'leaves a grandchild');
  },
);

Given(
  'a reviewer that answers only after it was stopped for running out of time',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'answers after termination');
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
  'an installed reviewer that cannot honor the review contract',
  function (this: SafewordWorld) {
    installReviewer(state(this), 'codex', 'no typed output', 'old');
  },
);

Given('no reviewer executable is installed', function (this: SafewordWorld) {
  state(this);
});

Given('a review target with supporting context', function (this: SafewordWorld) {
  const current = state(this);
  writeFileSync(nodePath.join(current.project, 'supporting-evidence.md'), 'supporting evidence\n');
  current.context = ['supporting-evidence.md'];
});

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
  writeConfig(state(this), { crossAgentReviewAlternateModel: { codex: 'invalid model' } });
});

Given("the reviewer agent's default model never answers", function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'answers only with a model');
});

Given('the default Claude Opus model never answers', function (this: SafewordWorld) {
  const current = state(this);
  current.environment.SAFEWORD_AGENT_RUNTIME = 'codex';
  current.environment.SAFEWORD_REVIEW_TIMEOUT_MS = '3000';
  current.environment.SAFEWORD_REVIEW_RUN_BOUND_MS = '12000';
  installReviewer(current, 'claude', 'times out on opus and answers on sonnet');
});

Given("the reviewer agent's alternate model answers promptly", function (this: SafewordWorld) {
  state(this);
});

Given('both reviewer models fail promptly', function (this: SafewordWorld) {
  installReviewer(state(this), 'codex', 'fails');
});

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
  const current = state(this);
  installReviewer(current, 'claude', 'answers');
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
  const current = state(this);
  installReviewer(current, 'codex', 'never answers');
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

Given(
  'a {word}-authored change with {word} alternate model {string}',
  function (this: SafewordWorld, authorName: string, reviewerName: string, model: string) {
    const current = state(this);
    const author = authorName.toLowerCase() as Agent;
    const reviewer = reviewerName.toLowerCase() as Agent;
    assert.notEqual(author, reviewer);
    current.environment.SAFEWORD_AGENT_RUNTIME = author;
    current.environment.SAFEWORD_REVIEW_BDD_EXPECTED_MODEL = model;
    writeConfig(current, { crossAgentReviewAlternateModel: { [reviewer]: model } });
    installReviewer(current, reviewer, 'answers only with the expected model');
  },
);

// ----------------------------------------------------------------- When

When(
  'the independent review runs',
  { timeout: REVIEW_STEP_TIMEOUT_MS },
  async function (this: SafewordWorld) {
    await runReview(this);
  },
);

When(
  'a builder runs the public review command',
  { timeout: REVIEW_STEP_TIMEOUT_MS },
  async function (this: SafewordWorld) {
    await runReview(this);
  },
);

When(
  'the attempt deadline is derived',
  { timeout: REVIEW_STEP_TIMEOUT_MS },
  async function (this: SafewordWorld) {
    await runReview(this);
  },
);

When(
  'the answer is checked',
  { timeout: REVIEW_STEP_TIMEOUT_MS },
  async function (this: SafewordWorld) {
    await runReview(this);
  },
);

When('the review result is reported', function (this: SafewordWorld) {
  state(this);
});

When(
  'the exhausted-route result is reported',
  { timeout: REVIEW_STEP_TIMEOUT_MS },
  async function (this: SafewordWorld) {
    await runReview(this);
  },
);

// ----------------------------------------------------------------- Then

Then("the review returns the reviewer's verdict", function (this: SafewordWorld) {
  assertApprovedCodexVerdict(this);
});

Then('no reviewer is asked to review it', function (this: SafewordWorld) {
  assert.deepEqual(reviewerLaunches(this), []);
});

Then('the command rejects the packet through a typed result', function (this: SafewordWorld) {
  const result = payload(this);
  assert.equal(result.state, 'failed');
  assert.equal(
    (result as { errors?: { code: string }[] }).errors?.[0]?.code,
    'REVIEW_PACKET_INVALID',
  );
  assert.equal(result.data.status, 'blocked');
  assert.equal(result.recovery.length, 1);
});

Then('the configured deadline is used', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'timed_out');
  assert.equal(reviewerLaunches(this).length, 1);
  const elapsedMs = state(this).elapsedMs;
  assert.ok(elapsedMs !== undefined && elapsedMs >= 2600 && elapsedMs < 4500);
});

Then('the assigned reviewer route is reported as timed out', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'timed_out');
});

Then("the review returns the second executable's verdict", function (this: SafewordWorld) {
  assertApprovedCodexVerdict(this);
});

Then(
  'the stale executable was tried before the working executable',
  function (this: SafewordWorld) {
    assert.deepEqual(
      reviewerLaunches(this).map(launch => launch.split('\t', 1)[0]),
      ['stale', 'working'],
    );
  },
);

Then(
  'no process grouped with that reviewer is still running afterwards',
  async function (this: SafewordWorld) {
    assert.equal(payload(this).data.independence, 'none');
    const pidFile = state(this).environment.SAFEWORD_REVIEW_DESCENDANT_PID_FILE;
    assert.ok(pidFile !== undefined && existsSync(pidFile));
    const descendant = Number(readFileSync(pidFile, 'utf8').trim());
    assert.ok(Number.isSafeInteger(descendant));
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      try {
        process.kill(descendant, 0);
      } catch {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(`reviewer descendant ${descendant} is still running`);
  },
);

Then('the review is reported as timed out', function (this: SafewordWorld) {
  assert.equal(payload(this).data.preferred_failure, 'timed_out');
});

Then("the review returns the Codex reviewer's verdict", function (this: SafewordWorld) {
  assert.equal(payload(this).data.actual_reviewer, 'codex');
});

Then(
  'the review is blocked because the installed reviewer is unsupported',
  function (this: SafewordWorld) {
    const result = payload(this);
    assert.equal(result.state, 'action_required');
    assert.equal(result.data.status, 'blocked');
    assert.equal(result.data.preferred_failure, 'unsupported');
  },
);

Then('the recovery tells the builder to update the reviewer', function (this: SafewordWorld) {
  assert.deepEqual(
    payload(this).recovery.map(item => item.description),
    ['Update Codex, then run the review again.'],
  );
});

Then('the incompatible reviewer is not asked to review', function (this: SafewordWorld) {
  assert.deepEqual(reviewerLaunches(this), []);
});

Then('the review is blocked because the reviewer is not installed', function (this: SafewordWorld) {
  const result = payload(this);
  assert.equal(result.state, 'action_required');
  assert.equal(result.data.status, 'blocked');
  assert.equal(result.data.preferred_failure, 'not_installed');
});

Then(
  'the recovery tells the builder to install or update the reviewer',
  function (this: SafewordWorld) {
    assert.deepEqual(
      payload(this).recovery.map(item => item.description),
      ['Install or update Codex, then run the review again.'],
    );
  },
);

Then(
  'the reviewer receives the target as work and the evidence as context',
  function (this: SafewordWorld) {
    assertReviewRoles(this);
  },
);

Then(
  'the alternate model receives the same target and context roles',
  function (this: SafewordWorld) {
    assertReviewRoles(this);
  },
);

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

Then(
  'both reviewer models were attempted before the author runtime completed',
  function (this: SafewordWorld) {
    const launches = reviewerLaunches(this);
    assert.equal(payload(this).data.actual_reviewer, 'claude');
    assert.equal(launches.length, 3);
    assert.match(launches[0] ?? '', /^codex\t(?!.*--model)/u);
    assert.match(launches[1] ?? '', /^codex\t.*--model vendor-model-2(?:\s|$)/u);
    assert.match(launches[2] ?? '', /^claude\t/u);
  },
);

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
    assert.ok(
      reviewerLaunches(this).every(
        launch => !launch.includes('--model') && !launch.includes('--help'),
      ),
    );
  },
);

Then('the alternate model still receives its own attempt', function (this: SafewordWorld) {
  // The first route being stopped at its own budget is what leaves the second
  // one able to answer at all.
  assert.equal(payload(this).data.reviewer_model, 'vendor-model-2');
});

Then('the Sonnet review returns an independent verdict', function (this: SafewordWorld) {
  assert.deepEqual(
    {
      independence: payload(this).data.independence,
      reviewerModel: payload(this).data.reviewer_model,
    },
    { independence: 'cross-agent', reviewerModel: 'sonnet' },
  );
});

Then('the result names Opus as the timed-out primary model', function (this: SafewordWorld) {
  assert.deepEqual(
    {
      preferredModel: payload(this).data.preferred_model,
      preferredFailure: payload(this).data.preferred_failure,
    },
    { preferredModel: 'opus', preferredFailure: 'timed_out' },
  );
});

Then('the routes were attempted in their fixed order', function (this: SafewordWorld) {
  const launches = reviewerLaunches(this);
  assert.equal(launches.length, 3);
  assert.match(launches[0] ?? '', /^codex\t(?!.*--model)/u);
  assert.match(launches[1] ?? '', /^codex\t.*--model vendor-model-2(?:\s|$)/u);
  assert.match(launches[2] ?? '', /^claude\t/u);
});

Then("the author's own runtime is never attempted", function (this: SafewordWorld) {
  assert.ok(reviewerLaunches(this).every(launch => !launch.startsWith('claude\t')));
});

Then('the command reports a full cross-agent check by Codex', function (this: SafewordWorld) {
  const data = payload(this).data;
  assert.equal(data.independence, 'cross-agent');
  assert.equal(data.actual_reviewer, 'codex');
});

Then(
  'the command reports a full cross-agent check by {word} using {string}',
  function (this: SafewordWorld, reviewerName: string, model: string) {
    const data = payload(this).data;
    assert.equal(data.independence, 'cross-agent');
    assert.equal(data.actual_reviewer, reviewerName.toLowerCase());
    assert.equal(data.reviewer_model, model);
  },
);

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
    for (const output of [this.result.stdout, this.result.stderr]) {
      assert.ok(!output.includes(CREDENTIAL));
      assert.ok(!output.includes('not-a-review'));
    }
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
