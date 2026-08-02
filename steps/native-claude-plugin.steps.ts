import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

interface NativeClaudePluginWorld {
  generation?: { status: number; output: string };
  cacheFixture?: {
    root: string;
    plugin: string;
    data: string;
    project: string;
    result?: { status: number; output: string };
  };
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');

After(function (this: NativeClaudePluginWorld) {
  if (this.cacheFixture !== undefined) {
    rmSync(this.cacheFixture.root, { recursive: true, force: true });
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
  const result = spawnSync(
    'bun',
    [nodePath.join(this.cacheFixture.plugin, 'runtime', 'dispatch.ts'), 'SessionStart'],
    {
      cwd: this.cacheFixture.project,
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
});

Then(
  'every framework import resolves beneath CLAUDE_PLUGIN_ROOT',
  function (this: NativeClaudePluginWorld) {
    assert.equal(this.cacheFixture?.result?.status, 0, this.cacheFixture?.result?.output);
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
