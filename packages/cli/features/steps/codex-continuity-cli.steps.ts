/* eslint-disable security/detect-non-literal-regexp, sonarjs/no-nested-conditional, unicorn/max-nested-calls, unicorn/no-null, unicorn/no-unreadable-for-of-expression, unicorn/prefer-else-if -- acceptance fixtures keep each Gherkin operation visible beside its real filesystem/CLI assertion */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  applyCodexFinalization,
  type CodexFinalizationMutation,
} from '../../src/codex-plugin/finalization.ts';
import { observeCodexHostProcesses } from '../../src/codex-plugin/host-process.ts';
import {
  type CodexHostProcessIdentity,
  type CodexPluginHookEvent,
  currentCodexPluginIdentity,
  recordCodexHookProof,
} from '../../src/codex-plugin/profile-proof.ts';
import { codexProjectBootstrapContent } from '../../src/codex-plugin/project-bootstrap.ts';
import { SAFEWORD_SCHEMA } from '../../src/schema.ts';
import type { CliResult, SafewordWorld } from './world.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const INSTALLING_HOST: CodexHostProcessIdentity = {
  pid: 100,
  started_at: '2026-08-02T08:00:00.000Z',
};
const RESTARTED_HOST: CodexHostProcessIdentity = {
  pid: 200,
  started_at: '2026-08-02T09:00:00.000Z',
};
const LEGACY_CONFIG = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'
`;
const POST_TOOL_CONFIG = `[[hooks.PostToolUse]]
[[hooks.PostToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/post-tool-quality.ts"'
`;
const CUSTOM_CONFIG = `
[mcp_servers.custom]
command = "custom-mcp"
`;

interface ContinuityCliWorld extends SafewordWorld {
  continuityRoot?: string;
  migrationDirectory?: string;
  continuityProfile?: string;
  continuityBin?: string;
  continuityEnvironment?: NodeJS.ProcessEnv;
  continuityBaseline?: Record<string, string>;
  continuityFirstResult?: CliResult;
  logicalLegacyExecutions?: number;
  logicalPluginExecutions?: number;
  bootstrapContent?: string;
  runCodexStatus?: () => CliResult;
  finalizationError?: Error;
  finalizationMutations?: CodexFinalizationMutation[];
  recoveryConflictPath?: string;
  expectedState?: string;
  secondRunBaseline?: { project: Record<string, string>; profile: Record<string, string> };
  unsafeFinalization?: boolean;
  pendingMarkerPath?: string;
}

type FakePluginState = 'absent' | 'enabled' | 'disabled';

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function marketplaceStateForPluginState(state: FakePluginState): string {
  return state === 'absent' ? 'absent' : 'git';
}

function initialize(
  world: ContinuityCliWorld,
  options: {
    config?: string;
    pluginState?: FakePluginState;
    pluginVersion?: string | null;
    legacyRuntime?: boolean;
    enrolled?: boolean;
  } = {},
): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-continuity-'));
  const project = nodePath.join(root, 'project');
  const profile = nodePath.join(root, 'profile');
  const bin = nodePath.join(root, 'bin');
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  mkdirSync(profile, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword/version'), '0.69.0\n');
  if (options.enrolled !== false) {
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# enrolled\n');
  }
  if (options.config !== undefined) {
    mkdirSync(nodePath.join(project, '.codex'), { recursive: true });
    writeFileSync(nodePath.join(project, '.codex/config.toml'), options.config);
  }
  if (options.legacyRuntime === true) {
    mkdirSync(nodePath.join(project, '.safeword/hooks/codex'), { recursive: true });
    writeFileSync(
      nodePath.join(project, '.safeword/hooks/codex/pre-tool-quality.ts'),
      '// legacy PreToolUse\n',
    );
    writeFileSync(
      nodePath.join(project, '.safeword/hooks/codex/post-tool-quality.ts'),
      '// legacy PostToolUse\n',
    );
  }
  writeFileSync(nodePath.join(profile, 'plugin-state'), options.pluginState ?? 'enabled');
  writeFileSync(
    nodePath.join(profile, 'marketplace-state'),
    marketplaceStateForPluginState(options.pluginState ?? 'enabled'),
  );
  writeFileSync(
    nodePath.join(profile, 'plugin-version'),
    options.pluginVersion === null ? '' : (options.pluginVersion ?? SAFEWORD_SCHEMA.version),
  );
  writeExecutable(
    nodePath.join(bin, 'codex'),
    `#!/bin/sh
set -eu
state="$CODEX_HOME/plugin-state"
version_state="$CODEX_HOME/plugin-version"
marketplace_state="$CODEX_HOME/marketplace-state"
printf '%s\n' "$*" >> "$SAFEWORD_CODEX_COMMAND_LOG"
case "$*" in
  '--version') echo 'codex 0.141.0' ;;
  'plugin marketplace list --json')
    if [ "\${SAFEWORD_FAIL_MARKETPLACE_LIST:-0}" = "1" ]; then
      echo 'marketplace observation failed' >&2
      exit 7
    fi
    if [ "$(cat "$marketplace_state")" = "git" ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"git","source":"https://github.com/ArcadeAI/safeword.git"}}]}'
    else
      echo '{"marketplaces":[]}'
    fi
    ;;
  'plugin marketplace upgrade safeword --json')
    if [ "\${SAFEWORD_FAIL_MARKETPLACE_UPGRADE:-0}" = "1" ]; then
      echo 'marketplace refresh failed' >&2
      exit 6
    fi
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin marketplace add '*)
    if [ "\${SAFEWORD_FAIL_PLUGIN_INSTALL:-0}" = "1" ]; then
      echo 'marketplace unavailable' >&2
      exit 9
    fi
    printf 'git' > "$marketplace_state"
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin add safeword@safeword --json')
    printf 'enabled' > "$state"
    printf '%s' "$SAFEWORD_FAKE_PLUGIN_VERSION" > "$version_state"
    echo '{"pluginId":"safeword@safeword"}'
    ;;
  'plugin list --json')
    if [ "\${SAFEWORD_FAIL_PLUGIN_VERIFY:-0}" = "1" ]; then
      echo 'profile observation failed' >&2
      exit 8
    fi
    mode="$(cat "$state")"
    version="$(cat "$version_state" 2>/dev/null || true)"
    if [ "$mode" = "absent" ]; then
      echo '{"installed":[]}'
    elif [ "$mode" = "disabled" ]; then
      if [ -n "$version" ]; then
        printf '{"installed":[{"pluginId":"safeword@safeword","enabled":false,"version":"%s"}]}\n' "$version"
      else
        echo '{"installed":[{"pluginId":"safeword@safeword","enabled":false}]}'
      fi
    else
      if [ -n "$version" ]; then
        printf '{"installed":[{"pluginId":"safeword@safeword","enabled":true,"version":"%s"}]}\n' "$version"
      else
        echo '{"installed":[{"pluginId":"safeword@safeword","enabled":true}]}'
      fi
    fi
    ;;
  *) exit 2 ;;
esac
`,
  );
  writeExecutable(
    nodePath.join(bin, 'bun'),
    String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$SAFEWORD_PACKAGED_HOOK_LOG"
exit 0
`,
  );
  world.continuityRoot = root;
  world.migrationDirectory = project;
  world.temporaryDirectory = project;
  world.continuityProfile = profile;
  world.continuityBin = bin;
  world.continuityEnvironment = {
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    CODEX_HOME: profile,
    CLAUDE_PROJECT_DIR: project,
    SAFEWORD_FAKE_PLUGIN_VERSION: SAFEWORD_SCHEMA.version,
    SAFEWORD_PACKAGED_HOOK_LOG: nodePath.join(root, 'packaged-hooks.log'),
    SAFEWORD_CODEX_COMMAND_LOG: nodePath.join(root, 'codex-commands.log'),
  };
  world.runCodexStatus = () => run(world, ['codex', 'status', '--json']);
}

function requireProject(world: ContinuityCliWorld): string {
  assert.ok(world.migrationDirectory, 'Codex continuity fixture was not initialized');
  return world.migrationDirectory;
}

function requireProfile(world: ContinuityCliWorld): string {
  assert.ok(world.continuityProfile, 'Codex profile fixture was not initialized');
  return world.continuityProfile;
}

function run(
  world: ContinuityCliWorld,
  arguments_: string[],
  environment: NodeJS.ProcessEnv = {},
  input = '',
): CliResult {
  const result = spawnSync(process.execPath, [CLI_PATH, ...arguments_], {
    cwd: requireProject(world),
    env: { ...process.env, ...world.continuityEnvironment, ...environment },
    input,
    encoding: 'utf8',
  });
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
  return world.result;
}

function runPlannedFinalization(
  world: ContinuityCliWorld,
  flag: '--finalize' | '--remove-legacy-hooks' = '--finalize',
): CliResult {
  const preview = run(world, ['codex', 'migrate', flag, '--json']);
  const envelope = JSON.parse(preview.stdout) as { data?: { plan?: { id?: string } } };
  const planId = envelope.data?.plan?.id;
  assert.ok(planId, `finalization preview did not return a plan: ${preview.stdout}`);
  return run(world, ['codex', 'migrate', flag, '--yes', '--plan', planId]);
}

function runPlannedRecovery(world: ContinuityCliWorld): CliResult {
  const preview = run(world, ['codex', 'recover', '--json']);
  const envelope = JSON.parse(preview.stdout) as {
    data?: { plan?: { id?: string } };
    errors?: { code?: string }[];
  };
  if (envelope.errors?.length) return preview;
  const planId = envelope.data?.plan?.id;
  assert.ok(planId, `recovery preview did not return a plan: ${preview.stdout}`);
  return run(world, ['codex', 'recover', '--yes', '--plan', planId]);
}

function observeMigrationState(world: ContinuityCliWorld): string {
  const previous = world.result;
  const observed = run(world, ['codex', 'status', '--json']);
  world.result = previous;
  assert.ok(
    observed.exitCode === 0 || observed.exitCode === 2,
    `unexpected Codex status exit ${observed.exitCode}: ${observed.stdout}${observed.stderr}`,
  );
  const envelope = JSON.parse(observed.stdout) as {
    data?: { migration?: { schema_version?: string; state?: string } };
  };
  assert.equal(envelope.data?.migration?.schema_version, '2');
  assert.ok(envelope.data.migration.state);
  return envelope.data.migration.state;
}

function snapshot(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = nodePath.join(current, entry.name);
      const relative = nodePath.relative(directory, absolute);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isSymbolicLink())
        result[relative] = `symlink:${readFileSync(absolute, 'utf8')}`;
      else result[relative] = readFileSync(absolute).toString('base64');
    }
  };
  visit(directory);
  return result;
}

function rememberBaseline(world: ContinuityCliWorld): void {
  world.continuityBaseline = snapshot(requireProject(world));
}

function assertRepoUnchanged(world: ContinuityCliWorld): void {
  assert.deepEqual(snapshot(requireProject(world)), world.continuityBaseline);
}

function proofPath(world: ContinuityCliWorld): string {
  return nodePath.join(requireProfile(world), 'safeword/hook-proof-v2/session-start.json');
}

function activationMarkerPath(world: ContinuityCliWorld): string {
  return nodePath.join(requireProfile(world), 'safeword/activation-pending-v2.json');
}

function legacyRestartMarkerPath(world: ContinuityCliWorld): string {
  return nodePath.join(requireProfile(world), 'safeword/restart-pending-v1.json');
}

function commandLog(world: ContinuityCliWorld): string {
  const root = world.continuityRoot;
  assert.ok(root);
  return readFileSync(nodePath.join(root, 'codex-commands.log'), 'utf8');
}

function pendingMarkerPayload(options: {
  legacy?: boolean;
  version?: string;
  manifest?: string;
  activeHosts?: CodexHostProcessIdentity[];
}): object {
  const identity = currentCodexPluginIdentity();
  const pluginIdentity = {
    plugin_version: options.version ?? identity.plugin_version,
    manifest_sha256: options.manifest ?? identity.manifest_sha256,
  };
  if (options.legacy === true) return { schema_version: 1, ...pluginIdentity };
  const observedCurrentHost = observeCodexHostProcesses().current;
  return {
    schema_version: 2,
    ...pluginIdentity,
    activation_id: 'acceptance-activation',
    installed_at: '2026-08-02T08:30:00.000Z',
    host_observation: 'observed',
    active_hosts:
      options.activeHosts ??
      (observedCurrentHost === null ? [INSTALLING_HOST] : [observedCurrentHost]),
  };
}

function writePendingMarker(
  world: ContinuityCliWorld,
  options: {
    legacy?: boolean;
    version?: string;
    manifest?: string;
    activeHosts?: CodexHostProcessIdentity[];
  } = {},
): string {
  const path =
    options.legacy === true ? legacyRestartMarkerPath(world) : activationMarkerPath(world);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(pendingMarkerPayload(options))}\n`, { mode: 0o600 });
  world.pendingMarkerPath = path;
  return path;
}

function recordEventProofForHost(
  world: ContinuityCliWorld,
  event: CodexPluginHookEvent,
  currentHost: CodexHostProcessIdentity,
): void {
  recordCodexHookProof(event, world.continuityEnvironment, new Date('2026-08-02T09:01:00.000Z'), {
    currentHost,
  });
}

function recordEventProofThroughCli(world: ContinuityCliWorld, event: CodexPluginHookEvent): void {
  const result = run(world, ['hook', 'codex', event, '--plugin-hook'], {}, '{}\n');
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
}

function recordCurrentProof(world: ContinuityCliWorld): void {
  for (const event of [
    'session-start',
    'pre-tool-use',
    'post-tool-use',
    'user-prompt-submit',
    'stop',
  ] as const) {
    recordEventProofThroughCli(world, event);
  }
}

function pluginMarkerContent(): string {
  return `${JSON.stringify({
    schema_version: 1,
    mode: 'plugin',
    finalized_at: '2026-07-28T00:00:00.000Z',
  })}\n`;
}

function transactionMutations(): CodexFinalizationMutation[] {
  return [
    { path: '.codex/config.toml', content: CUSTOM_CONFIG.trimStart() },
    { path: '.safeword/hooks/codex/pre-tool-quality.ts', content: null },
    { path: '.safeword/codex-plugin.json', content: pluginMarkerContent() },
    {
      path: '.agents/skills/safeword-plugin-setup/SKILL.md',
      content: '# Install the Safeword Codex plugin\n',
    },
  ];
}

function initializeFinalizationFixture(world: ContinuityCliWorld, custom = false): void {
  writeLegacyFixture(world, custom, 'enabled');
  recordCurrentProof(world);
  world.finalizationMutations = transactionMutations();
  rememberBaseline(world);
}

function createPreparedBackup(
  world: ContinuityCliWorld,
  options: { applyFirstMutation?: boolean } = {},
): void {
  const project = requireProject(world);
  const mutations = world.finalizationMutations ?? transactionMutations();
  try {
    applyCodexFinalization(project, mutations, {
      afterPrepared: () => {
        if (options.applyFirstMutation && mutations[0]?.content != null) {
          writeFileSync(nodePath.join(project, mutations[0].path), mutations[0].content);
        }
        throw new Error('simulated process crash');
      },
    });
  } catch (error) {
    world.finalizationError = error as Error;
  }
}

function writeLegacyFixture(
  world: ContinuityCliWorld,
  custom = false,
  pluginState: 'absent' | 'enabled' | 'disabled' = 'enabled',
): void {
  initialize(world, {
    config: `${LEGACY_CONFIG}${custom ? CUSTOM_CONFIG : ''}`,
    pluginState,
    legacyRuntime: true,
  });
  mkdirSync(nodePath.join(requireProject(world), '.agents/skills/review-spec'), {
    recursive: true,
  });
  writeFileSync(
    nodePath.join(requireProject(world), '.agents/skills/review-spec/SKILL.md'),
    '# legacy workflow\n',
  );
}

After(function (this: ContinuityCliWorld) {
  if (!this.continuityRoot) {
    return;
  }

  rmSync(this.continuityRoot, { recursive: true, force: true });
  this.continuityRoot = undefined;
  this.migrationDirectory = undefined;
});

Given(
  'a configured project with recognized legacy Codex hooks and workflow assets',
  function (this: ContinuityCliWorld) {
    writeLegacyFixture(this, false, 'absent');
    rememberBaseline(this);
  },
);

Given(
  'a configured project with recognized legacy Codex protection',
  function (this: ContinuityCliWorld) {
    writeLegacyFixture(this, false, 'absent');
    rememberBaseline(this);
  },
);

Given(
  'the active Codex profile cannot install the Safeword plugin',
  function (this: ContinuityCliWorld) {
    this.continuityEnvironment = {
      ...this.continuityEnvironment,
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    };
  },
);

Given(
  'plugin installation succeeds before a later Codex verification command fails',
  function (this: ContinuityCliWorld) {
    this.continuityEnvironment = {
      ...this.continuityEnvironment,
      SAFEWORD_FAIL_PLUGIN_VERIFY: '1',
    };
  },
);

Given(
  'the active Codex profile does not contain the Safeword plugin',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'absent' });
    rememberBaseline(this);
  },
);

Given(
  'the active Codex profile reports the Safeword plugin enabled',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
  },
);

Given(
  'the active Codex profile reports an enabled older Safeword plugin',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled', pluginVersion: '0.68.0' });
  },
);

Given('no current profile hook proof exists', function (this: ContinuityCliWorld) {
  assert.equal(existsSync(proofPath(this)), false);
});

When('the builder migrates Codex', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'migrate']);
});

When(
  'the builder upgrades only the Safeword project with legacy Codex protection',
  function (this: ContinuityCliWorld) {
    run(this, ['upgrade', '--agents', 'none', '--no-migrate-namespace']);
  },
);

When('the builder migrates Codex and installation succeeds', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'migrate']);
});

Then(
  'the legacy Codex assets remain protected and automatic enrollment is added',
  function (this: ContinuityCliWorld) {
    assert.equal(
      readFileSync(nodePath.join(requireProject(this), '.codex/config.toml'), 'utf8'),
      codexProjectBootstrapContent(LEGACY_CONFIG),
    );
    assert.equal(
      readFileSync(
        nodePath.join(requireProject(this), '.agents/skills/review-spec/SKILL.md'),
        'utf8',
      ),
      '# legacy workflow\n',
    );
    const status = run(this, ['codex', 'status']);
    assert.match(status.stdout, /Next: safeword codex migrate/u);
  },
);

Then('migration fails without changing the repository', function (this: ContinuityCliWorld) {
  assert.equal(this.result.exitCode, 1);
  assertRepoUnchanged(this);
});

Then(
  'migration reports installation succeeded, enablement is unknown, and the repository is unchanged',
  function (this: ContinuityCliWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.match(`${this.result.stdout}\n${this.result.stderr}`, /enablement is unknown/u);
    assertRepoUnchanged(this);
  },
);

Then(
  'migration reports plugin_installed_app_restart_required and changes no repository file',
  function (this: ContinuityCliWorld) {
    assert.equal(this.result.exitCode, 2);
    assert.equal(observeMigrationState(this), 'plugin_installed_app_restart_required');
    assertRepoUnchanged(this);
  },
);

Then(
  'the profile contains an activation marker bound to the installed version and hook manifest',
  function (this: ContinuityCliWorld) {
    const marker = JSON.parse(readFileSync(activationMarkerPath(this), 'utf8')) as {
      schema_version: number;
      plugin_version: string;
      manifest_sha256: string;
    };
    assert.equal(marker.schema_version, 2);
    assert.ok(marker.plugin_version.length > 0);
    assert.match(marker.manifest_sha256, /^[\da-f]{64}$/u);
  },
);

Given('a profile with a current activation-pending marker', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'absent' });
  const install = run(this, ['codex', 'migrate']);
  assert.equal(install.exitCode, 2);
  assert.equal(existsSync(activationMarkerPath(this)), true);
});

Given(
  'the Safeword profile-plugin SessionStart dispatcher is trusted',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
  },
);

When(
  'Codex invokes the marked profile-plugin SessionStart dispatcher',
  function (this: ContinuityCliWorld) {
    recordEventProofThroughCli(this, 'session-start');
  },
);

When('Codex invokes it with the plugin-hook marker', function (this: ContinuityCliWorld) {
  recordEventProofThroughCli(this, 'session-start');
});

Then(
  'same-host proof preserves the activation marker and status still requires an app restart',
  function (this: ContinuityCliWorld) {
    assert.equal(existsSync(proofPath(this)), true);
    assert.equal(existsSync(activationMarkerPath(this)), true);
    assert.equal(observeMigrationState(this), 'plugin_installed_app_restart_required');
    const status = run(this, ['codex', 'status']);
    assert.match(status.stdout, /Fully restart Codex.+resume this task/isu);
  },
);

Then(
  'the profile contains schema 2 proof with the running version, exact manifest digest, and a parseable UTC timestamp',
  function (this: ContinuityCliWorld) {
    const proof = JSON.parse(readFileSync(proofPath(this), 'utf8')) as {
      schema_version: number;
      plugin_version: string;
      manifest_sha256: string;
      recorded_at: string;
    };
    assert.equal(proof.schema_version, 2);
    assert.ok(proof.plugin_version.length > 0);
    assert.match(proof.manifest_sha256, /^[\da-f]{64}$/u);
    assert.ok(!Number.isNaN(Date.parse(proof.recorded_at)));
    assert.match(proof.recorded_at, /Z$/u);
  },
);

Given(
  'the Safeword profile-plugin SessionStart proof write is interrupted',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    const directory = nodePath.dirname(proofPath(this));
    mkdirSync(directory, { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword-interrupted.tmp'), '{"schema_version":1');
  },
);

Then('no partial or malformed proof is accepted as current', function (this: ContinuityCliWorld) {
  assert.equal(existsSync(proofPath(this)), false);
});

Given(
  /^profile hook proof differs from the running plugin by (.+)$/u,
  function (this: ContinuityCliWorld, difference: string) {
    initialize(this, { pluginState: 'enabled' });
    recordCurrentProof(this);
    const path = proofPath(this);
    if (difference === 'malformed JSON') {
      writeFileSync(path, '{malformed');
      return;
    }
    const proof = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    if (difference === 'package version') proof.plugin_version = '0.0.0';
    if (difference === 'hook manifest digest') proof.manifest_sha256 = '0'.repeat(64);
    if (difference === 'proof schema') proof.schema_version = 3;
    if (difference === 'missing fields') delete proof.manifest_sha256;
    writeFileSync(path, JSON.stringify(proof));
  },
);

Given('a project-local legacy SessionStart dispatcher', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'enabled' });
});

Given('a Codex profile whose status observation fails', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'enabled' });
  this.continuityEnvironment = {
    ...this.continuityEnvironment,
    SAFEWORD_FAIL_PLUGIN_VERIFY: '1',
  };
});

When('Codex invokes it without the plugin-hook marker', function (this: ContinuityCliWorld) {
  run(this, ['hook', 'codex', 'session-start'], {}, '{"hook_event_name":"SessionStart"}\n');
});

Then('no profile hook proof is written', function (this: ContinuityCliWorld) {
  assert.equal(existsSync(proofPath(this)), false);
});

Given(
  'current plugin proof and configured project and profile handlers for PostToolUse',
  function (this: ContinuityCliWorld) {
    initialize(this, {
      config: POST_TOOL_CONFIG,
      pluginState: 'enabled',
      legacyRuntime: true,
    });
    recordCurrentProof(this);
    rmSync(nodePath.join(requireProfile(this), 'safeword/hook-proof-v2/post-tool-use.json'));
  },
);

Given(
  'current plugin proof and legacy protection without a PostToolUse handler',
  function (this: ContinuityCliWorld) {
    initialize(this, {
      config: LEGACY_CONFIG,
      pluginState: 'enabled',
      legacyRuntime: true,
    });
    recordCurrentProof(this);
  },
);

Given(
  /^current plugin proof and a recognized legacy PostToolUse handler whose runtime is (.+)$/u,
  function (this: ContinuityCliWorld, runtimeState: string) {
    initialize(this, {
      config:
        runtimeState === 'backed by an unavailable package runner'
          ? `[[hooks.PostToolUse]]
[[hooks.PostToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex post-tool-use'
`
          : POST_TOOL_CONFIG,
      pluginState: 'enabled',
    });
    const runtime = nodePath.join(
      requireProject(this),
      '.safeword/hooks/codex/post-tool-quality.ts',
    );
    mkdirSync(nodePath.dirname(runtime), { recursive: true });
    if (runtimeState === 'a symbolic link') {
      const target = nodePath.join(requireProject(this), 'linked-runtime.ts');
      writeFileSync(target, '// linked runtime\n');
      symlinkSync(target, runtime);
    }
    recordCurrentProof(this);
    if (runtimeState === 'backed by an unavailable package runner') {
      const bunOnly = nodePath.join(this.continuityRoot ?? '', 'bun-only');
      mkdirSync(bunOnly);
      assert.ok(this.continuityBin);
      symlinkSync(nodePath.join(this.continuityBin, 'bun'), nodePath.join(bunOnly, 'bun'));
      this.continuityEnvironment = {
        ...this.continuityEnvironment,
        PATH: bunOnly,
      };
    }
  },
);

When('Codex dispatches PostToolUse through both handlers', function (this: ContinuityCliWorld) {
  const log = nodePath.join(this.continuityRoot ?? '', 'packaged-hooks.log');
  rmSync(log, { force: true });
  assert.ok(this.continuityEnvironment);
  const legacy = spawnSync(
    'bun',
    [nodePath.join(requireProject(this), '.safeword/hooks/codex/post-tool-quality.ts')],
    {
      cwd: requireProject(this),
      encoding: 'utf8',
      env: this.continuityEnvironment,
    },
  );
  assert.equal(legacy.status, 0, legacy.stderr);
  this.logicalLegacyExecutions = readFileSync(log, 'utf8').trim().split('\n').length;
  const executionsBeforePlugin = this.logicalLegacyExecutions;
  run(
    this,
    ['hook', 'codex', 'post-tool-use', '--plugin-hook'],
    {},
    '{"hook_event_name":"PostToolUse","tool_name":"custom"}\n',
  );
  const executionsAfterPlugin = readFileSync(log, 'utf8').trim().split('\n').length;
  this.logicalPluginExecutions = executionsAfterPlugin - executionsBeforePlugin;
});

When('the profile-plugin PostToolUse dispatcher runs', function (this: ContinuityCliWorld) {
  const log = nodePath.join(this.continuityRoot ?? '', 'packaged-hooks.log');
  rmSync(log, { force: true });
  run(
    this,
    ['hook', 'codex', 'post-tool-use', '--plugin-hook'],
    {},
    '{"hook_event_name":"PostToolUse","tool_name":"custom"}\n',
  );
  this.logicalPluginExecutions = existsSync(log) ? 1 : 0;
});

Then(
  'the legacy PostToolUse behavior executes exactly once and the packaged plugin behavior does not execute',
  function (this: ContinuityCliWorld) {
    assert.equal(this.logicalLegacyExecutions, 1);
    assert.equal(this.logicalPluginExecutions, 0);
  },
);

Then(
  'the profile plugin records PostToolUse proof while legacy remains authoritative',
  function (this: ContinuityCliWorld) {
    const path = nodePath.join(requireProfile(this), 'safeword/hook-proof-v2/post-tool-use.json');
    const proof = JSON.parse(readFileSync(path, 'utf8')) as { event?: string };
    assert.equal(proof.event, 'post-tool-use');
  },
);

Then('the packaged PostToolUse behavior executes', function (this: ContinuityCliWorld) {
  assert.equal(this.logicalPluginExecutions, 1);
});

Given('legacy Codex assets and stale profile hook proof', function (this: ContinuityCliWorld) {
  initializeFinalizationFixture(this);
  const proof = JSON.parse(readFileSync(proofPath(this), 'utf8')) as Record<string, unknown>;
  proof.plugin_version = '0.0.0';
  writeFileSync(proofPath(this), JSON.stringify(proof));
  rememberBaseline(this);
});

Given('legacy Codex assets and current profile hook proof', function (this: ContinuityCliWorld) {
  initializeFinalizationFixture(this);
});

Given(
  'legacy Codex assets, custom Codex content, and current profile hook proof',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this, true);
  },
);

When('the builder requests finalization', function (this: ContinuityCliWorld) {
  if (this.unsafeFinalization) {
    try {
      applyCodexFinalization(requireProject(this), this.finalizationMutations ?? []);
    } catch (error) {
      this.finalizationError = error as Error;
    }
    return;
  }
  run(this, ['codex', 'migrate', '--finalize', '--yes']);
});

When(
  'the builder leaves the displayed finalization plan unconfirmed',
  function (this: ContinuityCliWorld) {
    run(this, ['codex', 'migrate', '--finalize']);
  },
);

When('the builder confirms the displayed finalization plan', function (this: ContinuityCliWorld) {
  runPlannedFinalization(this);
});

Then(
  'finalization is rejected and every repository file remains unchanged',
  function (this: ContinuityCliWorld) {
    assert.notEqual(this.result.exitCode, 0);
    assertRepoUnchanged(this);
  },
);

Then('every repository file remains unchanged', function (this: ContinuityCliWorld) {
  assertRepoUnchanged(this);
});

Then(
  'known legacy assets are backed up and removed while custom content remains',
  function (this: ContinuityCliWorld) {
    assert.equal(this.result.exitCode, 0, `${this.result.stdout}\n${this.result.stderr}`);
    const project = requireProject(this);
    assert.equal(
      existsSync(nodePath.join(project, '.safeword/hooks/codex/pre-tool-quality.ts')),
      false,
    );
    assert.match(readFileSync(nodePath.join(project, '.codex/config.toml'), 'utf8'), /custom-mcp/u);
    assert.equal(
      existsSync(nodePath.join(project, '.safeword/codex-migration-backup/manifest.json')),
      true,
    );
  },
);

Then(
  'the repository records plugin mode and provides the setup bootstrap',
  function (this: ContinuityCliWorld) {
    const project = requireProject(this);
    const marker = JSON.parse(
      readFileSync(nodePath.join(project, '.safeword/codex-plugin.json'), 'utf8'),
    ) as { mode: string };
    assert.equal(marker.mode, 'plugin');
    assert.equal(
      existsSync(nodePath.join(project, '.agents/skills/safeword-plugin-setup/SKILL.md')),
      true,
    );
  },
);

Given(
  'a confirmed finalization whose repository mutation fails',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    try {
      applyCodexFinalization(requireProject(this), transactionMutations(), {
        beforeMutation: index => {
          if (index === 1) throw new Error('injected mutation failure');
        },
      });
    } catch (error) {
      this.finalizationError = error as Error;
    }
  },
);

Given(
  'a confirmed finalization whose repository mutation and restoration both fail',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    try {
      applyCodexFinalization(requireProject(this), transactionMutations(), {
        beforeMutation: index => {
          if (index === 1) throw new Error('injected mutation failure');
        },
        beforeRollback: () => {
          throw new Error('injected rollback failure');
        },
      });
    } catch (error) {
      this.finalizationError = error as Error;
    }
  },
);

When('Safeword handles the failure', function (this: ContinuityCliWorld) {
  assert.ok(this.finalizationError, 'failure fixture did not fail');
});

Then(
  'every prepared change is rolled back to the exact pre-migration state',
  function (this: ContinuityCliWorld) {
    assertRepoUnchanged(this);
  },
);

Then(
  'the command reports failure without reporting recovery_required',
  function (this: ContinuityCliWorld) {
    assert.match(this.finalizationError?.message ?? '', /injected mutation failure/u);
    assert.equal(
      existsSync(nodePath.join(requireProject(this), '.safeword/codex-migration-backup')),
      false,
    );
    const status = run(this, ['codex', 'status']);
    assert.doesNotMatch(status.stdout, /recovery_required/u);
  },
);

Then('the backup remains and the finalized marker is absent', function (this: ContinuityCliWorld) {
  const project = requireProject(this);
  assert.equal(
    existsSync(nodePath.join(project, '.safeword/codex-migration-backup/manifest.json')),
    true,
  );
  assert.equal(existsSync(nodePath.join(project, '.safeword/codex-plugin.json')), false);
});

Then('status reports recovery_required', function (this: ContinuityCliWorld) {
  const status = run(this, ['codex', 'status']);
  assert.match(status.stdout, /recovery_required/u);
});

Given(
  'a finalized plugin-only project with current profile hook proof',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    const first = runPlannedFinalization(this);
    assert.equal(first.exitCode, 0, `${first.stdout}\n${first.stderr}`);
    rememberBaseline(this);
  },
);

When('the builder finalizes migration again', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'migrate', '--finalize', '--yes']);
});

Then('the command succeeds without changing repository files', function (this: ContinuityCliWorld) {
  assert.equal(this.result.exitCode, 0, `${this.result.stdout}\n${this.result.stderr}`);
  assertRepoUnchanged(this);
});

Given(
  /^the repository and active profile derive the (legacy|plugin_disabled|plugin_setup_required|plugin_update_required|plugin_installed_app_restart_required|plugin_enabled_hook_unproven|compatibility|not_configured) state$/u,
  function (this: ContinuityCliWorld, state: string) {
    this.expectedState = state;
    switch (state) {
      case 'legacy': {
        writeLegacyFixture(this, false, 'absent');
        break;
      }
      case 'plugin_disabled': {
        initialize(this, { pluginState: 'disabled' });
        break;
      }
      case 'plugin_setup_required': {
        initializeFinalizationFixture(this);
        const finalized = runPlannedFinalization(this);
        assert.equal(finalized.exitCode, 0);
        writeFileSync(nodePath.join(requireProfile(this), 'plugin-state'), 'absent');
        break;
      }
      case 'plugin_update_required': {
        initialize(this, { pluginState: 'enabled', pluginVersion: '0.68.0' });
        break;
      }
      case 'plugin_installed_app_restart_required': {
        initialize(this, { pluginState: 'absent' });
        const installed = run(this, ['codex', 'migrate']);
        assert.equal(installed.exitCode, 2);
        break;
      }
      case 'plugin_enabled_hook_unproven': {
        initialize(this, { pluginState: 'enabled' });
        break;
      }
      case 'compatibility': {
        writeLegacyFixture(this);
        recordCurrentProof(this);
        break;
      }
      case 'not_configured': {
        initialize(this, { pluginState: 'absent' });
        break;
      }
    }
  },
);

When('the builder migrates Codex twice', function (this: ContinuityCliWorld) {
  this.continuityFirstResult = run(this, ['codex', 'migrate']);
  this.secondRunBaseline = {
    project: snapshot(requireProject(this)),
    profile: snapshot(requireProfile(this)),
  };
  run(this, ['codex', 'migrate']);
});

Then(
  /^the second run reports ([a-z_]+) without changing repository or profile state$/u,
  function (this: ContinuityCliWorld, expectedState: string) {
    assert.equal(observeMigrationState(this), expectedState);
    assert.deepEqual(snapshot(requireProject(this)), this.secondRunBaseline?.project);
    assert.deepEqual(snapshot(requireProfile(this)), this.secondRunBaseline?.profile);
  },
);

Given(
  'a repository with an unresolved Codex migration backup',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    createPreparedBackup(this, { applyFirstMutation: true });
    rememberBaseline(this);
  },
);

Then(
  'both runs report recovery_required and change no repository file',
  function (this: ContinuityCliWorld) {
    assert.match(this.continuityFirstResult?.stdout ?? '', /recovery_required/u);
    assert.match(this.result.stdout, /recovery_required/u);
    assertRepoUnchanged(this);
  },
);

When('the builder runs Codex recovery', function (this: ContinuityCliWorld) {
  runPlannedRecovery(this);
});

Then(
  'the pre-finalization files are restored and plugin-only markers are removed',
  function (this: ContinuityCliWorld) {
    const project = requireProject(this);
    assert.match(readFileSync(nodePath.join(project, '.codex/config.toml'), 'utf8'), /PreToolUse/u);
    assert.equal(existsSync(nodePath.join(project, '.safeword/codex-plugin.json')), false);
  },
);

Then(
  'the backup is resolved and subsequent status no longer reports recovery_required',
  function (this: ContinuityCliWorld) {
    assert.equal(
      existsSync(nodePath.join(requireProject(this), '.safeword/codex-migration-backup')),
      false,
    );
    const status = run(this, ['codex', 'status']);
    assert.doesNotMatch(status.stdout, /recovery_required/u);
  },
);

Given(
  'a repository backup whose finalized output was edited afterward',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    const finalized = runPlannedFinalization(this);
    assert.equal(finalized.exitCode, 0);
    const path = nodePath.join(requireProject(this), '.codex/config.toml');
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n# intervening edit\n`);
    this.recoveryConflictPath = '.codex/config.toml';
    rememberBaseline(this);
  },
);

Then(
  'recovery reports the conflicting path and overwrites no repository file',
  function (this: ContinuityCliWorld) {
    assert.notEqual(this.result.exitCode, 0);
    const envelope = JSON.parse(this.result.stdout) as { errors?: { code?: string }[] };
    assert.equal(envelope.errors?.[0]?.code, 'RECOVERY_CONFLICT');
    assert.match(
      `${this.result.stdout}\n${this.result.stderr}`,
      new RegExp(this.recoveryConflictPath ?? '', 'u'),
    );
    assertRepoUnchanged(this);
  },
);

Given(
  /^confirmed finalization fails (.+) while rollback remains available$/u,
  function (this: ContinuityCliWorld, boundary: string) {
    initializeFinalizationFixture(this);
    const failureIndex =
      boundary === 'after backup creation'
        ? 0
        : boundary === 'after config replacement'
          ? 1
          : boundary === 'after legacy file removal'
            ? 2
            : 3;
    try {
      applyCodexFinalization(requireProject(this), transactionMutations(), {
        beforeMutation: index => {
          if (index === failureIndex) throw new Error(`failure ${boundary}`);
        },
      });
    } catch (error) {
      this.finalizationError = error as Error;
    }
  },
);

Then(
  'the exact pre-migration repository state is restored and the temporary backup is removed',
  function (this: ContinuityCliWorld) {
    assertRepoUnchanged(this);
    assert.equal(
      existsSync(nodePath.join(requireProject(this), '.safeword/codex-migration-backup')),
      false,
    );
  },
);

Given(
  /^the finalization process crashes (.+)$/u,
  function (this: ContinuityCliWorld, boundary: string) {
    initializeFinalizationFixture(this);
    createPreparedBackup(this, {
      applyFirstMutation: boundary !== 'after backup creation',
    });
  },
);

Then(
  'the contained backup remains, the finalized marker is absent, and status reports recovery_required',
  function (this: ContinuityCliWorld) {
    const project = requireProject(this);
    assert.equal(
      existsSync(nodePath.join(project, '.safeword/codex-migration-backup/manifest.json')),
      true,
    );
    assert.equal(existsSync(nodePath.join(project, '.safeword/codex-plugin.json')), false);
    assert.match(this.result.stdout, /recovery_required/u);
  },
);

Given(
  /^finalization would back up (a path outside the repository|a symbolic-link file target)$/u,
  function (this: ContinuityCliWorld, unsafeTarget: string) {
    initializeFinalizationFixture(this);
    if (unsafeTarget === 'a path outside the repository') {
      this.finalizationMutations = [{ path: '../outside.txt', content: 'unsafe\n' }];
    } else {
      const target = nodePath.join(this.continuityRoot ?? '', 'outside.txt');
      writeFileSync(target, 'outside\n');
      const link = nodePath.join(requireProject(this), 'linked.txt');
      symlinkSync(target, link);
      this.finalizationMutations = [{ path: 'linked.txt', content: 'unsafe\n' }];
    }
    this.unsafeFinalization = true;
    rememberBaseline(this);
  },
);

Then(
  'finalization is rejected before any repository mutation',
  function (this: ContinuityCliWorld) {
    assert.match(String(this.finalizationError), /Unsafe Codex migration path/u);
    assertRepoUnchanged(this);
  },
);

When(
  'the builder uses the deprecated remove-legacy-hooks alias with confirmation',
  function (this: ContinuityCliWorld) {
    runPlannedFinalization(this, '--remove-legacy-hooks');
  },
);

Given(
  'legacy Codex assets and current profile hook proof in a non-interactive shell',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
  },
);

When(
  'an agent replays the previewed Codex finalization plan with finalize and yes flags',
  function (this: ContinuityCliWorld) {
    runPlannedFinalization(this);
  },
);

Then(
  'known legacy assets are backed up and removed and status reports plugin',
  function (this: ContinuityCliWorld) {
    assert.equal(this.result.exitCode, 0, `${this.result.stdout}\n${this.result.stderr}`);
    assert.equal(
      existsSync(nodePath.join(requireProject(this), '.safeword/hooks/codex/pre-tool-quality.ts')),
      false,
    );
    const status = run(this, ['codex', 'status']);
    assert.match(status.stdout, /Codex migration state: plugin\./u);
  },
);

When('an agent previews finalization with JSON output', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'migrate', '--finalize', '--json']);
});

Then(
  'file effects include config update, legacy removal, plugin-marker creation, and bootstrap creation',
  function (this: ContinuityCliWorld) {
    const output = JSON.parse(this.result.stdout) as {
      data: { plan: { effects: { files: { target: string; kind: string }[] } } };
    };
    const files = output.data.plan.effects.files;
    assert.ok(files.some(file => file.target === '.codex/config.toml' && file.kind === 'update'));
    assert.ok(
      files.some(
        file =>
          file.target === '.safeword/hooks/codex/pre-tool-quality.ts' && file.kind === 'remove',
      ),
    );
    assert.ok(
      files.some(file => file.target === '.safeword/codex-plugin.json' && file.kind === 'create'),
    );
    assert.ok(
      files.some(
        file =>
          file.target === '.agents/skills/safeword-plugin-setup/SKILL.md' && file.kind === 'create',
      ),
    );
  },
);

Then(
  'every listed action is create, update, remove, or restore',
  function (this: ContinuityCliWorld) {
    const output = JSON.parse(this.result.stdout) as {
      data: { plan: { effects: { files: { kind: string }[] } } };
    };
    assert.ok(
      output.data.plan.effects.files.every(file =>
        ['create', 'update', 'remove', 'restore'].includes(file.kind),
      ),
    );
  },
);

Then(
  'the preview exposes a human-confirmed replay command bound to its plan id',
  function (this: ContinuityCliWorld) {
    const output = JSON.parse(this.result.stdout) as {
      data: { plan: { id: string } };
      next_actions: { command: string; mutates: boolean; requires_human: boolean }[];
    };
    assert.deepEqual(output.next_actions, [
      {
        command: `safeword codex migrate --finalize --yes --plan ${output.data.plan.id}`,
        mutates: true,
        requires_human: true,
      },
    ]);
  },
);

Given(
  'current profile proof and legacy Codex assets in a non-interactive shell',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
  },
);

When(
  /^an agent runs Codex migration with (neither flag|finalize only|yes only)$/u,
  function (this: ContinuityCliWorld, flags: string) {
    const arguments_ = ['codex', 'migrate'];
    if (flags === 'finalize only') arguments_.push('--finalize');
    if (flags === 'yes only') arguments_.push('--yes');
    run(this, arguments_);
  },
);

Then('the command exits without changing the repository', function (this: ContinuityCliWorld) {
  assert.notEqual(this.result.exitCode, 0);
  assertRepoUnchanged(this);
});

Given(
  'current profile proof and a mixture of known legacy and user-authored Codex assets',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this, true);
    const userAsset = nodePath.join(requireProject(this), '.safeword/hooks/codex/user-authored.ts');
    writeFileSync(userAsset, '// user-authored\n');
    writeFileSync(
      nodePath.join(requireProject(this), '.agents/skills/user-authored.md'),
      '# user-authored\n',
    );
    rememberBaseline(this);
  },
);

When('the builder finalizes migration', function (this: ContinuityCliWorld) {
  runPlannedFinalization(this);
});

Then('only the finite Safeword legacy allowlist is removed', function (this: ContinuityCliWorld) {
  const project = requireProject(this);
  assert.equal(
    existsSync(nodePath.join(project, '.safeword/hooks/codex/pre-tool-quality.ts')),
    false,
  );
  assert.equal(
    readFileSync(nodePath.join(project, '.safeword/hooks/codex/user-authored.ts'), 'utf8'),
    '// user-authored\n',
  );
  assert.equal(
    readFileSync(nodePath.join(project, '.agents/skills/user-authored.md'), 'utf8'),
    '# user-authored\n',
  );
});

Given(
  'a finalized repository opened by a teammate without the profile plugin',
  function (this: ContinuityCliWorld) {
    initializeFinalizationFixture(this);
    const finalized = runPlannedFinalization(this);
    assert.equal(finalized.exitCode, 0);
    writeFileSync(nodePath.join(requireProfile(this), 'plugin-state'), 'absent');
  },
);

When('the teammate reads the repository bootstrap skill', function (this: ContinuityCliWorld) {
  this.bootstrapContent = readFileSync(
    nodePath.join(requireProject(this), '.agents/skills/safeword-plugin-setup/SKILL.md'),
    'utf8',
  );
});

Then(
  'it explains install, app restart, hook review, and status without embedding workflow policy',
  function (this: ContinuityCliWorld) {
    const content = this.bootstrapContent ?? '';
    assert.match(content, /codex migrate/u);
    assert.match(content, /Fully restart Codex/iu);
    assert.match(content, /resume this task/iu);
    assert.match(content, /\/hooks/u);
    assert.match(content, /codex status/u);
    assert.doesNotMatch(content, /BDD|TDD|quality review/u);
  },
);

Given(
  'a Codex profile without the Safeword marketplace or plugin',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'absent' });
  },
);

Given(
  'a fresh Codex profile whose Safeword marketplace cannot be added',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'absent' });
    this.continuityEnvironment = {
      ...this.continuityEnvironment,
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    };
  },
);

Given(
  'a Codex profile with an older Safeword plugin from the configured Git marketplace',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled', pluginVersion: '0.69.0' });
  },
);

Given(
  'a Codex profile whose configured Safeword Git marketplace cannot refresh',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled', pluginVersion: '0.69.0' });
    this.continuityEnvironment = {
      ...this.continuityEnvironment,
      SAFEWORD_FAIL_MARKETPLACE_UPGRADE: '1',
    };
  },
);

Given('a Codex task is running with an older Safeword plugin', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'enabled', pluginVersion: '0.69.0' });
});

Given(
  'the released Safeword plugin is installed but Codex has not restarted',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    writePendingMarker(this);
  },
);

When('the builder installs the Safeword Codex plugin', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'install']);
});

When(
  'the builder installs the released Safeword Codex plugin',
  function (this: ContinuityCliWorld) {
    run(this, ['codex', 'install']);
  },
);

Then(
  'the marketplace is added before the plugin install command selects the exact released Safeword version',
  function (this: ContinuityCliWorld) {
    const calls = commandLog(this);
    assert.ok(
      calls.indexOf('plugin marketplace add') < calls.indexOf('plugin add safeword@safeword'),
    );
    assert.equal(
      readFileSync(nodePath.join(requireProfile(this), 'plugin-version'), 'utf8'),
      SAFEWORD_SCHEMA.version,
    );
  },
);

Then(
  'the existing marketplace is upgraded before the plugin install command selects the exact released Safeword version',
  function (this: ContinuityCliWorld) {
    const calls = commandLog(this);
    assert.ok(
      calls.indexOf('plugin marketplace upgrade safeword --json') <
        calls.indexOf('plugin add safeword@safeword --json'),
    );
    assert.equal(
      readFileSync(nodePath.join(requireProfile(this), 'plugin-version'), 'utf8'),
      SAFEWORD_SCHEMA.version,
    );
  },
);

Then(
  'installation fails before the plugin install command runs',
  function (this: ContinuityCliWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.doesNotMatch(commandLog(this), /plugin add safeword@safeword --json/u);
  },
);

Then(
  'the result says the Codex app may keep its loaded catalogue and must fully restart before this task verifies the installed version',
  function (this: ContinuityCliWorld) {
    const output = `${this.result.stdout}\n${this.result.stderr}`;
    assert.match(output, /Codex app may keep its loaded Safeword catalogue/u);
    assert.match(output, /Fully restart Codex/u);
    assert.match(output, /resume this task/u);
  },
);

When('the builder checks the Codex plugin activation status', function (this: ContinuityCliWorld) {
  run(this, ['codex', 'status', '--json']);
});

Then(
  'status reports plugin_installed_app_restart_required and directs the builder to review hooks before restarting',
  function (this: ContinuityCliWorld) {
    const status = JSON.parse(this.result.stdout) as {
      data?: { migration?: { schema_version?: string; state?: string } };
    };
    assert.deepEqual(status.data?.migration, {
      schema_version: '2',
      state: 'plugin_installed_app_restart_required',
    });
    const human = run(this, ['codex', 'status']);
    assert.match(human.stdout, /review.+hooks.+Fully restart Codex.+resume this task/isu);
  },
);

Then(
  'JSON status exposes the schema 2 app-restart state and the schema 1 compatibility state',
  function (this: ContinuityCliWorld) {
    const status = JSON.parse(this.result.stdout) as {
      state?: string;
      data?: {
        migration?: { schema_version?: string; state?: string };
        migration_state?: string;
      };
    };
    assert.deepEqual(status.data?.migration, {
      schema_version: '2',
      state: 'plugin_installed_app_restart_required',
    });
    assert.equal(status.data?.migration_state, 'plugin_installed_restart_required');
    assert.equal(status.state, 'action_required');
  },
);

Given(
  'a profile with app-restart activation pending for the installed plugin identity',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    writePendingMarker(this);
  },
);

Given('a profile installed while no Codex host was running', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'enabled' });
  writePendingMarker(this, { activeHosts: [] });
});

Given(
  /^activation is pending for (older|current) version and (older|current) hook manifest identity$/u,
  function (this: ContinuityCliWorld, version: string, manifest: string) {
    initialize(this, { pluginState: 'enabled' });
    const identity = currentCodexPluginIdentity();
    writePendingMarker(this, {
      version: version === 'current' ? identity.plugin_version : '0.69.0',
      manifest: manifest === 'current' ? identity.manifest_sha256 : '0'.repeat(64),
    });
  },
);

When(
  'the resumed task in the same Codex app invokes the installed profile-plugin SessionStart dispatcher',
  function (this: ContinuityCliWorld) {
    recordEventProofForHost(
      this,
      'session-start',
      observeCodexHostProcesses().current ?? INSTALLING_HOST,
    );
  },
);

Then(
  'same-host proof does not replace the pending marker or satisfy the restart requirement',
  function (this: ContinuityCliWorld) {
    assert.equal(existsSync(activationMarkerPath(this)), true);
    assert.equal(existsSync(proofPath(this)), true);
    assert.equal(observeMigrationState(this), 'plugin_installed_app_restart_required');
  },
);

When(
  'a restarted Codex app resumes the task through the installed profile-plugin SessionStart dispatcher',
  function (this: ContinuityCliWorld) {
    recordEventProofForHost(this, 'session-start', RESTARTED_HOST);
  },
);

When(
  'a restarted Codex app invokes the installed profile-plugin SessionStart dispatcher',
  function (this: ContinuityCliWorld) {
    recordEventProofForHost(this, 'session-start', RESTARTED_HOST);
  },
);

When(
  'the next Codex app invokes the installed profile-plugin SessionStart dispatcher',
  function (this: ContinuityCliWorld) {
    recordEventProofForHost(this, 'session-start', RESTARTED_HOST);
  },
);

Then(
  'restart-bound proof replaces the pending marker and status no longer requires an app restart',
  function (this: ContinuityCliWorld) {
    assert.equal(existsSync(activationMarkerPath(this)), false);
    assert.equal(existsSync(proofPath(this)), true);
    assert.equal(observeMigrationState(this), 'plugin_enabled_hook_unproven');
  },
);

Then(
  /^proof for current version and current hook manifest does not clear the unmatched marker or claim its activation$/u,
  function (this: ContinuityCliWorld) {
    assert.ok(this.pendingMarkerPath);
    assert.equal(existsSync(this.pendingMarkerPath), true);
    assert.notEqual(observeMigrationState(this), 'plugin');
  },
);

Given(
  'exact current plugin proof exists and no activation marker is pending',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    recordCurrentProof(this);
    assert.equal(existsSync(activationMarkerPath(this)), false);
  },
);

When('a later Codex task starts', function (this: ContinuityCliWorld) {
  recordEventProofThroughCli(this, 'session-start');
});

Then(
  'exact current proof remains valid and status does not reintroduce an app-restart requirement',
  function (this: ContinuityCliWorld) {
    assert.equal(observeMigrationState(this), 'plugin');
    assert.equal(existsSync(activationMarkerPath(this)), false);
  },
);

Given(
  'a profile with a valid v0.70 restart-pending marker for the installed plugin identity',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    writePendingMarker(this, { legacy: true });
  },
);

Given(
  'current SessionStart proof for the installed plugin identity and a valid v0.70 restart-pending marker',
  function (this: ContinuityCliWorld) {
    initialize(this, { pluginState: 'enabled' });
    recordEventProofThroughCli(this, 'session-start');
    writePendingMarker(this, { legacy: true });
  },
);

Then(
  'the legacy marker is removed and current SessionStart proof is retained',
  function (this: ContinuityCliWorld) {
    assert.equal(existsSync(legacyRestartMarkerPath(this)), false);
    assert.equal(existsSync(proofPath(this)), true);
  },
);

Then(
  'proof still establishes the exact installed identity and the legacy marker is retired',
  function (this: ContinuityCliWorld) {
    const proof = JSON.parse(readFileSync(proofPath(this), 'utf8')) as {
      plugin_version: string;
      manifest_sha256: string;
    };
    assert.deepEqual(
      { plugin_version: proof.plugin_version, manifest_sha256: proof.manifest_sha256 },
      currentCodexPluginIdentity(),
    );
    assert.equal(existsSync(legacyRestartMarkerPath(this)), false);
  },
);

Given(
  /^a profile with a (malformed|stale) v0\.70 restart-pending marker$/u,
  function (this: ContinuityCliWorld, markerKind: string) {
    initialize(this, { pluginState: 'enabled' });
    const path = legacyRestartMarkerPath(this);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    if (markerKind === 'malformed') writeFileSync(path, '{bad json\n');
    else writePendingMarker(this, { legacy: true, version: '0.69.0' });
  },
);

Then(
  'status does not report app-restart activation pending or synthesize current proof from that marker',
  function (this: ContinuityCliWorld) {
    const status = JSON.parse(this.result.stdout) as {
      data?: { migration?: { state?: string } };
    };
    assert.notEqual(status.data?.migration?.state, 'plugin_installed_app_restart_required');
    assert.equal(existsSync(proofPath(this)), false);
  },
);

Given('a repository that has never finalized Codex migration', function (this: ContinuityCliWorld) {
  initialize(this, { pluginState: 'absent' });
});

When('the builder runs Safeword setup', function (this: ContinuityCliWorld) {
  run(this, ['setup', '--yes', '--agents', 'none', '--no-modify'], {
    SAFEWORD_SKIP_INSTALL: '1',
  });
});

Then('no Safeword plugin-setup bootstrap skill is created', function (this: ContinuityCliWorld) {
  assert.equal(
    existsSync(
      nodePath.join(requireProject(this), '.agents/skills/safeword-plugin-setup/SKILL.md'),
    ),
    false,
  );
});
