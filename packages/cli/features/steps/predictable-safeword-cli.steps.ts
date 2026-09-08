/* eslint-disable prefer-arrow-callback, security/detect-non-literal-regexp, sonarjs/no-alphabetical-sort, sonarjs/no-nested-conditional, unicorn/import-style, unicorn/no-computed-property-existence-check, unicorn/prefer-else-if, unicorn/require-array-sort-compare -- executable acceptance steps prioritize scenario correspondence and Cucumber's `this` world binding */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { CLAUDE_MIGRATION_SCHEMA } from '../../src/claude-plugin/inventory.ts';
import {
  commandCatalog,
  type CommandDefinition,
  findCommandDefinition,
  publicCommands,
} from '../../src/cli-protocol/catalog.ts';
import { createProgressReporter } from '../../src/cli-protocol/policy.ts';
import {
  type CliResult,
  createResult,
  type Effects,
  renderHumanResult,
} from '../../src/cli-protocol/result.ts';
import { convergeSetup } from '../../src/lifecycle/project-install.ts';
import { VERSION } from '../../src/version.ts';
import { publicFixtureEnvironment } from './public-fixture-environment.js';
import type { SafewordWorld } from './world.js';

const CLI_PATH = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const CLAUDE_PLUGIN_PATH = fileURLToPath(new URL('../../../../plugin/', import.meta.url));
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
  resultState?: string;
  hostEnvironment?: NodeJS.ProcessEnv;
  resolvedBunPath?: string;
  expectedReadOnlyState?: string;
  observedProcessOutput?: string;
  canonicalAliasResult?: CliResult;
  latencySamples?: number[];
  scheduledProgress?: () => void;
  scheduledCallbacks?: (() => void)[];
  scheduledHandles?: symbol[];
  cancelledHandle?: symbol;
  cancelledHandles?: Set<symbol>;
  scheduledDelay?: number;
  progressCancelled?: boolean;
  progressReporter?: ReturnType<typeof createProgressReporter>;
  progressMessages?: string[];
  commandRuns?: CommandRun[][];
  secondDirectory?: string;
  witnessDirectory?: string;
  witnessLog?: string;
  hostProfileDirectory?: string;
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

function hostProfileDirectory(world: PredictableCliWorld): string {
  world.hostProfileDirectory ??= mkdtempSync(join(tmpdir(), 'safeword-cli-profiles-'));
  return world.hostProfileDirectory;
}

function bunPath(): string {
  const path = spawnSync('sh', ['-c', 'command -v bun'], { encoding: 'utf8' }).stdout.trim();
  assert.notEqual(path, '', 'The predictable CLI hook scenarios require bun on PATH.');
  return path;
}

function runCli(
  world: PredictableCliWorld,
  argv: readonly string[],
  cwd = temporaryProject(world),
): void {
  const environment = publicFixtureEnvironment(
    hostProfileDirectory(world),
    world.hostEnvironment ?? {},
    childEnvironment(),
  );
  if (world.hostEnvironment?.NODE_OPTIONS !== undefined) {
    environment.NODE_OPTIONS = world.hostEnvironment.NODE_OPTIONS;
  }
  const completed = spawnSync(process.execPath, [CLI_PATH, ...argv], {
    cwd,
    encoding: 'utf8',
    env: environment,
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
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
  };
  delete environment.NODE_OPTIONS;
  return environment;
}

function runPublicFixture(
  world: PredictableCliWorld,
  definition: CommandDefinition,
  fixtureKey = definition.name,
  argv: readonly string[] = definition.fixture.argv,
): CommandRun {
  // One directory per command, wiped before each run: distinct paths keep an
  // earlier fixture from changing a later command's preconditions, while a
  // stable path per command keeps plan identities repeatable across runs.
  // A unique path per *run* would not — plan digests take in profile
  // observations that name the project directory.
  const cwd = join(
    temporaryProject(world),
    `public-fixture-${fixtureKey.replaceAll(/[^a-z0-9]+/giu, '-')}`,
  );
  const hostProfiles = join(
    temporaryProject(world),
    `public-host-${fixtureKey.replaceAll(/[^a-z0-9]+/giu, '-')}`,
  );
  rmSync(cwd, { recursive: true, force: true });
  rmSync(hostProfiles, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...argv, '--json', '--no-input', '--offline', '--cwd', cwd],
    {
      cwd,
      encoding: 'utf8',
      env: publicFixtureEnvironment(
        hostProfiles,
        definition.fixture.environment,
        childEnvironment(),
      ),
    },
  );
  // The stable per-command directory is not part of the contract: host tools
  // echo it in messages. Normalize it so comparisons measure behavior.
  const normalize = (value: string): string =>
    value.split(cwd).join('<fixture>').split(hostProfiles).join('<host-profile>');
  return {
    stdout: normalize(completed.stdout),
    stderr: normalize(completed.stderr),
    exitCode: completed.status ?? 1,
  };
}

function stableMachineResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => stableMachineResult(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (key !== 'recorded_at') return [key, stableMachineResult(child)];
      // The observation schema declares `recorded_at: string | null`, and a
      // missing hook proof legitimately reports null. Only a present value has
      // to be a parseable timestamp.
      // eslint-disable-next-line unicorn/no-null -- null is the schema's own absent-observation value
      if (child === null) return [key, null];
      assert.equal(typeof child, 'string');
      assert.ok(!Number.isNaN(Date.parse(child)));
      return [key, '<valid-observation-time>'];
    }),
  );
}

function withoutDeprecation(result: CliResult): CliResult {
  return {
    ...result,
    findings: result.findings.filter(candidate => candidate.code !== 'CLI_ALIAS_DEPRECATED'),
  };
}

function setupProject(world: PredictableCliWorld): void {
  const directory = temporaryProject(world);
  runCli(
    world,
    ['install', '--agents', 'none', '--json', '--no-input', '--cwd', directory],
    directory,
  );
  assert.equal(world.result.exitCode, 0);
  const setupResult = world.result;
  runCli(world, ['plan', '--json', '--no-input', '--offline', '--cwd', directory], directory);
  const packagePath = join(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  const preview = wireResult(world);
  const packages = (preview.data as { plan: { effects: Effects } }).plan.effects.packages;
  const devDependencies = { ...manifest.devDependencies };
  for (const { target } of packages) {
    const separator = target.lastIndexOf('@');
    const hasVersion = separator > 0;
    devDependencies[hasVersion ? target.slice(0, separator) : target] = hasVersion
      ? target.slice(separator + 1)
      : '*';
  }
  writeFileSync(packagePath, `${JSON.stringify({ ...manifest, devDependencies }, undefined, 2)}\n`);
  world.result = setupResult;
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

function prepareGlobalOptionScenario(world: PredictableCliWorld, option: string): string[] {
  const cwd = temporaryProject(world);
  if (option === '--no-input') {
    setupProject(world);
    return ['remove', '--json', '--offline', '--cwd', cwd];
  }
  if (option === '--quiet') return ['capabilities'];
  if (option === '--offline') return ['tracker', 'sync', '--json', '--no-input'];
  if (option === '--verbose') {
    mkdirSync(join(cwd, '.safeword'), { recursive: true });
    writeFileSync(join(cwd, '.safeword', 'version'), '0.0.0\n');
    return ['status', '--no-input', '--offline', '--cwd', cwd];
  }
  if (option === '--cwd') return ['status', '--json', '--no-input', '--offline'];
  return ['status', '--no-input', '--offline', '--cwd', cwd];
}

function runRealHook(world: PredictableCliWorld) {
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
      SAFEWORD_REAL_BUN: assertPresent(world.resolvedBunPath),
      SAFEWORD_FETCH_WITNESS: join(witnessDirectory, 'fetch-witness.mjs'),
      SAFEWORD_WITNESS_LOG: witnessLog,
    },
  };
  return spawnSync(process.execPath, [CLI_PATH, 'codex-hook', 'session-start'], {
    ...common,
    env: {
      ...common.env,
      NODE_OPTIONS: `--import=${join(witnessDirectory, 'fetch-witness.mjs')}`,
    },
    input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'bdd-session' }),
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
  if (this.hostProfileDirectory !== undefined) {
    rmSync(this.hostProfileDirectory, { recursive: true, force: true });
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
  add|i|install|ci|update|upgrade|remove|uninstall|x|dlx)
    printf '%s\n' "$0 $*" >> "$SAFEWORD_WITNESS_LOG"
    exit 97
    ;;
esac
if [ "$(basename "$0")" = "bun" ] && [ "$#" -gt 0 ]; then
  exec "$SAFEWORD_REAL_BUN" --preload "$SAFEWORD_FETCH_WITNESS" "$@"
fi
printf '%s\n' "$0 $*" >> "$SAFEWORD_WITNESS_LOG"
exit 97
`;
  writeFileSync(
    join(directory, 'fetch-witness.mjs'),
    String.raw`import { appendFileSync } from 'node:fs';
globalThis.fetch = (() => {
  appendFileSync(process.env.SAFEWORD_WITNESS_LOG ?? '', 'fetch\n');
  throw new Error('network access attempted from lifecycle hook');
});
`,
  );
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

function installActiveClaudeFixture(world: PredictableCliWorld): void {
  const directory = join(hostProfileDirectory(world), 'bin');
  const projectRoot = realpathSync(temporaryProject(world));
  const pluginRoot = realpathSync(CLAUDE_PLUGIN_PATH);
  const identity = JSON.parse(readFileSync(join(pluginRoot, 'identity.json'), 'utf8')) as {
    hook_manifest_sha256: string;
  };
  const plugins = JSON.stringify([
    {
      id: 'safeword@safeword',
      version: VERSION,
      enabled: true,
      scope: 'user',
      installPath: pluginRoot,
    },
  ]);
  mkdirSync(directory, { recursive: true });
  const executable = join(directory, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
case "$*" in
  '--version') printf '2.1.170\n' ;;
  'plugin list --json') printf '%s\n' '${plugins}' ;;
  *) exit 2 ;;
esac
`,
  );
  chmodSync(executable, 0o755);
  world.hostEnvironment = {
    ...world.hostEnvironment,
    PATH: `${directory}:${world.hostEnvironment?.PATH ?? process.env.PATH ?? ''}`,
  };
  const proofDirectory = join(
    hostProfileDirectory(world),
    'claude-profile',
    CLAUDE_MIGRATION_SCHEMA.paths.proofDirectory,
  );
  const projectDigest = createHash('sha256').update(projectRoot).digest('hex');
  mkdirSync(proofDirectory, { recursive: true });
  writeFileSync(
    join(proofDirectory, `${projectDigest}.json`),
    `${JSON.stringify({
      schema_version: 2,
      project_root: projectRoot,
      plugin_version: VERSION,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      canonical_plugin_root: pluginRoot,
      event: 'UserPromptSubmit',
      session_id: 'predictable-cli-fixture',
      recorded_at: new Date().toISOString(),
    })}\n`,
  );
}

Given('a configured project without native profile plugins', function (this: PredictableCliWorld) {
  setupProject(this);
  this.beforeTree = treeDigest(temporaryProject(this));
});

Given('a configured project with managed drift', function (this: PredictableCliWorld) {
  setupProject(this);
  installActiveClaudeFixture(this);
  writeFileSync(join(temporaryProject(this), '.safeword', 'version'), '0.0.0\n');
});

When('the user runs Safeword with no command', function (this: PredictableCliWorld) {
  runCli(this, ['--json', '--no-input', '--offline', '--cwd', temporaryProject(this)]);
});

Then('the result reports action required without changes', function (this: PredictableCliWorld) {
  const result = wireResult(this);
  assert.equal(result.state, 'action_required');
  assert.equal(result.changed, false);
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
});

Then(
  'the result requires action and recommends {string}',
  function (this: PredictableCliWorld, command: string) {
    const result = wireResult(this);
    assert.equal(result.state, 'action_required', JSON.stringify(result));
    assert.equal((result.next_actions as { command: string }[])[0]?.command, command);
  },
);

Given('a project that is {word}', function (this: PredictableCliWorld, state: string) {
  installEffectWitnesses(this);
  this.resolvedBunPath = bunPath();
  this.hostEnvironment = {
    NODE_OPTIONS: `--import=${join(assertPresent(this.witnessDirectory), 'fetch-witness.mjs')}`,
    PATH: `${assertPresent(this.witnessDirectory)}:${process.env.PATH ?? ''}`,
    SAFEWORD_FETCH_WITNESS: join(assertPresent(this.witnessDirectory), 'fetch-witness.mjs'),
    SAFEWORD_REAL_BUN: this.resolvedBunPath,
    SAFEWORD_WITNESS_LOG: assertPresent(this.witnessLog),
  };
  const directory = temporaryProject(this);
  if (state === 'drifted') {
    mkdirSync(join(directory, '.safeword'), { recursive: true });
    writeFileSync(join(directory, '.safeword', 'version'), '0.0.0\n');
  }
  if (state === 'failed') {
    mkdirSync(join(directory, '.safeword', 'version'), { recursive: true });
  }
  this.expectedReadOnlyState = state === 'failed' ? 'failed' : 'action_required';
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
  const result = wireResult(this);
  assert.equal(result.state, this.expectedReadOnlyState);
  const effects = result.effects as typeof EMPTY_EFFECTS;
  assert.deepEqual(effects.files, []);
  assert.deepEqual(effects.packages, []);
  assert.deepEqual(effects.configuration, []);
  assert.deepEqual(effects.network, []);
  assert.deepEqual(effects.destructive, []);
  const witnessLog = assertPresent(this.witnessLog);
  assert.equal(existsSync(witnessLog) ? readFileSync(witnessLog, 'utf8') : '', '');
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
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('the user runs {string}', function (this: PredictableCliWorld, invocation: string) {
  const argv = invocation.split(' ').slice(1);
  runCli(this, [...argv, '--json', '--cwd', temporaryProject(this)]);
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
    assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  },
);

Given('a configured project and its remove plan', function (this: PredictableCliWorld) {
  setupProject(this);
  runCli(this, ['remove', '--json', '--no-input', '--cwd', temporaryProject(this)]);
  const result = wireResult(this);
  const plan = (result.data as { plan: { id: string; effects: Effects } }).plan;
  this.planId = plan.id;
  this.plannedEffects = plan.effects;
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('the user explicitly confirms that plan', function (this: PredictableCliWorld) {
  runCli(this, [
    'remove',
    '--yes',
    '--plan',
    assertPresent(this.planId),
    '--json',
    '--no-input',
    '--cwd',
    temporaryProject(this),
  ]);
});

Then('only the previewed effects are applied', function (this: PredictableCliWorld) {
  const completed = wireResult(this).effects as Effects;
  const planned = assertPresent(this.plannedEffects);
  const categories: readonly (keyof Effects)[] = [
    'files',
    'packages',
    'configuration',
    'network',
    'destructive',
  ];
  const plannedTargets = new Set(
    categories.flatMap(category => planned[category].map(effect => `${category}:${effect.target}`)),
  );
  const completedEffects = categories.flatMap(category =>
    completed[category].map(effect => `${category}:${effect.target}`),
  );

  assert.ok(completedEffects.length > 0);
  for (const effect of completedEffects) assert.ok(plannedTargets.has(effect), effect);
  assert.notEqual(treeDigest(temporaryProject(this)), this.beforeTree);
});

Given(
  'the project changed after a remove plan was previewed',
  function (this: PredictableCliWorld) {
    setupProject(this);
    runCli(this, ['remove', '--json', '--no-input', '--cwd', temporaryProject(this)]);
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
    '--cwd',
    temporaryProject(this),
  ]);
});

Then('no effect is applied and a fresh plan is required', function (this: PredictableCliWorld) {
  assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  assert.equal(wireResult(this).state, 'action_required');
  assert.equal((wireResult(this).findings as { code: string }[])[0]?.code, 'PLAN_STALE');
});

Given('an install whose second effect fails', function (this: PredictableCliWorld) {
  temporaryProject(this);
});

When('Safeword applies install', async function (this: PredictableCliWorld) {
  this.protocolResult = await convergeSetup(temporaryProject(this), {
    noModify: false,
    adapters: {
      configureArchitecture: () => {
        writeFileSync(
          join(temporaryProject(this), '.dependency-cruiser.cjs'),
          'module.exports = {};\n',
        );
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
    assert.ok(
      result.effects.files.some(
        effect => effect.kind === 'create' && effect.target === '.dependency-cruiser.cjs',
      ),
    );
    assert.equal(result.errors[0]?.code, 'SETUP_FAILED');
    assert.equal(result.recovery.length, 1);
  },
);

Given('install has converged a project', function (this: PredictableCliWorld) {
  setupProject(this);
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('the user runs install again', function (this: PredictableCliWorld) {
  runCli(this, [
    'install',
    '--agents',
    'none',
    '--json',
    '--no-input',
    '--cwd',
    temporaryProject(this),
  ]);
});

Then(
  'the result is successful with no reported or filesystem effects',
  function (this: PredictableCliWorld) {
    const result = wireResult(this);
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.deepEqual(result.effects, EMPTY_EFFECTS);
    assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
  },
);

Given('a command result in {word} state', function (this: PredictableCliWorld, state: string) {
  this.resultState = state;
});

When('Safeword completes the command', function (this: PredictableCliWorld) {
  const state = assertPresent(this.resultState);
  if (state === 'healthy') {
    runCli(this, ['capabilities', '--json', '--no-input', '--offline']);
  } else if (state === 'action-required') {
    runCli(this, ['status', '--json', '--no-input', '--offline']);
  } else {
    runCli(this, ['not-a-command', '--json', '--no-input', '--offline']);
  }
});

Then('the process exits with {int}', function (this: PredictableCliWorld, status: number) {
  assert.equal(this.result.exitCode, status);
});

Given('a destructive command has a valid plan', function (this: PredictableCliWorld) {
  setupProject(this);
});

When('it runs in {word}', function (this: PredictableCliWorld, mode: string) {
  runCli(this, [
    'remove',
    '--json',
    ...(mode === '--no-input' ? ['--no-input'] : []),
    '--offline',
    '--cwd',
    temporaryProject(this),
  ]);
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
  const { observeStatus } = await import('../../src/lifecycle/status.ts');
  let output = '';
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  };
  try {
    this.protocolResult = await observeStatus(temporaryProject(this));
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
  this.observedProcessOutput = output;
});

Then('it returns typed data and writes no process output', function (this: PredictableCliWorld) {
  assert.equal(assertPresent(this.protocolResult).schemaVersion, 1);
  assert.equal(this.observedProcessOutput, '');
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
  'every invocation returns one JSON result through the shared renderer',
  function (this: PredictableCliWorld) {
    const runs = assertPresent(this.commandRuns)[0] ?? [];
    for (const run of runs) {
      assert.equal(run.stderr, '');
      const envelope = JSON.parse(run.stdout) as Record<string, unknown>;
      assert.equal(envelope.schema_version, 1);
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

When('each command is invoked through its machine fixture', function (this: PredictableCliWorld) {
  this.commandRuns = [
    publicCommands.map(definition => runPublicFixture(this, definition)),
    publicCommands.map(definition => runPublicFixture(this, definition)),
  ];
});

Then(
  'each invocation returns deterministic JSON without prompting',
  function (this: PredictableCliWorld) {
    const [firstRuns = [], secondRuns = []] = assertPresent(this.commandRuns);
    assert.equal(firstRuns.length, publicCommands.length);
    for (const [index, first] of firstRuns.entries()) {
      const second = assertPresent(secondRuns[index]);
      assert.equal(first.stderr, '');
      assert.equal(second.stderr, '');
      assert.deepEqual(
        stableMachineResult(JSON.parse(first.stdout)),
        stableMachineResult(JSON.parse(second.stdout)),
      );
      assert.equal(first.exitCode, second.exitCode);
    }
  },
);

Given('a public command', function (this: PredictableCliWorld) {
  temporaryProject(this);
});

When(
  'the global option {string} is placed before and after its name',
  function (this: PredictableCliWorld, option: string) {
    this.globalOption = option;
    const value = option === '--cwd' ? temporaryProject(this) : undefined;
    const command = prepareGlobalOptionScenario(this, option);
    const optionWithValue = [option, ...(value === undefined ? [] : [value])];
    const split = command[0] === 'tracker' ? 2 : 1;
    runCli(this, [...optionWithValue, ...command]);
    const beforeRun = { ...this.result };
    runCli(this, [...command.slice(0, split), ...optionWithValue, ...command.slice(split)]);
    this.commandRuns = [[beforeRun, { ...this.result }]];
  },
);

Then('both invocations have equivalent results', function (this: PredictableCliWorld) {
  const [before, after] = assertPresent(this.commandRuns)[0] ?? [];
  assert.deepEqual(before, after);
  const option = assertPresent(this.globalOption);
  if (option === '--json') assert.doesNotThrow(() => JSON.parse(assertPresent(before).stdout));
  if (option === '--no-input') {
    assert.equal(JSON.parse(assertPresent(before).stdout).state, 'action_required');
    assert.equal(assertPresent(before).stderr, '');
  }
  if (option === '--cwd') {
    assert.equal(
      JSON.parse(assertPresent(before).stdout).data.surfaces[0].state,
      'action_required',
    );
  }
  if (option === '--quiet') assert.equal(assertPresent(before).stdout, '');
  if (option === '--offline') {
    assert.equal(JSON.parse(assertPresent(before).stdout).findings[0].code, 'CLI_ONLINE_REQUIRED');
  }
  if (option === '--verbose') assert.match(assertPresent(before).stdout, /Safeword CLI v/);
});

Given('a public command with positional arguments', function (this: PredictableCliWorld) {
  temporaryProject(this);
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
  installEffectWitnesses(this);
  this.resolvedBunPath = bunPath();
  this.hostEnvironment = {
    NODE_OPTIONS: `--import=${join(assertPresent(this.witnessDirectory), 'fetch-witness.mjs')}`,
    PATH: `${assertPresent(this.witnessDirectory)}:${process.env.PATH ?? ''}`,
    SAFEWORD_FETCH_WITNESS: join(assertPresent(this.witnessDirectory), 'fetch-witness.mjs'),
    SAFEWORD_REAL_BUN: this.resolvedBunPath,
    SAFEWORD_WITNESS_LOG: assertPresent(this.witnessLog),
  };
  temporaryProject(this);
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
    const witnessLog = assertPresent(this.witnessLog);
    assert.equal(existsSync(witnessLog) ? readFileSync(witnessLog, 'utf8') : '', '');
  },
);

Given('two projects with different Safeword states', function (this: PredictableCliWorld) {
  setupProject(this);
  this.secondDirectory = mkdtempSync(join(tmpdir(), 'safeword-cli-second-'));
  mkdirSync(join(this.secondDirectory, '.safeword'), { recursive: true });
  writeFileSync(join(this.secondDirectory, '.safeword', 'version'), '0.0.0\n');
});

When('status is run with cwd selecting the second project', function (this: PredictableCliWorld) {
  runCli(this, [
    'status',
    '--json',
    '--no-input',
    '--offline',
    '--cwd',
    assertPresent(this.secondDirectory),
  ]);
});

Then('the result describes only the second project', function (this: PredictableCliWorld) {
  const data = wireResult(this).data as {
    surfaces: { name: string; state: string }[];
  };
  assert.deepEqual(data.surfaces, [
    { name: 'project', selected: true, state: 'action_required' },
    { name: 'claude', selected: true, state: 'action_required' },
    { name: 'codex', selected: true, state: 'action_required' },
  ]);
  assert.ok(
    (wireResult(this).findings as { code: string; message: string }[]).some(
      finding => finding.code === 'SAFEWORD_VERSION' && finding.message.includes('v0.0.0'),
    ),
  );
});

Given('healthy action-required and failed results', function (this: PredictableCliWorld) {
  this.protocolResults = [
    resultForState('healthy'),
    resultForState('action-required', 1),
    resultForState('failed', 1),
  ];
});

When('Safeword renders each result with quiet enabled', function (this: PredictableCliWorld) {
  this.renderedMany = assertPresent(this.protocolResults).map(result =>
    renderHumanResult(result, { quiet: true }),
  );
});

Then(
  'healthy prose is suppressed while next actions and errors remain visible',
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
  this.resultState = state;
});

Given('a command that requires action', function (this: PredictableCliWorld) {
  this.protocolResult = resultForState('action-required', 1);
  this.resultState = 'action-required';
});

When('Safeword renders JSON', function (this: PredictableCliWorld) {
  const state = assertPresent(this.resultState);
  if (state === 'healthy') runCli(this, ['capabilities', '--json', '--no-input', '--offline']);
  else if (state === 'action-required')
    runCli(this, ['status', '--json', '--no-input', '--offline']);
  else runCli(this, ['not-a-command', '--json', '--no-input', '--offline']);
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

Then(
  'the JSON envelope reports failed state with a stable error',
  function (this: PredictableCliWorld) {
    const envelope = wireResult(this);
    assert.equal(envelope.state, 'failed');
    const errors = envelope.errors as { code: string; message: string; retryable: boolean }[];
    assert.equal(errors.length, 1);
    assert.match(errors[0]?.code ?? '', /^[A-Z][A-Z0-9_]+$/);
    assert.ok((errors[0]?.message.length ?? 0) > 0);
    assert.equal(typeof errors[0]?.retryable, 'boolean');
  },
);

Given('the public command catalog', function (this: PredictableCliWorld) {
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('the agent requests capabilities as JSON', function (this: PredictableCliWorld) {
  runCli(this, ['capabilities', '--json', '--no-input', '--offline']);
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
        .filter(command => command.classification === 'internal')
        .every(helper => commands.every(command => command.name !== helper.name)),
    );
    assert.deepEqual(wireResult(this).effects, EMPTY_EFFECTS);
    assert.equal(treeDigest(temporaryProject(this)), this.beforeTree);
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
      assert.match(this.result.stdout, new RegExp(String.raw`^  ${family}(?:\s|$)`, 'm'));
    }
    for (const helper of ['boundary', 'codex-hook', 'feature-directories']) {
      assert.doesNotMatch(this.result.stdout, new RegExp(String.raw`\b${helper}\b`));
    }
  },
);

Given('the legacy command {string}', function (this: PredictableCliWorld, legacy: string) {
  this.legacy = legacy;
});

When('the user invokes the retained alias', function (this: PredictableCliWorld) {
  const legacy = assertPresent(this.legacy);
  const definition = findCommandDefinition(legacy);
  const run = runPublicFixture(this, definition, legacy);
  assert.equal(run.stderr, '');
  this.protocolResult = JSON.parse(run.stdout) as CliResult;
  const replacement = definition.compatibility?.replacement ?? assertPresent(definition.aliasFor);
  const fixtureArguments = definition.fixture.argv.slice(legacy.split(' ').length);
  const canonicalArgv = [...replacement.split(' '), ...fixtureArguments];
  const canonicalRun = runPublicFixture(this, definition, legacy, canonicalArgv);
  assert.equal(canonicalRun.stderr, '');
  this.canonicalAliasResult = JSON.parse(canonicalRun.stdout) as CliResult;
});

Then(
  'canonical behavior runs with indefinite-retention compatibility metadata',
  function (this: PredictableCliWorld) {
    const finding = assertPresent(this.protocolResult).findings.find(
      candidate => candidate.code === 'CLI_ALIAS_DEPRECATED',
    );
    assert.equal(finding?.metadata?.retention, 'indefinite');
    assert.equal(finding?.metadata?.removal_eligible_after, undefined);
    if (assertPresent(this.legacy) === 'reset') {
      assert.equal(finding?.metadata?.replacement, 'uninstall --agents=none');
      return;
    }
    const aliasResult = withoutDeprecation(assertPresent(this.protocolResult));
    const canonicalResult = assertPresent(this.canonicalAliasResult);
    assert.deepEqual(stableMachineResult(aliasResult), stableMachineResult(canonicalResult));
  },
);

Given('an installed Codex hook', function (this: PredictableCliWorld) {
  this.resolvedBunPath = bunPath();
  installEffectWitnesses(this);
  this.beforeTree = treeDigest(temporaryProject(this));
});

When('it invokes its real hidden Safeword entrypoint', function (this: PredictableCliWorld) {
  const hidden = commandCatalog.filter(command => command.classification === 'internal');
  assert.ok(hidden.some(command => command.name.includes('hook')));
  const completed = runRealHook(this);
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
  runCli(this, ['capabilities', '--json', '--no-input', '--offline']);
  assert.doesNotMatch(this.result.stdout, /codex-hook|hook codex/);
  runCli(this, ['--help']);
  assert.equal(this.result.exitCode, 0);
  assert.doesNotMatch(this.result.stdout, /codex-hook|hook codex/);
});

Given('an installed Codex hook after warm-up', function (this: PredictableCliWorld) {
  this.resolvedBunPath = bunPath();
  installEffectWitnesses(this);
  const completed = runRealHook(this);
  assert.equal(completed.status, 0);
});

When(
  'its latency is measured over {int} samples',
  function (this: PredictableCliWorld, count: number) {
    this.latencySamples = Array.from({ length: count }, () => {
      const start = performance.now();
      const completed = runRealHook(this);
      assert.equal(completed.status, 0);
      return performance.now() - start;
    });
  },
);

Then(
  'its p95 latency stays below {int} milliseconds',
  function (this: PredictableCliWorld, budget: number) {
    const samples = assertPresent(this.latencySamples).toSorted((left, right) => left - right);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? Infinity;
    assert.ok(p95 < budget, `expected p95 < ${budget}ms, received ${p95.toFixed(1)}ms`);
  },
);

Given('a progress reporter with a controlled scheduler', function (this: PredictableCliWorld) {
  this.progressMessages = [];
  this.scheduledCallbacks = [];
  this.scheduledHandles = [];
  this.cancelledHandles = new Set();
  this.progressReporter = createProgressReporter({
    schedule: (callback, delay) => {
      this.scheduledDelay = delay;
      const handle = Symbol('progress-timer');
      const guardedCallback = () => {
        if (!this.cancelledHandles?.has(handle)) callback();
      };
      this.scheduledProgress = guardedCallback;
      this.scheduledCallbacks?.push(guardedCallback);
      this.scheduledHandles?.push(handle);
      return handle;
    },
    cancel: handle => {
      this.progressCancelled = true;
      this.cancelledHandle = handle as symbol;
      this.cancelledHandles?.add(handle as symbol);
    },
    emit: message => {
      this.progressMessages?.push(message);
    },
  });
});

When(
  'progress reporting starts twice before {int} milliseconds elapse',
  function (this: PredictableCliWorld, _milliseconds: number) {
    const reporter = assertPresent(this.progressReporter);
    reporter.start('Applying the confirmed plan…');
    reporter.start('Applying the confirmed plan…');
  },
);

Then(
  'the first schedule is cancelled and the replacement emits one meaningful message after {int} milliseconds',
  function (this: PredictableCliWorld, milliseconds: number) {
    const callbacks = assertPresent(this.scheduledCallbacks);
    const handles = assertPresent(this.scheduledHandles);
    callbacks[0]?.();
    assert.deepEqual(this.progressMessages, []);
    assertPresent(this.scheduledProgress)();
    assert.equal(this.scheduledDelay, milliseconds);
    assert.deepEqual(this.progressMessages, ['Applying the confirmed plan…']);
    assert.equal(this.progressCancelled, true);
    assert.equal(this.cancelledHandle, handles[0]);
  },
);

function assertPresent<T>(value: T | undefined): T {
  assert.notEqual(value, undefined);
  return value as T;
}
