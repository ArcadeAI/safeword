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
  assertClaudePluginAssetReferences,
  type GeneratedClaudePluginAsset,
} from '../packages/cli/src/claude-plugin/catalogue.js';

interface NativeClaudePluginWorld {
  generation?: { status: number; output: string };
  validation?: { assets: GeneratedClaudePluginAsset[]; error?: Error; root: string };
  lifecycle?: {
    root: string;
    project: string;
    statePath: string;
    projectSnapshot: string;
    profileSnapshot: string;
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
  };
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');

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
    const plugin = nodePath.join(root, 'cache', 'safeword', '0.71.0-rc.0');
    const data = nodePath.join(root, 'data');
    const project = nodePath.join(root, 'project');
    cpSync(PLUGIN_ROOT, plugin, { recursive: true });
    mkdirSync(project, { recursive: true });
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
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
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
      CLAUDE_PROJECT_DIR: REPO_ROOT,
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
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
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
    const plugin = nodePath.join(root, 'cache', 'safeword', '0.71.0-rc.0');
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
  /^the installed plugin cache has (a mismatched hook manifest|a missing hook entrypoint|a modified hook runtime)$/u,
  function (this: NativeClaudePluginWorld, damage: string) {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-damaged-cache-'));
    const plugin = nodePath.join(root, 'cache', 'safeword', '0.71.0-rc.0');
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
  state.plugins = [{ id: 'safeword@safeword', version: '0.71.0-rc.0', enabled: true, scope: 'user' }];
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
    ...overrides,
  };
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
          ref: 'v0.71.0-rc.0',
        },
      ],
      plugins: [
        {
          id: 'safeword@safeword',
          version: '0.71.0-rc.0',
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
    const officialSource = 'https://github.com/ArcadeAI/safeword.git#v0.71.0-rc.0';
    const state = {
      hostVersion: '2.1.170 (Claude Code)',
      failOperation: null,
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
                    : '0.71.0-rc.0',
                enabled: initialState !== 'the exact official Safeword plugin disabled',
                scope: 'user',
              },
            ],
    };
    const profileSnapshot = `${JSON.stringify(state, undefined, 2)}\n`;
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
      plugins: { id: string; version: string; enabled: boolean; scope: string }[];
    };
    assert.deepEqual(state.marketplaces, [
      {
        name: 'safeword',
        source: 'git',
        url: 'https://github.com/ArcadeAI/safeword.git',
        ref: 'v0.71.0-rc.0',
      },
    ]);
    assert.deepEqual(state.plugins, [
      {
        id: 'safeword@safeword',
        version: '0.71.0-rc.0',
        enabled: true,
        scope: 'user',
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
        command:
          'claude plugin marketplace add https://github.com/ArcadeAI/safeword.git#v0.71.0-rc.0 --scope user',
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
    assert.equal(proof.plugin_version, '0.71.0-rc.0');
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
