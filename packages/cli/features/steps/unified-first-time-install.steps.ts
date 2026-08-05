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
  world.parameters = {
    ...world.parameters,
    environment: {
      PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      CODEX_HOME: profile,
      SAFEWORD_CLAUDE_MARKETPLACE: claudeMarketplace,
      SAFEWORD_CLAUDE_PAYLOAD: claudePayload,
      SAFEWORD_CLAUDE_SOURCE: officialClaudeSource,
      SAFEWORD_CLAUDE_STATE: claudeState,
      SAFEWORD_CODEX_MARKETPLACE: codexMarketplace,
      SAFEWORD_CODEX_STATE: codexState,
      SAFEWORD_VERSION: SAFEWORD_SCHEMA.version,
    },
  };
}

function requiredPath(path: string | undefined, label: string): string {
  assert.notEqual(path, undefined, `${label} was not initialized`);
  return path;
}

After(function (this: UnifiedInstallWorld) {
  if (this.fixtureRoot !== undefined) rmSync(this.fixtureRoot, { recursive: true, force: true });
});

Given(
  'an unconfigured project with available Claude and Codex hosts',
  function (this: UnifiedInstallWorld) {
    initializeHosts(this);
  },
);

When(
  'the user runs the canonical install command without an agent selector',
  function (this: UnifiedInstallWorld) {
    const project = requiredPath(this.projectRoot, 'project root');
    const environment = (this.parameters.environment ?? {}) as NodeJS.ProcessEnv;
    const completed = spawnSync(
      process.execPath,
      [CLI_PATH, 'install', '--json', '--cwd', project],
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
    this.result = {
      stdout: completed.stdout,
      stderr: completed.stderr,
      exitCode: completed.status ?? 1,
    };
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
