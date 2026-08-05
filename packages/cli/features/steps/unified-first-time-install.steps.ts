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
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { SAFEWORD_SCHEMA } from '../../src/schema.ts';
import type { SafewordWorld } from './world.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

interface UnifiedInstallWorld extends SafewordWorld {
  fixtureRoot?: string;
  projectRoot?: string;
  profileBin?: string;
  claudeState?: string;
  codexState?: string;
  cursorBefore?: string;
  hostEnvironment?: NodeJS.ProcessEnv;
  fixtureBefore?: string;
  selectedAgents?: string[];
  statusEnvelope?: Record<string, unknown>;
  doctorEnvelope?: Record<string, unknown>;
  planId?: string;
  unrelatedProfilePath?: string;
  unifiedUninstall?: boolean;
  lifecycleOperation?: string;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function createClaudePayload(root: string): string {
  const installPath = nodePath.join(root, 'claude-plugin');
  const assets = [
    ['hooks/hooks.json', '{"hooks":{}}\n'],
    ['runtime/cli.js', '// cli\n'],
    ['runtime/dispatch.ts', '// dispatch\n'],
    ['runtime/event-groups.json', '{}\n'],
  ] as const;
  for (const [relativePath, content] of assets) {
    const path = nodePath.join(installPath, relativePath);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const inventory = {
    schema_version: 1,
    assets: assets.map(([path, content]) => ({ path, sha256: sha256(content) })),
  };
  const inventoryContent = `${JSON.stringify(inventory)}\n`;
  writeFileSync(nodePath.join(installPath, 'inventory.json'), inventoryContent);
  writeFileSync(
    nodePath.join(installPath, 'identity.json'),
    `${JSON.stringify({
      schema_version: 1,
      plugin_version: SAFEWORD_SCHEMA.version,
      inventory_sha256: sha256(inventoryContent),
      hook_manifest_sha256: sha256(assets[0][1]),
    })}\n`,
  );
  return installPath;
}

function directoryDigest(directory: string): string {
  if (!existsSync(directory)) return 'missing';
  const visit = (path: string): unknown => {
    const stat = lstatSync(path);
    if (!stat.isDirectory()) return readFileSync(path).toString('base64');
    return readdirSync(path)
      .toSorted((left, right) => left.localeCompare(right))
      .map(name => [name, visit(nodePath.join(path, name))]);
  };
  return JSON.stringify(visit(directory));
}

function initializeHosts(world: UnifiedInstallWorld): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-unified-install-'));
  const project = nodePath.join(root, 'project');
  const bin = nodePath.join(root, 'bin');
  const profile = nodePath.join(root, 'profile');
  const claudeState = nodePath.join(profile, 'claude-state');
  const codexState = nodePath.join(profile, 'codex-state');
  const claudeMarketplace = nodePath.join(profile, 'claude-marketplace');
  const codexMarketplace = nodePath.join(profile, 'codex-marketplace');
  const claudePayload = createClaudePayload(root);
  mkdirSync(nodePath.join(project, '.cursor'), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(nodePath.join(project, '.cursor/customer.json'), '{"ownedBy":"customer"}\n');
  spawnSync('git', ['init', '--quiet'], { cwd: project });
  for (const path of [claudeState, codexState, claudeMarketplace, codexMarketplace]) {
    writeFileSync(path, 'absent');
  }

  const officialClaudeSource = `https://github.com/ArcadeAI/safeword.git#v${SAFEWORD_SCHEMA.version}`;
  writeExecutable(
    nodePath.join(bin, 'claude'),
    `#!/bin/sh
set -eu
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json')
    if [ "$(cat "$SAFEWORD_CLAUDE_MARKETPLACE")" = 'official' ]; then
      printf '[{"name":"safeword","source":"%s"}]\n' "$SAFEWORD_CLAUDE_SOURCE"
    else
      echo '[]'
    fi
    ;;
  'plugin marketplace add '*' --scope user') printf 'official' > "$SAFEWORD_CLAUDE_MARKETPLACE" ;;
  'plugin install safeword@safeword --scope user'|'plugin update safeword@safeword --scope user'|'plugin enable safeword@safeword --scope user')
    printf 'enabled' > "$SAFEWORD_CLAUDE_STATE"
    ;;
  'plugin uninstall safeword@safeword --scope user --keep-data')
    printf 'absent' > "$SAFEWORD_CLAUDE_STATE"
    ;;
  'plugin list --json')
    if [ "$(cat "$SAFEWORD_CLAUDE_STATE")" = 'enabled' ]; then
      printf '[{"id":"safeword@safeword","version":"%s","enabled":true,"scope":"user","installPath":"%s"}]\n' "$SAFEWORD_VERSION" "$SAFEWORD_CLAUDE_PAYLOAD"
    else
      echo '[]'
    fi
    ;;
  *) echo "unexpected claude command: $*" >&2; exit 2 ;;
esac
`,
  );
  writeExecutable(
    nodePath.join(bin, 'codex'),
    `#!/bin/sh
set -eu
case "$*" in
  '--version') echo 'codex 0.141.0' ;;
  'plugin marketplace list --json')
    if [ "$(cat "$SAFEWORD_CODEX_MARKETPLACE")" = 'official' ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"git","source":"https://github.com/ArcadeAI/safeword.git"}}]}'
    else
      echo '{"marketplaces":[]}'
    fi
    ;;
  'plugin marketplace add '*|'plugin marketplace upgrade safeword --json')
    printf 'official' > "$SAFEWORD_CODEX_MARKETPLACE"
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin add safeword@safeword --json')
    printf 'enabled' > "$SAFEWORD_CODEX_STATE"
    echo '{"pluginId":"safeword@safeword"}'
    ;;
  'plugin remove safeword@safeword --json')
    printf 'absent' > "$SAFEWORD_CODEX_STATE"
    echo '{"pluginId":"safeword@safeword"}'
    ;;
  'plugin list --json')
    if [ "$(cat "$SAFEWORD_CODEX_STATE")" = 'enabled' ]; then
      printf '{"installed":[{"pluginId":"safeword@safeword","enabled":true,"version":"%s"}]}\n' "$SAFEWORD_VERSION"
    else
      echo '{"installed":[]}'
    fi
    ;;
  *) echo "unexpected codex command: $*" >&2; exit 2 ;;
esac
`,
  );

  world.fixtureRoot = root;
  world.temporaryDirectory = project;
  world.projectRoot = project;
  world.profileBin = bin;
  world.claudeState = claudeState;
  world.codexState = codexState;
  world.cursorBefore = directoryDigest(nodePath.join(project, '.cursor'));
  world.hostEnvironment = {
    PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    CODEX_HOME: profile,
    SAFEWORD_CLAUDE_MARKETPLACE: claudeMarketplace,
    SAFEWORD_CLAUDE_PAYLOAD: claudePayload,
    SAFEWORD_CLAUDE_SOURCE: officialClaudeSource,
    SAFEWORD_CLAUDE_STATE: claudeState,
    SAFEWORD_CODEX_MARKETPLACE: codexMarketplace,
    SAFEWORD_CODEX_STATE: codexState,
    SAFEWORD_VERSION: SAFEWORD_SCHEMA.version,
  };
  world.fixtureBefore = directoryDigest(root);
}

function requiredPath(path: string | undefined, label: string): string {
  if (path === undefined) throw new Error(`${label} was not initialized`);
  return path;
}

interface LifecyclePlanEnvelope {
  data: {
    plan: {
      command: string;
      effects: { configuration: unknown[]; network: unknown[]; destructive: unknown[] };
    };
    surfaces: { name: string }[];
  };
}

function assertSelectedProfilePlan(
  operation: string | undefined,
  selectedAgents: readonly string[],
  envelope: LifecyclePlanEnvelope,
): void {
  if (selectedAgents.length === 0) return;
  const profileSelected = selectedAgents.some(agent => agent === 'claude' || agent === 'codex');
  if (operation === 'uninstall' && !profileSelected) return;
  const effects = envelope.data.plan.effects;
  assert.ok(effects.configuration.length > 0);
  if (!profileSelected) return;
  const selectedEffects = operation === 'install' ? effects.network : effects.destructive;
  assert.ok(selectedEffects.length > 0);
}

After(function (this: UnifiedInstallWorld) {
  if (this.fixtureRoot !== undefined) rmSync(this.fixtureRoot, { recursive: true, force: true });
});

function runInstall(world: UnifiedInstallWorld, arguments_: readonly string[]): void {
  const project = requiredPath(world.projectRoot, 'project root');
  const environment = world.hostEnvironment ?? {};
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, 'install', ...arguments_, '--json', '--cwd', project],
    {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...environment,
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_SKIP_INSTALL: '1',
      },
    },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

function runJsonCommand(world: UnifiedInstallWorld, command: string): Record<string, unknown> {
  const project = requiredPath(world.projectRoot, 'project root');
  const completed = spawnSync(process.execPath, [CLI_PATH, command, '--json', '--cwd', project], {
    cwd: project,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...world.hostEnvironment,
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    },
  });
  assert.notEqual(completed.status, 1, completed.stderr || completed.stdout);
  return JSON.parse(completed.stdout) as Record<string, unknown>;
}

function runRawCommand(world: UnifiedInstallWorld, arguments_: readonly string[]): void {
  const project = requiredPath(world.projectRoot, 'project root');
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...arguments_, '--json', '--cwd', project],
    {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...world.hostEnvironment,
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_SKIP_INSTALL: '1',
      },
    },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

Given(
  'an unconfigured project with available Claude and Codex hosts',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When(
  'the user runs the canonical install command without an agent selector',
  function (this: UnifiedInstallWorld) {
    runInstall(this, []);
  },
);

Then(
  'core project configuration and both profile plugins are installed',
  function (this: UnifiedInstallWorld) {
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'enabled');
  },
);

Then('Cursor configuration is unchanged', function (this: UnifiedInstallWorld) {
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Given(
  'an unconfigured project whose default installation requires network access',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When('the user runs the canonical install command offline', function (this: UnifiedInstallWorld) {
  runInstall(this, ['--offline']);
});

Then('no project profile or Cursor effect occurs', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
});

Then('an online next action is reported', function (this: UnifiedInstallWorld) {
  const result = JSON.parse(this.result.stdout) as { next_actions?: { command?: string }[] };
  assert.equal(
    result.next_actions?.some(action => action.command === 'safeword install'),
    true,
  );
});

Given(
  'an unconfigured project with all agent hosts available',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When(
  'the user installs with agents {string}',
  function (this: UnifiedInstallWorld, agents: string) {
    this.selectedAgents = agents.split(',');
    runInstall(this, ['--agents', agents]);
  },
);

Then('core project configuration is installed', function (this: UnifiedInstallWorld) {
  assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
});

Then(
  'exactly the {string} integrations are changed',
  function (this: UnifiedInstallWorld, agents: string) {
    const selected = new Set(agents.split(','));
    assert.equal(
      readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'),
      selected.has('claude') ? 'enabled' : 'absent',
    );
    assert.equal(
      readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'),
      selected.has('codex') ? 'enabled' : 'absent',
    );
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(
      directoryDigest(nodePath.join(project, '.cursor')) === this.cursorBefore,
      !selected.has('cursor'),
    );
  },
);

Given(
  'an unconfigured project whose core dependencies and Cursor assets are locally available',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When(
  'the user installs offline with agents {string}',
  function (this: UnifiedInstallWorld, agents: string) {
    runInstall(this, ['--offline', '--agents', agents]);
  },
);

Then(
  'core project configuration and Cursor assets are installed without a network effect',
  function (this: UnifiedInstallWorld) {
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.notEqual(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
    const result = JSON.parse(this.result.stdout) as { effects?: { network?: unknown[] } };
    assert.deepEqual(result.effects?.network, []);
  },
);

Then('Claude and Codex are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'absent');
});

Given(
  'a configured project with one profile action required',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, ['--agents', 'none']);
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
  },
);

When('the user compares canonical status with doctor', function (this: UnifiedInstallWorld) {
  this.statusEnvelope = runJsonCommand(this, 'status');
  this.doctorEnvelope = runJsonCommand(this, 'doctor');
});

Then('both report the same health state', function (this: UnifiedInstallWorld) {
  assert.equal(this.statusEnvelope?.state, this.doctorEnvelope?.state);
});

Then(
  'only doctor includes causal diagnostics and coverage detail',
  function (this: UnifiedInstallWorld) {
    const statusData = this.statusEnvelope?.data as Record<string, unknown> | undefined;
    const doctorData = this.doctorEnvelope?.data as Record<string, unknown> | undefined;
    assert.equal(statusData?.diagnostics, undefined);
    assert.equal(statusData?.coverage, undefined);
    assert.ok(Array.isArray(doctorData?.diagnostics));
    assert.ok(Array.isArray(doctorData?.coverage));
  },
);

Given('the public command catalogue and handlers', () => {
  // The executable catalogue is exercised by the command comparison below.
});

When('command contracts are validated', function (this: UnifiedInstallWorld) {
  if (this.projectRoot === undefined) initializeHosts(this);
  this.statusEnvelope = runJsonCommand(this, 'status');
  this.doctorEnvelope = runJsonCommand(this, 'doctor');
});

Then(
  'status and doctor have distinct executable fixtures and observable output',
  function (this: UnifiedInstallWorld) {
    assert.notDeepEqual(this.statusEnvelope, this.doctorEnvelope);
  },
);

Given('a default unified installation', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  runInstall(this, []);
  assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
  this.fixtureBefore = directoryDigest(requiredPath(this.fixtureRoot, 'fixture root'));
});

When('the user runs uninstall without confirmation', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall']);
});

Then(
  'an exact plan covers core Claude and Codex but not Cursor',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
    const envelope = JSON.parse(this.result.stdout) as {
      data?: { plan?: { id?: string }; surfaces?: { name?: string }[] };
    };
    assert.match(envelope.data?.plan?.id ?? '', /^[a-f\d]{64}$/u);
    assert.deepEqual(
      envelope.data?.surfaces?.map(surface => surface.name),
      ['project', 'claude', 'codex'],
    );
  },
);

Then('no state is changed', function (this: UnifiedInstallWorld) {
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
});

Given(
  'an exact uninstall plan and unrelated project and profile content',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
    const project = requiredPath(this.projectRoot, 'project root');
    writeFileSync(nodePath.join(project, 'CUSTOM.md'), 'customer project content\n');
    const profilePath = nodePath.join(
      requiredPath(this.fixtureRoot, 'fixture root'),
      'profile/customer.txt',
    );
    writeFileSync(profilePath, 'customer profile content\n');
    this.unrelatedProfilePath = profilePath;
    runRawCommand(this, ['uninstall']);
    const envelope = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
    this.planId = envelope.data?.plan?.id;
    assert.match(this.planId ?? '', /^[a-f\d]{64}$/u);
  },
);

When('the user confirms that exact plan', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall', '--yes', '--plan', requiredPath(this.planId, 'plan id')]);
});

Then('only recognized Safe Word-owned state is removed', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), false);
  assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'absent');
  assert.equal(
    readFileSync(nodePath.join(project, 'CUSTOM.md'), 'utf8'),
    'customer project content\n',
  );
  assert.equal(
    readFileSync(requiredPath(this.unrelatedProfilePath, 'profile customer content'), 'utf8'),
    'customer profile content\n',
  );
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Then(
  'backup and recovery actions are reported where required',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as { recovery?: { command?: string }[] };
    assert.equal(
      envelope.recovery?.some(action => action.command === 'safeword install --agents=claude'),
      true,
    );
    assert.equal(
      envelope.recovery?.some(action => action.command === 'safeword install --agents=codex'),
      true,
    );
  },
);

Given(
  'selected state changed after an uninstall plan was previewed',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    runRawCommand(this, ['uninstall']);
    const envelope = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
    this.planId = envelope.data?.plan?.id;
    assert.match(this.planId ?? '', /^[a-f\d]{64}$/u);
    writeFileSync(requiredPath(this.claudeState, 'Claude state'), 'absent');
    this.fixtureBefore = directoryDigest(requiredPath(this.fixtureRoot, 'fixture root'));
    this.unifiedUninstall = true;
  },
);

Then('no removal occurs and a fresh plan is required', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
  const envelope = JSON.parse(this.result.stdout) as {
    findings?: { code?: string }[];
    next_actions?: { command?: string }[];
  };
  assert.equal(
    envelope.findings?.some(finding => finding.code === 'PLAN_STALE'),
    true,
  );
  assert.equal(
    envelope.next_actions?.some(action => action.command === 'safeword uninstall'),
    true,
  );
});

Given('an exact uninstall plan has not been confirmed', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  runInstall(this, []);
  this.fixtureBefore = directoryDigest(requiredPath(this.fixtureRoot, 'fixture root'));
});

When('the user runs uninstall without input', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall', '--no-input']);
});

Then('the plan is reported without applying any removal', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
  const envelope = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
  assert.match(envelope.data?.plan?.id ?? '', /^[a-f\d]{64}$/u);
});

Given(
  'an installation state with agents {string}',
  function (this: UnifiedInstallWorld, agents: string) {
    initializeHosts(this);
    this.selectedAgents = agents === 'none' ? [] : agents.split(',');
    this.fixtureBefore = directoryDigest(requiredPath(this.fixtureRoot, 'fixture root'));
  },
);

When(
  'the user previews {string} for that selection',
  function (this: UnifiedInstallWorld, operation: string) {
    this.lifecycleOperation = operation;
    const agents = this.selectedAgents?.length === 0 ? 'none' : this.selectedAgents?.join(',');
    runRawCommand(this, ['plan', operation, '--agents', requiredPath(agents, 'selected agents')]);
  },
);

Then(
  'project profile network destructive and manual effects are declared when applicable',
  function (this: UnifiedInstallWorld) {
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
    const envelope = JSON.parse(this.result.stdout) as LifecyclePlanEnvelope;
    assert.equal(envelope.data.plan.command, this.lifecycleOperation);
    assert.deepEqual(
      envelope.data.surfaces.map(surface => surface.name),
      ['project', ...(this.selectedAgents ?? [])],
    );
    assertSelectedProfilePlan(this.lifecycleOperation, this.selectedAgents ?? [], envelope);
  },
);

Then('no effect is applied', function (this: UnifiedInstallWorld) {
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
});

Given('an unconfigured project', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
});

Then('the selector error names the supported values', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 1);
  assert.match(this.result.stdout, /claude, codex, cursor, or none/u);
});

Then('no project or agent effect occurs', function (this: UnifiedInstallWorld) {
  assert.equal(directoryDigest(requiredPath(this.fixtureRoot, 'fixture root')), this.fixtureBefore);
});

Given(
  'an unconfigured project with the Claude host available',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

Then(
  'core project configuration and Claude are installed once',
  function (this: UnifiedInstallWorld) {
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    const envelope = JSON.parse(this.result.stdout) as { data?: { selected_agents?: string[] } };
    assert.deepEqual(envelope.data?.selected_agents, ['claude']);
  },
);

Then('Codex and Cursor are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'absent');
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Given(
  'an unconfigured project whose core assets are locally available',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

Then(
  'core project configuration is installed without a network effect',
  function (this: UnifiedInstallWorld) {
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    const envelope = JSON.parse(this.result.stdout) as { effects?: { network?: unknown[] } };
    assert.deepEqual(envelope.effects?.network, []);
  },
);

Then('every agent integration is unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'absent');
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Given(
  'an installation whose selected effects require no destructive consent',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When('the user installs without input', function (this: UnifiedInstallWorld) {
  runInstall(this, ['--no-input']);
});

Then('the selected installation completes without prompting', function (this: UnifiedInstallWorld) {
  assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
  assert.doesNotMatch(this.result.stderr, /\?/u);
});

Then(
  'the selector error explains that none must be used alone',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.match(this.result.stdout, /none.*used alone/u);
  },
);

Given('a project with customer-owned Cursor configuration', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
});

Then('every Cursor file remains byte-for-byte unchanged', function (this: UnifiedInstallWorld) {
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Given('a project with no Cursor configuration', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  const project = requiredPath(this.projectRoot, 'project root');
  rmSync(nodePath.join(project, '.cursor'), { recursive: true, force: true });
  this.cursorBefore = 'missing';
});

Then('no Cursor file or directory is created', function (this: UnifiedInstallWorld) {
  const project = requiredPath(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.cursor')), false);
});

Then(
  'core project configuration and Safe Word-owned Cursor assets are installed',
  function (this: UnifiedInstallWorld) {
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(existsSync(nodePath.join(project, '.cursor')), true);
  },
);

Then('Claude and Codex profiles are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'absent');
});

Given(
  'a project with customer and third-party Cursor configuration',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    const project = requiredPath(this.projectRoot, 'project root');
    writeFileSync(nodePath.join(project, '.cursor/third-party.json'), '{"owner":"third-party"}\n');
  },
);

Then(
  'Safe Word Cursor entries are reconciled without replacing unrelated content',
  function (this: UnifiedInstallWorld) {
    const project = requiredPath(this.projectRoot, 'project root');
    assert.equal(
      readFileSync(nodePath.join(project, '.cursor/customer.json'), 'utf8'),
      '{"ownedBy":"customer"}\n',
    );
    assert.equal(
      readFileSync(nodePath.join(project, '.cursor/third-party.json'), 'utf8'),
      '{"owner":"third-party"}\n',
    );
  },
);

Given(
  'setup is a retained compatibility route for non-destructive install',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When('the user runs setup with yes', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['setup', '--yes']);
});

Then(
  'unified installation runs without inferring additional consent',
  function (this: UnifiedInstallWorld) {
    assert.notEqual(this.result.exitCode, 1, this.result.stderr || this.result.stdout);
    assert.equal(readFileSync(requiredPath(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    assert.equal(readFileSync(requiredPath(this.codexState, 'Codex state'), 'utf8'), 'enabled');
  },
);

Then(
  'compatibility guidance reports that yes is redundant and names install',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      findings?: { code?: string; message?: string; metadata?: Record<string, unknown> }[];
    };
    assert.equal(
      envelope.findings?.some(
        finding =>
          finding.code === 'CLI_OPTION_REDUNDANT' &&
          finding.message?.includes('--yes') === true &&
          finding.metadata?.replacement === 'install',
      ),
      true,
    );
  },
);
