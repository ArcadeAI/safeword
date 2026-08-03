import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  assertClaudePluginAssetClosure,
  assertClaudePluginAssetReferences,
  type GeneratedClaudePluginAsset,
} from '../packages/cli/src/claude-plugin/catalogue.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';

interface NativeClaudePluginWorld {
  generation?: { status: number; output: string };
  validation?: { assets: GeneratedClaudePluginAsset[]; error?: Error; root: string };
  lifecycle?: {
    root: string;
    project: string;
    configRoot?: string;
    statePath: string;
    projectSnapshot: string;
    profileSnapshot: string;
    projectTreeSnapshot?: string;
    configTreeSnapshot?: string;
    completedSnapshot?: string;
    terminalClassification?: string;
    completedOperation?: string;
    unrelatedProfile: unknown;
    result?: { status: number; output: string };
  };
  cacheFixture?: {
    root: string;
    plugin: string;
    data: string;
    project: string;
    result?: { status: number; output: string };
    legacySentinel?: string;
    effectLog?: string;
    priorProof?: string;
  };
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');
const EXPECTED_VERSION = SAFEWORD_SCHEMA.version;
const OFFICIAL_MARKETPLACE_SOURCE = `https://github.com/ArcadeAI/safeword.git#v${EXPECTED_VERSION}`;

function pluginCachePath(root: string): string {
  return nodePath.join(root, 'cache', 'safeword', EXPECTED_VERSION);
}

After(function (this: NativeClaudePluginWorld) {
  if (this.cacheFixture !== undefined) {
    rmSync(this.cacheFixture.root, { recursive: true, force: true });
  }
  if (this.validation !== undefined) {
    rmSync(this.validation.root, { recursive: true, force: true });
  }
  if (this.lifecycle !== undefined) {
    rmSync(this.lifecycle.root, { recursive: true, force: true });
  }
});

function filesBeneath(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = nodePath.join(prefix, entry.name);
    const absolute = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return filesBeneath(absolute, relative);
    return entry.isFile() ? [relative] : [];
  });
}

function snapshotDirectory(directory: string): string {
  if (!existsSync(directory)) return '[]';
  return JSON.stringify(
    filesBeneath(directory).map(path => [
      path,
      readFileSync(nodePath.join(directory, path)).toString('base64'),
    ]),
  );
}

Given(
  'the canonical hooks, skills, commands, agents, references, guides, scripts, and templates are valid',
  function () {
    assert.ok(existsSync(nodePath.join(REPO_ROOT, 'packages/cli/templates/skills')));
    assert.ok(existsSync(nodePath.join(REPO_ROOT, 'packages/cli/templates/hooks')));
  },
);

When(
  /^bun run generate:claude-plugin runs from packages\/cli$/u,
  function (this: NativeClaudePluginWorld) {
    const result = spawnSync('bun', ['run', 'generate:claude-plugin'], {
      cwd: nodePath.join(REPO_ROOT, 'packages/cli'),
      encoding: 'utf8',
    });
    this.generation = {
      status: result.status ?? 1,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    };
  },
);

Then(
  'every required transformed asset appears exactly once beneath plugin',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.generation?.status, 0, this.generation?.output);
    const files = filesBeneath(PLUGIN_ROOT);
    assert.equal(new Set(files).size, files.length);
    for (const required of [
      '.claude-plugin/plugin.json',
      'hooks/hooks.json',
      'skills/bdd/SKILL.md',
      'skills/bdd/TDD.md',
      'agents/safeword-retro-filer.md',
    ]) {
      assert.ok(files.includes(required), `missing generated Claude plugin asset: ${required}`);
    }
  },
);

Then('the plugin manifest and every transitive reference resolve within the package', function () {
  const manifest = readFileSync(nodePath.join(PLUGIN_ROOT, 'hooks/hooks.json'), 'utf8');
  assert.match(manifest, /CLAUDE_PLUGIN_ROOT/u);
  for (const path of filesBeneath(PLUGIN_ROOT)) {
    if (!path.endsWith('.md') && !path.endsWith('.json') && !path.endsWith('.ts')) continue;
    const content = readFileSync(nodePath.join(PLUGIN_ROOT, path), 'utf8');
    assert.doesNotMatch(content, /\.\.\/\.\.\/packages\/cli\/templates/u);
  }
});

Given(
  'the installed plugin cache is available without its source checkout or package registry',
  function (this: NativeClaudePluginWorld) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-cache-'));
    const plugin = pluginCachePath(root);
    const data = nodePath.join(root, 'data');
    const project = nodePath.join(root, 'project');
    cpSync(PLUGIN_ROOT, plugin, { recursive: true });
    mkdirSync(project, { recursive: true });
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/version'), `${EXPECTED_VERSION}\n`);
    this.cacheFixture = { root, plugin, data, project };
  },
);

When('a Safeword plugin hook executes', function (this: NativeClaudePluginWorld) {
  assert.ok(this.cacheFixture);
  const manifest = JSON.parse(
    readFileSync(nodePath.join(this.cacheFixture.plugin, 'hooks', 'hooks.json'), 'utf8'),
  ) as { hooks?: { UserPromptSubmit?: { hooks?: { command?: string }[] }[] } };
  const command = manifest.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command;
  assert.ok(command, 'generated UserPromptSubmit hook command is missing');
  const result = spawnSync('bash', ['-lc', command], {
    cwd: this.cacheFixture.project,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: this.cacheFixture.data,
      CLAUDE_PLUGIN_ROOT: this.cacheFixture.plugin,
      CLAUDE_PROJECT_DIR: this.cacheFixture.project,
    },
    encoding: 'utf8',
    input: `${JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      prompt: 'prove the cached plugin',
      session_id: 'cache-wiring-test',
      cwd: this.cacheFixture.project,
    })}\n`,
  });
  this.cacheFixture.result = {
    status: result.status ?? 1,
    output:
      result.status === 0 ? (result.stdout ?? '') : `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

When('its generated SessionStart entrypoint executes', function (this: NativeClaudePluginWorld) {
  assert.ok(this.cacheFixture);
  const manifest = JSON.parse(
    readFileSync(nodePath.join(this.cacheFixture.plugin, 'hooks', 'hooks.json'), 'utf8'),
  ) as { hooks?: { SessionStart?: { hooks?: { command?: string }[] }[] } };
  const command = manifest.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
  assert.ok(command, 'generated SessionStart hook command is missing');
  const result = spawnSync('bash', ['-lc', command], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: this.cacheFixture.data,
      CLAUDE_PLUGIN_ROOT: this.cacheFixture.plugin,
      CLAUDE_PROJECT_DIR: this.cacheFixture.project,
    },
    encoding: 'utf8',
    input: `${JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'startup',
      session_id: 'aggregate-response-test',
      cwd: this.cacheFixture.project,
    })}\n`,
  });
  this.cacheFixture.result = {
    status: result.status ?? 1,
    output:
      result.status === 0 ? (result.stdout ?? '') : `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then(
  'Claude receives one valid SessionStart response containing every sibling context',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    const response = JSON.parse(this.cacheFixture?.result?.output ?? '') as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    assert.equal(response.hookSpecificOutput?.hookEventName, 'SessionStart');
    assert.match(response.hookSpecificOutput?.additionalContext ?? '', /SAFEWORD\.md/u);
    assert.match(response.hookSpecificOutput?.additionalContext ?? '', /SAFE WORD Claude Config/u);
  },
);

Then(
  'every framework import resolves beneath CLAUDE_PLUGIN_ROOT',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.match(this.cacheFixture.result?.output ?? '', /Current time:/u);
    assert.ok(this.cacheFixture);
    const proof = JSON.parse(
      readFileSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json'), 'utf8'),
    ) as { canonical_plugin_root?: string };
    assert.equal(proof.canonical_plugin_root, realpathSync(this.cacheFixture.plugin));
  },
);

Then(
  'execution proof is written beneath CLAUDE_PLUGIN_DATA',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    assert.ok(existsSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json')));
  },
);

Then(
  'ticket, configuration, and runtime project state remain beneath the project root',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    assert.equal(existsSync(nodePath.join(this.cacheFixture.plugin, '.safeword')), false);
  },
);

Given(
  'an intact cached UserPromptSubmit event whose final sibling hook fails',
  function (this: NativeClaudePluginWorld) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-event-failure-'));
    const plugin = pluginCachePath(root);
    const data = nodePath.join(root, 'data');
    const project = nodePath.join(root, 'project');
    cpSync(PLUGIN_ROOT, plugin, { recursive: true });
    const legacySentinel = nodePath.join(project, '.safeword', 'hooks', 'legacy.ts');
    mkdirSync(nodePath.dirname(legacySentinel), { recursive: true });
    writeFileSync(legacySentinel, 'legacy protection remains authoritative\n');

    const eventGroupsPath = nodePath.join(plugin, 'runtime', 'event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: { UserPromptSubmit: { hooks: { type: string; command: string }[] }[] };
    };
    eventGroups.groups.UserPromptSubmit.push({ hooks: [{ type: 'command', command: 'false' }] });
    const eventGroupsContent = `${JSON.stringify(eventGroups, undefined, 2)}\n`;
    writeFileSync(eventGroupsPath, eventGroupsContent);

    const inventoryPath = nodePath.join(plugin, 'inventory.json');
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
      assets: { path: string; sha256: string }[];
    };
    const eventGroupsAsset = inventory.assets.find(
      asset => asset.path === 'runtime/event-groups.json',
    );
    assert.ok(eventGroupsAsset);
    eventGroupsAsset.sha256 = createHash('sha256').update(eventGroupsContent).digest('hex');
    const inventoryContent = `${JSON.stringify(inventory, undefined, 2)}\n`;
    writeFileSync(inventoryPath, inventoryContent);

    const identityPath = nodePath.join(plugin, 'identity.json');
    const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as {
      inventory_sha256: string;
    };
    identity.inventory_sha256 = createHash('sha256').update(inventoryContent).digest('hex');
    writeFileSync(identityPath, `${JSON.stringify(identity, undefined, 2)}\n`);
    this.cacheFixture = { root, plugin, data, project, legacySentinel };
  },
);

Then(
  'the aggregate event fails without writing execution proof',
  function (this: NativeClaudePluginWorld) {
    assert.notEqual(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.ok(this.cacheFixture);
    assert.equal(
      existsSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json')),
      false,
    );
  },
);

Given(
  'a canonical workflow reference resolves through a project .safeword hook, guide, script, or template',
  function (this: NativeClaudePluginWorld) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-reference-'));
    this.validation = {
      root,
      assets: [
        {
          relativePath: 'skills/probe/SKILL.md',
          content:
            '---\nname: probe\ndescription: Probe invalid framework resolution.\n---\n\nRun `bun .safeword/hooks/probe.ts`.\n',
        },
      ],
    };
  },
);

When('the Claude plugin catalogue is validated', function (this: NativeClaudePluginWorld) {
  assert.ok(this.validation);
  try {
    assertClaudePluginAssetReferences(this.validation.assets);
  } catch (error) {
    this.validation.error = error instanceof Error ? error : new Error(String(error));
  }
});

Then(
  'validation fails naming the project-relative dependency',
  function (this: NativeClaudePluginWorld) {
    assert.match(
      this.validation?.error?.message ?? '',
      /skills\/probe\/SKILL\.md.*\.safeword\/hooks\/probe\.ts/u,
    );
  },
);

Then('no plugin catalogue is published', function (this: NativeClaudePluginWorld) {
  assert.ok(this.validation?.error);
});

Given(
  'a canonical Claude skill references a required guide absent from the generated catalogue',
  function (this: NativeClaudePluginWorld) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-closure-'));
    this.validation = {
      root,
      assets: [
        {
          relativePath: 'skills/probe/SKILL.md',
          content:
            '---\nname: probe\ndescription: Probe missing closure.\n---\n\nRead "${CLAUDE_PLUGIN_ROOT}/resources/guides/missing.md".\n',
        },
      ],
    };
  },
);

Given(
  'canonical Claude assets define a skill and flat command with the same invocation name',
  function (this: NativeClaudePluginWorld) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-invocation-'));
    this.validation = {
      root,
      assets: [
        {
          relativePath: 'skills/probe/SKILL.md',
          content: '---\nname: probe\ndescription: Probe duplicate.\n---\n',
        },
        { relativePath: 'commands/probe.md', content: '# Duplicate probe\n' },
      ],
    };
  },
);

When('the Claude plugin catalogue is generated', function (this: NativeClaudePluginWorld) {
  assert.ok(this.validation);
  try {
    assertClaudePluginAssetReferences(this.validation.assets);
    assertClaudePluginAssetClosure(this.validation.assets);
  } catch (error) {
    this.validation.error = error instanceof Error ? error : new Error(String(error));
  }
});

Then(
  'generation fails naming the missing dependency and its referrer',
  function (this: NativeClaudePluginWorld) {
    assert.match(
      this.validation?.error?.message ?? '',
      /skills\/probe\/SKILL\.md.*resources\/guides\/missing\.md/u,
    );
  },
);

Then('the partial catalogue is not accepted', function (this: NativeClaudePluginWorld) {
  assert.ok(this.validation?.error);
});

Then(
  'generation fails naming both conflicting canonical sources',
  function (this: NativeClaudePluginWorld) {
    assert.match(
      this.validation?.error?.message ?? '',
      /skills\/probe\/SKILL\.md.*commands\/probe\.md/u,
    );
  },
);

Then('no ambiguous workflow is packaged', function (this: NativeClaudePluginWorld) {
  assert.ok(this.validation?.error);
});

Given(
  /^the installed plugin cache has (a mismatched hook manifest|a missing hook entrypoint|a modified hook runtime)$/u,
  function (this: NativeClaudePluginWorld, damage: string) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-damaged-cache-'));
    const plugin = pluginCachePath(root);
    const data = nodePath.join(root, 'data');
    const project = nodePath.join(root, 'project');
    cpSync(PLUGIN_ROOT, plugin, { recursive: true });
    const legacySentinel = nodePath.join(project, '.safeword', 'hooks', 'legacy.ts');
    mkdirSync(nodePath.dirname(legacySentinel), { recursive: true });
    writeFileSync(legacySentinel, 'legacy protection remains authoritative\n');
    if (damage === 'a mismatched hook manifest') {
      appendFileSync(nodePath.join(plugin, 'hooks', 'hooks.json'), ' ');
    } else if (damage === 'a missing hook entrypoint') {
      rmSync(nodePath.join(plugin, 'runtime', 'hooks', 'prompt-timestamp.ts'));
    } else {
      appendFileSync(
        nodePath.join(plugin, 'runtime', 'hooks', 'prompt-timestamp.ts'),
        '\n// damaged\n',
      );
    }
    this.cacheFixture = { root, plugin, data, project, legacySentinel };
  },
);

When(
  'its generated UserPromptSubmit entrypoint executes',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    const manifest = JSON.parse(
      readFileSync(nodePath.join(this.cacheFixture.plugin, 'hooks', 'hooks.json'), 'utf8'),
    ) as { hooks?: { UserPromptSubmit?: { hooks?: { command?: string }[] }[] } };
    const command = manifest.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command;
    assert.ok(command);
    const result = spawnSync('bash', ['-lc', command], {
      cwd: this.cacheFixture.project,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_DATA: this.cacheFixture.data,
        CLAUDE_PLUGIN_ROOT: this.cacheFixture.plugin,
        CLAUDE_PROJECT_DIR: this.cacheFixture.project,
      },
      encoding: 'utf8',
      input: '{"hook_event_name":"UserPromptSubmit","prompt":"damaged cache"}\n',
    });
    this.cacheFixture.result = {
      status: result.status ?? 1,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    };
  },
);

Then(
  'the hook rejects the damaged cache and writes no proof',
  function (this: NativeClaudePluginWorld) {
    assert.notEqual(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.ok(this.cacheFixture);
    assert.equal(
      existsSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json')),
      false,
    );
  },
);

Then('viable legacy protection remains authoritative', function (this: NativeClaudePluginWorld) {
  assert.equal(
    readFileSync(this.cacheFixture?.legacySentinel ?? '', 'utf8'),
    'legacy protection remains authoritative\n',
  );
});

function writeFakeClaude(fakeBin: string): void {
  const fakeClaude = nodePath.join(fakeBin, 'claude');
  writeFileSync(
    fakeClaude,
    `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = process.env.FAKE_CLAUDE_STATE;
const args = process.argv.slice(2);
const read = () => JSON.parse(fs.readFileSync(statePath, 'utf8'));
const write = value => fs.writeFileSync(statePath, JSON.stringify(value, null, 2) + '\\n');
const state = read();
const operation = args.join(' ');
if (args[0] === '--version') { console.log(state.hostVersion); process.exit(0); }
if (state.failOperation && operation.startsWith(state.failOperation)) {
  console.error('simulated Claude failure: ' + state.failOperation); process.exit(70);
}
if (operation === 'plugin marketplace list --json') { console.log(JSON.stringify(state.marketplaces)); process.exit(0); }
if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'add') {
  const [url, ref] = args[3].split('#');
  state.marketplaces.push({ name: 'safeword', source: 'git', url, ref }); write(state); process.exit(0);
}
if (operation === 'plugin list --json') { console.log(JSON.stringify(state.plugins)); process.exit(0); }
if (args[0] === 'plugin' && ['install', 'enable', 'update'].includes(args[1])) {
  state.plugins = [{ id: 'safeword@safeword', version: '${EXPECTED_VERSION}', enabled: true, scope: 'user', installPath: state.installPath }];
  write(state); process.exit(0);
}
console.error('unexpected fake claude command: ' + operation); process.exit(64);
`,
  );
  chmodSync(fakeClaude, 0o755);
}

function createLifecycleFixture(
  world: NativeClaudePluginWorld,
  overrides: Partial<{
    hostVersion: string;
    failOperation: string | null;
    marketplaces: unknown[];
    plugins: unknown[];
    installPath: string;
  }>,
): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-lifecycle-'));
  const project = nodePath.join(root, 'project');
  const fakeBin = nodePath.join(root, 'bin');
  const statePath = nodePath.join(root, 'claude-state.json');
  mkdirSync(project, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(nodePath.join(project, 'keep.txt'), 'project bytes must not change\n');
  const state = {
    hostVersion: '2.1.170 (Claude Code)',
    failOperation: null as string | null,
    unrelated: { theme: 'dark', custom: ['preserve', 7] },
    marketplaces: [] as unknown[],
    plugins: [] as unknown[],
    installPath: pluginCachePath(root),
    ...overrides,
  };
  cpSync(PLUGIN_ROOT, state.installPath, { recursive: true });
  const profileSnapshot = `${JSON.stringify(state, undefined, 2)}\n`;
  writeFileSync(statePath, profileSnapshot);
  writeFakeClaude(fakeBin);
  world.lifecycle = {
    root,
    project,
    statePath,
    projectSnapshot: readFileSync(nodePath.join(project, 'keep.txt'), 'utf8'),
    profileSnapshot,
    unrelatedProfile: state.unrelated,
  };
}

function writeCanonicalLegacy(project: string): string {
  const relative = '.claude/skills/debug/SKILL.md';
  const target = nodePath.join(project, relative);
  mkdirSync(nodePath.dirname(target), { recursive: true });
  cpSync(nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/debug/SKILL.md'), target);
  return target;
}

function writeStatusProof(
  configRoot: string,
  installPath: string,
  overrides: Record<string, unknown> = {},
): void {
  const identity = JSON.parse(
    readFileSync(nodePath.join(installPath, 'identity.json'), 'utf8'),
  ) as { hook_manifest_sha256: string };
  const proofPath = nodePath.join(
    configRoot,
    'plugins/data/safeword-safeword/execution-proof-v1.json',
  );
  mkdirSync(nodePath.dirname(proofPath), { recursive: true });
  writeFileSync(
    proofPath,
    `${JSON.stringify(
      {
        schema_version: 1,
        event: 'UserPromptSubmit',
        plugin_version: EXPECTED_VERSION,
        hook_manifest_sha256: identity.hook_manifest_sha256,
        canonical_plugin_root: realpathSync(installPath),
        recorded_at: new Date(0).toISOString(),
        ...overrides,
      },
      undefined,
      2,
    )}\n`,
  );
}

function createStatusFixture(
  world: NativeClaudePluginWorld,
  stateDescription: string,
  viableLegacy: boolean,
): void {
  createLifecycleFixture(world, {});
  assert.ok(world.lifecycle);
  const fixture = world.lifecycle;
  const configRoot = nodePath.join(fixture.root, 'claude-config');
  mkdirSync(configRoot, { recursive: true });
  fixture.configRoot = configRoot;
  const state = JSON.parse(readFileSync(fixture.statePath, 'utf8')) as {
    hostVersion: string;
    failOperation: string | null;
    plugins: Record<string, unknown>[];
    installPath: string;
  };
  state.plugins = [
    {
      id: 'safeword@safeword',
      version: EXPECTED_VERSION,
      enabled: true,
      scope: 'user',
      installPath: state.installPath,
    },
  ];
  if (viableLegacy || stateDescription.includes('recognized removable legacy')) {
    writeCanonicalLegacy(fixture.project);
  }

  if (stateDescription.includes('incomplete transaction')) {
    const transaction = nodePath.join(
      fixture.project,
      '.safeword/claude-plugin/cleanup-transaction-v1.json',
    );
    mkdirSync(nodePath.dirname(transaction), { recursive: true });
    writeFileSync(transaction, '{"schema_version":1}\n');
  } else if (stateDescription.includes('older than')) {
    state.hostVersion = '2.1.169 (Claude Code)';
  } else if (stateDescription.includes('unparseable')) {
    state.hostVersion = 'not a version';
  } else if (stateDescription === 'not installed') {
    state.plugins = [];
  } else if (stateDescription.includes('installed but disabled')) {
    state.plugins[0] = { ...state.plugins[0], enabled: false };
  } else if (stateDescription.includes('different version')) {
    state.plugins[0] = { ...state.plugins[0], version: '0.70.0' };
  } else if (stateDescription.includes('reported unhealthy')) {
    state.failOperation = 'plugin list';
  }
  writeFileSync(fixture.statePath, `${JSON.stringify(state, undefined, 2)}\n`);

  if (stateDescription.includes('malformed proof')) {
    const path = nodePath.join(
      configRoot,
      'plugins/data/safeword-safeword/execution-proof-v1.json',
    );
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, '{not-json\n');
  } else if (
    !stateDescription.includes('without execution proof') &&
    !stateDescription.includes('incomplete transaction') &&
    !stateDescription.includes('older than') &&
    !stateDescription.includes('unparseable') &&
    stateDescription !== 'not installed' &&
    !stateDescription.includes('installed but disabled') &&
    !stateDescription.includes('different version') &&
    !stateDescription.includes('reported unhealthy')
  ) {
    const overrides: Record<string, unknown> = {};
    if (stateDescription.includes('stale version or digest')) {
      overrides.plugin_version = '0.70.0';
    }
    if (stateDescription.includes('different canonical')) {
      overrides.canonical_plugin_root = nodePath.join(fixture.root, 'other-cache');
    }
    writeStatusProof(configRoot, state.installPath, overrides);
  }

  if (stateDescription.includes('durable plugin-mode marker')) {
    const marker = nodePath.join(fixture.project, '.safeword/claude-plugin/plugin-mode-v1.json');
    mkdirSync(nodePath.dirname(marker), { recursive: true });
    writeFileSync(marker, '{"schema_version":1}\n');
  }
  if (stateDescription.includes('recognized and conflicting legacy content')) {
    const conflict = nodePath.join(fixture.project, '.claude/skills/quality-review/SKILL.md');
    mkdirSync(nodePath.dirname(conflict), { recursive: true });
    writeFileSync(conflict, 'user customized legacy protection\n');
  }
  fixture.profileSnapshot = readFileSync(fixture.statePath, 'utf8');
  fixture.projectTreeSnapshot = snapshotDirectory(fixture.project);
  fixture.configTreeSnapshot = snapshotDirectory(configRoot);
}

Given(
  /^the profile and project represent (.+)$/u,
  function (this: NativeClaudePluginWorld, state: string) {
    createStatusFixture(this, state, false);
  },
);

Given(
  /^the project has viable legacy protection and the profile and project represent (.+)$/u,
  function (this: NativeClaudePluginWorld, state: string) {
    createStatusFixture(this, state, true);
  },
);

When('safeword claude status runs', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      'claude',
      'status',
      '--json',
      '--no-input',
      '--cwd',
      this.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: this.lifecycle.configRoot,
        FAKE_CLAUDE_STATE: this.lifecycle.statePath,
        PATH: `${nodePath.join(this.lifecycle.root, 'bin')}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    },
  );
  this.lifecycle.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then(
  /^the versioned JSON classification is (.+) with exit (\d+)$/u,
  function (this: NativeClaudePluginWorld, classification: string, exit: string) {
    assert.equal(this.lifecycle?.result?.status, Number(exit), this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      schema_version?: number;
      data?: { classification?: string };
    };
    assert.equal(result.schema_version, 1);
    assert.equal(result.data?.classification, classification);
  },
);

Then(
  /^it reports (\d+) safe next action named (.+)$/u,
  function (this: NativeClaudePluginWorld, count: string, action: string) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.equal(result.next_actions?.length, Number(count));
    if (action !== 'none') assert.equal(result.next_actions?.[0]?.command, action);
  },
);

Then(
  /^it reports exactly one safe next action named (.+)$/u,
  function (this: NativeClaudePluginWorld, action: string) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(
      result.next_actions?.map(item => item.command),
      [action],
    );
  },
);

Then(
  'profile and project bytes equal their pre-command snapshots',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
    assert.equal(
      snapshotDirectory(this.lifecycle.configRoot ?? ''),
      this.lifecycle.configTreeSnapshot,
    );
  },
);

Then(
  'the viable legacy protection remains authoritative and unchanged',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md'), 'utf8'),
      readFileSync(
        nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/debug/SKILL.md'),
        'utf8',
      ),
    );
  },
);

function runLifecycleCommand(
  world: NativeClaudePluginWorld,
  command: string[],
): { status: number; output: string } {
  assert.ok(world.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      ...command,
      '--json',
      '--no-input',
      '--cwd',
      world.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: world.lifecycle.configRoot,
        FAKE_CLAUDE_STATE: world.lifecycle.statePath,
        PATH: `${nodePath.join(world.lifecycle.root, 'bin')}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    },
  );
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

Given(
  'a cleanup-ready project and a call-recording Claude command adapter',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
  },
);

Given(
  'cleanup preconditions fail and a call-recording Claude command adapter is present',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'enabled without execution proof', true);
  },
);

Given(
  'valid current plugin proof and a plugin-mode project with no Claude legacy assets',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'valid proof, durable plugin-mode marker, and no legacy', false);
  },
);

When('safeword claude cleanup is confirmed', function (this: NativeClaudePluginWorld) {
  const preview = runLifecycleCommand(this, ['claude', 'cleanup']);
  const result = JSON.parse(preview.output) as { data?: { plan?: { id?: string } } };
  const plan = result.data?.plan?.id;
  this.lifecycle!.result =
    typeof plan === 'string'
      ? runLifecycleCommand(this, ['claude', 'cleanup', '--yes', '--plan', plan])
      : preview;
});

Then(
  'the cleanup transaction completes without any marketplace, install, update, enable, reload, or trust call',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
    assert.ok(this.lifecycle);
    assert.equal(
      existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')),
      false,
    );
    assert.equal(
      existsSync(
        nodePath.join(
          this.lifecycle.project,
          '.safeword/claude-plugin/cleanup-transaction-v1.json',
        ),
      ),
      false,
    );
    assert.ok(
      existsSync(
        nodePath.join(this.lifecycle.project, '.safeword/claude-plugin/plugin-mode-v1.json'),
      ),
    );
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Then('cleanup leaves the project unchanged', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
});

Then(
  'it makes no marketplace, install, update, enable, reload, or trust call',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Then('it reports plugin-mode with no next action', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    data?: { classification?: string };
    next_actions?: unknown[];
  };
  assert.equal(result.data?.classification, 'plugin-mode');
  assert.deepEqual(result.next_actions, []);
});

Then('profile and project bytes are unchanged', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
});

Given('a project that has never installed Safeword', function (this: NativeClaudePluginWorld) {
  createLifecycleFixture(this, {});
});

When('safeword setup runs for native Claude delivery', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      'setup',
      '--json',
      '--no-input',
      '--cwd',
      this.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SAFEWORD_SKIP_INSTALL: '1',
        SAFEWORD_SKIP_SKILLS: '1',
      },
      encoding: 'utf8',
    },
  );
  this.lifecycle.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then('project-owned Safeword state is created', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
  assert.ok(this.lifecycle);
  assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/version')));
  assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/skills/debug/SKILL.md')));
  assert.match(
    readFileSync(
      nodePath.join(this.lifecycle.project, '.cursor/rules/safeword-debugging.mdc'),
      'utf8',
    ),
    /@\.safeword\/skills\/debug\/SKILL\.md/u,
  );
});

Then(
  'no Claude-only legacy hooks, skills, commands, or agents are materialized',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.claude')), false);
  },
);

Then(
  'the result recommends safeword claude install without changing the Claude profile',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const result = JSON.parse(this.lifecycle.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.ok(result.next_actions?.some(action => action.command === 'safeword claude install'));
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Given(
  /^a cleanup-ready project with (the current accepted|a historical accepted) Safeword assets and mixed user and third-party Claude settings$/u,
  function (this: NativeClaudePluginWorld, _fingerprint: string) {
    createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
    assert.ok(this.lifecycle);
    const settings = nodePath.join(this.lifecycle.project, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      `${JSON.stringify(
        {
          theme: 'user-owned',
          hooks: {
            PreToolUse: [
              { hooks: [{ type: 'command', command: 'bun .safeword/hooks/pre-tool-quality.ts' }] },
              { hooks: [{ type: 'command', command: 'third-party protect' }] },
            ],
          },
        },
        undefined,
        2,
      )}\n`,
    );
    const cursor = nodePath.join(this.lifecycle.project, '.cursor/keep.json');
    const projectOwned = nodePath.join(this.lifecycle.project, '.safeword/user-state.json');
    mkdirSync(nodePath.dirname(cursor), { recursive: true });
    mkdirSync(nodePath.dirname(projectOwned), { recursive: true });
    writeFileSync(cursor, '{"cursor":"keep"}\n');
    writeFileSync(projectOwned, '{"project":"keep"}\n');
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
  },
);

Then(
  'only the recognized Safeword files and settings entries are removed',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')),
      false,
    );
    const settings = readFileSync(
      nodePath.join(this.lifecycle.project, '.claude/settings.json'),
      'utf8',
    );
    assert.doesNotMatch(settings, /\.safeword\/hooks/u);
    assert.match(settings, /third-party protect/u);
  },
);

Then(
  'user-authored, third-party, Cursor-shared, and project-owned assets are byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      readFileSync(nodePath.join(this.lifecycle.project, '.cursor/keep.json'), 'utf8'),
      '{"cursor":"keep"}\n',
    );
    assert.equal(
      readFileSync(nodePath.join(this.lifecycle.project, '.safeword/user-state.json'), 'utf8'),
      '{"project":"keep"}\n',
    );
    assert.match(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/settings.json'), 'utf8'),
      /"theme": "user-owned"/u,
    );
  },
);

Then(
  'the complete Claude profile is byte-identical to its pre-command snapshot',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.equal(
      snapshotDirectory(this.lifecycle.configRoot ?? ''),
      this.lifecycle.configTreeSnapshot,
    );
  },
);

Given('a cleanup-ready project and profile', function (this: NativeClaudePluginWorld) {
  createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
});

When(
  'the user declines safeword claude cleanup confirmation',
  function (this: NativeClaudePluginWorld) {
    this.lifecycle!.result = runLifecycleCommand(this, ['claude', 'cleanup']);
  },
);

Then('every profile and project file is byte-identical', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
  assert.equal(
    snapshotDirectory(this.lifecycle.configRoot ?? ''),
    this.lifecycle.configTreeSnapshot,
  );
});

Then('no Claude lifecycle command is invoked', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
});

Given(
  'a cleanup-ready project whose managed Claude skill path contains content with no accepted Safeword fingerprint',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
    assert.ok(this.lifecycle);
    writeFileSync(
      nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md'),
      'user-authored unknown skill\n',
    );
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
  },
);

Then('cleanup refuses to contract that project', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    data?: { classification?: string };
  };
  assert.equal(result.data?.classification, 'coexistence');
});

Then(
  'the unknown content and every unrelated project file remain byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
  },
);

Given(
  'an existing project has viable legacy Claude protection and arbitrary profile state',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    writeCanonicalLegacy(this.lifecycle.project);
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
  },
);

When('ordinary safeword setup upgrades the project', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      'setup',
      '--json',
      '--no-input',
      '--cwd',
      this.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
      encoding: 'utf8',
    },
  );
  this.lifecycle.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then(
  'every viable legacy asset and the complete Claude profile are byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md'), 'utf8'),
      readFileSync(
        nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/debug/SKILL.md'),
        'utf8',
      ),
    );
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Then(
  'the result recommends the explicit Claude lifecycle command without invoking it',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.ok(result.next_actions?.some(action => action.command === 'safeword claude install'));
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

function createAuthorityFixture(world: NativeClaudePluginWorld): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-authority-'));
  const plugin = pluginCachePath(root);
  const data = nodePath.join(root, 'data');
  const project = nodePath.join(root, 'project');
  const effectLog = nodePath.join(root, 'effects.log');
  cpSync(PLUGIN_ROOT, plugin, { recursive: true });
  mkdirSync(project, { recursive: true });
  world.cacheFixture = { root, plugin, data, project, effectLog };
}

function runAuthorityHook(world: NativeClaudePluginWorld, event: string): void {
  assert.ok(world.cacheFixture?.effectLog);
  const command = `printf 'plugin\\n' >> ${JSON.stringify(world.cacheFixture.effectLog)}`;
  const result = spawnSync(
    'bun',
    [
      nodePath.join(world.cacheFixture.plugin, 'runtime/dispatch.ts'),
      event,
      '--',
      'bash',
      '-lc',
      command,
    ],
    {
      cwd: world.cacheFixture.project,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_DATA: world.cacheFixture.data,
        CLAUDE_PLUGIN_ROOT: world.cacheFixture.plugin,
        CLAUDE_PROJECT_DIR: world.cacheFixture.project,
      },
      input: `${JSON.stringify({ hook_event_name: event, session_id: 'authority-test' })}\n`,
      encoding: 'utf8',
    },
  );
  world.cacheFixture.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

Given(
  'current cleanup-authorizing SessionStart proof exists',
  function (this: NativeClaudePluginWorld) {
    createAuthorityFixture(this);
    assert.ok(this.cacheFixture);
    const identity = JSON.parse(
      readFileSync(nodePath.join(this.cacheFixture.plugin, 'identity.json'), 'utf8'),
    ) as { hook_manifest_sha256: string };
    mkdirSync(this.cacheFixture.data, { recursive: true });
    const proof = `${JSON.stringify({
      schema_version: 1,
      plugin_version: EXPECTED_VERSION,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      canonical_plugin_root: realpathSync(this.cacheFixture.plugin),
      event: 'SessionStart',
      recorded_at: new Date(0).toISOString(),
    })}\n`;
    writeFileSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json'), proof);
    this.cacheFixture.priorProof = proof;
  },
);

Given(
  'a viable recognized legacy PreToolUse hook and the matching plugin hook coexist',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture?.effectLog);
    const legacyHook = nodePath.join(this.cacheFixture.project, '.safeword/hooks/legacy.ts');
    const settings = nodePath.join(this.cacheFixture.project, '.claude/settings.json');
    mkdirSync(nodePath.dirname(legacyHook), { recursive: true });
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(legacyHook, '// recognized legacy authority\n');
    writeFileSync(
      settings,
      `${JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'bun .safeword/hooks/legacy.ts' }] }] } })}\n`,
    );
    writeFileSync(this.cacheFixture.effectLog, 'legacy\n');
  },
);

When('the plugin PreToolUse hook executes', function (this: NativeClaudePluginWorld) {
  runAuthorityHook(this, 'PreToolUse');
});

Then(
  'the bundled identity is validated without writing new cleanup-authorizing proof',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.ok(this.cacheFixture);
    assert.equal(
      readFileSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json'), 'utf8'),
      this.cacheFixture.priorProof,
    );
  },
);

Then(
  'the protected functional effect occurs exactly once through the viable legacy hook',
  function (this: NativeClaudePluginWorld) {
    assert.equal(readFileSync(this.cacheFixture?.effectLog ?? '', 'utf8'), 'legacy\n');
  },
);

Given('no viable legacy SessionStart hook exists', function (this: NativeClaudePluginWorld) {
  createAuthorityFixture(this);
});

When('the plugin SessionStart hook executes', function (this: NativeClaudePluginWorld) {
  runAuthorityHook(this, 'SessionStart');
});

Then(
  'its functional effect occurs exactly once and exact plugin proof is recorded',
  function (this: NativeClaudePluginWorld) {
    assert.equal(readFileSync(this.cacheFixture?.effectLog ?? '', 'utf8'), 'plugin\n');
    assert.ok(this.cacheFixture);
    const proof = JSON.parse(
      readFileSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json'), 'utf8'),
    ) as { event?: string; plugin_version?: string };
    assert.deepEqual([proof.event, proof.plugin_version], ['SessionStart', EXPECTED_VERSION]);
  },
);

Given(
  /^Claude lists the exact Safeword plugin as enabled but its proof is (.+)$/u,
  function (this: NativeClaudePluginWorld, proofState: string) {
    const descriptions: Record<string, string> = {
      missing: 'enabled without execution proof',
      'bound to a stale plugin version': 'proven with a stale version or digest',
      'bound to the wrong hook-manifest digest': 'proven with a stale version or digest',
      malformed: 'represented by a malformed proof record',
      'bound to a different canonical cache path':
        'proven from a different canonical installed cache path',
    };
    createStatusFixture(this, descriptions[proofState] ?? proofState, true);
  },
);

Then(
  'cleanup returns unproven without removing or disabling any legacy asset',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { classification?: string };
    };
    assert.equal(result.data?.classification, 'unproven');
    assert.ok(this.lifecycle);
    assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')));
  },
);

Then(
  'complete profile and project snapshots are unchanged',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
    assert.equal(
      snapshotDirectory(this.lifecycle.configRoot ?? ''),
      this.lifecycle.configTreeSnapshot,
    );
  },
);

Then(
  'no marketplace, install, update, enable, reload, or trust call occurs',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Given(
  'the current task has exact plugin proof and is in post-cleanup state with no matching legacy authority',
  function (this: NativeClaudePluginWorld) {
    createAuthorityFixture(this);
  },
);

When('the next matching plugin event executes', function (this: NativeClaudePluginWorld) {
  runAuthorityHook(this, 'SessionStart');
});

Then('the plugin functional effect occurs exactly once', function (this: NativeClaudePluginWorld) {
  assert.equal(readFileSync(this.cacheFixture?.effectLog ?? '', 'utf8'), 'plugin\n');
});

Then('no plugin reload or task restart is required', function (this: NativeClaudePluginWorld) {
  assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
});

function resultClassification(output: string): string | undefined {
  return (JSON.parse(output) as { data?: { classification?: string } }).data?.classification;
}

Given(
  /^(safeword claude install|safeword claude cleanup|safeword claude recover) has completed successfully$/u,
  function (this: NativeClaudePluginWorld, operation: string) {
    if (operation.endsWith('install')) {
      createLifecycleFixture(this, {
        marketplaces: [
          {
            name: 'safeword',
            source: 'git',
            url: 'https://github.com/ArcadeAI/safeword.git',
            ref: `v${EXPECTED_VERSION}`,
          },
        ],
        plugins: [
          {
            id: 'safeword@safeword',
            version: EXPECTED_VERSION,
            enabled: true,
            scope: 'user',
            installPath: '',
          },
        ],
      });
      assert.ok(this.lifecycle);
      const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
        plugins: Record<string, unknown>[];
        installPath: string;
      };
      state.plugins[0] = { ...state.plugins[0], installPath: state.installPath };
      writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
      this.lifecycle.result = runLifecycleCommand(this, ['claude', 'install']);
    } else if (operation.endsWith('cleanup')) {
      createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
      const preview = runLifecycleCommand(this, ['claude', 'cleanup']);
      const id = (JSON.parse(preview.output) as { data?: { plan?: { id?: string } } }).data?.plan
        ?.id;
      assert.ok(id);
      this.lifecycle!.result = runLifecycleCommand(this, [
        'claude',
        'cleanup',
        '--yes',
        '--plan',
        id,
      ]);
    } else {
      createLifecycleFixture(this, {});
      this.lifecycle!.result = runLifecycleCommand(this, ['claude', 'recover']);
    }
    assert.ok(this.lifecycle?.result);
    this.lifecycle.completedOperation = operation;
    this.lifecycle.terminalClassification = resultClassification(this.lifecycle.result.output);
    this.lifecycle.completedSnapshot = JSON.stringify({
      project: snapshotDirectory(this.lifecycle.project),
      config: snapshotDirectory(this.lifecycle.configRoot ?? ''),
      profile: readFileSync(this.lifecycle.statePath, 'utf8'),
    });
  },
);

When(
  /^the same (safeword claude install|safeword claude cleanup|safeword claude recover) runs again$/u,
  function (this: NativeClaudePluginWorld, operation: string) {
    this.lifecycle!.result = runLifecycleCommand(this, operation.split(' ').slice(1));
  },
);

Then(
  'its owned profile or project state is byte-identical to the completed state',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      JSON.stringify({
        project: snapshotDirectory(this.lifecycle.project),
        config: snapshotDirectory(this.lifecycle.configRoot ?? ''),
        profile: readFileSync(this.lifecycle.statePath, 'utf8'),
      }),
      this.lifecycle.completedSnapshot,
    );
  },
);

Then(
  'unrelated profile and project state is byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      unrelated?: unknown;
    };
    assert.deepEqual(state.unrelated, this.lifecycle.unrelatedProfile);
  },
);

Then(
  'the versioned JSON result has the same successful terminal classification',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
    assert.equal(
      resultClassification(this.lifecycle?.result?.output ?? ''),
      this.lifecycle?.terminalClassification,
    );
  },
);

Given(
  'a project has an incomplete durable Claude cleanup transaction',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'accompanied by an incomplete transaction', true);
  },
);

When('a new safeword claude cleanup runs', function (this: NativeClaudePluginWorld) {
  this.lifecycle!.result = runLifecycleCommand(this, ['claude', 'cleanup']);
});

Then(
  'it fails in recovery-required state without changing the project',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    assert.equal(resultClassification(this.lifecycle?.result?.output ?? ''), 'recovery-required');
    assert.ok(this.lifecycle);
    assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
  },
);

Then(
  'the sole safe next action is safeword claude recover',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(
      result.next_actions?.map(action => action.command),
      ['safeword claude recover'],
    );
  },
);

Given(
  'a successfully cleaned project carries its durable plugin-mode marker',
  function (this: NativeClaudePluginWorld) {
    createStatusFixture(this, 'valid proof, durable plugin-mode marker, and no legacy', false);
  },
);

When('safeword setup runs again', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      'setup',
      '--json',
      '--no-input',
      '--cwd',
      this.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
      encoding: 'utf8',
    },
  );
  this.lifecycle.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then(
  'no retired Claude hook, skill, command, agent, or settings entry is recreated',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.claude')), false);
  },
);

Then(
  'project-owned and Cursor-shared assets remain reconciled',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/skills/debug/SKILL.md')));
    assert.ok(
      existsSync(nodePath.join(this.lifecycle.project, '.cursor/rules/safeword-debugging.mdc')),
    );
  },
);

Given(
  /^the Claude executable reports (2\.1\.169|unparseable output)$/u,
  function (this: NativeClaudePluginWorld, version: string) {
    createLifecycleFixture(this, {
      hostVersion: version === 'unparseable output' ? version : `${version} (Claude Code)`,
    });
  },
);

Given(
  'the active Claude profile maps the Safeword marketplace name to a different source',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {
      marketplaces: [{ name: 'safeword', source: 'https://example.com/impostor.git#v9' }],
    });
  },
);

Given(
  'the exact enabled plugin metadata points to a cache without native identity',
  function (this: NativeClaudePluginWorld) {
    const installPath = nodePath.join(tmpdir(), 'safeword-legacy-plugin-payload');
    createLifecycleFixture(this, {
      marketplaces: [
        {
          name: 'safeword',
          source: 'git',
          url: 'https://github.com/ArcadeAI/safeword.git',
          ref: `v${EXPECTED_VERSION}`,
        },
      ],
      plugins: [
        {
          id: 'safeword@safeword',
          version: EXPECTED_VERSION,
          enabled: true,
          scope: 'user',
          installPath,
        },
      ],
    });
  },
);

Given(
  /^a supported Claude profile whose (plugin install|plugin list) command fails$/u,
  function (this: NativeClaudePluginWorld, operation: string) {
    createLifecycleFixture(this, { failOperation: operation });
  },
);

Given(
  /^a Claude Code 2\.1\.170 or newer profile with (no Safeword marketplace or plugin|the exact official Safeword plugin disabled|an enabled older official Safeword plugin version)$/u,
  function (this: NativeClaudePluginWorld, initialState: string) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-install-'));
    const project = nodePath.join(root, 'project');
    const fakeBin = nodePath.join(root, 'bin');
    const statePath = nodePath.join(root, 'claude-state.json');
    mkdirSync(project, { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(nodePath.join(project, 'keep.txt'), 'project bytes must not change\n');
    const officialSource = OFFICIAL_MARKETPLACE_SOURCE;
    const state = {
      hostVersion: '2.1.170 (Claude Code)',
      failOperation: null,
      installPath: pluginCachePath(root),
      unrelated: { theme: 'dark', custom: ['preserve', 7] },
      marketplaces:
        initialState === 'no Safeword marketplace or plugin'
          ? []
          : [
              {
                name: 'safeword',
                source: 'git',
                url: officialSource.split('#')[0],
                ref: officialSource.split('#')[1],
              },
            ],
      plugins:
        initialState === 'no Safeword marketplace or plugin'
          ? []
          : [
              {
                id: 'safeword@safeword',
                version:
                  initialState === 'an enabled older official Safeword plugin version'
                    ? '0.70.0'
                    : EXPECTED_VERSION,
                enabled: initialState !== 'the exact official Safeword plugin disabled',
                scope: 'user',
                installPath: pluginCachePath(root),
              },
            ],
    };
    const profileSnapshot = `${JSON.stringify(state, undefined, 2)}\n`;
    cpSync(PLUGIN_ROOT, state.installPath, { recursive: true });
    writeFileSync(statePath, profileSnapshot);
    writeFakeClaude(fakeBin);
    this.lifecycle = {
      root,
      project,
      statePath,
      projectSnapshot: readFileSync(nodePath.join(project, 'keep.txt'), 'utf8'),
      profileSnapshot,
      unrelatedProfile: state.unrelated,
    };
  },
);

When('safeword claude install runs', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages', 'cli', 'src', 'cli.ts'),
      'claude',
      'install',
      '--json',
      '--no-input',
      '--cwd',
      this.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        FAKE_CLAUDE_STATE: this.lifecycle.statePath,
        PATH: `${nodePath.join(this.lifecycle.root, 'bin')}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    },
  );
  this.lifecycle.result = {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
});

Then(
  'the official marketplace and exact enabled Safeword version exist at user scope',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaces: { name: string; source: string }[];
      plugins: {
        id: string;
        version: string;
        enabled: boolean;
        scope: string;
        installPath: string;
      }[];
    };
    assert.deepEqual(state.marketplaces, [
      {
        name: 'safeword',
        source: 'git',
        url: 'https://github.com/ArcadeAI/safeword.git',
        ref: `v${EXPECTED_VERSION}`,
      },
    ]);
    assert.deepEqual(state.plugins, [
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        scope: 'user',
        installPath: pluginCachePath(this.lifecycle.root),
      },
    ]);
  },
);

Then('every project file is byte-identical', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(
    readFileSync(nodePath.join(this.lifecycle.project, 'keep.txt'), 'utf8'),
    this.lifecycle.projectSnapshot,
  );
  assert.deepEqual(filesBeneath(this.lifecycle.project), ['keep.txt']);
});

Then('unrelated profile state is byte-identical', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
    unrelated: unknown;
  };
  assert.deepEqual(state.unrelated, this.lifecycle.unrelatedProfile);
});

Then(
  /^the result names \/reload-plugins as the sole immediate action$/u,
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(result.next_actions, [
      { command: '/reload-plugins', mutates: false, requires_human: true },
    ]);
  },
);

Then(
  'it returns unsupported-host with profile and project state byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1);
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.deepEqual(filesBeneath(this.lifecycle.project), ['keep.txt']);
    const result = JSON.parse(this.lifecycle.result?.output ?? '') as { data?: unknown };
    assert.deepEqual(result.data, {
      command: 'claude install',
      classification: 'unsupported-host',
    });
  },
);

Then(
  'upgrading or reinstalling Claude Code is the sole safe next action',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(result.next_actions, [
      { command: 'claude update', mutates: true, requires_human: true },
    ]);
  },
);

Then(
  'installation fails without changing the project or the conflicting marketplace',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1);
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.deepEqual(filesBeneath(this.lifecycle.project), ['keep.txt']);
  },
);

Then(
  'the result names the official marketplace identity as the safe next action',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(result.next_actions, [
      {
        command: `claude plugin marketplace add ${OFFICIAL_MARKETPLACE_SOURCE} --scope user`,
        mutates: true,
        requires_human: true,
      },
    ]);
  },
);

Then(
  'installation fails as unverified without changing the project',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1);
    assert.ok(this.lifecycle);
    assert.deepEqual(filesBeneath(this.lifecycle.project), ['keep.txt']);
    const result = JSON.parse(this.lifecycle.result?.output ?? '') as {
      errors?: { code?: string }[];
    };
    assert.equal(result.errors?.[0]?.code, 'CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED');
  },
);

Then(
  'no reload action is reported for the legacy cached payload',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.equal(
      result.next_actions?.some(action => action.command === '/reload-plugins'),
      false,
    );
  },
);

Then(
  'it returns errored without changing project files or unrelated profile values',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1);
    assert.ok(this.lifecycle);
    assert.deepEqual(filesBeneath(this.lifecycle.project), ['keep.txt']);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      unrelated?: unknown;
    };
    assert.deepEqual(state.unrelated, this.lifecycle.unrelatedProfile);
    const result = JSON.parse(this.lifecycle.result?.output ?? '') as { data?: unknown };
    assert.deepEqual(result.data, { command: 'claude install', classification: 'errored' });
  },
);

Then(
  'profile files outside the observed Claude command write set are byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const before = JSON.parse(this.lifecycle.profileSnapshot) as { unrelated?: unknown };
    const after = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      unrelated?: unknown;
    };
    assert.deepEqual(after.unrelated, before.unrelated);
  },
);

Then(
  'every profile effect completed before the failure is reported exactly',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      effects?: { configuration?: unknown[] };
    };
    assert.deepEqual(result.effects?.configuration, [
      { kind: 'add', target: 'safeword', operation: 'user' },
    ]);
  },
);

Then('the result names one repair or retry action', function (this: NativeClaudePluginWorld) {
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    next_actions?: unknown[];
  };
  assert.equal(result.next_actions?.length, 1);
});

Given(
  'an authenticated Claude task has installed or updated Safeword and supports plugin reload',
  function () {
    // A direct dispatcher invocation cannot establish this precondition. Keep
    // the live lane visibly pending until an authenticated harness actually
    // installs, reloads, and submits a prompt through Claude.
    return 'pending';
  },
);

When(
  /^the user submits the first prompt after \/reload-plugins$/u,
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    const result = spawnSync(
      'bun',
      [nodePath.join(this.cacheFixture.plugin, 'runtime', 'dispatch.ts'), 'UserPromptSubmit'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          CLAUDE_PLUGIN_DATA: this.cacheFixture.data,
          CLAUDE_PLUGIN_ROOT: this.cacheFixture.plugin,
          CLAUDE_PROJECT_DIR: this.cacheFixture.project,
        },
        encoding: 'utf8',
      },
    );
    this.cacheFixture.result = {
      status: result.status ?? 1,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    };
  },
);

Then(
  'UserPromptSubmit records the exact installed version, hook-manifest digest, and canonical reloaded cache path before the prompt proceeds',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.ok(this.cacheFixture);
    const proof = JSON.parse(
      readFileSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json'), 'utf8'),
    ) as {
      event?: string;
      plugin_version?: string;
      hook_manifest_sha256?: string;
      canonical_plugin_root?: string;
    };
    assert.equal(proof.event, 'UserPromptSubmit');
    assert.equal(proof.plugin_version, EXPECTED_VERSION);
    assert.match(proof.hook_manifest_sha256 ?? '', /^[\da-f]{64}$/u);
    assert.equal(proof.canonical_plugin_root, realpathSync(this.cacheFixture.plugin));
    const manifest = readFileSync(
      nodePath.join(this.cacheFixture.plugin, 'hooks/hooks.json'),
      'utf8',
    );
    assert.match(manifest, /runtime\/dispatch\.ts[^\n]+UserPromptSubmit/u);
  },
);

Then(
  'status observes current-task plugin proof without requiring a restart',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    assert.ok(existsSync(nodePath.join(this.cacheFixture.data, 'execution-proof-v1.json')));
  },
);
