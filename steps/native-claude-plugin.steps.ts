import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
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
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../packages/cli/src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../packages/cli/src/claude-plugin/historical-ownership.js';

import {
  assertClaudePluginAssetClosure,
  assertClaudePluginAssetReferences,
  type GeneratedClaudePluginAsset,
} from '../packages/cli/src/claude-plugin/catalogue.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { installFakeCodexRuntime } from '../packages/cli/tests/helpers/fake-codex-runtime.js';

interface NativeClaudePluginWorld {
  generation?: { status: number; output: string };
  validation?: { assets: GeneratedClaudePluginAsset[]; error?: Error; root: string };
  lifecycle?: {
    root: string;
    project: string;
    commandCwd?: string;
    configRoot?: string;
    codexHome: string;
    codexLogPath: string;
    statePath: string;
    projectSnapshot: string;
    profileSnapshot: string;
    projectTreeSnapshot?: string;
    configTreeSnapshot?: string;
    completedSnapshot?: string;
    terminalClassification?: string;
    completedOperation?: string;
    otherScopeSnapshot?: string;
    otherScopeSettingsSnapshot?: string;
    selectedScope?: 'project' | 'user';
    overlapHealthSnapshot?: Record<string, string>;
    selectedScopeUnrelatedSettingsSnapshot?: Record<string, unknown>;
    profileFilesOutsideSettingsSnapshot?: string;
    projectFilesOutsideSettingsSnapshot?: string;
    projectSettingsSnapshot?: Record<string, unknown>;
    unrelatedProfile: unknown;
    result?: { status: number; output: string };
    sessionOutputs?: string[];
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
    lifecycleLease?: { path: string; content: string };
  };
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');
const EXPECTED_VERSION = SAFEWORD_SCHEMA.version;
const OFFICIAL_MARKETPLACE_REF = EXPECTED_VERSION.includes('-') ? `v${EXPECTED_VERSION}` : 'stable';
const OFFICIAL_MARKETPLACE_SOURCE = `https://github.com/ArcadeAI/safeword.git#${OFFICIAL_MARKETPLACE_REF}`;
const MARKETPLACE_REGISTRATION_KIND = EXPECTED_VERSION.includes('-') ? 'add' : 'update';

function pluginCachePath(root: string): string {
  return nodePath.join(root, 'cache', 'safeword', EXPECTED_VERSION);
}

function executionProofV2Path(pluginData: string, project: string): string {
  const digest = createHash('sha256').update(realpathSync(project)).digest('hex');
  return nodePath.join(pluginData, 'execution-proofs-v2', `${digest}.json`);
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

function snapshotDirectoryExcept(directory: string, excludedPath: string): string {
  if (!existsSync(directory)) return '[]';
  return JSON.stringify(
    filesBeneath(directory)
      .filter(path => path !== excludedPath)
      .map(path => [path, readFileSync(nodePath.join(directory, path)).toString('base64')]),
  );
}

function fixtureSettingsPath(
  lifecycle: NonNullable<NativeClaudePluginWorld['lifecycle']>,
  scope: 'project' | 'user',
): string {
  return scope === 'project'
    ? nodePath.join(lifecycle.project, '.claude/settings.json')
    : nodePath.join(lifecycle.configRoot ?? '', 'settings.json');
}

function settingsBytes(
  lifecycle: NonNullable<NativeClaudePluginWorld['lifecycle']>,
  scope: 'project' | 'user',
): string {
  const path = fixtureSettingsPath(lifecycle, scope);
  return existsSync(path) ? readFileSync(path, 'utf8') : '<absent>';
}

function unrelatedSettings(settings: string): Record<string, unknown> {
  if (settings === '<absent>') return {};
  const value = JSON.parse(settings) as Record<string, unknown> & {
    enabledPlugins?: Record<string, unknown>;
    extraKnownMarketplaces?: Record<string, unknown>;
  };
  delete value.extraKnownMarketplaces?.safeword;
  delete value.enabledPlugins?.['safeword@safeword'];
  if (typeof value.env === 'object' && value.env !== null) {
    delete (value.env as Record<string, unknown>).CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE;
    if (Object.keys(value.env).length === 0) delete value.env;
  }
  if (Object.keys(value.extraKnownMarketplaces ?? {}).length === 0) {
    delete value.extraKnownMarketplaces;
  }
  if (Object.keys(value.enabledPlugins ?? {}).length === 0) delete value.enabledPlugins;
  return value;
}

function captureScopedPreservation(world: NativeClaudePluginWorld): void {
  assert.ok(world.lifecycle?.selectedScope);
  const lifecycle = world.lifecycle;
  const selectedScope = lifecycle.selectedScope;
  const otherScope = selectedScope === 'project' ? 'user' : 'project';
  const state = JSON.parse(readFileSync(lifecycle.statePath, 'utf8')) as {
    marketplaceDeclarations: Record<string, unknown>[];
    plugins: Record<string, unknown>[];
  };
  lifecycle.otherScopeSnapshot = JSON.stringify({
    marketplaces: state.marketplaceDeclarations.filter(entry => entry.scope === otherScope),
    plugins: state.plugins.filter(entry => entry.scope === otherScope),
  });
  lifecycle.otherScopeSettingsSnapshot = settingsBytes(lifecycle, otherScope);
  lifecycle.selectedScopeUnrelatedSettingsSnapshot = unrelatedSettings(
    settingsBytes(lifecycle, selectedScope),
  );
  lifecycle.projectFilesOutsideSettingsSnapshot = snapshotDirectoryExcept(
    lifecycle.project,
    '.claude/settings.json',
  );
  lifecycle.profileFilesOutsideSettingsSnapshot = snapshotDirectoryExcept(
    lifecycle.configRoot ?? '',
    'settings.json',
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

Given(
  'its .in_use lifecycle lease has exact Claude ownership metadata',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    const path = nodePath.join(this.cacheFixture.plugin, '.in_use', '3455');
    const content = `${JSON.stringify({ pid: 3455, procStart: '2026-08-09T00:00:00.000Z' })}\n`;
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, content);
    this.cacheFixture.lifecycleLease = { path, content };
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
  const commands = (manifest.hooks?.SessionStart ?? [])
    .filter(entry => !('matcher' in entry))
    .flatMap(entry => entry.hooks ?? [])
    .map(hook => hook.command)
    .filter((command): command is string => Boolean(command));
  assert.ok(commands.length > 1, 'generated SessionStart hook commands are missing');
  const input = `${JSON.stringify({
    hook_event_name: 'SessionStart',
    source: 'startup',
    session_id: 'separate-response-test',
    cwd: this.cacheFixture.project,
  })}\n`;
  const results = commands.map(command =>
    spawnSync('bash', ['-lc', command], {
      cwd: this.cacheFixture?.project,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_DATA: this.cacheFixture?.data,
        CLAUDE_PLUGIN_ROOT: this.cacheFixture?.plugin,
        CLAUDE_PROJECT_DIR: this.cacheFixture?.project,
      },
      encoding: 'utf8',
      input,
    }),
  );
  const failed = results.find(result => result.status !== 0);
  this.cacheFixture.sessionOutputs = results
    .map(result => result.stdout?.trim() ?? '')
    .filter(Boolean);
  this.cacheFixture.result = {
    status: failed?.status ?? 0,
    output: failed ? `${failed.stdout ?? ''}${failed.stderr ?? ''}` : '',
  };
});

Then(
  'Claude receives independently valid SessionStart responses containing every sibling context',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    const responses = (this.cacheFixture?.sessionOutputs ?? []).map(output => {
      try {
        return JSON.parse(output) as {
          hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
        };
      } catch {
        return {
          hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: output },
        };
      }
    });
    assert.ok(responses.length > 1);
    assert.ok(
      responses.every(response => response.hookSpecificOutput?.hookEventName === 'SessionStart'),
    );
    const contexts = responses
      .map(response => response.hookSpecificOutput?.additionalContext ?? '')
      .join('\n\n');
    assert.match(contexts, /SAFEWORD\.md/u);
    assert.match(contexts, /Safeword Claude Config/u);
    const contractContext = responses
      .map(response => response.hookSpecificOutput?.additionalContext ?? '')
      .find(context => context.includes('**CONFIDENT**'));
    assert.ok(contractContext && contractContext.length < 10_000);
  },
);

Then(
  'every framework import resolves beneath CLAUDE_PLUGIN_ROOT',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.match(this.cacheFixture.result?.output ?? '', /Current time:/u);
    assert.ok(this.cacheFixture);
    const proof = JSON.parse(
      readFileSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project), 'utf8'),
    ) as { canonical_plugin_root?: string };
    assert.equal(proof.canonical_plugin_root, realpathSync(this.cacheFixture.plugin));
  },
);

Then(
  'it writes plugin proof without reporting an unlisted plugin asset',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.doesNotMatch(this.cacheFixture?.result?.output ?? '', /unlisted asset/u);
    assert.ok(this.cacheFixture);
    assert.ok(existsSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project)));
  },
);

Then('the exact lifecycle lease remains byte-identical', function (this: NativeClaudePluginWorld) {
  assert.ok(this.cacheFixture?.lifecycleLease);
  assert.equal(
    readFileSync(this.cacheFixture.lifecycleLease.path, 'utf8'),
    this.cacheFixture.lifecycleLease.content,
  );
});

Then(
  'execution proof is written beneath CLAUDE_PLUGIN_DATA',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture);
    assert.ok(existsSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project)));
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
      existsSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project)),
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
  'the hook reports the damaged cache without blocking and writes no proof',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
    assert.match(this.cacheFixture?.result?.output ?? '', /damaged native plugin cache/u);
    assert.ok(this.cacheFixture);
    assert.equal(
      existsSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project)),
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
const path = require('node:path');
const statePath = process.env.FAKE_CLAUDE_STATE;
const args = process.argv.slice(2);
const read = () => JSON.parse(fs.readFileSync(statePath, 'utf8'));
const write = value => fs.writeFileSync(statePath, JSON.stringify(value, null, 2) + '\\n');
const state = read();
const operation = args.join(' ');
const settingsPath = scope => scope === 'project'
  ? path.join(state.projectPath, '.claude', 'settings.json')
  : path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
const updateSettings = (scope, update) => {
  const target = settingsPath(scope);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const settings = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
  update(settings);
  fs.writeFileSync(target, JSON.stringify(settings, null, 2) + '\\n');
};
if (args[0] === '--version') { console.log(state.hostVersion); process.exit(0); }
if (state.failOperation && operation.startsWith(state.failOperation)) {
  if ((state.failOperationAfter || 0) > 0) {
    state.failOperationAfter -= 1;
    write(state);
  } else {
  console.error('simulated Claude failure: ' + state.failOperation); process.exit(70);
  }
}
if (operation === 'plugin marketplace list --json') { console.log(JSON.stringify(state.marketplaces)); process.exit(0); }
if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'add') {
  const [url, ref] = args[3].split('#');
  const scope = args[args.indexOf('--scope') + 1];
  const projectPath = scope === 'project' ? state.projectPath : undefined;
  state.marketplaceDeclarations = (state.marketplaceDeclarations || []).filter(entry =>
    entry.name !== 'safeword' || (entry.scope || 'user') !== scope ||
      (scope === 'project' && entry.projectPath !== projectPath));
  state.marketplaceDeclarations.push({ name: 'safeword', source: 'git', url, ref, scope, ...(projectPath && { projectPath }) });
  state.marketplaces = state.marketplaces.filter(entry => entry.name !== 'safeword');
  state.marketplaces.push({ name: 'safeword', source: 'git', url, ref });
  updateSettings(scope, settings => {
    settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
    settings.extraKnownMarketplaces.safeword = { source: { source: 'git', url, ref } };
  });
  write(state); process.exit(0);
}
if (operation === 'plugin list --json') { console.log(JSON.stringify(state.plugins)); process.exit(0); }
if (args[0] === 'plugin' && ['install', 'enable', 'update'].includes(args[1])) {
  const scope = args[args.indexOf('--scope') + 1];
  const projectPath = scope === 'project' ? state.projectPath : undefined;
  state.plugins = state.plugins.filter(entry =>
    entry.id !== 'safeword@safeword' || (entry.scope || 'user') !== scope ||
      (scope === 'project' && entry.projectPath !== projectPath));
  state.plugins.push({ id: 'safeword@safeword', version: '${EXPECTED_VERSION}', enabled: true, scope, installPath: state.installPath, ...(projectPath && { projectPath }) });
  updateSettings(scope, settings => {
    settings.enabledPlugins = settings.enabledPlugins || {};
    settings.enabledPlugins['safeword@safeword'] = true;
  });
  write(state); process.exit(0);
}
console.error('unexpected fake claude command: ' + operation); process.exit(64);
`,
  );
  chmodSync(fakeClaude, 0o755);
}

function materializeScopedSettings(
  project: string,
  configRoot: string,
  marketplaceDeclarations: readonly unknown[],
  plugins: readonly unknown[],
): void {
  for (const scope of ['project', 'user'] as const) {
    const scopedMarketplaces = (marketplaceDeclarations as Record<string, unknown>[]).filter(
      entry => entry.scope === scope,
    );
    const scopedPlugins = (plugins as Record<string, unknown>[]).filter(
      entry => entry.scope === scope,
    );
    if (scopedMarketplaces.length === 0 && scopedPlugins.length === 0) continue;
    const settings: Record<string, unknown> = {};
    const marketplace = scopedMarketplaces.find(entry => entry.name === 'safeword');
    if (marketplace !== undefined) {
      settings.extraKnownMarketplaces = {
        safeword: {
          source: {
            source: marketplace.source,
            url: marketplace.url,
            ref: marketplace.ref,
          },
          ...(marketplace.ref === 'stable' && { autoUpdate: true }),
        },
      };
      if (marketplace.ref === 'stable') {
        settings.env = { CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1' };
      }
    }
    const plugin = scopedPlugins.find(entry => entry.id === 'safeword@safeword');
    if (plugin !== undefined) {
      settings.enabledPlugins = { 'safeword@safeword': plugin.enabled };
    }
    const target =
      scope === 'project'
        ? nodePath.join(project, '.claude/settings.json')
        : nodePath.join(configRoot, 'settings.json');
    mkdirSync(nodePath.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(settings, undefined, 2)}\n`);
  }
}

function createLifecycleFixture(
  world: NativeClaudePluginWorld,
  overrides: Partial<{
    hostVersion: string;
    failOperation: string | null;
    failOperationAfter: number;
    marketplaces: unknown[];
    marketplaceDeclarations: unknown[];
    plugins: unknown[];
    installPath: string;
  }>,
): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-lifecycle-'));
  const project = nodePath.join(root, 'project');
  const fakeBin = nodePath.join(root, 'bin');
  const configRoot = nodePath.join(root, 'claude-config');
  const statePath = nodePath.join(root, 'claude-state.json');
  mkdirSync(project, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(configRoot, { recursive: true });
  const codexRuntime = installFakeCodexRuntime(nodePath.join(root, 'codex-runtime'), {
    pluginEnabled: false,
    pluginInitiallyInstalled: false,
  });
  cpSync(nodePath.join(codexRuntime.bin, 'codex'), nodePath.join(fakeBin, 'codex'));
  writeFileSync(nodePath.join(project, 'keep.txt'), 'project bytes must not change\n');
  const state = {
    hostVersion: '2.1.170 (Claude Code)',
    failOperation: null as string | null,
    failOperationAfter: 0,
    unrelated: { theme: 'dark', custom: ['preserve', 7] },
    projectPath: project,
    marketplaceDeclarations: [] as unknown[],
    marketplaces: [] as unknown[],
    plugins: [] as unknown[],
    installPath: pluginCachePath(root),
    ...overrides,
  };
  cpSync(PLUGIN_ROOT, state.installPath, { recursive: true });
  const profileSnapshot = `${JSON.stringify(state, undefined, 2)}\n`;
  writeFileSync(statePath, profileSnapshot);
  materializeScopedSettings(project, configRoot, state.marketplaceDeclarations, state.plugins);
  writeFakeClaude(fakeBin);
  world.lifecycle = {
    root,
    project,
    configRoot,
    codexHome: codexRuntime.codexHome,
    codexLogPath: codexRuntime.logPath,
    statePath,
    projectSnapshot: readFileSync(nodePath.join(project, 'keep.txt'), 'utf8'),
    profileSnapshot,
    unrelatedProfile: state.unrelated,
  };
}

function createExactScopedFixture(world: NativeClaudePluginWorld, scope: 'project' | 'user'): void {
  createLifecycleFixture(world, {});
  assert.ok(world.lifecycle);
  world.lifecycle.selectedScope = scope;
  const state = JSON.parse(readFileSync(world.lifecycle.statePath, 'utf8')) as {
    installPath: string;
    marketplaceDeclarations: Record<string, unknown>[];
    marketplaces: Record<string, unknown>[];
    plugins: Record<string, unknown>[];
    projectPath: string;
  };
  const projectIdentity = scope === 'project' ? { projectPath: state.projectPath } : {};
  state.marketplaces = [
    {
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: 'stable',
    },
  ];
  state.marketplaceDeclarations = [
    {
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: 'stable',
      scope,
      ...projectIdentity,
    },
  ];
  state.plugins = [
    {
      id: 'safeword@safeword',
      version: EXPECTED_VERSION,
      enabled: true,
      installPath: state.installPath,
      scope,
      ...projectIdentity,
    },
  ];
  writeFileSync(world.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
  materializeScopedSettings(
    world.lifecycle.project,
    world.lifecycle.configRoot ?? '',
    state.marketplaceDeclarations,
    state.plugins,
  );
  world.lifecycle.profileSnapshot = readFileSync(world.lifecycle.statePath, 'utf8');
  world.lifecycle.projectTreeSnapshot = snapshotDirectory(world.lifecycle.project);
  world.lifecycle.configTreeSnapshot = snapshotDirectory(world.lifecycle.configRoot ?? '');
}

function writeCanonicalLegacy(project: string): string {
  const relative = '.claude/skills/debug/SKILL.md';
  const target = nodePath.join(project, relative);
  mkdirSync(nodePath.dirname(target), { recursive: true });
  cpSync(nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/debug/SKILL.md'), target);
  return target;
}

function writeStatusProofV2(
  configRoot: string,
  project: string,
  installPath: string,
  overrides: Record<string, unknown> = {},
): void {
  const identity = JSON.parse(
    readFileSync(nodePath.join(installPath, 'identity.json'), 'utf8'),
  ) as { hook_manifest_sha256: string };
  const canonicalProjectRoot = realpathSync(project);
  const projectDigest = createHash('sha256').update(canonicalProjectRoot).digest('hex');
  const proofPath = nodePath.join(
    configRoot,
    'plugins/data/safeword-safeword/execution-proofs-v2',
    `${projectDigest}.json`,
  );
  mkdirSync(nodePath.dirname(proofPath), { recursive: true });
  writeFileSync(
    proofPath,
    `${JSON.stringify(
      {
        schema_version: 2,
        project_root: canonicalProjectRoot,
        plugin_version: EXPECTED_VERSION,
        hook_manifest_sha256: identity.hook_manifest_sha256,
        canonical_plugin_root: realpathSync(installPath),
        event: 'UserPromptSubmit',
        session_id: 'current-project-proof',
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
    writeStatusProofV2(configRoot, fixture.project, state.installPath, overrides);
  }

  if (stateDescription.includes('durable plugin-mode marker')) {
    const marker = nodePath.join(fixture.project, '.safeword/claude-plugin/plugin-mode-v2.json');
    mkdirSync(nodePath.dirname(marker), { recursive: true });
    writeFileSync(
      marker,
      `${JSON.stringify({
        schema_version: 2,
        state: 'clean',
        plugin_version: EXPECTED_VERSION,
        hook_manifest_sha256: '0'.repeat(64),
        catalogue_sha256: '0'.repeat(64),
        unresolved_paths: [],
      })}\n`,
    );
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
      this.lifecycle.commandCwd ?? this.lifecycle.project,
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
  json = true,
): { status: number; output: string } {
  assert.ok(world.lifecycle);
  const inheritedEnvironment = Object.fromEntries(
    ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT']
      .map(name => [name, process.env[name]])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      ...command,
      ...(json ? ['--json'] : []),
      '--no-input',
      '--cwd',
      world.lifecycle.commandCwd ?? world.lifecycle.project,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...inheritedEnvironment,
        CLAUDE_CONFIG_DIR: world.lifecycle.configRoot,
        CODEX_HOME: world.lifecycle.codexHome,
        FAKE_CLAUDE_STATE: world.lifecycle.statePath,
        SAFEWORD_CODEX_LOG: world.lifecycle.codexLogPath,
        SAFEWORD_SKIP_INSTALL: '1',
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
        nodePath.join(this.lifecycle.project, '.safeword/claude-plugin/plugin-mode-v2.json'),
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
  this.lifecycle.result = runLifecycleCommand(this, ['setup', '--agents=claude']);
});

Then('project-owned Safeword state is created', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
  assert.ok(this.lifecycle);
  assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/version')));
  assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/SAFEWORD.md')));
  // A Claude-only project never reads .safeword/hooks|skills|scripts — native
  // Claude uses its own packaged copies instead (ticket 0VG5AC).
  assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.safeword/skills')), false);
});

Then('no Cursor configuration is materialized', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.cursor')), false);
});

Then(
  'no Claude-only legacy hooks, skills, commands, or agents are materialized',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    for (const legacyDirectory of ['hooks', 'skills', 'commands', 'agents']) {
      assert.equal(
        existsSync(nodePath.join(this.lifecycle.project, '.claude', legacyDirectory)),
        false,
      );
    }
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
  function (this: NativeClaudePluginWorld, acceptedFingerprint: string) {
    createStatusFixture(this, 'valid proof and wholly recognized removable legacy', false);
    assert.ok(this.lifecycle);
    const settings = nodePath.join(this.lifecycle.project, '.claude/settings.json');
    const release =
      acceptedFingerprint === 'the current accepted'
        ? CLAUDE_HISTORICAL_CATALOGUE.current
        : CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'];
    const fingerprint = release.hooks.PreToolUse.find(candidate =>
      JSON.stringify(historicalHookEntry(candidate)).includes('pre-tool-quality'),
    );
    assert.ok(fingerprint, 'catalogue has no accepted pre-tool-quality hook');
    const acceptedHook = historicalHookEntry(fingerprint);
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      `${JSON.stringify(
        {
          theme: 'user-owned',
          hooks: {
            PreToolUse: [
              acceptedHook,
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
  this.lifecycle.result = runLifecycleCommand(this, ['setup', '--agents=claude']);
});

Then(
  'every viable legacy asset and unrelated Claude profile state are preserved',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md'), 'utf8'),
      readFileSync(
        nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/debug/SKILL.md'),
        'utf8',
      ),
    );
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      unrelated?: unknown;
    };
    assert.deepEqual(state.unrelated, this.lifecycle.unrelatedProfile);
  },
);

Then(
  'the result records the user plugin install and recommends reloading it',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      ok?: boolean;
      state?: string;
      errors?: unknown[];
      next_actions?: { command?: string }[];
      effects?: { configuration?: { kind?: string; operation?: string; target?: string }[] };
    };
    assert.equal(result.ok, true);
    assert.equal(result.state, 'action_required');
    assert.deepEqual(result.errors, []);
    assert.ok(
      result.effects?.configuration?.some(
        effect =>
          effect.kind === 'install' &&
          effect.target === 'safeword@safeword' &&
          effect.operation === 'user',
      ),
      JSON.stringify(result),
    );
    assert.ok(result.next_actions?.some(action => action.command === '/reload-plugins'));
    assert.ok(this.lifecycle);
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
      nodePath.join(world.cacheFixture.plugin, 'runtime/dispatch.js'),
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
      schema_version: 2,
      project_root: realpathSync(this.cacheFixture.project),
      plugin_version: EXPECTED_VERSION,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      canonical_plugin_root: realpathSync(this.cacheFixture.plugin),
      event: 'SessionStart',
      session_id: 'prior-cleanup-proof',
      recorded_at: new Date(0).toISOString(),
    })}\n`;
    const proofPath = executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, proof);
    this.cacheFixture.priorProof = proof;
  },
);

Given(
  'a viable recognized legacy PreToolUse hook and the matching plugin hook coexist',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.cacheFixture?.effectLog);
    const fingerprint = CLAUDE_HISTORICAL_CATALOGUE.current.hooks.PreToolUse.find(candidate =>
      JSON.stringify(historicalHookEntry(candidate)).includes('pre-tool-quality'),
    );
    assert.ok(fingerprint, 'catalogue has no accepted pre-tool-quality hook');
    const acceptedHook = historicalHookEntry(fingerprint);
    const hookReference = /\.safeword\/hooks\/[\w./-]+/u.exec(JSON.stringify(acceptedHook))?.[0];
    assert.ok(hookReference, 'accepted PreToolUse hook has no project hook path');
    const legacyHook = nodePath.join(this.cacheFixture.project, hookReference);
    const settings = nodePath.join(this.cacheFixture.project, '.claude/settings.json');
    mkdirSync(nodePath.dirname(legacyHook), { recursive: true });
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    cpSync(
      nodePath.join(REPO_ROOT, 'packages/cli/templates', hookReference.replace('.safeword/', '')),
      legacyHook,
    );
    writeFileSync(settings, `${JSON.stringify({ hooks: { PreToolUse: [acceptedHook] } })}\n`);
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
      readFileSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project), 'utf8'),
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
      readFileSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project), 'utf8'),
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
  this.lifecycle.result = runLifecycleCommand(this, ['setup', '--agents=claude']);
});

Then(
  'no retired Claude hook, skill, command, or agent is recreated',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    for (const legacyDirectory of ['hooks', 'skills', 'commands', 'agents']) {
      assert.equal(
        existsSync(nodePath.join(this.lifecycle.project, '.claude', legacyDirectory)),
        false,
      );
    }
  },
);

Then(
  'project-owned assets remain reconciled while Cursor stays unselected',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.ok(existsSync(nodePath.join(this.lifecycle.project, '.safeword/SAFEWORD.md')));
    // A Claude-only project never reads .safeword/hooks|skills|scripts — native
    // Claude uses its own packaged copies instead (ticket 0VG5AC).
    assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.safeword/skills')), false);
    assert.equal(existsSync(nodePath.join(this.lifecycle.project, '.cursor')), false);
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
  /^the active Claude profile maps the official marketplace in (flattened fields|packed string) form to (\S+)$/u,
  function (this: NativeClaudePluginWorld, sourceShape: string, marketplaceTag: string) {
    const marketplace =
      sourceShape === 'packed string'
        ? {
            name: 'safeword',
            source: `${OFFICIAL_MARKETPLACE_SOURCE.split('#')[0]}#${marketplaceTag}`,
          }
        : {
            name: 'safeword',
            source: 'git',
            url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
            ref: marketplaceTag,
          };
    createLifecycleFixture(this, {
      marketplaces: [marketplace],
    });
  },
);

Given(
  /^a supported Claude profile uses the official marketplace in (flattened fields|packed string) form at (\S+) with plugin (\S+)$/u,
  function (
    this: NativeClaudePluginWorld,
    sourceShape: string,
    marketplaceTag: string,
    pluginVersion: string,
  ) {
    const marketplace =
      sourceShape === 'packed string'
        ? {
            name: 'safeword',
            source: `${OFFICIAL_MARKETPLACE_SOURCE.split('#')[0]}#${marketplaceTag}`,
          }
        : {
            name: 'safeword',
            source: 'git',
            url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
            ref: marketplaceTag,
          };
    createLifecycleFixture(this, {
      marketplaces: [marketplace],
      plugins: [
        {
          id: 'safeword@safeword',
          version: pluginVersion,
          enabled: true,
          scope: 'user',
          installPath: '/unused/stale-safeword-cache',
        },
      ],
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
    const configRoot = nodePath.join(root, 'claude-config');
    const statePath = nodePath.join(root, 'claude-state.json');
    mkdirSync(project, { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    mkdirSync(configRoot, { recursive: true });
    writeFileSync(nodePath.join(project, 'keep.txt'), 'project bytes must not change\n');
    const officialSource = OFFICIAL_MARKETPLACE_SOURCE;
    const state = {
      hostVersion: '2.1.170 (Claude Code)',
      failOperation: null,
      installPath: pluginCachePath(root),
      projectPath: project,
      marketplaceDeclarations: [],
      unrelated: { theme: 'dark', custom: ['preserve', 7] },
      marketplaces:
        initialState === 'no Safeword marketplace or plugin'
          ? []
          : [
              {
                name: 'safeword',
                source: 'git',
                url: officialSource.split('#')[0],
                ref:
                  initialState === 'an enabled older official Safeword plugin version'
                    ? 'v0.70.0'
                    : officialSource.split('#')[1],
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
      configRoot,
      statePath,
      projectSnapshot: readFileSync(nodePath.join(project, 'keep.txt'), 'utf8'),
      profileSnapshot,
      unrelatedProfile: state.unrelated,
    };
  },
);

Given(
  'the current project and Claude profile have no Safeword plugin declaration',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
  },
);

Given(
  /^Safeword has an older official installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, selectedScope: string) {
    const otherScope = selectedScope === 'project' ? 'user' : 'project';
    const scoped = (scope: string, version: string): Record<string, unknown> => ({
      scope,
      ...(scope === 'project' && { projectPath: 'CURRENT_PROJECT' }),
      version,
    });
    createLifecycleFixture(this, {
      marketplaces: [
        {
          name: 'safeword',
          source: 'git',
          url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
          ref: `v${EXPECTED_VERSION}`,
        },
      ],
      marketplaceDeclarations: [
        {
          name: 'safeword',
          source: 'git',
          url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
          ref: 'v0.70.0',
          ...scoped(selectedScope, '0.70.0'),
        },
        {
          name: 'safeword',
          source: 'git',
          url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
          ref: `v${EXPECTED_VERSION}`,
          ...scoped(otherScope, EXPECTED_VERSION),
        },
      ],
      plugins: [
        {
          id: 'safeword@safeword',
          enabled: true,
          installPath: '',
          ...scoped(selectedScope, '0.70.0'),
        },
        {
          id: 'safeword@safeword',
          enabled: true,
          installPath: '',
          ...scoped(otherScope, EXPECTED_VERSION),
        },
      ],
    });
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = selectedScope as 'project' | 'user';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    for (const entries of [state.marketplaceDeclarations, state.plugins]) {
      for (const entry of entries) {
        if (entry.projectPath === 'CURRENT_PROJECT') entry.projectPath = state.projectPath;
        if ('installPath' in entry) entry.installPath = state.installPath;
      }
    }
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
  },
);

Given(
  /^Safeword has no installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, selectedScope: string) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = selectedScope as 'project' | 'user';
  },
);

Given(
  /^Safeword has a disabled exact installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, selectedScope: string) {
    const otherScope = selectedScope === 'project' ? 'user' : 'project';
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = selectedScope as 'project' | 'user';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    const scoped = (scope: string): Record<string, unknown> => ({
      scope,
      ...(scope === 'project' && { projectPath: state.projectPath }),
    });
    state.marketplaces = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: 'stable',
      },
    ];
    state.marketplaceDeclarations = [selectedScope, otherScope].map(scope => ({
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: `v${EXPECTED_VERSION}`,
      ...scoped(scope),
    }));
    state.plugins = [
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: false,
        installPath: state.installPath,
        ...scoped(selectedScope),
      },
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        installPath: state.installPath,
        ...scoped(otherScope),
      },
    ];
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
  },
);

Given(
  /^Safeword has (malformed plugin metadata|a newer official plugin version) at (project|user)$/u,
  function (this: NativeClaudePluginWorld, selectedState: string, selectedScope: string) {
    const otherScope = selectedScope === 'project' ? 'user' : 'project';
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = selectedScope as 'project' | 'user';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    const scoped = (scope: string): Record<string, unknown> => ({
      scope,
      ...(scope === 'project' && { projectPath: state.projectPath }),
    });
    state.marketplaces = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: 'stable',
      },
    ];
    state.marketplaceDeclarations = [selectedScope, otherScope].map(scope => ({
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: 'stable',
      ...scoped(scope),
    }));
    state.plugins = [
      {
        id: 'safeword@safeword',
        version: selectedState === 'malformed plugin metadata' ? { invalid: true } : '999.0.0',
        enabled: true,
        installPath: state.installPath,
        ...scoped(selectedScope),
      },
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        installPath: state.installPath,
        ...scoped(otherScope),
      },
    ];
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
    captureScopedPreservation(this);
  },
);

Given(
  /^Safeword has an exact installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, otherScope: string) {
    assert.ok(this.lifecycle);
    assert.notEqual(otherScope, this.lifecycle.selectedScope);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    const projectIdentity = otherScope === 'project' ? { projectPath: state.projectPath } : {};
    state.marketplaces = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: `v${EXPECTED_VERSION}`,
      },
    ];
    state.marketplaceDeclarations = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: `v${EXPECTED_VERSION}`,
        scope: otherScope,
        ...projectIdentity,
      },
    ];
    state.plugins = [
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        scope: otherScope,
        installPath: state.installPath,
        ...projectIdentity,
      },
    ];
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    this.lifecycle.otherScopeSnapshot = JSON.stringify({
      marketplaces: state.marketplaceDeclarations,
      plugins: state.plugins,
    });
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
  },
);

Given(
  /^the selected (project|user) installation reports the exact version from a damaged cache$/u,
  function (this: NativeClaudePluginWorld, selectedScope: string) {
    createExactScopedFixture(this, selectedScope as 'project' | 'user');
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
    };
    appendFileSync(nodePath.join(state.installPath, 'hooks/hooks.json'), ' ');
  },
);

Given(
  'an exact project installation is recorded at the canonical project root',
  function (this: NativeClaudePluginWorld) {
    createExactScopedFixture(this, 'project');
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    state.projectPath = realpathSync(this.lifecycle.project);
    for (const plugin of state.plugins) plugin.projectPath = state.projectPath;
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
  },
);

Given(
  'the project is accessed through a filesystem alias',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const alias = nodePath.join(this.lifecycle.root, 'project-alias');
    symlinkSync(this.lifecycle.project, alias, 'dir');
    this.lifecycle.project = alias;
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(alias);
  },
);

Given(
  /^the profile contains (an exact project installation for the current project and no user installation|an exact user installation and no current-project entry|an exact user installation and another project's entry)$/u,
  function (this: NativeClaudePluginWorld, installationState: string) {
    const applicableScope = installationState.startsWith('an exact project') ? 'project' : 'user';
    createExactScopedFixture(this, applicableScope);
    assert.ok(this.lifecycle);
    if (installationState.includes("another project's entry")) {
      const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
        installPath: string;
        plugins: Record<string, unknown>[];
      };
      const otherProject = nodePath.join(this.lifecycle.root, 'other-project');
      mkdirSync(otherProject, { recursive: true });
      state.plugins.push({
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        scope: 'project',
        projectPath: otherProject,
        installPath: state.installPath,
      });
      writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
      this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
      this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
      this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
    }
  },
);

Given(
  'neither the current project nor the Claude profile contains an applicable Safeword installation',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
    this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
  },
);

Given(
  /^the current project has applicable project and user installations with (the same exact version|different official versions|one disabled installation)$/u,
  function (this: NativeClaudePluginWorld, overlapState: string) {
    createExactScopedFixture(this, 'project');
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    state.marketplaceDeclarations.push({
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: `v${EXPECTED_VERSION}`,
      scope: 'user',
    });
    const userHealth =
      overlapState === 'different official versions'
        ? 'wrong-version'
        : overlapState === 'one disabled installation'
          ? 'disabled'
          : 'current';
    state.plugins.push({
      id: 'safeword@safeword',
      version: userHealth === 'wrong-version' ? '0.70.0' : EXPECTED_VERSION,
      enabled: userHealth !== 'disabled',
      installPath: state.installPath,
      scope: 'user',
    });
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    this.lifecycle.overlapHealthSnapshot = { project: 'current', user: userHealth };
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
    this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
  },
);

Given(
  'the current project has incompatible project and user installations',
  function (this: NativeClaudePluginWorld) {
    createExactScopedFixture(this, 'project');
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    state.marketplaceDeclarations.push({
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: `v${EXPECTED_VERSION}`,
      scope: 'user',
    });
    state.plugins.push({
      id: 'safeword@safeword',
      version: '0.72.0',
      enabled: true,
      scope: 'user',
      installPath: state.installPath,
    });
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    writeCanonicalLegacy(this.lifecycle.project);
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
    this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
  },
);

Given('exact plugin execution proof exists', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
    installPath: string;
  };
  writeStatusProofV2(this.lifecycle.configRoot ?? '', this.lifecycle.project, state.installPath);
  this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
});

Given(
  /^the current project has one exact proven Safeword installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, applicableScope: string) {
    createExactScopedFixture(this, applicableScope as 'project' | 'user');
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
    };
    writeStatusProofV2(this.lifecycle.configRoot ?? '', this.lifecycle.project, state.installPath);
    this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
  },
);

Given(
  /^the current project has one exact applicable Safeword installation at (project|user)$/u,
  function (this: NativeClaudePluginWorld, applicableScope: string) {
    createExactScopedFixture(this, applicableScope as 'project' | 'user');
  },
);

Given('the command runs from a nested project directory', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  execFileSync('git', ['init', '--quiet', this.lifecycle.project]);
  this.lifecycle.commandCwd = nodePath.join(this.lifecycle.project, 'packages/example');
  mkdirSync(this.lifecycle.commandCwd, { recursive: true });
  this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
});

Given(
  /^that installation has (proof recorded in another project|no plugin execution proof|stale plugin execution proof|self-consistently altered installed hook manifest)$/u,
  function (this: NativeClaudePluginWorld, proofState: string) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
    };
    if (proofState === 'proof recorded in another project') {
      const otherProject = nodePath.join(this.lifecycle.root, 'proof-for-other-project');
      mkdirSync(otherProject, { recursive: true });
      writeStatusProofV2(this.lifecycle.configRoot ?? '', otherProject, state.installPath);
    } else if (proofState === 'stale plugin execution proof') {
      writeStatusProofV2(
        this.lifecycle.configRoot ?? '',
        this.lifecycle.project,
        state.installPath,
        {
          plugin_version: '0.70.0',
        },
      );
    } else if (proofState === 'self-consistently altered installed hook manifest') {
      const manifestPath = nodePath.join(state.installPath, 'hooks/hooks.json');
      const inventoryPath = nodePath.join(state.installPath, 'inventory.json');
      const identityPath = nodePath.join(state.installPath, 'identity.json');
      const manifest = `${JSON.stringify({ hooks: {}, altered: true }, undefined, 2)}\n`;
      writeFileSync(manifestPath, manifest);
      const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
        assets: { path: string; sha256: string }[];
      };
      const asset = inventory.assets.find(candidate => candidate.path === 'hooks/hooks.json');
      assert.ok(asset);
      asset.sha256 = createHash('sha256').update(manifest).digest('hex');
      const inventoryContent = `${JSON.stringify(inventory, undefined, 2)}\n`;
      writeFileSync(inventoryPath, inventoryContent);
      const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as {
        hook_manifest_sha256: string;
        inventory_sha256: string;
      };
      identity.hook_manifest_sha256 = asset.sha256;
      identity.inventory_sha256 = createHash('sha256').update(inventoryContent).digest('hex');
      writeFileSync(identityPath, `${JSON.stringify(identity, undefined, 2)}\n`);
      writeStatusProofV2(
        this.lifecycle.configRoot ?? '',
        this.lifecycle.project,
        state.installPath,
      );
    }
    this.lifecycle.configTreeSnapshot = snapshotDirectory(this.lifecycle.configRoot ?? '');
  },
);

Given(
  /^the (?:current )?project has wholly recognized removable legacy protection$/u,
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    writeCanonicalLegacy(this.lifecycle.project);
    this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
  },
);

Given(
  'the other Claude scope has independent plugin state',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    const selectedScope = this.lifecycle.selectedScope;
    const otherScope = selectedScope === 'project' ? 'user' : 'project';
    this.lifecycle.otherScopeSnapshot = JSON.stringify({
      marketplaces: state.marketplaceDeclarations.filter(entry => entry.scope === otherScope),
      plugins: state.plugins.filter(entry => entry.scope === otherScope),
    });
  },
);

Given('arbitrary project and Claude profile state', function (this: NativeClaudePluginWorld) {
  createLifecycleFixture(this, {
    marketplaces: [{ name: 'third-party', source: 'directory', path: '/preserve' }],
    plugins: [{ id: 'third-party@example', version: '1.2.3', enabled: false, scope: 'user' }],
  });
  assert.ok(this.lifecycle);
  this.lifecycle.projectTreeSnapshot = snapshotDirectory(this.lifecycle.project);
});

Given(
  'the current project has user-authored and third-party Claude settings',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    const settings = {
      env: { TEAM_MODE: 'careful' },
      permissions: { allow: ['Read(./docs/**)'] },
      extraKnownMarketplaces: {
        community: {
          source: {
            source: 'git',
            url: 'https://example.com/community.git',
            ref: 'main',
          },
        },
      },
      enabledPlugins: { 'third-party@community': false },
    };
    const settingsPath = nodePath.join(this.lifecycle.project, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(settings, undefined, 2)}\n`);
    writeFileSync(
      nodePath.join(this.lifecycle.project, '.claude/README.md'),
      'user-authored Claude documentation\n',
    );
    this.lifecycle.selectedScope = 'project';
    this.lifecycle.projectSettingsSnapshot = settings;
    this.lifecycle.projectFilesOutsideSettingsSnapshot = snapshotDirectoryExcept(
      this.lifecycle.project,
      '.claude/settings.json',
    );
  },
);

Given(
  'Safeword has independent declarations at project and user scope',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      projectPath: string;
    };
    const scoped = (scope: 'project' | 'user'): Record<string, unknown> => ({
      scope,
      ...(scope === 'project' && { projectPath: state.projectPath }),
    });
    state.marketplaces = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: `v${EXPECTED_VERSION}`,
      },
    ];
    state.marketplaceDeclarations = (['project', 'user'] as const).map(scope => ({
      name: 'safeword',
      source: 'git',
      url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
      ref: `v${EXPECTED_VERSION}`,
      ...scoped(scope),
    }));
    state.plugins = (['project', 'user'] as const).map(scope => ({
      id: 'safeword@safeword',
      version: EXPECTED_VERSION,
      enabled: true,
      installPath: state.installPath,
      ...scoped(scope),
    }));
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
  },
);

Given(
  'the project-scope marketplace and plugin mutations will complete',
  function (this: NativeClaudePluginWorld) {
    createLifecycleFixture(this, {});
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = 'project';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      installPath: string;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    state.marketplaces = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: `v${EXPECTED_VERSION}`,
      },
    ];
    state.marketplaceDeclarations = [
      {
        name: 'safeword',
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: `v${EXPECTED_VERSION}`,
        scope: 'user',
      },
    ];
    state.plugins = [
      {
        id: 'safeword@safeword',
        version: EXPECTED_VERSION,
        enabled: true,
        installPath: state.installPath,
        scope: 'user',
      },
    ];
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
  },
);

Given(
  'observing the final project-scope installation will fail',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      failOperation: string | null;
      failOperationAfter: number;
    };
    state.failOperation = 'plugin list';
    state.failOperationAfter = 1;
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
    captureScopedPreservation(this);
  },
);

Given(
  /^the selected (project|user) installation is prepared so (no mutation|marketplace registration) complete before (marketplace add|plugin update) fails$/u,
  function (
    this: NativeClaudePluginWorld,
    selectedScope: string,
    _completedEffects: string,
    failingOperation: string,
  ) {
    assert.ok(this.lifecycle);
    this.lifecycle.selectedScope = selectedScope as 'project' | 'user';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      failOperation: string | null;
      marketplaceDeclarations: Record<string, unknown>[];
      marketplaces: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    state.marketplaceDeclarations = state.marketplaceDeclarations.filter(
      entry => entry.scope !== selectedScope,
    );
    if (failingOperation === 'plugin update') {
      const plugin = state.plugins.find(entry => entry.scope === selectedScope);
      assert.ok(plugin);
      plugin.version = '0.70.0';
    }
    state.failOperation =
      failingOperation === 'marketplace add' ? 'plugin marketplace add' : 'plugin update';
    writeFileSync(this.lifecycle.statePath, `${JSON.stringify(state, undefined, 2)}\n`);
    materializeScopedSettings(
      this.lifecycle.project,
      this.lifecycle.configRoot ?? '',
      state.marketplaceDeclarations,
      state.plugins,
    );
    this.lifecycle.profileSnapshot = readFileSync(this.lifecycle.statePath, 'utf8');
    captureScopedPreservation(this);
  },
);

When(
  /^safeword claude install runs with (no scope option|--scope project|--scope user)$/u,
  function (this: NativeClaudePluginWorld, scopeOption: string) {
    assert.ok(this.lifecycle);
    const scopeArguments =
      scopeOption === 'no scope option' ? [] : ['--scope', scopeOption.split(' ').at(-1) ?? ''];
    this.lifecycle.result = runLifecycleCommand(this, ['claude', 'install', ...scopeArguments]);
  },
);

When(
  /^safeword claude install runs with (--scope local|--scope invalid|--scope with no value)$/u,
  function (this: NativeClaudePluginWorld, scopeOption: string) {
    assert.ok(this.lifecycle);
    const scopeArguments =
      scopeOption === '--scope with no value'
        ? ['--scope']
        : ['--scope', scopeOption.split(' ').at(-1) ?? ''];
    this.lifecycle.result = runLifecycleCommand(this, ['claude', 'install', ...scopeArguments]);
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
  /^the exact official Safeword plugin is enabled at (project|user)(?: scope)? for the current project$/u,
  function (this: NativeClaudePluginWorld, scope: string) {
    if (this.lifecycle === undefined) {
      createExactScopedFixture(this, scope as 'project' | 'user');
      return;
    }
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    assert.ok(
      state.plugins.some(
        plugin =>
          plugin.id === 'safeword@safeword' &&
          plugin.version === EXPECTED_VERSION &&
          plugin.enabled === true &&
          plugin.scope === scope &&
          (scope !== 'project' || plugin.projectPath === this.lifecycle?.project),
      ),
    );
    assert.ok(
      state.marketplaceDeclarations.some(
        marketplace =>
          marketplace.name === 'safeword' &&
          marketplace.ref === OFFICIAL_MARKETPLACE_REF &&
          marketplace.scope === scope &&
          (scope !== 'project' || marketplace.projectPath === this.lifecycle?.project),
      ),
    );
  },
);

Then(
  'selected-scope plugin and marketplace state are byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Then(
  'unrelated project and profile state are byte-identical',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
    assert.equal(
      snapshotDirectory(this.lifecycle.configRoot ?? ''),
      this.lifecycle.configTreeSnapshot,
    );
  },
);

Then('the result reports no completed mutation', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    changed?: boolean;
    effects?: Record<string, unknown[]>;
  };
  assert.equal(result.changed, false);
  assert.ok(Object.values(result.effects ?? {}).every(effects => effects.length === 0));
});

Then(
  'installation fails as unverified without reporting a no-op',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      changed?: boolean;
      errors?: { code?: string }[];
      state?: string;
    };
    assert.equal(result.state, 'failed');
    assert.equal(result.changed, false);
    assert.equal(result.errors?.[0]?.code, 'CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED');
  },
);

Then("the other scope's declaration is byte-identical", function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
    marketplaceDeclarations: Record<string, unknown>[];
    plugins: Record<string, unknown>[];
  };
  const selectedScope = this.lifecycle.selectedScope;
  const otherScope = selectedScope === 'project' ? 'user' : 'project';
  assert.equal(
    JSON.stringify({
      marketplaces: state.marketplaceDeclarations.filter(entry => entry.scope === otherScope),
      plugins: state.plugins.filter(entry => entry.scope === otherScope),
    }),
    this.lifecycle.otherScopeSnapshot,
  );
});

Then(
  /^the (project|user) installation is byte-identical$/u,
  function (this: NativeClaudePluginWorld, otherScope: string) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    assert.equal(
      JSON.stringify({
        marketplaces: state.marketplaceDeclarations.filter(entry => entry.scope === otherScope),
        plugins: state.plugins.filter(entry => entry.scope === otherScope),
      }),
      this.lifecycle.otherScopeSnapshot,
    );
  },
);

Then('the result reports scope-overlap', function (this: NativeClaudePluginWorld) {
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    data?: { classification?: string };
  };
  assert.equal(result.data?.classification, 'scope-overlap');
});

Then(
  /^installation reports (unverified metadata|downgrade refused) without changing the selected installation$/u,
  function (this: NativeClaudePluginWorld, classification: string) {
    assert.equal(this.lifecycle?.result?.status, 1, this.lifecycle?.result?.output);
    assert.ok(this.lifecycle);
    const result = JSON.parse(this.lifecycle.result?.output ?? '') as {
      data?: { classification?: string };
    };
    assert.equal(result.data?.classification, classification.replaceAll(' ', '-'));
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  },
);

Then(
  'only the official marketplace, failure fallback, and Safeword plugin declarations are added at project scope',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    assert.ok(this.lifecycle);
    const settings = JSON.parse(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/settings.json'), 'utf8'),
    ) as {
      env?: Record<string, unknown>;
      enabledPlugins?: Record<string, unknown>;
      extraKnownMarketplaces?: Record<string, unknown>;
    };
    assert.deepEqual(settings.extraKnownMarketplaces?.safeword, {
      autoUpdate: true,
      source: {
        source: 'git',
        url: OFFICIAL_MARKETPLACE_SOURCE.split('#')[0],
        ref: OFFICIAL_MARKETPLACE_REF,
      },
    });
    assert.equal(settings.env?.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE, '1');
    assert.equal(settings.enabledPlugins?.['safeword@safeword'], true);
  },
);

Then(
  'every unrelated project setting value is preserved',
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    const settings = JSON.parse(
      readFileSync(nodePath.join(this.lifecycle.project, '.claude/settings.json'), 'utf8'),
    ) as Record<string, unknown> & {
      enabledPlugins?: Record<string, unknown>;
      extraKnownMarketplaces?: Record<string, unknown>;
    };
    delete settings.extraKnownMarketplaces?.safeword;
    delete settings.enabledPlugins?.['safeword@safeword'];
    delete (settings.env as Record<string, unknown> | undefined)
      ?.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE;
    assert.deepEqual(settings, this.lifecycle.projectSettingsSnapshot);
  },
);

Then('every project file outside Claude settings is byte-identical', function () {
  const world = this as NativeClaudePluginWorld;
  assert.ok(world.lifecycle);
  assert.equal(
    snapshotDirectoryExcept(world.lifecycle.project, '.claude/settings.json'),
    world.lifecycle.projectFilesOutsideSettingsSnapshot,
  );
});

Then(
  /^(?:the other scope's|the user-scope) declaration and unrelated state are byte-identical$/u,
  function (this: NativeClaudePluginWorld) {
    assert.ok(this.lifecycle);
    assert.ok(this.lifecycle.selectedScope);
    const otherScope = this.lifecycle.selectedScope === 'project' ? 'user' : 'project';
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
      unrelated: unknown;
    };
    assert.equal(
      JSON.stringify({
        marketplaces: state.marketplaceDeclarations.filter(entry => entry.scope === otherScope),
        plugins: state.plugins.filter(entry => entry.scope === otherScope),
      }),
      this.lifecycle.otherScopeSnapshot,
    );
    assert.deepEqual(state.unrelated, this.lifecycle.unrelatedProfile);
    assert.equal(
      settingsBytes(this.lifecycle, otherScope),
      this.lifecycle.otherScopeSettingsSnapshot,
    );
    assert.deepEqual(
      unrelatedSettings(settingsBytes(this.lifecycle, this.lifecycle.selectedScope)),
      this.lifecycle.selectedScopeUnrelatedSettingsSnapshot,
    );
    assert.equal(
      snapshotDirectoryExcept(this.lifecycle.project, '.claude/settings.json'),
      this.lifecycle.projectFilesOutsideSettingsSnapshot,
    );
    assert.equal(
      snapshotDirectoryExcept(this.lifecycle.configRoot ?? '', 'settings.json'),
      this.lifecycle.profileFilesOutsideSettingsSnapshot,
    );
  },
);

Then(
  'installation reports postcondition verification failure',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 1, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { classification?: string };
      errors?: { code?: string }[];
    };
    assert.equal(result.data?.classification, 'postcondition-verification-failed');
    assert.equal(result.errors?.[0]?.code, 'CLAUDE_PLUGIN_POSTCONDITION_UNVERIFIED');
  },
);

Then(
  'it reports the marketplace and plugin mutations as completed',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      effects?: { configuration?: unknown[] };
    };
    assert.deepEqual(result.effects?.configuration, [
      { kind: MARKETPLACE_REGISTRATION_KIND, target: 'safeword', operation: 'project' },
      { kind: 'enable', target: 'safeword marketplace auto-update', operation: 'project' },
      {
        kind: 'enable',
        target: 'safeword last-known-good marketplace fallback',
        operation: 'project',
      },
      { kind: 'install', target: 'safeword@safeword', operation: 'project' },
    ]);
  },
);

Then(
  /^installation reports that (marketplace add|plugin update) failed$/u,
  function (this: NativeClaudePluginWorld, failingOperation: string) {
    assert.equal(this.lifecycle?.result?.status, 1, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      errors?: { message?: string }[];
    };
    const command =
      failingOperation === 'marketplace add' ? 'plugin marketplace add' : 'plugin update';
    assert.match(result.errors?.[0]?.message ?? '', new RegExp(command, 'u'));
  },
);

Then(
  /^it reports exactly (no mutation|marketplace registration) as completed$/u,
  function (this: NativeClaudePluginWorld, completedEffects: string) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      effects?: { configuration?: unknown[] };
    };
    assert.deepEqual(
      result.effects?.configuration,
      completedEffects === 'no mutation'
        ? []
        : [
            { kind: MARKETPLACE_REGISTRATION_KIND, target: 'safeword', operation: 'user' },
            { kind: 'enable', target: 'safeword marketplace auto-update', operation: 'user' },
            {
              kind: 'enable',
              target: 'safeword last-known-good marketplace fallback',
              operation: 'user',
            },
          ],
    );
  },
);

Then(
  /^the (project|user) plugin and marketplace declarations remain absent$/u,
  function (this: NativeClaudePluginWorld, scope: string) {
    assert.ok(this.lifecycle);
    const state = JSON.parse(readFileSync(this.lifecycle.statePath, 'utf8')) as {
      marketplaceDeclarations: Record<string, unknown>[];
      plugins: Record<string, unknown>[];
    };
    const appliesToScope = (entry: Record<string, unknown>): boolean =>
      (entry.scope ?? 'user') === scope &&
      (scope !== 'project' || entry.projectPath === this.lifecycle?.project);
    assert.equal(state.marketplaceDeclarations.some(appliesToScope), false);
    assert.equal(state.plugins.some(appliesToScope), false);
  },
);

Then(
  /^the result reports (project|user) as the selected scope$/u,
  function (this: NativeClaudePluginWorld, scope: string) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { scope?: string };
    };
    assert.equal(result.data?.scope, scope);
  },
);

Then(
  /^status reports (project|user) as the applicable Safeword scope$/u,
  function (this: NativeClaudePluginWorld, scope: string) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { applicable_scope?: string };
    };
    assert.equal(result.data?.applicable_scope, scope);
  },
);

Then(
  /^human status names (project|user) as the configured scope$/u,
  function (this: NativeClaudePluginWorld, scope: string) {
    const result = runLifecycleCommand(this, ['claude', 'status'], false);
    assert.match(result.output, new RegExp(`configured at ${scope} scope`, 'u'));
  },
);

Then(
  'status reports that Safeword is not installed for the current project',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { applicable_scope?: string; classification?: string };
    };
    assert.equal(result.data?.classification, 'missing');
    assert.equal(result.data?.applicable_scope, undefined);
  },
);

Then(
  'status reports scope-overlap and the identity and health of both installations',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: {
        classification?: string;
        installations?: { health?: string; scope?: string }[];
      };
    };
    assert.equal(result.data?.classification, 'scope-overlap');
    assert.deepEqual(
      Object.fromEntries(
        (result.data?.installations ?? []).map(installation => [
          installation.scope,
          installation.health,
        ]),
      ),
      this.lifecycle?.overlapHealthSnapshot,
    );
  },
);

Then(
  'it names explicit project-scope and user-scope resolution actions',
  function (this: NativeClaudePluginWorld) {
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      next_actions?: { command?: string }[];
    };
    assert.deepEqual(
      result.next_actions?.map(action => action.command),
      [
        'claude plugin uninstall safeword@safeword --scope project',
        'claude plugin uninstall safeword@safeword --scope user',
      ],
    );
  },
);

Then(
  'human status explains both overlapping installations and both resolution choices',
  function (this: NativeClaudePluginWorld) {
    const result = runLifecycleCommand(this, ['claude', 'status'], false);
    assert.match(result.output, /overlapping Claude installations/u);
    assert.match(result.output, /project \(.+\).+user \(.+\)/u);
    assert.match(result.output, /--scope project/u);
    assert.match(result.output, /--scope user/u);
  },
);

Then('only the recognized legacy protection is removed', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 0, this.lifecycle?.result?.output);
  assert.ok(this.lifecycle);
  assert.equal(
    existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')),
    false,
  );
});

Then(
  'cleanup reports unproven without removing legacy protection',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { classification?: string };
    };
    assert.equal(result.data?.classification, 'unproven');
    assert.ok(this.lifecycle);
    assert.equal(
      existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')),
      true,
    );
  },
);

Then(
  'cleanup reports scope-overlap without removing legacy protection',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
    const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
      data?: { classification?: string };
    };
    assert.equal(result.data?.classification, 'scope-overlap');
    assert.ok(this.lifecycle);
    assert.equal(
      existsSync(nodePath.join(this.lifecycle.project, '.claude/skills/debug/SKILL.md')),
      true,
    );
  },
);

Then(
  /^the (project|user) installation and unrelated state remain byte-identical$/u,
  function (this: NativeClaudePluginWorld, _scope: string) {
    assert.ok(this.lifecycle);
    assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
    assert.equal(
      snapshotDirectory(this.lifecycle.configRoot ?? ''),
      this.lifecycle.configTreeSnapshot,
    );
  },
);

Then('installation rejects the unsupported scope', function (this: NativeClaudePluginWorld) {
  assert.equal(this.lifecycle?.result?.status, 1, this.lifecycle?.result?.output);
  const result = JSON.parse(this.lifecycle?.result?.output ?? '') as {
    state?: string;
    errors?: unknown[];
  };
  assert.equal(result.state, 'failed');
  assert.ok((result.errors?.length ?? 0) > 0);
});

Then('project and profile state remain byte-identical', function (this: NativeClaudePluginWorld) {
  assert.ok(this.lifecycle);
  assert.equal(readFileSync(this.lifecycle.statePath, 'utf8'), this.lifecycle.profileSnapshot);
  assert.equal(snapshotDirectory(this.lifecycle.project), this.lifecycle.projectTreeSnapshot);
});

Then(
  'the official marketplace and exact enabled Safeword version exist at user scope',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.lifecycle?.result?.status, 2, this.lifecycle?.result?.output);
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
        ref: OFFICIAL_MARKETPLACE_REF,
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
      { kind: 'enable', target: 'safeword marketplace auto-update', operation: 'user' },
      {
        kind: 'enable',
        target: 'safeword last-known-good marketplace fallback',
        operation: 'user',
      },
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
      [nodePath.join(this.cacheFixture.plugin, 'runtime', 'dispatch.js'), 'UserPromptSubmit'],
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
      readFileSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project), 'utf8'),
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
    assert.ok(existsSync(executionProofV2Path(this.cacheFixture.data, this.cacheFixture.project)));
  },
);
