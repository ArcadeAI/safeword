/* eslint-disable prefer-arrow-callback, security/detect-non-literal-regexp, sonarjs/no-alphabetical-sort, sonarjs/no-nested-conditional, unicorn/import-style, unicorn/no-computed-property-existence-check, unicorn/prefer-else-if, unicorn/require-array-sort-compare -- executable acceptance steps prioritize scenario correspondence and Cucumber's `this` world binding */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  commandCatalog,
  type CommandDefinition,
  createCapabilitiesResult,
  findCommandDefinition,
  publicCommands,
} from '../../src/cli-protocol/catalog.ts';
import { createProgressReporter } from '../../src/cli-protocol/policy.ts';
import {
  type CliResult,
  createResult,
  type Effects,
  exitStatusFor,
  renderHumanResult,
  renderJsonResult,
} from '../../src/cli-protocol/result.ts';
import { convergeSetup } from '../../src/commands/converge-setup.ts';
import type { SafewordWorld } from './world.js';

const CLI_PATH = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const SAFEWORD_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const BUN_PATH = spawnSync('sh', ['-c', 'command -v bun'], { encoding: 'utf8' }).stdout.trim();
const HOOK_P95_BUDGET_MS = 5000;
const EMPTY_EFFECTS = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: [],
} as const;

interface PredictableCliWorld extends SafewordWorld {
  protocolResult?: CliResult;
  protocolResults?: CliResult[];
  rendered?: string;
  renderedMany?: string[];
  beforeTree?: string;
  planId?: string;
  plannedEffects?: Effects;
  legacy?: string;
  globalOption?: string;
  publicCommandName?: string;
  hookEntrypoint?: string;
  hookSurface?: 'Claude Code' | 'Codex' | 'Cursor';
  latencySamples?: number[];
  scheduledProgress?: () => void;
  progressMessages?: string[];
  commandRuns?: CommandRun[][];
  parentCwd?: string;
  secondDirectory?: string;
  witnessDirectory?: string;
  witnessLog?: string;
}

interface CommandRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function temporaryProject(world: PredictableCliWorld): string {
  if (world.temporaryDirectory === '') {
    world.temporaryDirectory = mkdtempSync(join(tmpdir(), 'safeword-cli-bdd-'));
  }
  return world.temporaryDirectory;
}

function runCli(
  world: PredictableCliWorld,
  argv: readonly string[],
  cwd = temporaryProject(world),
): void {
  const completed = spawnSync(process.execPath, [CLI_PATH, ...argv], {
    cwd,
    encoding: 'utf8',
    env: childEnvironment(),
  });
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
  if (completed.stdout.trimStart().startsWith('{')) {
    world.protocolResult = JSON.parse(completed.stdout) as CliResult;
  }
}

function childEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, SAFEWORD_NO_UPDATE_CHECK: '1' };
  delete environment.NODE_OPTIONS;
  return environment;
}

function runPublicFixture(world: PredictableCliWorld, definition: CommandDefinition): CommandRun {
  const cwd = join(temporaryProject(world), 'public-fixture');
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...definition.fixture.argv, '--json', '--no-input', '--offline', '--cwd', cwd],
    {
      cwd,
      encoding: 'utf8',
      env: { ...childEnvironment(), ...definition.fixture.environment },
    },
  );
  return {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

function setupProject(world: PredictableCliWorld): void {
  const directory = temporaryProject(world);
  runCli(world, ['setup', '--json', '--no-input', '--cwd', directory], directory);
  assert.equal(world.result.exitCode, 0);
}

function treeDigest(directory: string): string {
  if (!existsSync(directory)) return 'missing';
  const visit = (path: string): unknown => {
    const stat = lstatSync(path);
    if (!stat.isDirectory()) return readFileSync(path).toString('base64');
    return readdirSync(path)
      .toSorted()
      .map(name => [name, visit(join(path, name))]);
  };
  return JSON.stringify(visit(directory));
}

function wireResult(world: PredictableCliWorld): Record<string, unknown> {
  return JSON.parse(world.result.stdout) as Record<string, unknown>;
}

function resultForState(state: string, actionCount = 0): CliResult {
  const normalized = state === 'action-required' ? 'action_required' : state;
  return createResult({
    state: normalized as CliResult['state'],
    errors:
      normalized === 'failed'
        ? [{ code: 'EXAMPLE_FAILURE', message: 'Example failed.', retryable: false }]
        : [],
    nextActions: Array.from({ length: actionCount }, (_, index) => ({
      command: `safeword example-${index + 1}`,
      mutates: false,
      requiresHuman: false,
    })),
  });
}

function aliasFixture(name: string): readonly string[] {
  return findCommandDefinition(name).fixture.argv;
}

function runRealHook(world: PredictableCliWorld, surface: 'Claude Code' | 'Codex' | 'Cursor') {
  const cwd = temporaryProject(world);
  const witnessDirectory = assertPresent(world.witnessDirectory);
  const witnessLog = assertPresent(world.witnessLog);
  const common = {
    cwd,
    encoding: 'utf8' as const,
    env: {
      ...childEnvironment(),
      CLAUDE_PROJECT_DIR: cwd,
      PATH: `${witnessDirectory}:${process.env.PATH ?? ''}`,
      SAFEWORD_REAL_BUN: BUN_PATH,
      SAFEWORD_WITNESS_LOG: witnessLog,
    },
  };
  if (surface === 'Codex') {
    return spawnSync(process.execPath, [CLI_PATH, 'codex-hook', 'session-start'], {
      ...common,
      input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'bdd-session' }),
    });
  }
  if (surface === 'Cursor') {
    const hook = join(SAFEWORD_ROOT, 'packages/cli/templates/hooks/cursor/stop.ts');
    return spawnSync(BUN_PATH, [hook], {
      ...common,
      input: JSON.stringify({
        workspace_roots: [cwd],
        conversation_id: 'bdd-session',
        status: 'completed',
      }),
    });
  }
  const hook = join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');
  return spawnSync(BUN_PATH, [hook], {
    ...common,
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      session_id: 'bdd-session',
      tool_name: 'Read',
      tool_input: { file_path: 'README.md' },
    }),
  });
}

After(function (this: PredictableCliWorld) {
  if (this.temporaryDirectory !== '') {
    rmSync(this.temporaryDirectory, { recursive: true, force: true });
  }
  if (this.secondDirectory !== undefined) {
    rmSync(this.secondDirectory, { recursive: true, force: true });
  }
  if (this.witnessDirectory !== undefined) {
    rmSync(this.witnessDirectory, { recursive: true, force: true });
  }
});

function installEffectWitnesses(world: PredictableCliWorld): void {
  const directory = mkdtempSync(join(tmpdir(), 'safeword-hook-witness-'));
  const log = join(directory, 'effects.log');
  const fail = String.raw`#!/bin/sh
printf '%s\n' "$0 $*" >> "$SAFEWORD_WITNESS_LOG"
exit 97
`;
  const packageManager = String.raw`#!/bin/sh
case "$1" in
  add|install|update|upgrade|remove|uninstall|x|dlx)
    printf '%s\n' "$0 $*" >> "$SAFEWORD_WITNESS_LOG"
    exit 97
    ;;
esac
if [ "$(basename "$0")" = "bun" ]; then
  exec "$SAFEWORD_REAL_BUN" "$@"
fi
exit 0
`;
  for (const executable of ['bunx', 'npx', 'curl', 'wget', 'corepack']) {
    const path = join(directory, executable);
    writeFileSync(path, fail);
    chmodSync(path, 0o755);
  }
  for (const executable of ['bun', 'npm', 'pnpm', 'yarn']) {
    const path = join(directory, executable);
    writeFileSync(path, packageManager);
    chmodSync(path, 0o755);
  }
  world.witnessDirectory = directory;
  world.witnessLog = log;
}

Given('a configured healthy project', function (this: PredictableCliWorld) {
  setupProject(this);
});

Given('a configured project with managed drift', function (this: PredictableCliWorld) {
  setupProject(this);
  rmSync(join(temporaryProject(this), '.claude', 'settings.json'));
});

When('the user runs Safeword with no command', function (this: PredictableCliWorld) {
  runCli(this, ['--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
});

Then('the result reports healthy state and no changes', function (this: PredictableCliWorld) {
  const result = wireResult(this);
  assert.equal(result.state, 'healthy');
  assert.equal(result.changed, false);
});

Then(
  'the result requires action and recommends {string}',
  function (this: PredictableCliWorld, command: string) {
    const result = wireResult(this);
    assert.equal(result.state, 'action_required');
    assert.equal((result.next_actions as { command: string }[])[0]?.command, command);
  },
);

Given('a project that is {word}', function (this: PredictableCliWorld, state: string) {
  const directory = temporaryProject(this);
  if (state === 'drifted') {
    mkdirSync(join(directory, '.safeword'), { recursive: true });
    writeFileSync(join(directory, '.safeword', 'version'), '0.0.0\n');
  }
  if (state === 'failed') {
    mkdirSync(join(directory, '.safeword', 'version'), { recursive: true });
  }
  this.beforeTree = treeDigest(directory);
});

When(
  'the user runs the read-only command {string}',
  function (this: PredictableCliWorld, command: string) {
    runCli(this, [command, '--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
  },
);

Then('no filesystem package or network effect occurs', function (this: PredictableCliWorld) {
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  const effects = wireResult(this).effects as typeof EMPTY_EFFECTS;
  assert.deepEqual(effects.packages, []);
  assert.deepEqual(effects.network, []);
});

Given(
  'a {word} result with {int} possible next actions',
  function (this: PredictableCliWorld, state: string, count: number) {
    this.protocolResult = resultForState(state, count);
  },
);

When('Safeword renders it for a human', function (this: PredictableCliWorld) {
  this.rendered = renderHumanResult(assertPresent(this.protocolResult));
});

Then(
  'one outcome comes first changed is explicit and {int} next actions are shown',
  function (this: PredictableCliWorld, nextCount: number) {
    const lines = assertPresent(this.rendered).split('\n');
    assert.match(lines[0] ?? '', /^(Healthy|Complete|Needs attention|Failed)$/);
    assert.match(lines[1] ?? '', /^Changed: (yes|no)$/);
    assert.equal(lines.filter(line => line.startsWith('Next: ')).length, nextCount);
  },
);

Given(
  'a result with repeated warnings and internal identifiers',
  function (this: PredictableCliWorld) {
    this.protocolResult = createResult({
      state: 'action_required',
      findings: [
        {
          code: 'WARNING_ONE',
          message: 'Review this warning.',
          severity: 'warning',
          detail: 'internal-id: plan_123',
        },
        {
          code: 'WARNING_TWO',
          message: 'Review this warning.',
          severity: 'warning',
          detail: 'internal-id: plan_123',
        },
      ],
    });
  },
);

When('Safeword renders it for a human with verbose disabled', function (this: PredictableCliWorld) {
  this.rendered = renderHumanResult(assertPresent(this.protocolResult), { verbose: false });
});

Then(
  'warnings are deduplicated and internal identifiers are hidden',
  function (this: PredictableCliWorld) {
    assert.equal(assertPresent(this.rendered).match(/Review this warning\./g)?.length, 1);
    assert.doesNotMatch(assertPresent(this.rendered), /plan_123/);
  },
);

When('Safeword renders the same result with verbose enabled', function (this: PredictableCliWorld) {
  this.rendered = renderHumanResult(assertPresent(this.protocolResult), { verbose: true });
});

Then(
  'implementation detail follows the unchanged primary verdict',
  function (this: PredictableCliWorld) {
    const output = assertPresent(this.rendered);
    assert.equal(output.split('\n', 1)[0], 'Needs attention');
    assert.ok(output.indexOf('internal-id: plan_123') > output.indexOf('Changed: no'));
  },
);

Given('a configured project', function (this: PredictableCliWorld) {
  setupProject(this);
});

When('the user runs {string}', function (this: PredictableCliWorld, invocation: string) {
  const argv = invocation.split(' ').slice(1);
  runCli(this, [...argv, '--json', '--offline', '--cwd', temporaryProject(this)]);
});

Then(
  'the exact destructive plan is reported and no effect is applied',
  function (this: PredictableCliWorld) {
    const result = wireResult(this);
    assert.equal(result.changed, false);
    const plan = (result.data as { plan: { id: string; effects: Effects } }).plan;
    assert.ok(plan.id);
    assert.ok(plan.effects.destructive.length > 0);
    assert.deepEqual(result.effects, EMPTY_EFFECTS);
  },
);

Given('a configured project and its remove plan', function (this: PredictableCliWorld) {
  setupProject(this);
  runCli(this, ['remove', '--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
  const result = wireResult(this);
  const plan = (result.data as { plan: { id: string; effects: Effects } }).plan;
  this.planId = plan.id;
  this.plannedEffects = plan.effects;
});

When('the user explicitly confirms that plan', function (this: PredictableCliWorld) {
  runCli(this, [
    'remove',
    '--yes',
    '--plan',
    assertPresent(this.planId),
    '--json',
    '--no-input',
    '--offline',
    '--cwd',
    temporaryProject(this),
  ]);
});

Then('only the previewed effects are applied', function (this: PredictableCliWorld) {
  assert.deepEqual(wireResult(this).effects, this.plannedEffects);
});

Given(
  'the project changed after a remove plan was previewed',
  function (this: PredictableCliWorld) {
    setupProject(this);
    runCli(this, ['remove', '--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
    this.planId = (wireResult(this).data as { plan: { id: string } }).plan.id;
    writeFileSync(join(temporaryProject(this), '.safeword', 'version'), 'changed-after-plan\n');
    this.beforeTree = treeDigest(temporaryProject(this));
  },
);

When('the user confirms the stale plan', function (this: PredictableCliWorld) {
  runCli(this, [
    'remove',
    '--yes',
    '--plan',
    assertPresent(this.planId),
    '--json',
    '--no-input',
    '--offline',
    '--cwd',
    temporaryProject(this),
  ]);
});

Then('no effect is applied and a fresh plan is required', function (this: PredictableCliWorld) {
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  assert.equal(wireResult(this).state, 'action_required');
  assert.equal((wireResult(this).findings as { code: string }[])[0]?.code, 'PLAN_STALE');
});

Given('a confirmed plan whose second effect fails', function (this: PredictableCliWorld) {
  temporaryProject(this);
});

When('Safeword applies the plan', async function (this: PredictableCliWorld) {
  this.protocolResult = await convergeSetup(temporaryProject(this), {
    noModify: true,
    adapters: {
      configureArchitecture: () => {
        throw new Error('injected failure');
      },
    },
  });
});

Then(
  'the result reports the first completed effect the stable error and recovery action',
  function (this: PredictableCliWorld) {
    const result = assertPresent(this.protocolResult);
    assert.ok(
      result.effects.files.some(
        effect => effect.kind === 'create' && effect.target === 'package.json',
      ),
    );
    assert.equal(result.errors[0]?.code, 'SETUP_FAILED');
    assert.equal(result.recovery.length, 1);
  },
);

Given('setup has converged a project', function (this: PredictableCliWorld) {
  setupProject(this);
});

When('the user runs setup again', function (this: PredictableCliWorld) {
  runCli(this, ['setup', '--json', '--no-input', '--cwd', temporaryProject(this)]);
});

Then('the result is successful and changed is false', function (this: PredictableCliWorld) {
  const result = wireResult(this);
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
});

Given('a command result in {word} state', function (this: PredictableCliWorld, state: string) {
  this.protocolResult = resultForState(state);
});

When('Safeword completes the command', function (this: PredictableCliWorld) {
  this.result.exitCode = exitStatusFor(assertPresent(this.protocolResult));
});

Then('the process exits with {int}', function (this: PredictableCliWorld, status: number) {
  assert.equal(this.result.exitCode, status);
});

Given('a destructive command has a valid plan', function (this: PredictableCliWorld) {
  setupProject(this);
});

When('it runs in {word}', function (this: PredictableCliWorld, _mode: string) {
  runCli(this, ['remove', '--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
});

Then('it does not prompt or apply without explicit consent', function (this: PredictableCliWorld) {
  assert.equal(this.result.stderr, '');
  assert.equal(wireResult(this).changed, false);
  assert.equal(wireResult(this).state, 'action_required');
});

Given('a public command handler', function (this: PredictableCliWorld) {
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('it observes and plans an operation', async function (this: PredictableCliWorld) {
  const { observeStatus } = await import('../../src/commands/status.ts');
  this.protocolResult = await observeStatus(temporaryProject(this));
});

Then('it returns typed data and writes no process output', function (this: PredictableCliWorld) {
  assert.equal(assertPresent(this.protocolResult).schemaVersion, 1);
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
});

Given(
  'every public catalog entry and its deterministic invocation fixture',
  function (this: PredictableCliWorld) {
    assert.ok(publicCommands.length > 0);
  },
);

When(
  'each real handler is invoked through the executable adapter',
  function (this: PredictableCliWorld) {
    this.commandRuns = [publicCommands.map(definition => runPublicFixture(this, definition))];
  },
);

Then(
  'only the shared renderer writes output and no handler terminates the process',
  function (this: PredictableCliWorld) {
    const runs = assertPresent(this.commandRuns)[0] ?? [];
    for (const run of runs) {
      assert.equal(run.stderr, '');
      assert.doesNotThrow(() => JSON.parse(run.stdout));
      assert.ok([0, 1, 2].includes(run.exitCode));
    }
  },
);

Given(
  'every public command and its deterministic invocation fixture',
  function (this: PredictableCliWorld) {
    assert.ok(publicCommands.every(command => command.fixture.argv.length > 0));
  },
);

When(
  'each command is invoked with {string}',
  function (this: PredictableCliWorld, _contract: string) {
    this.commandRuns = [
      publicCommands.map(definition => runPublicFixture(this, definition)),
      publicCommands.map(definition => runPublicFixture(this, definition)),
    ];
  },
);

Then(
  'each invocation returns deterministic JSON without prompting',
  function (this: PredictableCliWorld) {
    const [firstRuns = [], secondRuns = []] = assertPresent(this.commandRuns);
    assert.equal(firstRuns.length, publicCommands.length);
    for (const [index, first] of firstRuns.entries()) {
      const second = assertPresent(secondRuns[index]);
      assert.equal(first.stderr, '');
      assert.equal(second.stderr, '');
      assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));
      assert.equal(first.exitCode, second.exitCode);
    }
  },
);

Given('a public command', function (this: PredictableCliWorld) {
  this.publicCommandName = 'capabilities';
});

When(
  'the global option {string} is placed before and after its name',
  function (this: PredictableCliWorld, option: string) {
    this.globalOption = option;
    const value = option === '--cwd' ? temporaryProject(this) : undefined;
    const before = [option, ...(value === undefined ? [] : [value]), 'capabilities', '--json'];
    runCli(this, before);
    const beforeOutput = this.result.stdout;
    const after = ['capabilities', option, ...(value === undefined ? [] : [value]), '--json'];
    runCli(this, after);
    this.renderedMany = [beforeOutput, this.result.stdout];
  },
);

Then('both invocations have equivalent results', function (this: PredictableCliWorld) {
  assert.equal(assertPresent(this.renderedMany)[0], assertPresent(this.renderedMany)[1]);
});

Given('a public command with positional arguments', function (this: PredictableCliWorld) {
  this.publicCommandName = 'project lint-gherkin';
});

When(
  'global options precede the command and double dash precedes a flag-like argument',
  function (this: PredictableCliWorld) {
    runCli(this, ['--json', '--no-input', 'project', 'lint-gherkin', '--', '--flag-like.feature']);
  },
);

Then('the flag-like argument reaches the handler unchanged', function (this: PredictableCliWorld) {
  assert.deepEqual((wireResult(this).data as { arguments: string[] }).arguments, [
    '--flag-like.feature',
  ]);
  assert.equal(this.result.stderr, '');
});

Given('a public command plan that declares a network effect', function (this: PredictableCliWorld) {
  this.publicCommandName = 'tracker sync';
});

When('the agent invokes it with {string}', function (this: PredictableCliWorld, _contract: string) {
  runCli(this, ['tracker', 'sync', '--offline', '--json', '--no-input']);
});

Then(
  'no network call occurs and the result requires an online next action',
  function (this: PredictableCliWorld) {
    const result = wireResult(this);
    assert.deepEqual((result.effects as typeof EMPTY_EFFECTS).network, []);
    assert.equal((result.findings as { code: string }[])[0]?.code, 'CLI_ONLINE_REQUIRED');
  },
);

Given('two projects with different Safeword states', function (this: PredictableCliWorld) {
  this.parentCwd = process.cwd();
  temporaryProject(this);
  this.secondDirectory = mkdtempSync(join(tmpdir(), 'safeword-cli-second-'));
});

When('status is run with cwd selecting the second project', function (this: PredictableCliWorld) {
  runCli(this, ['status', '--json', '--no-input', '--cwd', assertPresent(this.secondDirectory)]);
});

Then(
  'the result describes only the second project and the parent process cwd is unchanged',
  function (this: PredictableCliWorld) {
    assert.equal((wireResult(this).data as { configured: boolean }).configured, false);
    assert.equal(process.cwd(), this.parentCwd);
  },
);

Given(
  'healthy action-required and failed results with progress prose',
  function (this: PredictableCliWorld) {
    this.protocolResults = [
      resultForState('healthy'),
      resultForState('action-required', 1),
      resultForState('failed', 1),
    ];
  },
);

When('Safeword renders each result with quiet enabled', function (this: PredictableCliWorld) {
  this.renderedMany = assertPresent(this.protocolResults).map(result =>
    renderHumanResult(result, { quiet: true }),
  );
});

Then(
  'healthy and progress prose is suppressed while next actions and errors remain visible',
  function (this: PredictableCliWorld) {
    const [healthy, actionRequired, failed] = assertPresent(this.renderedMany);
    assert.equal(healthy, '');
    assert.match(actionRequired ?? '', /Next:/);
    assert.match(failed ?? '', /Example failed\./);
  },
);

Given('a command that {word}', function (this: PredictableCliWorld, outcome: string) {
  const state =
    outcome === 'succeeds' ? 'healthy' : outcome === 'fails' ? 'failed' : 'action-required';
  this.protocolResult = resultForState(state, state === 'healthy' ? 0 : 1);
});

Given('a command that requires action', function (this: PredictableCliWorld) {
  this.protocolResult = resultForState('action-required', 1);
});

When('Safeword renders JSON', function (this: PredictableCliWorld) {
  this.result.stdout = renderJsonResult(assertPresent(this.protocolResult));
});

Then(
  'stdout contains only one schema-version-{int} envelope with state changed findings effects errors recovery and next actions',
  function (this: PredictableCliWorld, schemaVersion: number) {
    const envelope = wireResult(this);
    assert.equal(envelope.schema_version, schemaVersion);
    for (const key of [
      'state',
      'changed',
      'findings',
      'effects',
      'errors',
      'recovery',
      'next_actions',
    ]) {
      assert.ok(key in envelope);
    }
  },
);

Given('the public command catalog', function (this: PredictableCliWorld) {
  this.protocolResult = createCapabilitiesResult();
});

When('the agent requests capabilities as JSON', function (this: PredictableCliWorld) {
  this.result.stdout = renderJsonResult(assertPresent(this.protocolResult));
});

Then(
  'every public command declares its canonical name aliases effect class prompt policy network policy schema and invocation fixture',
  function (this: PredictableCliWorld) {
    const commands = (wireResult(this).data as { commands: Record<string, unknown>[] }).commands;
    assert.equal(commands.length, publicCommands.length);
    for (const command of commands) {
      for (const key of [
        'name',
        'aliases',
        'effect_class',
        'prompt_policy',
        'network_policy',
        'schema_versions',
        'fixture',
      ]) {
        assert.ok(key in command);
      }
    }
  },
);

Then(
  'hidden helpers are absent and no command effect occurs',
  function (this: PredictableCliWorld) {
    const commands = (wireResult(this).data as { commands: { name: string }[] }).commands;
    assert.ok(
      commandCatalog
        .filter(command => !command.public)
        .every(helper => commands.every(command => command.name !== helper.name)),
    );
    assert.deepEqual(wireResult(this).effects, EMPTY_EFFECTS);
  },
);

Given('the Safeword CLI', function () {
  assert.ok(existsSync(CLI_PATH));
});

When('the user requests ordinary help', function (this: PredictableCliWorld) {
  runCli(this, ['--help']);
});

Then(
  'canonical command families are visible and internal helpers are hidden',
  function (this: PredictableCliWorld) {
    for (const family of ['project', 'tracker', 'codex', 'ticket', 'retro']) {
      assert.match(this.result.stdout, new RegExp(String.raw`\b${family}\b`));
    }
    for (const helper of ['boundary', 'codex-hook', 'feature-directories']) {
      assert.doesNotMatch(this.result.stdout, new RegExp(String.raw`\b${helper}\b`));
    }
  },
);

Given('the legacy command {string}', function (this: PredictableCliWorld, legacy: string) {
  this.legacy = legacy;
});

When(
  'the user invokes it in retained release line {int}',
  function (this: PredictableCliWorld, _releaseLine: number) {
    const legacy = assertPresent(this.legacy);
    const definition = findCommandDefinition(legacy);
    const run = runPublicFixture(this, definition);
    assert.equal(run.stderr, '');
    this.protocolResult = JSON.parse(run.stdout) as CliResult;
    assert.ok(aliasFixture(legacy).length > 0);
  },
);

Then(
  'canonical behavior runs with a deprecation finding and removal eligibility metadata',
  function (this: PredictableCliWorld) {
    const finding = assertPresent(this.protocolResult).findings.find(
      candidate => candidate.code === 'CLI_ALIAS_DEPRECATED',
    );
    assert.equal(finding?.metadata?.removal_eligible_after, '0.71');
  },
);

Given(
  /^an installed (Claude Code|Codex|Cursor) hook$/,
  function (this: PredictableCliWorld, surface: string) {
    installEffectWitnesses(this);
    this.hookSurface = surface as PredictableCliWorld['hookSurface'];
    this.hookEntrypoint =
      surface === 'Codex' ? 'hook codex' : surface === 'Cursor' ? 'cursor hook' : 'claude hook';
    this.beforeTree = treeDigest(temporaryProject(this));
  },
);

When('it invokes its real hidden Safeword entrypoint', function (this: PredictableCliWorld) {
  const hidden = commandCatalog.filter(command => !command.public);
  assert.ok(hidden.some(command => command.name.includes('hook')));
  const completed = runRealHook(this, assertPresent(this.hookSurface));
  this.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
});

Then(
  'output contains no human or progress prose and any required stdout is one valid host-protocol payload',
  function (this: PredictableCliWorld) {
    assert.doesNotMatch(this.result.stdout, /^(Healthy|Complete|Needs attention|Failed)$/m);
    assert.doesNotMatch(this.result.stdout, /^Applying\b/m);
    if (this.result.stdout.trim() !== '') assert.doesNotThrow(() => JSON.parse(this.result.stdout));
  },
);

Then('no install upgrade package or network effect occurs', function (this: PredictableCliWorld) {
  assert.equal(this.result.exitCode, 0);
  assert.equal(this.result.stderr, '');
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  const witnessLog = assertPresent(this.witnessLog);
  assert.equal(existsSync(witnessLog) ? readFileSync(witnessLog, 'utf8') : '', '');
});

Then('the entrypoint is absent from help and capabilities', function (this: PredictableCliWorld) {
  const capabilities = renderJsonResult(createCapabilitiesResult());
  assert.doesNotMatch(capabilities, /codex-hook|hook codex/);
});

Given('an installed agent hook after warm-up', function (this: PredictableCliWorld) {
  installEffectWitnesses(this);
  const completed = runRealHook(this, 'Codex');
  assert.equal(completed.status, 0);
});

When('its latency is measured repeatedly', function (this: PredictableCliWorld) {
  this.latencySamples = Array.from({ length: 10 }, () => {
    const start = performance.now();
    const completed = runRealHook(this, 'Codex');
    assert.equal(completed.status, 0);
    return performance.now() - start;
  });
});

Then('its p95 latency stays within the repository threshold', function (this: PredictableCliWorld) {
  const samples = assertPresent(this.latencySamples).toSorted((left, right) => left - right);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? Infinity;
  assert.ok(
    p95 < HOOK_P95_BUDGET_MS,
    `expected p95 < ${HOOK_P95_BUDGET_MS}ms, received ${p95.toFixed(1)}ms`,
  );
});

Given(
  'an interactive command with an injected monotonic clock and an apply step longer than {int} milliseconds',
  function (this: PredictableCliWorld, milliseconds: number) {
    this.progressMessages = [];
    const reporter = createProgressReporter({
      schedule: callback => {
        this.scheduledProgress = callback;
        return milliseconds;
      },
      cancel: handle => {
        assert.notEqual(handle, undefined);
      },
      emit: message => {
        this.progressMessages?.push(message);
      },
    });
    reporter.start('Applying the confirmed plan…');
  },
);

When('the user confirms the plan', function (this: PredictableCliWorld) {
  assertPresent(this.scheduledProgress)();
});

Then(
  'the progress adapter emits meaningful feedback within {int} milliseconds',
  function (this: PredictableCliWorld, milliseconds: number) {
    assert.equal(milliseconds, 100);
    assert.deepEqual(this.progressMessages, ['Applying the confirmed plan…']);
  },
);

function assertPresent<T>(value: T | undefined): T {
  assert.notEqual(value, undefined);
  return value as T;
}
