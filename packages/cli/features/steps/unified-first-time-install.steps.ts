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
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { gunzipSync } from 'node:zlib';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  commandCatalog,
  type CompatibilityRoute,
  compatibilityRoutes,
} from '../../src/cli-protocol/catalog.ts';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  recordCodexHookProof,
} from '../../src/codex-plugin/profile-proof.ts';
import { SAFEWORD_SCHEMA } from '../../src/schema.ts';
import { parseShellWords } from '../../templates/hooks/lib/shell-segments.ts';
import type { SafewordWorld } from './world.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

function executableDirectory(name: string): string {
  const executableName = process.platform === 'win32' ? `${name}.exe` : name;
  const directory = (process.env.PATH ?? '')
    .split(nodePath.delimiter)
    .find(candidate => existsSync(nodePath.join(candidate, executableName)));
  assert.ok(directory, `${name} must be available on the acceptance runner PATH`);
  return directory;
}

interface UnifiedInstallWorld extends SafewordWorld {
  fixtureRoot?: string;
  projectRoot?: string;
  profileBin?: string;
  claudeState?: string;
  codexState?: string;
  claudeLog?: string;
  codexLog?: string;
  githubLog?: string;
  claudeFailure?: string;
  cursorBefore?: string;
  hostEnvironment?: NodeJS.ProcessEnv;
  fixtureBefore?: string;
  selectedAgents?: string[];
  statusEnvelope?: Record<string, unknown>;
  doctorEnvelope?: Record<string, unknown>;
  planId?: string;
  unrelatedProfilePath?: string;
  lifecycleOperation?: string;
  projectBefore?: string;
  unplannedContent?: string;
  canonicalCommand?: string;
  relayRecoveryCommand?: string;
  profileOnlyAlias?: string;
  irrelevantAliasOption?: string;
  historicalCommand?: string;
  humanInstallSummary?: boolean;
  compatibilityAlias?: string;
  compatibilityCanonical?: string;
  compatibilityRoute?: CompatibilityRoute;
  referenceHelp?: Readonly<Record<string, string>>;
  referenceCapabilities?: Record<string, unknown>;
  legacyGuidancePath?: string;
  recoveryCommand?: string;
  unrelatedProfileBefore?: string;
  architectureLegacyFlags?: string;
  architectureCanonicalFlags?: string;
  architectureDocument?: string;
  architectureLegacyOutcome?: ArchitectureRunOutcome;
  architectureCanonicalOutcome?: ArchitectureRunOutcome;
  retiredFixtureRoots?: string[];
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function historicalGlobalGuidance(): string {
  const encoded = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../tests/fixtures/legacy-global-guidance.txt.gz.b64'),
    'utf8',
  );
  return gunzipSync(Buffer.from(encoded.replaceAll(/\s/gu, ''), 'base64')).toString('utf8');
}

function createLegacyGuidanceFixture(world: UnifiedInstallWorld): void {
  const codexHome = requiredValue(world.hostEnvironment?.CODEX_HOME, 'Codex home');
  const guidancePath = nodePath.join(codexHome, 'AGENTS.md');
  const unrelatedPath = nodePath.join(codexHome, 'CUSTOM.md');
  writeFileSync(guidancePath, historicalGlobalGuidance());
  writeFileSync(unrelatedPath, '# Customer profile policy\n');
  world.legacyGuidancePath = guidancePath;
  world.unrelatedProfilePath = unrelatedPath;
  world.unrelatedProfileBefore = readFileSync(unrelatedPath, 'utf8');
}

function createClaudePayload(root: string): string {
  const installPath = nodePath.join(root, 'claude-plugin');
  const assets = [
    ['hooks/hooks.json', '{"hooks":{}}\n'],
    ['runtime/cli.js', '// cli\n'],
    ['runtime/dispatch.js', '// dispatch\n'],
    ['runtime/event-groups.json', '{}\n'],
    ['.claude-plugin/plugin.json', '{"name":"safeword"}\n'],
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

function directoryDigest(directory: string, ignoredPaths: ReadonlySet<string> = new Set()): string {
  if (!existsSync(directory)) return 'missing';
  const visit = (path: string, relativePath = ''): unknown => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return { symlink: readlinkSync(path) };
    if (!stat.isDirectory()) return readFileSync(path).toString('base64');
    return readdirSync(path)
      .filter(name => !ignoredPaths.has(nodePath.join(relativePath, name)))
      .toSorted((left, right) => left.localeCompare(right))
      .map(name => [name, visit(nodePath.join(path, name), nodePath.join(relativePath, name))]);
  };
  return JSON.stringify(visit(directory));
}

function fixtureEffectDigest(world: UnifiedInstallWorld): string {
  return directoryDigest(
    requiredValue(world.fixtureRoot, 'fixture root'),
    new Set([
      nodePath.join('profile', 'claude-log'),
      nodePath.join('profile', 'codex-log'),
      nodePath.join('profile', 'github-log'),
      nodePath.join('project', '.git'),
    ]),
  );
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
  const claudeLog = nodePath.join(profile, 'claude-log');
  const codexLog = nodePath.join(profile, 'codex-log');
  const githubLog = nodePath.join(profile, 'github-log');
  const claudeFailure = nodePath.join(profile, 'claude-failure');
  const claudePayload = createClaudePayload(root);
  mkdirSync(nodePath.join(project, '.cursor'), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(nodePath.join(project, '.cursor/customer.json'), '{"ownedBy":"customer"}\n');
  const initialized = spawnSync(
    'git',
    ['-c', 'init.templateDir=', '-c', 'core.hooksPath=', 'init', '--quiet'],
    { cwd: project, encoding: 'utf8' },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  for (const path of [claudeState, codexState, claudeMarketplace, codexMarketplace]) {
    writeFileSync(path, 'absent');
  }
  for (const path of [claudeLog, codexLog, githubLog, claudeFailure]) writeFileSync(path, '');

  const marketplaceUrl = 'https://github.com/ArcadeAI/safeword.git';
  const marketplaceReference = SAFEWORD_SCHEMA.version.includes('-')
    ? `v${SAFEWORD_SCHEMA.version}`
    : 'stable';
  const officialClaudeSource = `${marketplaceUrl}#${marketplaceReference}`;
  // Claude records project-scope state in the project's .claude/settings.json.
  // Merge rather than overwrite: Safeword writes its own keys there too
  // (marketplace auto-update, last-known-good fallback), and clobbering them
  // makes every install re-enable them, so a repeat install never converges.
  const mergeSettings = nodePath.join(bin, 'safeword-merge-claude-settings');
  writeExecutable(
    mergeSettings,
    String.raw`#!/bin/sh
exec "${process.execPath}" -e '
const fs = require("node:fs");
const path = require("node:path");
const file = path.join(process.env.SAFEWORD_CLAUDE_PROJECT, ".claude/settings.json");
let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
if (process.argv[1] === "marketplace") {
  settings.extraKnownMarketplaces = {
    ...settings.extraKnownMarketplaces,
    safeword: {
      source: {
        source: "git",
        url: process.env.SAFEWORD_MARKETPLACE_URL,
        ref: process.env.SAFEWORD_MARKETPLACE_REF,
      },
    },
  };
} else {
  settings.enabledPlugins = { ...settings.enabledPlugins, "safeword@safeword": true };
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(settings, undefined, 2) + "\n");
' "$@"
`,
  );

  writeExecutable(
    nodePath.join(bin, 'claude'),
    `#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$SAFEWORD_CLAUDE_LOG"
if [ "$(cat "$SAFEWORD_CLAUDE_FAILURE")" = 'unavailable' ]; then
  echo 'Claude host unavailable' >&2
  exit 127
fi
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json')
    if [ "$(cat "$SAFEWORD_CLAUDE_MARKETPLACE")" = 'official' ]; then
      printf '[{"name":"safeword","source":"%s"}]\n' "$SAFEWORD_CLAUDE_SOURCE"
    else
      echo '[]'
    fi
    ;;
  'plugin marketplace add '*' --scope project')
    printf 'official' > "$SAFEWORD_CLAUDE_MARKETPLACE"
    "$SAFEWORD_MERGE_SETTINGS" marketplace
    ;;
  'plugin install safeword@safeword --scope project'|'plugin update safeword@safeword --scope project'|'plugin enable safeword@safeword --scope project')
    if [ -s "$SAFEWORD_CLAUDE_FAILURE" ]; then echo 'forced Claude failure' >&2; exit 3; fi
    printf 'enabled' > "$SAFEWORD_CLAUDE_STATE"
    "$SAFEWORD_MERGE_SETTINGS" enable
    ;;
  'plugin uninstall safeword@safeword --scope project --keep-data')
    printf 'absent' > "$SAFEWORD_CLAUDE_STATE"
    ;;
  'plugin list --json')
    if [ "$(cat "$SAFEWORD_CLAUDE_STATE")" = 'enabled' ]; then
      printf '[{"id":"safeword@safeword","version":"%s","enabled":true,"scope":"project","projectPath":"%s","installPath":"%s"}]\n' "$SAFEWORD_VERSION" "$SAFEWORD_CLAUDE_PROJECT" "$SAFEWORD_CLAUDE_PAYLOAD"
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
printf '%s\n' "$*" >> "$SAFEWORD_CODEX_LOG"
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
  // The unified-install corpus exercises CLI routing, not live GitHub access.
  // Shadow `gh` as well as removing token variables below so a developer's
  // keychain cannot turn a compatibility scenario into a real network sweep.
  writeExecutable(
    nodePath.join(bin, 'gh'),
    `#!/bin/sh
printf '%s|%s|%s\n' "$*" "\${GITHUB_TOKEN-unset}" "\${GH_TOKEN-unset}" >> "$SAFEWORD_GITHUB_LOG"
exit 1
`,
  );

  world.fixtureRoot = root;
  world.temporaryDirectory = project;
  world.projectRoot = project;
  world.profileBin = bin;
  world.claudeState = claudeState;
  world.codexState = codexState;
  world.claudeLog = claudeLog;
  world.codexLog = codexLog;
  world.githubLog = githubLog;
  world.claudeFailure = claudeFailure;
  world.cursorBefore = directoryDigest(nodePath.join(project, '.cursor'));
  world.hostEnvironment = {
    PATH: [bin, executableDirectory('bun'), '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(
      nodePath.delimiter,
    ),
    CODEX_HOME: profile,
    SAFEWORD_CLAUDE_MARKETPLACE: claudeMarketplace,
    SAFEWORD_CLAUDE_LOG: claudeLog,
    SAFEWORD_CLAUDE_FAILURE: claudeFailure,
    SAFEWORD_CLAUDE_PAYLOAD: claudePayload,
    SAFEWORD_CLAUDE_SOURCE: officialClaudeSource,
    SAFEWORD_CLAUDE_PROJECT: project,
    SAFEWORD_MERGE_SETTINGS: mergeSettings,
    SAFEWORD_MARKETPLACE_URL: marketplaceUrl,
    SAFEWORD_MARKETPLACE_REF: marketplaceReference,
    SAFEWORD_CLAUDE_STATE: claudeState,
    SAFEWORD_CODEX_MARKETPLACE: codexMarketplace,
    SAFEWORD_CODEX_LOG: codexLog,
    SAFEWORD_GITHUB_LOG: githubLog,
    SAFEWORD_CODEX_STATE: codexState,
    SAFEWORD_VERSION: SAFEWORD_SCHEMA.version,
  };
  world.fixtureBefore = fixtureEffectDigest(world);
}

function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} was not initialized`);
  return value;
}

function helpListsCommand(help: string, command: string): boolean {
  return help.split('\n').some(line => line.trimStart().split(/\s+/u, 1)[0] === command);
}

function assertReferenceCommand(
  help: Readonly<Record<string, string>>,
  capabilities: readonly { name?: string; effect_class?: string }[] | undefined,
  name: string,
  effectClass: string,
): void {
  const definition = commandCatalog.find(candidate => candidate.name === name);
  assert.equal(definition?.effectClass, effectClass, name);
  assert.equal(typeof definition?.handler, 'function', name);
  const [family, nestedCommand] = name.split(' ', 2);
  assert.equal(helpListsCommand(help[''] ?? '', family ?? ''), true);
  assert.equal(helpListsCommand(help[family ?? ''] ?? '', nestedCommand ?? ''), true);
  assert.equal(
    capabilities?.some(entry => entry.name === name && entry.effect_class === effectClass),
    true,
    `${name} is absent from capabilities with effect class ${effectClass}`,
  );
}

function fixtureProcessEnvironment(world: UnifiedInstallWorld): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    LANG: process.env.LANG ?? 'C.UTF-8',
    LC_ALL: process.env.LC_ALL,
    TZ: process.env.TZ,
    ...world.hostEnvironment,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
  };
  delete environment.GITHUB_TOKEN;
  delete environment.GH_TOKEN;
  return environment;
}

interface LifecyclePlanEnvelope {
  data: {
    plan: {
      command: string;
      effects: {
        files: unknown[];
        configuration: unknown[];
        network: unknown[];
        destructive: { target?: string }[];
      };
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
  const effects = envelope.data.plan.effects;
  if (operation === 'install') {
    assert.ok(effects.files.length + effects.configuration.length > 0);
    if (profileSelected) assert.ok(effects.network.length > 0);
    return;
  }
  if (operation !== 'uninstall') {
    throw new Error(`Unsupported profile plan operation: ${operation ?? 'unset'}`);
  }
  // The fixture starts with no installed profile plugins. An exact uninstall
  // plan must not fabricate destructive profile effects for absent state.
  if (profileSelected) {
    assert.equal(
      effects.destructive.some(effect =>
        /(?:Claude|Codex) profile plugin/u.test(effect.target ?? ''),
      ),
      false,
    );
  }
}

After(function (this: UnifiedInstallWorld) {
  for (const root of [...(this.retiredFixtureRoots ?? []), this.fixtureRoot]) {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

function runInstall(world: UnifiedInstallWorld, arguments_: readonly string[]): void {
  const project = requiredValue(world.projectRoot, 'project root');
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, 'install', ...arguments_, '--json', '--cwd', project],
    {
      cwd: project,
      encoding: 'utf8',
      env: fixtureProcessEnvironment(world),
    },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

function runJsonCommand(world: UnifiedInstallWorld, command: string): Record<string, unknown> {
  const project = requiredValue(world.projectRoot, 'project root');
  const completed = spawnSync(process.execPath, [CLI_PATH, command, '--json', '--cwd', project], {
    cwd: project,
    encoding: 'utf8',
    env: fixtureProcessEnvironment(world),
  });
  // status and doctor are observations: action_required (exit 2) is a real
  // health verdict, so only a hard failure invalidates the envelope.
  assert.ok(
    completed.status === 0 || completed.status === 2,
    `exit ${completed.status}: ${completed.stderr || completed.stdout}`,
  );
  return JSON.parse(completed.stdout) as Record<string, unknown>;
}

function runRawCommand(
  world: UnifiedInstallWorld,
  arguments_: readonly string[],
  globalJson = true,
): void {
  const project = requiredValue(world.projectRoot, 'project root');
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...arguments_, ...(globalJson ? ['--json'] : []), '--cwd', project],
    {
      cwd: project,
      encoding: 'utf8',
      env: fixtureProcessEnvironment(world),
    },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

/**
 * A lifecycle command completed without failing. Exit 0 is healthy or changed;
 * exit 2 is `action_required` — a real outcome (a plan awaiting confirmation, a
 * pending host activation), not an error. Exit 1 and anything else are failures.
 */
function assertCommandDidNotFail(world: UnifiedInstallWorld): void {
  assert.ok(
    world.result.exitCode === 0 || world.result.exitCode === 2,
    `exit ${world.result.exitCode}: ${world.result.stderr || world.result.stdout}`,
  );
}

function assertRetainedCompatibilityRoute(world: UnifiedInstallWorld): void {
  const alias = requiredValue(world.compatibilityAlias, 'compatibility alias');
  const canonical = requiredValue(world.compatibilityCanonical, 'canonical route');
  const route = world.compatibilityRoute;
  assert.ok(route, `No retained compatibility route maps ${alias} to ${canonical}`);
  assert.equal(route.retention, 'indefinite', alias);
  assert.ok(
    route.route === alias || route.route.endsWith(` ${alias}`),
    `${route.route} does not name the ${alias} route`,
  );
  assert.ok(
    route.replacement === canonical || route.replacement.endsWith(` ${canonical}`),
    `${route.replacement} does not name the ${canonical} canonical route`,
  );
}

function assertScopedInstallCompatibility(world: UnifiedInstallWorld, alias: string): void {
  const canonical = requiredValue(world.compatibilityCanonical, 'canonical route');
  assertCommandDidNotFail(world);
  const project = requiredValue(world.projectRoot, 'project root');
  // The retained scoped spellings install the profile plugin only; reconciling
  // the repository is the canonical `install --agents=<agent>` route.
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), false);
  const selected = alias.startsWith('claude') ? 'claude' : 'codex';
  assert.equal(
    readFileSync(requiredValue(world.claudeState, 'Claude state'), 'utf8'),
    selected === 'claude' ? 'enabled' : 'absent',
  );
  assert.equal(
    readFileSync(requiredValue(world.codexState, 'Codex state'), 'utf8'),
    selected === 'codex' ? 'enabled' : 'absent',
  );
  const envelope = JSON.parse(world.result.stdout) as {
    findings?: { code?: string; metadata?: { replacement?: string } }[];
  };
  assert.equal(
    envelope.findings?.some(
      finding =>
        finding.code === 'CLI_ALIAS_DEPRECATED' && finding.metadata?.replacement === canonical,
    ),
    true,
  );
}

function assertUninstallPreview(envelope: Record<string, unknown> | undefined): void {
  assert.ok(envelope);
  const data = envelope.data as { plan: { effects: { destructive: unknown[] } } };
  assert.ok(data.plan.effects.destructive.length > 0);
}

function assertGuidanceCleanupPreview(envelope: Record<string, unknown> | undefined): void {
  assert.ok(envelope);
  const data = envelope.data as {
    plan: { effects: { destructive: { operation?: string }[]; files: unknown[] } };
  };
  assert.equal(
    data.plan.effects.destructive.some(effect => effect.operation === 'deactivate'),
    true,
  );
  assert.ok(data.plan.effects.files.length > 0);
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
    assertCommandDidNotFail(this);
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'enabled');
  },
);

Then('Cursor configuration is unchanged', function (this: UnifiedInstallWorld) {
  const project = requiredValue(this.projectRoot, 'project root');
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
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
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
  assertCommandDidNotFail(this);
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
});

Then(
  'exactly the {string} integrations are changed',
  function (this: UnifiedInstallWorld, agents: string) {
    const selected = new Set(agents.split(','));
    assert.equal(
      readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'),
      selected.has('claude') ? 'enabled' : 'absent',
    );
    assert.equal(
      readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'),
      selected.has('codex') ? 'enabled' : 'absent',
    );
    const project = requiredValue(this.projectRoot, 'project root');
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
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.notEqual(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
    const result = JSON.parse(this.result.stdout) as { effects?: { network?: unknown[] } };
    assert.deepEqual(result.effects?.network, []);
  },
);

Then('Claude and Codex are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'absent');
});

Given(
  'a configured project with one profile action required',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, ['--agents', 'none']);
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
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
  const status = commandCatalog.find(candidate => candidate.name === 'status');
  const doctor = commandCatalog.find(candidate => candidate.name === 'doctor');
  assert.ok(status && doctor, 'status and doctor must both be canonical commands');
  assert.equal(status.aliasFor, undefined, 'status must not be an alias');
  assert.equal(doctor.aliasFor, undefined, 'doctor must not be an alias');
  assert.notEqual(status.handler, doctor.handler, 'status and doctor share one handler');
  assert.notDeepEqual(status.fixture, doctor.fixture, 'status and doctor share one fixture');
});

When('command contracts are validated', function (this: UnifiedInstallWorld) {
  if (this.projectRoot === undefined) initializeHosts(this);
  this.statusEnvelope = runJsonCommand(this, 'status');
  this.doctorEnvelope = runJsonCommand(this, 'doctor');
});

Then(
  'status and doctor have distinct executable fixtures and observable output',
  function (this: UnifiedInstallWorld) {
    // Not merely "not deepEqual": doctor must carry the diagnostics and
    // coverage that make it a different command, and status must not.
    const statusData = this.statusEnvelope?.data as Record<string, unknown> | undefined;
    const doctorData = this.doctorEnvelope?.data as Record<string, unknown> | undefined;
    assert.equal(statusData?.command, 'status');
    assert.equal(doctorData?.command, 'doctor');
    assert.equal(statusData?.diagnostics, undefined);
    assert.equal(statusData?.coverage, undefined);
    assert.ok(Array.isArray(doctorData?.diagnostics));
    assert.ok(Array.isArray(doctorData?.coverage));
  },
);

Given('a default unified installation', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  runInstall(this, []);
  assertCommandDidNotFail(this);
  this.fixtureBefore = fixtureEffectDigest(this);
});

When('the user runs uninstall without confirmation', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall']);
});

Then(
  'an exact plan covers project, Claude, Codex, and Cursor',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
    const envelope = JSON.parse(this.result.stdout) as {
      data?: { plan?: { id?: string }; surfaces?: { name?: string }[] };
    };
    assert.match(envelope.data?.plan?.id ?? '', /^[a-f\d]{64}$/u);
    assert.deepEqual(
      envelope.data?.surfaces?.map(surface => surface.name),
      ['project', 'claude', 'codex', 'cursor'],
    );
  },
);

Then('no state is changed', function (this: UnifiedInstallWorld) {
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
});

Given(
  'an exact uninstall plan and unrelated project and profile content',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assertCommandDidNotFail(this);
    const project = requiredValue(this.projectRoot, 'project root');
    writeFileSync(nodePath.join(project, 'CUSTOM.md'), 'customer project content\n');
    const profilePath = nodePath.join(
      requiredValue(this.fixtureRoot, 'fixture root'),
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
  runRawCommand(this, ['uninstall', '--yes', '--plan', requiredValue(this.planId, 'plan id')]);
});

Then('only recognized Safeword-owned state is removed', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), false);
  assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'absent');
  assert.equal(
    readFileSync(nodePath.join(project, 'CUSTOM.md'), 'utf8'),
    'customer project content\n',
  );
  assert.equal(
    readFileSync(requiredValue(this.unrelatedProfilePath, 'profile customer content'), 'utf8'),
    'customer profile content\n',
  );
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Then(
  'backup and recovery actions are reported where required',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as { recovery?: { command?: string }[] };
    const recovery = envelope.recovery?.map(action => action.command ?? '') ?? [];
    // Claude's recovery names the scope it removed, so reinstalling restores
    // the same activation boundary rather than silently changing it.
    assert.equal(
      recovery.some(command =>
        /^safeword install --agents=claude --scope (?:project|user)$/u.test(command),
      ),
      true,
      JSON.stringify(recovery),
    );
    assert.equal(
      recovery.includes('safeword install --agents=codex'),
      true,
      JSON.stringify(recovery),
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
    writeFileSync(requiredValue(this.claudeState, 'Claude state'), 'absent');
    this.fixtureBefore = fixtureEffectDigest(this);
  },
);

When('the user confirms that stale uninstall plan', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall', '--yes', '--plan', requiredValue(this.planId, 'plan id')]);
});

Then('no removal occurs and a fresh plan is required', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
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
  this.fixtureBefore = fixtureEffectDigest(this);
});

When('the user runs uninstall without input', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall', '--no-input']);
});

Then('the plan is reported without applying any removal', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
  const envelope = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
  assert.match(envelope.data?.plan?.id ?? '', /^[a-f\d]{64}$/u);
});

Given(
  'an installation state with agents {string}',
  function (this: UnifiedInstallWorld, agents: string) {
    initializeHosts(this);
    this.selectedAgents = agents === 'none' ? [] : agents.split(',');
    this.fixtureBefore = fixtureEffectDigest(this);
  },
);

When(
  'the user previews {string} for that selection',
  function (this: UnifiedInstallWorld, operation: string) {
    this.lifecycleOperation = operation;
    const agents = this.selectedAgents?.length === 0 ? 'none' : this.selectedAgents?.join(',');
    runRawCommand(this, ['plan', operation, '--agents', requiredValue(agents, 'selected agents')]);
  },
);

Then(
  'project profile network destructive and manual effects are declared when applicable',
  function (this: UnifiedInstallWorld) {
    assertCommandDidNotFail(this);
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
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
});

When('the user previews user-scoped Claude uninstall', function (this: UnifiedInstallWorld) {
  this.fixtureBefore = fixtureEffectDigest(this);
  runRawCommand(this, ['plan', 'uninstall', '--agents=claude', '--scope=user']);
});

Then(
  'the plan reports no removable user-scoped Claude installation',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const envelope = JSON.parse(this.result.stdout) as {
      next_actions?: { command?: string }[];
      data?: { plan?: { effects?: { destructive?: { target?: string }[] } } };
    };
    // Only project-scoped Claude and Codex are installed. There is no user
    // plugin to remove, and Codex still needs the shared project enrollment.
    assert.deepEqual(envelope.next_actions, []);
    assert.deepEqual(envelope.data?.plan?.effects?.destructive, []);
  },
);

Given('an unconfigured project', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
});

Then('the selector error names the supported values', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 1);
  assert.match(this.result.stdout, /claude, codex, opencode, cursor, or none/u);
});

Then('no project or agent effect occurs', function (this: UnifiedInstallWorld) {
  assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
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
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    const envelope = JSON.parse(this.result.stdout) as { data?: { selected_agents?: string[] } };
    assert.deepEqual(envelope.data?.selected_agents, ['claude']);
  },
);

Then('Codex and Cursor are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'absent');
  const project = requiredValue(this.projectRoot, 'project root');
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
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    const envelope = JSON.parse(this.result.stdout) as { effects?: { network?: unknown[] } };
    assert.deepEqual(envelope.effects?.network, []);
  },
);

Then('every agent integration is unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'absent');
  const project = requiredValue(this.projectRoot, 'project root');
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
  assertCommandDidNotFail(this);
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
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), this.cursorBefore);
});

Given('a project with no Cursor configuration', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  const project = requiredValue(this.projectRoot, 'project root');
  rmSync(nodePath.join(project, '.cursor'), { recursive: true, force: true });
  this.cursorBefore = 'missing';
});

Then('no Cursor file or directory is created', function (this: UnifiedInstallWorld) {
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.cursor')), false);
});

Then(
  'core project configuration and Safeword-owned Cursor assets are installed',
  function (this: UnifiedInstallWorld) {
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
    assert.equal(existsSync(nodePath.join(project, '.cursor')), true);
  },
);

Then('Claude and Codex profiles are unchanged', function (this: UnifiedInstallWorld) {
  assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'absent');
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'absent');
});

Given(
  'a project with customer and third-party Cursor configuration',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    const project = requiredValue(this.projectRoot, 'project root');
    writeFileSync(nodePath.join(project, '.cursor/third-party.json'), '{"owner":"third-party"}\n');
  },
);

Then(
  'Safeword Cursor entries are reconciled without replacing unrelated content',
  function (this: UnifiedInstallWorld) {
    const project = requiredValue(this.projectRoot, 'project root');
    // The positive half of the claim: a no-op install would preserve both
    // files below and prove nothing, so require the owned entries too.
    const owned = Object.keys(SAFEWORD_SCHEMA.ownedFiles).filter(path =>
      path.startsWith('.cursor/'),
    );
    assert.ok(owned.length > 0, 'schema declares no Safeword-owned Cursor files');
    for (const path of owned) {
      assert.equal(existsSync(nodePath.join(project, path)), true, path);
    }
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
    assertCommandDidNotFail(this);
    assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'enabled');
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

Given(
  'the retained compatibility route {string} for {string}',
  function (this: UnifiedInstallWorld, alias: string, canonical: string) {
    this.compatibilityAlias = alias;
    this.compatibilityCanonical = canonical;
    this.compatibilityRoute = compatibilityRoutes.find(route => {
      const routeMatches = route.route === alias || route.route.endsWith(` ${alias}`);
      const replacementMatches =
        route.replacement === canonical || route.replacement.endsWith(` ${canonical}`);
      return routeMatches && replacementMatches;
    });
  },
);

/**
 * Operands required by an alias before Commander will dispatch it. Argument
 * validation runs ahead of the handler, so an alias missing a required operand
 * exits without compatibility guidance; supplying one exercises the route.
 */
const ALIAS_REQUIRED_OPERANDS: Readonly<Record<string, readonly string[]>> = {
  codify: ['NOSUCH'],
  connect: ['unsupported-provider'],
};

function invokeOptionAlias(world: UnifiedInstallWorld, alias: string): boolean {
  if (alias === '--stage' || alias === '--staged') {
    createDivergentArchitectureFixture(world);
    runRawCommand(world, ['project', 'architecture', alias]);
    return true;
  }
  if (alias !== '--remove-legacy-hooks') return false;

  initializeHosts(world);
  for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
    recordCodexHookProof(event, world.hostEnvironment);
  }
  const argv = ['codex', 'migrate', alias];
  runRawCommand(world, argv);
  return true;
}

function assertCredentialIsolationInChild(world: UnifiedInstallWorld): void {
  const observed = spawnSync(
    process.execPath,
    [
      '-e',
      'process.stdout.write(`${process.env.GITHUB_TOKEN ?? "unset"}|${process.env.GH_TOKEN ?? "unset"}`)',
    ],
    { env: fixtureProcessEnvironment(world), encoding: 'utf8' },
  );
  assert.equal(observed.status, 0, observed.stderr);
  assert.equal(observed.stdout, 'unset|unset');
}

function assertOptionAliasResult(result: string, alias: string, canonical: string): void {
  const envelope = JSON.parse(result) as {
    schema_version?: number;
    data?: { command?: string };
    findings?: { code?: string; metadata?: { legacy?: string; replacement?: string } }[];
  };
  assert.equal(envelope.schema_version, 1, `${alias} did not return a result envelope`);
  assert.equal(
    envelope.findings?.some(
      finding =>
        finding.code === 'CLI_OPTION_DEPRECATED' &&
        finding.metadata?.legacy === alias &&
        canonical.endsWith(finding.metadata?.replacement ?? '\0'),
    ),
    true,
    `${alias} did not dispatch with compatibility guidance: ${result}`,
  );
  if (alias === '--remove-legacy-hooks') {
    assert.equal(envelope.data?.command, 'codex migrate --finalize');
  }
}

When('the user invokes it', function (this: UnifiedInstallWorld) {
  const alias = requiredValue(this.compatibilityAlias, 'compatibility alias');
  if (invokeOptionAlias(this, alias)) return;
  initializeHosts(this);
  // Reproduce the credential-bearing developer/CI environment that exposed
  // this fixture's former live-network leak. The fixture process boundary must
  // remove it before exercising the reconcile alias.
  if (alias === 'retro-reconcile') {
    this.hostEnvironment = {
      ...this.hostEnvironment,
      GITHUB_TOKEN: `ghp_${'a'.repeat(36)}`,
    };
    assertCredentialIsolationInChild(this);
  }
  const argv = alias === 'bare safeword' ? [] : alias.split(' ');
  runRawCommand(this, [...argv, ...(ALIAS_REQUIRED_OPERANDS[alias] ?? [])]);
});

Then(
  'the named canonical behavior runs with compatibility guidance',
  function (this: UnifiedInstallWorld) {
    const alias = requiredValue(this.compatibilityAlias, 'compatibility alias');
    const canonical = requiredValue(this.compatibilityCanonical, 'canonical route');
    assertRetainedCompatibilityRoute(this);

    if (alias.startsWith('--')) {
      assertOptionAliasResult(this.result.stdout, alias, canonical);
      return;
    }

    // Every alias must dispatch for real: the envelope proves the CLI accepted
    // the spelling, and the deprecation finding proves which canonical route ran.
    const envelope = JSON.parse(this.result.stdout) as {
      schema_version?: number;
      findings?: { code?: string; metadata?: { replacement?: string } }[];
    };
    assert.equal(envelope.schema_version, 1, `${alias} did not return a result envelope`);

    if (alias === 'retro-reconcile') {
      const calls = readFileSync(requiredValue(this.githubLog, 'GitHub log'), 'utf8')
        .trim()
        .split('\n')
        .filter(call => call.length > 0);
      assert.equal(
        calls.every(call => call.endsWith('|unset|unset')),
        true,
      );
    } else if (alias === 'bare safeword') {
      // Bare invocation is the default route, not a named alias, so it carries
      // no deprecation finding; it must still resolve to canonical status.
      assert.equal((envelope as { data?: { command?: string } }).data?.command, canonical);
      return;
    }

    assert.equal(
      envelope.findings?.some(
        finding =>
          finding.code === 'CLI_ALIAS_DEPRECATED' && finding.metadata?.replacement === canonical,
      ),
      true,
      `${alias} did not report ${canonical} as its canonical route: ${this.result.stdout}`,
    );

    if (alias === 'claude install' || alias === 'codex install') {
      assertScopedInstallCompatibility(this, alias);
    }
  },
);

Then('metadata schedules no deletion date', function (this: UnifiedInstallWorld) {
  assert.equal(this.compatibilityRoute?.retention, 'indefinite');
  assert.equal('removalDate' in (this.compatibilityRoute ?? {}), false);
});

Given('migration cleanup recovery and project commands outside the unified lifecycle', () => {
  // The catalogue is the executable source used by the assertions below.
});

When('the canonical command catalogue is validated', () => {
  assert.ok(commandCatalog.length > 0);
});

Then('each specialized operation retains its own behavior and effect policy', () => {
  const expectedPolicies: Readonly<Record<string, string>> = {
    'codex migrate': 'destructive',
    'claude cleanup': 'destructive',
    'claude recover': 'mutate',
    'codex clean-guidance': 'destructive',
    'codex recover': 'destructive',
    'project sync-config': 'mutate',
    'project architecture': 'mutate',
    'project sync-learnings': 'mutate',
    'project sync-tickets': 'mutate',
  };
  for (const [name, effectClass] of Object.entries(expectedPolicies)) {
    const definition = commandCatalog.find(candidate => candidate.name === name);
    assert.equal(definition?.aliasFor, undefined, name);
    assert.equal(definition?.effectClass, effectClass, name);
    assert.equal(typeof definition?.handler, 'function', name);
  }
});

Then('only its alternate spelling is marked as a compatibility alias', () => {
  const aliases = commandCatalog.filter(definition => definition.aliasFor !== undefined);
  assert.equal(
    aliases.every(definition => definition.compatibility !== undefined),
    true,
  );
  assert.equal(
    aliases.every(definition =>
      commandCatalog.some(
        canonical => canonical.name === definition.aliasFor && canonical.aliasFor === undefined,
      ),
    ),
    true,
  );
});

Given('compatibility route {string}', function (this: UnifiedInstallWorld, alias: string) {
  this.compatibilityAlias = alias;
  initializeHosts(this);
});

function assertUnifiedInstallAlias(world: UnifiedInstallWorld, alias: string): void {
  assert.ok(alias === 'setup' || alias === 'upgrade');
  const project = requiredValue(world.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
  assert.equal(readFileSync(requiredValue(world.claudeState, 'Claude state'), 'utf8'), 'enabled');
  assert.equal(readFileSync(requiredValue(world.codexState, 'Codex state'), 'utf8'), 'enabled');
  assert.equal(directoryDigest(nodePath.join(project, '.cursor')), world.cursorBefore);
}

function assertPlanAlias(world: UnifiedInstallWorld, alias: string): void {
  assert.equal(alias, 'diff');
  const envelope = JSON.parse(world.result.stdout) as {
    data?: {
      operation?: string;
      selected_agents?: string[];
      plan?: { command?: string };
    };
  };
  assert.equal(envelope.data?.operation, 'install');
  assert.deepEqual(envelope.data?.selected_agents, []);
  assert.equal(envelope.data?.plan?.command, 'install');
  assert.equal(fixtureEffectDigest(world), world.fixtureBefore);
}

function assertProjectRemovalAlias(world: UnifiedInstallWorld, alias: string): void {
  assert.ok(alias === 'remove' || alias === 'reset');
  const envelope = JSON.parse(world.result.stdout) as {
    data: {
      plan: {
        command: string;
        id: string;
        requires_confirmation: boolean;
        effects: { destructive: unknown[] };
      };
    };
    next_actions: { command: string }[];
  };
  assert.equal(envelope.data.plan.command, 'remove');
  assert.equal(envelope.data.plan.requires_confirmation, true);
  assert.match(envelope.data.plan.id, /^[a-f\d]{64}$/u);
  assert.ok(envelope.data.plan.effects.destructive.length > 0);
  assert.equal(
    envelope.next_actions.some(action =>
      action.command.startsWith('safeword remove --yes --plan '),
    ),
    true,
  );
  assert.equal(fixtureEffectDigest(world), world.fixtureBefore);
}

const compatibilityInvariantAssertions: Readonly<
  Record<string, (world: UnifiedInstallWorld, alias: string) => void>
> = {
  'core Claude and Codex install while Cursor is omitted': assertUnifiedInstallAlias,
  'core Claude and Codex converge while Cursor is omitted': assertUnifiedInstallAlias,
  'selected effects are reported without mutation': assertPlanAlias,
  'project-only removal requires an exact plan': assertProjectRemovalAlias,
};

When(
  'its behavior is compared with {string}',
  function (this: UnifiedInstallWorld, canonical: string) {
    const alias = requiredValue(this.compatibilityAlias, 'compatibility alias');
    this.compatibilityCanonical = canonical;
    if (alias === 'setup' || alias === 'upgrade') {
      runRawCommand(this, [alias]);
      return;
    }
    if (alias === 'diff') {
      this.fixtureBefore = fixtureEffectDigest(this);
      runRawCommand(this, ['diff', 'install', '--agents', 'none']);
      return;
    }
    runInstall(this, ['--agents', 'none']);
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    this.fixtureBefore = fixtureEffectDigest(this);
    runRawCommand(this, [alias]);
  },
);

Then(
  'the observable contract remains {string}',
  function (this: UnifiedInstallWorld, invariant: string) {
    const alias = requiredValue(this.compatibilityAlias, 'compatibility alias');
    assertCommandDidNotFail(this);
    const assertInvariant = compatibilityInvariantAssertions[invariant];
    assert.ok(assertInvariant, `Unhandled compatibility invariant: ${invariant}`);
    assertInvariant(this, alias);
  },
);

Given(
  'canonical review run and codex clean-guidance commands',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When('CLI reference and capability fixtures are validated', function (this: UnifiedInstallWorld) {
  const project = requiredValue(this.projectRoot, 'project root');
  const environment = fixtureProcessEnvironment(this);
  this.referenceHelp = Object.fromEntries(
    ['', 'review', 'codex'].map(command => {
      const help = spawnSync(
        process.execPath,
        [CLI_PATH, ...command.split(' ').filter(Boolean), '--help'],
        { cwd: project, encoding: 'utf8', env: environment },
      );
      assert.equal(help.status, 0, help.stderr);
      return [command, help.stdout];
    }),
  );
  this.referenceCapabilities = runJsonCommand(this, 'capabilities');
});

Then(
  'both commands are listed with their executable syntax and effect policy',
  function (this: UnifiedInstallWorld) {
    const help = this.referenceHelp;
    assert.ok(help, 'CLI reference help was not initialized');
    const capabilities = this.referenceCapabilities?.data as
      { commands?: { name?: string; effect_class?: string }[] } | undefined;
    for (const [name, effectClass] of [
      ['review run', 'mutate'],
      ['codex clean-guidance', 'destructive'],
    ] as const) {
      assertReferenceCommand(help, capabilities?.commands, name, effectClass);
    }
  },
);

Then('codex clean-guidance is described as destructive deactivation', () => {
  const definition = commandCatalog.find(candidate => candidate.name === 'codex clean-guidance');
  assert.match(definition?.description ?? '', /deactivate.*recovery backup/iu);
});

Given(
  'canonical commands and retained compatibility aliases',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

Then(
  'the quick path omits aliases where hiding is supported',
  function (this: UnifiedInstallWorld) {
    const quickPath = this.result.stdout.split(
      'Compatibility routes (retained indefinitely):',
      1,
    )[0];
    const quickPathLines = (quickPath ?? '').split('\n').map(line => line.trimStart());
    const aliases = commandCatalog.filter(definition => definition.aliasFor !== undefined);
    for (const alias of aliases) {
      const isCanonicalFamily = commandCatalog.some(
        definition =>
          definition.aliasFor === undefined && definition.name.startsWith(`${alias.name} `),
      );
      if (isCanonicalFamily) continue;
      assert.equal(
        quickPathLines.some(line => line === alias.name || line.startsWith(`${alias.name} `)),
        false,
        alias.name,
      );
    }
  },
);

Then(
  'one compatibility section documents every retained route',
  function (this: UnifiedInstallWorld) {
    const help = this.result.stdout;
    assert.equal(help.match(/Compatibility routes \(retained indefinitely\):/gu)?.length, 1);
    for (const route of compatibilityRoutes) {
      assert.equal(help.includes(`${route.route} -> ${route.replacement}`), true, route.route);
    }
  },
);

Given('uninstall and legacy cleanup commands', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  runInstall(this, ['--agents', 'none']);
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  createLegacyGuidanceFixture(this);
});

When('the user inspects help and previews each command', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['uninstall', '--agents', 'none']);
  this.statusEnvelope = JSON.parse(this.result.stdout) as Record<string, unknown>;
  runRawCommand(this, ['codex', 'clean-guidance']);
  this.doctorEnvelope = JSON.parse(this.result.stdout) as Record<string, unknown>;
});

Then(
  'descriptions identify deactivated state preserved content backups and recovery paths',
  function (this: UnifiedInstallWorld) {
    const uninstall = commandCatalog.find(definition => definition.name === 'uninstall');
    const cleanup = commandCatalog.find(definition => definition.name === 'codex clean-guidance');
    assert.match(uninstall?.description ?? '', /deactivate.*preserve.*recover/iu);
    assert.match(cleanup?.description ?? '', /deactivate.*preserve.*recovery backup/iu);
    assertUninstallPreview(this.statusEnvelope);
    assertGuidanceCleanupPreview(this.doctorEnvelope);
  },
);

Given(
  'a command moves active guidance out of service into a backup',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    createLegacyGuidanceFixture(this);
  },
);

When('its catalogue and human plan are rendered', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['codex', 'clean-guidance'], false);
});

Then(
  'both call the operation destructive deactivation rather than only a backup',
  function (this: UnifiedInstallWorld) {
    const cleanup = commandCatalog.find(definition => definition.name === 'codex clean-guidance');
    assert.match(cleanup?.description ?? '', /deactivate/iu);
    const rendered = `${this.result.stdout}\n${this.result.stderr}`;
    assert.match(rendered, /destructive:/iu);
    assert.match(rendered, /deactivation/iu);
  },
);

Given(
  'a confirmed cleanup moved recognized Safeword state into a recovery backup',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    createLegacyGuidanceFixture(this);
    const project = requiredValue(this.projectRoot, 'project root');
    const unrelatedProjectPath = nodePath.join(project, 'customer.txt');
    writeFileSync(unrelatedProjectPath, 'customer project content\n');
    this.projectBefore = readFileSync(unrelatedProjectPath, 'utf8');
    runRawCommand(this, ['codex', 'clean-guidance']);
    const preview = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
    const planId = requiredValue(preview.data?.plan?.id, 'legacy cleanup plan');
    runRawCommand(this, ['codex', 'clean-guidance', '--yes', '--plan', planId]);
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const applied = JSON.parse(this.result.stdout) as { recovery?: { command?: string }[] };
    this.recoveryCommand = requiredValue(applied.recovery?.[0]?.command, 'recovery command');
  },
);

When('the user runs the advertised recovery action', function (this: UnifiedInstallWorld) {
  const [executable, separator, ...arguments_] = parseShellWords(
    requiredValue(this.recoveryCommand, 'recovery command'),
  );
  assert.equal(executable, 'mv');
  assert.equal(separator, '--');
  assert.equal(arguments_.length, 2);
  const project = requiredValue(this.projectRoot, 'project root');
  const completed = spawnSync(executable, [separator, ...arguments_], {
    cwd: project,
    encoding: 'utf8',
    env: fixtureProcessEnvironment(this),
  });
  assert.equal(completed.status, 0, completed.stderr);
});

Then('the recognized state is restored to service', function (this: UnifiedInstallWorld) {
  assert.equal(
    readFileSync(requiredValue(this.legacyGuidancePath, 'legacy guidance'), 'utf8'),
    historicalGlobalGuidance(),
  );
});

Then(
  'unrelated current project and profile content remains unchanged',
  function (this: UnifiedInstallWorld) {
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(readFileSync(nodePath.join(project, 'customer.txt'), 'utf8'), this.projectBefore);
    assert.equal(
      readFileSync(requiredValue(this.unrelatedProfilePath, 'unrelated profile content'), 'utf8'),
      this.unrelatedProfileBefore,
    );
  },
);

/**
 * Build a git project whose worktree and index describe different module
 * graphs, so an architecture run that reads the wrong input produces
 * observably different content.
 */
function createDivergentArchitectureFixture(world: UnifiedInstallWorld): void {
  initializeHosts(world);
  const project = requiredValue(world.projectRoot, 'project root');
  const git = (...args: string[]): void => {
    const completed = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
    assert.equal(completed.status, 0, completed.stderr);
  };
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.safeword/config.json'),
    JSON.stringify({ architectureDocEnforcement: true }),
  );
  const writeModule = (name: string): void => {
    const directory = nodePath.join(project, 'src', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(nodePath.join(directory, 'index.ts'), `export const ${name} = true;\n`);
  };
  writeModule('auth');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');
  git('add', '-A');
  git('commit', '-m', 'initial architecture');
  // Staged-only module: present in the index, absent from HEAD.
  writeModule('billing');
  git('add', '--', 'src/billing/index.ts');
  rmSync(nodePath.join(project, 'src/billing'), { recursive: true });
  // Worktree-only module: never staged.
  writeModule('shipping');
  world.architectureDocument = nodePath.join(project, '.project/architecture.generated.md');
}

function stagedArchitecturePaths(world: UnifiedInstallWorld): string[] {
  const completed = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: requiredValue(world.projectRoot, 'project root'),
    encoding: 'utf8',
  });
  return completed.stdout.split('\n').filter(line => line.length > 0);
}

function readArchitectureDocument(world: UnifiedInstallWorld): string {
  const path = requiredValue(world.architectureDocument, 'architecture document');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

Given(
  'architecture documents can be generated from worktree or index state',
  function (this: UnifiedInstallWorld) {
    createDivergentArchitectureFixture(this);
  },
);

When(
  'the user runs architecture with {string}',
  function (this: UnifiedInstallWorld, flags: string) {
    runRawCommand(this, [
      'project',
      'architecture',
      ...flags.split(' ').filter(flag => flag.length > 0),
    ]);
  },
);

Then(
  'generation reads {string} state and leaves output {string}',
  function (this: UnifiedInstallWorld, input: string, output: string) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const document = readArchitectureDocument(this);
    // `shipping` exists only in the worktree; `billing` only in the index.
    assert.equal(
      document.includes('shipping'),
      input === 'worktree',
      `reading ${input} state produced: ${document}`,
    );
    assert.equal(
      document.includes('billing'),
      input === 'index',
      `reading ${input} state produced: ${document}`,
    );
    assert.equal(
      stagedArchitecturePaths(this).includes('.project/architecture.generated.md'),
      output === 'staged',
    );
  },
);

Given(
  'a project with different worktree and index architecture',
  function (this: UnifiedInstallWorld) {
    createDivergentArchitectureFixture(this);
  },
);

When(
  'the user runs architecture with legacy flag {string}',
  function (this: UnifiedInstallWorld, legacy: string) {
    this.architectureLegacyFlags = legacy;
    runRawCommand(this, ['project', 'architecture', legacy]);
  },
);

Then(
  'it behaves like canonical flags {string} and reports compatibility guidance',
  function (this: UnifiedInstallWorld, canonical: string) {
    const legacy = requiredValue(this.architectureLegacyFlags, 'legacy architecture flag');
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const envelope = JSON.parse(this.result.stdout) as {
      findings?: { code?: string; metadata?: { legacy?: string; replacement?: string } }[];
    };
    assert.equal(
      envelope.findings?.some(
        finding =>
          finding.code === 'CLI_OPTION_DEPRECATED' &&
          finding.metadata?.legacy === legacy &&
          finding.metadata?.replacement === canonical,
      ),
      true,
      `${legacy} did not report ${canonical} as its canonical spelling: ${this.result.stdout}`,
    );
    assert.equal(
      compatibilityRoutes.some(
        route =>
          route.route === `project architecture ${legacy}` &&
          route.replacement === `project architecture ${canonical}`,
      ),
      true,
    );
  },
);

interface ArchitectureRunOutcome {
  readonly document: string;
  readonly baseline: string;
  readonly staged: readonly string[];
  readonly exitCode: number;
}

/** Run one architecture spelling in its own fresh fixture and record the effects. */
function runArchitectureInFreshFixture(
  world: UnifiedInstallWorld,
  flags: string,
): ArchitectureRunOutcome {
  world.retiredFixtureRoots ??= [];
  if (world.fixtureRoot !== undefined) world.retiredFixtureRoots.push(world.fixtureRoot);
  createDivergentArchitectureFixture(world);
  // Generate a Safeword-owned document from the worktree first: regeneration
  // from the index is only observable against an existing owned document, and
  // an unowned file is deliberately left untouched.
  runRawCommand(world, ['project', 'architecture']);
  assert.equal(world.result.exitCode, 0, world.result.stderr || world.result.stdout);
  const baseline = readArchitectureDocument(world);
  runRawCommand(world, [
    'project',
    'architecture',
    ...flags.split(' ').filter(flag => flag.length > 0),
  ]);
  return {
    document: readArchitectureDocument(world),
    baseline,
    staged: stagedArchitecturePaths(world),
    exitCode: world.result.exitCode,
  };
}

Given('divergent worktree and index inputs with an existing generated document', () => {
  // Each spelling builds its own fixture in the comparison below so neither run
  // can observe the other's effects.
});

When(
  'legacy {string} and canonical {string} run in equivalent isolated fixtures',
  function (this: UnifiedInstallWorld, legacy: string, canonical: string) {
    this.architectureLegacyFlags = legacy;
    this.architectureCanonicalFlags = canonical;
    this.architectureLegacyOutcome = runArchitectureInFreshFixture(this, legacy);
    this.architectureCanonicalOutcome = runArchitectureInFreshFixture(this, canonical);
  },
);

Then(
  'generated content and index staging effects are identical',
  function (this: UnifiedInstallWorld) {
    const legacy = requiredValue(this.architectureLegacyFlags, 'legacy architecture flags');
    const canonical = requiredValue(
      this.architectureCanonicalFlags,
      'canonical architecture flags',
    );
    const legacyOutcome = this.architectureLegacyOutcome;
    const canonicalOutcome = this.architectureCanonicalOutcome;
    assert.ok(legacyOutcome && canonicalOutcome, 'both spellings must have run');
    assert.equal(legacyOutcome.exitCode, 0, `${legacy} failed`);
    assert.equal(canonicalOutcome.exitCode, 0, `${canonical} failed`);
    // Guard against a vacuous match: both runs must have produced a real
    // Safeword-owned document, and the two rows of this outline must differ
    // from each other in staging, so a constant implementation cannot pass.
    assert.match(legacyOutcome.document, /<!-- reconciled: [a-f\d]{64} -->/u);
    const documentPath = '.project/architecture.generated.md';
    assert.equal(
      legacyOutcome.staged.includes(documentPath),
      canonical.includes('--stage-output'),
      `${legacy} staging did not follow the ${canonical} contract`,
    );
    assert.equal(
      legacyOutcome.document,
      canonicalOutcome.document,
      `${legacy} and ${canonical} generated different documents`,
    );
    assert.deepEqual(
      legacyOutcome.staged,
      canonicalOutcome.staged,
      `${legacy} and ${canonical} left different index staging effects`,
    );
  },
);

Given(
  'architecture output cannot be tied to a reproducible source state',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When('the user requests staged output', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['project', 'architecture', '--stage-output']);
});

Then(
  'staging is refused and the required input selection is named',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 1);
    const envelope = JSON.parse(this.result.stdout) as {
      errors?: { code?: string; message?: string }[];
    };
    assert.equal(envelope.errors?.[0]?.code, 'ARCHITECTURE_INPUT_REQUIRED');
    assert.match(envelope.errors?.[0]?.message ?? '', /--stage-output requires --from-index/iu);
  },
);

Given(
  'core Claude and Codex already match the requested release',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assertCommandDidNotFail(this);
    const environment = this.hostEnvironment ?? {};
    const codexHome = requiredValue(environment.CODEX_HOME, 'Codex home');
    rmSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'), { force: true });
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) recordCodexHookProof(event, environment);
    runRawCommand(this, ['codex', 'migrate', '--finalize']);
    const preview = JSON.parse(this.result.stdout) as {
      data?: { plan?: { id?: string } };
    };
    const planId = requiredValue(preview.data?.plan?.id, 'Codex finalization plan');
    runRawCommand(this, ['codex', 'migrate', '--finalize', '--yes', '--plan', planId]);
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const finalization = JSON.parse(this.result.stdout) as { state?: string };
    assert.equal(finalization.state, 'changed', this.result.stdout);
    const project = requiredValue(this.projectRoot, 'project root');
    this.projectBefore = readFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'utf8');
    writeFileSync(requiredValue(this.claudeLog, 'Claude log'), '');
    writeFileSync(requiredValue(this.codexLog, 'Codex log'), '');
  },
);

When('the user repeats the default install', function (this: UnifiedInstallWorld) {
  runInstall(this, []);
});

Then(
  'every surface remains unchanged and the result is healthy',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      changed?: boolean;
      state?: string;
      next_actions?: unknown[];
      data?: { surfaces?: { selected?: boolean; state?: string }[] };
    };
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(
      readFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'utf8'),
      this.projectBefore,
    );
    assert.equal(
      readFileSync(nodePath.join(project, '.cursor/customer.json'), 'utf8'),
      '{"ownedBy":"customer"}\n',
    );
    assert.equal(envelope.state, 'healthy', JSON.stringify(envelope));
    assert.equal(envelope.changed, false);
    assert.deepEqual(envelope.next_actions, []);
    assert.equal(
      envelope.data?.surfaces
        ?.filter(surface => surface.selected !== false)
        .every(surface => surface.state === 'healthy'),
      true,
    );
    assert.doesNotMatch(
      readFileSync(requiredValue(this.claudeLog, 'Claude log'), 'utf8'),
      /plugin (?:install|update|enable)/u,
    );
    assert.doesNotMatch(
      readFileSync(requiredValue(this.codexLog, 'Codex log'), 'utf8'),
      /plugin add/u,
    );
  },
);

Given(
  'core configuration has drifted Claude is already healthy and Codex is missing',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assertCommandDidNotFail(this);
    const project = requiredValue(this.projectRoot, 'project root');
    rmSync(nodePath.join(project, '.safeword/SAFEWORD.md'));
    writeFileSync(requiredValue(this.codexState, 'Codex state'), 'absent');
    writeFileSync(requiredValue(this.claudeLog, 'Claude log'), '');
    writeFileSync(requiredValue(this.codexLog, 'Codex log'), '');
  },
);

Then('core drift is reconciled and Codex is installed', function (this: UnifiedInstallWorld) {
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'enabled');
});

Then(
  'healthy Claude state and user-owned content are preserved without duplicate entries',
  function (this: UnifiedInstallWorld) {
    const project = requiredValue(this.projectRoot, 'project root');
    assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
    assert.equal(
      readFileSync(nodePath.join(project, '.cursor/customer.json'), 'utf8'),
      '{"ownedBy":"customer"}\n',
    );
    assert.doesNotMatch(
      readFileSync(requiredValue(this.claudeLog, 'Claude log'), 'utf8'),
      /plugin (?:install|update|enable)/u,
    );
    assert.equal(
      readFileSync(requiredValue(this.codexLog, 'Codex log'), 'utf8')
        .split('\n')
        .filter(line => line === 'plugin add safeword@safeword --json').length,
      1,
    );
  },
);

Given(
  'core and Codex can install but Claude installation fails',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
  },
);

Given(
  'an enrolled project whose Claude plugin is missing and cannot reinstall',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assertCommandDidNotFail(this);
    writeFileSync(requiredValue(this.claudeState, 'Claude state'), 'absent');
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
  },
);

When('the user runs the default install', function (this: UnifiedInstallWorld) {
  if (this.humanInstallSummary === true) runRawCommand(this, ['install'], false);
  else runInstall(this, []);
});

Then('successful core and Codex effects remain recorded', function (this: UnifiedInstallWorld) {
  assert.equal(this.result.exitCode, 1);
  const project = requiredValue(this.projectRoot, 'project root');
  assert.equal(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md')), true);
  assert.equal(readFileSync(requiredValue(this.codexState, 'Codex state'), 'utf8'), 'enabled');
  const envelope = JSON.parse(this.result.stdout) as {
    effects?: { configuration?: { target?: string }[] };
    data?: { surfaces?: { name?: string; state?: string }[] };
  };
  assert.equal(
    envelope.data?.surfaces?.some(
      surface => surface.name === 'project' && surface.state === 'changed',
    ),
    true,
  );
  assert.equal(
    envelope.data?.surfaces?.some(
      surface => surface.name === 'codex' && surface.state !== 'failed',
    ),
    true,
  );
  assert.equal(
    envelope.effects?.configuration?.some(effect => effect.target?.includes('Codex') === true),
    true,
  );
});

Then('Claude is the only failed surface offered for retry', function (this: UnifiedInstallWorld) {
  const envelope = JSON.parse(this.result.stdout) as {
    data?: { surfaces?: { name?: string; state?: string }[] };
    next_actions?: { command?: string }[];
  };
  assert.deepEqual(
    envelope.data?.surfaces
      ?.filter(surface => surface.state === 'failed')
      .map(surface => surface.name),
    ['claude'],
  );
  const retryActions = envelope.next_actions?.filter(action =>
    action.command?.startsWith('safeword install'),
  );
  assert.deepEqual(
    retryActions?.map(action => action.command),
    ['safeword install --agents=claude'],
  );
  assert.equal(
    envelope.next_actions?.some(action => action.command === '/reload-plugins'),
    false,
  );
});

Given(
  'core and Codex succeeded while Claude failed on the prior install',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
    runInstall(this, []);
    assert.equal(this.result.exitCode, 1);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), '');
    this.projectBefore = directoryDigest(
      requiredValue(this.projectRoot, 'project root'),
      new Set(['.claude']),
    );
    writeFileSync(requiredValue(this.claudeLog, 'Claude log'), '');
    writeFileSync(requiredValue(this.codexLog, 'Codex log'), '');
  },
);

When('the user runs the reported Claude retry', function (this: UnifiedInstallWorld) {
  const envelope = JSON.parse(this.result.stdout) as { next_actions?: { command?: string }[] };
  assert.equal(
    envelope.next_actions?.some(action => action.command === 'safeword install --agents=claude'),
    true,
  );
  runInstall(this, ['--agents', 'claude']);
});

Then('Claude converges to healthy', function (this: UnifiedInstallWorld) {
  assertCommandDidNotFail(this);
  assert.equal(readFileSync(requiredValue(this.claudeState, 'Claude state'), 'utf8'), 'enabled');
});

Then('core and Codex are not installed again', function (this: UnifiedInstallWorld) {
  // `.claude` is the Claude surface's own state, which the retry does rewrite.
  assert.equal(
    directoryDigest(requiredValue(this.projectRoot, 'project root'), new Set(['.claude'])),
    this.projectBefore,
  );
  assert.doesNotMatch(
    readFileSync(requiredValue(this.codexLog, 'Codex log'), 'utf8'),
    /plugin (?:marketplace|add)/u,
  );
});

Given(
  'an apply would require an effect not present in the reviewed plan',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, ['--agents', 'cursor']);
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const project = requiredValue(this.projectRoot, 'project root');
    const managedPath = nodePath.join(project, '.safeword/templates/work-log-template.md');
    this.unplannedContent = readFileSync(managedPath, 'utf8');
    rmSync(managedPath);
    runRawCommand(this, ['uninstall', '--agents', 'cursor']);
    const envelope = JSON.parse(this.result.stdout) as { data?: { plan?: { id?: string } } };
    this.planId = envelope.data?.plan?.id;
    assert.match(this.planId ?? '', /^[a-f\d]{64}$/u);
    writeFileSync(managedPath, this.unplannedContent);
    this.fixtureBefore = fixtureEffectDigest(this);
  },
);

When('the user confirms that plan', function (this: UnifiedInstallWorld) {
  runRawCommand(this, [
    'uninstall',
    '--agents',
    'cursor',
    '--yes',
    '--plan',
    requiredValue(this.planId, 'plan id'),
  ]);
});

Then(
  'the unplanned effect is refused and recovery guidance is returned',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 2, this.result.stderr || this.result.stdout);
    assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
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
  },
);

Given(
  'the canonical lifecycle command {string}',
  function (this: UnifiedInstallWorld, command: string) {
    initializeHosts(this);
    this.canonicalCommand = command;
  },
);

Given(
  'the public relay recovery command {string}',
  function (this: UnifiedInstallWorld, command: string) {
    initializeHosts(this);
    this.relayRecoveryCommand = command;
  },
);

When('the user requests global JSON output', function (this: UnifiedInstallWorld) {
  if (this.relayRecoveryCommand !== undefined) {
    runRawCommand(this, [...this.relayRecoveryCommand.split(' '), '--quiet', '--offline']);
    return;
  }
  const command = requiredValue(this.canonicalCommand, 'canonical command');
  const argumentsByCommand: Readonly<Record<string, readonly string[]>> = {
    install: ['install', '--agents', 'none'],
    status: ['status', '--agents', 'none'],
    doctor: ['doctor', '--agents', 'none'],
    plan: ['plan', 'install', '--agents', 'none'],
    uninstall: ['uninstall', '--agents', 'none'],
  };
  const arguments_ = argumentsByCommand[command];
  if (arguments_ === undefined) throw new Error(`Unsupported lifecycle fixture: ${command}`);
  runRawCommand(this, arguments_);
});

Then('capabilities lists the relay recovery command', function (this: UnifiedInstallWorld) {
  const invocation = requiredValue(this.relayRecoveryCommand, 'relay recovery command');
  const command = commandCatalog.find(
    candidate => invocation === candidate.name || invocation.startsWith(`${candidate.name} `),
  )?.name;
  assert.ok(command, `No catalogue command matches relay recovery invocation: ${invocation}`);
  const project = requiredValue(this.projectRoot, 'project root');
  const result = spawnSync(
    process.execPath,
    [CLI_PATH, 'capabilities', '--json', '--cwd', project],
    {
      cwd: project,
      encoding: 'utf8',
      env: fixtureProcessEnvironment(this),
    },
  );
  const envelope = JSON.parse(result.stdout) as { data?: { commands?: { name?: string }[] } };
  assert.equal(
    envelope.data?.commands?.some(candidate => candidate.name === command),
    true,
  );
});

Given('retained profile-only alias {string}', function (this: UnifiedInstallWorld, alias: string) {
  initializeHosts(this);
  this.profileOnlyAlias = alias;
  this.fixtureBefore = fixtureEffectDigest(this);
});

When(
  'the user supplies irrelevant option {string}',
  function (this: UnifiedInstallWorld, option: string) {
    this.irrelevantAliasOption = option;
    runRawCommand(this, [
      ...requiredValue(this.profileOnlyAlias, 'profile-only alias').split(' '),
      option,
      '--offline',
    ]);
  },
);

Then(
  'the parser rejects the option before any profile mutation',
  function (this: UnifiedInstallWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.equal(fixtureEffectDigest(this), this.fixtureBefore);
    assert.notEqual(
      this.result.stdout.trim(),
      '',
      `expected a JSON rejection envelope on stdout: ${this.result.stderr || 'no stderr'}`,
    );
    const envelope = JSON.parse(this.result.stdout) as { errors?: { message?: string }[] };
    assert.match(JSON.stringify(envelope.errors ?? []), /unknown option/iu);
  },
);

Then('the alias remains documented as retained indefinitely', function (this: UnifiedInstallWorld) {
  const alias = requiredValue(this.profileOnlyAlias, 'profile-only alias');
  const route = compatibilityRoutes.find(candidate => candidate.route === alias);
  assert.equal(route?.retention, 'indefinite');
});

Then(
  'stdout contains one versioned result envelope and no prose',
  function (this: UnifiedInstallWorld) {
    const trimmed = this.result.stdout.trim();
    assert.equal(trimmed.startsWith('{') && trimmed.endsWith('}'), true);
    assert.equal(trimmed.split('\n').length, 1);
    const envelope = JSON.parse(trimmed) as { schema_version?: number; ok?: boolean };
    assert.equal(envelope.schema_version, 1);
    assert.equal(typeof envelope.ok, 'boolean');
  },
);

Given(
  'historical raw JSON command {string}',
  function (this: UnifiedInstallWorld, command: string) {
    initializeHosts(this);
    this.historicalCommand = command;
  },
);

When('the user requests its legacy raw format', function (this: UnifiedInstallWorld) {
  const command = requiredValue(this.historicalCommand, 'historical command');
  runRawCommand(this, [...command.split(' '), '--format', 'json'], false);
});

Then(
  'the legacy shape is preserved with compatibility guidance outside stdout',
  function (this: UnifiedInstallWorld) {
    const raw = JSON.parse(this.result.stdout) as Record<string, unknown>;
    assert.equal(raw.schema_version, undefined);
    assert.match(this.result.stderr, /legacy raw JSON.*--json/iu);
  },
);

Then(
  'help and capabilities identify global JSON as canonical',
  function (this: UnifiedInstallWorld) {
    const project = requiredValue(this.projectRoot, 'project root');
    const environment = fixtureProcessEnvironment(this);
    const help = spawnSync(process.execPath, [CLI_PATH, '--help'], {
      cwd: project,
      encoding: 'utf8',
      env: environment,
    });
    assert.match(help.stdout, /--json\s+Write one versioned result envelope as JSON/u);
    const capabilities = spawnSync(
      process.execPath,
      [CLI_PATH, 'capabilities', '--json', '--cwd', project],
      { cwd: project, encoding: 'utf8', env: environment },
    );
    const envelope = JSON.parse(capabilities.stdout) as {
      data?: { machine_output?: { canonical_option?: string } };
    };
    assert.equal(envelope.data?.machine_output?.canonical_option, '--json');
  },
);

Given('core Claude and Codex installation all succeed', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  this.humanInstallSummary = true;
});

Then('the human result names each surface and its outcome', function (this: UnifiedInstallWorld) {
  assert.match(this.result.stdout, /Project: (?:ready|updated|needs attention)/u);
  assert.match(this.result.stdout, /Claude: (?:ready|updated|needs attention)/u);
  assert.match(this.result.stdout, /Codex: (?:ready|updated|needs attention)/u);
});

Then('Cursor is identified as not selected', function (this: UnifiedInstallWorld) {
  assert.match(this.result.stdout, /Cursor: not selected/u);
});

Given(
  'selected surfaces finish with healthy changed and failed outcomes',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
  },
);

Given('Claude and Codex profile installation succeeds', function (this: UnifiedInstallWorld) {
  initializeHosts(this);
  this.humanInstallSummary = true;
});

When('the unified result is rendered', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['install'], false);
});

Then(
  'the aggregate requires action and preserves every per-surface outcome',
  function (this: UnifiedInstallWorld) {
    assert.notEqual(this.result.exitCode, 0);
    const rendered = `${this.result.stdout}\n${this.result.stderr}`;
    assert.match(rendered, /Project: updated/u);
    assert.match(rendered, /Claude: failed/u);
    assert.match(rendered, /Codex: needs attention/u);
    assert.doesNotMatch(rendered, /^Healthy$/mu);
  },
);

Then(
  'Claude reload and Codex restart plus task-resume actions are shown separately',
  function (this: UnifiedInstallWorld) {
    const rendered = `${this.result.stdout}\n${this.result.stderr}`;
    assert.match(rendered, /Claude activation: run \/reload-plugins/u);
    assert.match(rendered, /Codex activation: fully restart Codex/u);
    assert.match(rendered, /Codex activation: resume this Codex task/u);
  },
);

Given(
  'profile plugins are installed but activation proof is pending',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runInstall(this, []);
    assertCommandDidNotFail(this);
  },
);

When('status is observed', function (this: UnifiedInstallWorld) {
  runRawCommand(this, ['status']);
});

Then(
  'activation remains action-required and no active claim is made',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      state?: string;
      findings?: { message?: string }[];
    };
    assert.equal(envelope.state, 'action_required');
    assert.doesNotMatch(JSON.stringify(envelope.findings ?? []), /\bactive\b/iu);
  },
);

Given(
  'core and Codex succeed while the Claude host is unavailable',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'unavailable');
  },
);

When('the default install completes', function (this: UnifiedInstallWorld) {
  runInstall(this, []);
});

Then(
  'the result records core and Codex effects and names Claude unavailable',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      errors?: { message?: string }[];
      data?: { surfaces?: { name?: string; state?: string }[] };
    };
    assert.equal(
      envelope.data?.surfaces?.some(
        surface => surface.name === 'project' && surface.state !== 'failed',
      ),
      true,
    );
    assert.equal(
      envelope.data?.surfaces?.some(
        surface => surface.name === 'codex' && surface.state !== 'failed',
      ),
      true,
    );
    assert.equal(
      envelope.data?.surfaces?.some(
        surface => surface.name === 'claude' && surface.state === 'failed',
      ),
      true,
    );
    assert.match(JSON.stringify(envelope.errors ?? []), /claude/iu);
  },
);

Then('the next action retries only Claude', function (this: UnifiedInstallWorld) {
  const envelope = JSON.parse(this.result.stdout) as {
    next_actions?: { command?: string }[];
  };
  const retries = envelope.next_actions?.filter(action =>
    action.command?.startsWith('safeword install'),
  );
  assert.deepEqual(
    retries?.map(action => action.command),
    ['safeword install --agents=claude'],
  );
});

Given(
  'one selected profile install fails after another surface succeeds',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
    runInstall(this, []);
  },
);

When('the unified result is finalized', () => {
  // The preceding install returns the complete aggregated result.
});

Then(
  'the aggregate is action-required or failed and never healthy',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as { state?: string };
    assert.equal(['action_required', 'failed'].includes(envelope.state ?? ''), true);
    assert.notEqual(envelope.state, 'healthy');
  },
);

Given(
  'a unified install completed with one surface requiring action',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    runRawCommand(this, ['install', '--agents', 'claude'], false);
  },
);

When('a non-technical builder reads the human summary', () => {
  // The preceding step captured the same summary a builder sees.
});

Then(
  'they can identify what is ready what failed and the next action',
  function (this: UnifiedInstallWorld) {
    assert.match(this.result.stdout, /Project: updated/u);
    assert.match(this.result.stdout, /Claude: needs attention/u);
    assert.match(this.result.stdout, /Next: \/reload-plugins/u);
  },
);

Then(
  'no project profile plugin or reconciliation vocabulary is required',
  function (this: UnifiedInstallWorld) {
    assert.doesNotMatch(this.result.stdout, /surface|profile plugin|reconciliation/iu);
  },
);

Given(
  'a unified install completed with mixed per-surface outcomes',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
    writeFileSync(requiredValue(this.claudeFailure, 'Claude failure control'), 'fail');
    runInstall(this, []);
  },
);

When('a technical builder requests verbose or JSON detail', () => {
  // The fixture already requested the canonical JSON envelope.
});

Then(
  'the selected scope and exact per-surface evidence are available',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      data?: {
        selected_agents?: string[];
        surfaces?: { name?: string; selected?: boolean; state?: string }[];
      };
    };
    assert.deepEqual(envelope.data?.selected_agents, ['claude', 'codex']);
    assert.deepEqual(
      envelope.data?.surfaces
        ?.filter(surface => surface.selected !== false)
        .map(surface => [surface.name, surface.state]),
      [
        ['project', 'changed'],
        ['claude', 'failed'],
        ['codex', 'action_required'],
      ],
    );
  },
);

Then(
  'the failed surface has a targeted retry that does not repeat successful work',
  function (this: UnifiedInstallWorld) {
    const envelope = JSON.parse(this.result.stdout) as {
      next_actions?: { command?: string }[];
    };
    const retries = envelope.next_actions?.filter(action =>
      action.command?.startsWith('safeword install'),
    );
    assert.deepEqual(
      retries?.map(action => action.command),
      ['safeword install --agents=claude'],
    );
  },
);
