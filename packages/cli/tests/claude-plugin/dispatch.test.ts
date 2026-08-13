import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../../src/claude-plugin/historical-ownership.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function temporary(prefix: string): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function releasedAsset(projectDirectory: string): string {
  const release = CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'];
  const installedPath = Object.keys(release.files)[0];
  if (installedPath === undefined) throw new Error('Release 0.72.0 has no Claude fixture.');
  const schema = execFileSync('git', ['show', 'v0.72.0:packages/cli/src/schema.ts'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const escaped = installedPath.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  // eslint-disable-next-line security/detect-non-literal-regexp -- escaped fixture path is test-owned
  const template = new RegExp(
    String.raw`['"]${escaped}['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]`,
    'su',
  ).exec(schema)?.[1];
  const target = nodePath.join(projectDirectory, installedPath);
  mkdirSync(nodePath.dirname(target), { recursive: true });
  writeFileSync(
    target,
    execFileSync('git', ['show', `v0.72.0:packages/cli/templates/${template}`], {
      cwd: REPO_ROOT,
    }),
  );
  return target;
}

function promptSettings(projectDirectory: string, marketplace: unknown): void {
  const fingerprint =
    CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.UserPromptSubmit?.[0] ?? '';
  const hook = historicalHookEntry(fingerprint);
  const command = /\.safeword\/hooks\/[\w./-]+/u.exec(JSON.stringify(hook))?.[0];
  if (command === undefined) throw new Error('Historical prompt hook has no project hook path.');
  const hookTarget = nodePath.join(projectDirectory, command);
  mkdirSync(nodePath.dirname(hookTarget), { recursive: true });
  writeFileSync(hookTarget, '// viable legacy authority\n');
  const settings = nodePath.join(projectDirectory, '.claude/settings.json');
  mkdirSync(nodePath.dirname(settings), { recursive: true });
  writeFileSync(
    settings,
    `${JSON.stringify({
      enabledPlugins: { 'safeword@safeword': true },
      extraKnownMarketplaces: { safeword: marketplace },
      hooks: { UserPromptSubmit: [hook] },
    })}\n`,
  );
}

function dispatchPrompt(
  projectDirectory: string,
  pluginData: string,
  configDirectory: string | undefined,
  sessionId: string,
  options: { readonly homeDirectory?: string; readonly pluginRoot?: string } = {},
) {
  return dispatchEvent(projectDirectory, pluginData, configDirectory, sessionId, {
    ...options,
    event: 'UserPromptSubmit',
  });
}

function dispatchEvent(
  projectDirectory: string,
  pluginData: string,
  configDirectory: string | undefined,
  sessionId: string,
  options: {
    readonly event: string;
    readonly homeDirectory?: string;
    readonly hookInput?: Readonly<Record<string, unknown>>;
    readonly omitProjectDirectory?: boolean;
    readonly pluginRoot?: string;
  },
) {
  const { event } = options;
  const pluginRoot = options.pluginRoot ?? PLUGIN_ROOT;
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PLUGIN_DATA: pluginData,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PROJECT_DIR: projectDirectory,
    HOME: options.homeDirectory ?? process.env.HOME,
  };
  if (options.omitProjectDirectory === true) delete environment.CLAUDE_PROJECT_DIR;
  if (configDirectory === undefined) delete environment.CLAUDE_CONFIG_DIR;
  else environment.CLAUDE_CONFIG_DIR = configDirectory;
  return spawnSync(
    'bun',
    [nodePath.join(pluginRoot, 'runtime/dispatch.js'), event, '--event-group'],
    {
      cwd: projectDirectory,
      env: environment,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: projectDirectory,
        hook_event_name: event,
        session_id: sessionId,
        ...options.hookInput,
      }),
    },
  );
}

function refreshPluginIdentity(pluginRoot: string, changedAssets: readonly string[] = []): void {
  const inventoryPath = nodePath.join(pluginRoot, 'inventory.json');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
    assets: { path: string; sha256: string }[];
  };
  for (const changedAsset of changedAssets) {
    const asset = inventory.assets.find(candidate => candidate.path === changedAsset);
    if (asset === undefined) throw new Error(`Missing ${changedAsset} inventory asset.`);
    asset.sha256 = createHash('sha256')
      .update(readFileSync(nodePath.join(pluginRoot, changedAsset)))
      .digest('hex');
  }
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, undefined, 2)}\n`);
  const identityPath = nodePath.join(pluginRoot, 'identity.json');
  const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as {
    inventory_sha256: string;
  };
  identity.inventory_sha256 = createHash('sha256')
    .update(readFileSync(inventoryPath))
    .digest('hex');
  writeFileSync(identityPath, `${JSON.stringify(identity, undefined, 2)}\n`);
}

describe('Claude plugin dispatcher', () => {
  it('passes the bundled CLI path to aggregate child hooks', () => {
    const projectDirectory = temporary('safeword-plugin-project-');
    const pluginData = temporary('safeword-plugin-data-');
    mkdirSync(nodePath.join(projectDirectory, '.safeword'));
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PLUGIN_DATA: pluginData,
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
      CLAUDE_PROJECT_DIR: projectDirectory,
    };
    delete environment.SAFEWORD_PLUGIN_CLI;

    const result = spawnSync(
      'bun',
      [nodePath.join(PLUGIN_ROOT, 'runtime/dispatch.js'), 'SessionStart', '--event-group'],
      {
        cwd: projectDirectory,
        env: environment,
        encoding: 'utf8',
        input: JSON.stringify({
          hook_event_name: 'SessionStart',
          session_id: 'dispatch-environment-test',
        }),
      },
    );

    expect(result.stderr).not.toContain('Module not found');
    expect(result.status, result.stderr).toBe(0);
    const projectDigest = createHash('sha256').update(realpathSync(projectDirectory)).digest('hex');
    const proofPath = nodePath.join(pluginData, 'execution-proofs-v2', `${projectDigest}.json`);
    expect(existsSync(proofPath)).toBe(true);
    expect(JSON.parse(readFileSync(proofPath, 'utf8'))).toMatchObject({
      event: 'SessionStart',
      session_id: 'dispatch-environment-test',
    });
  });

  it('automatically contracts a released project through the generated runtime', () => {
    const projectDirectory = temporary('safeword-plugin-migration-project-');
    const pluginData = temporary('safeword-plugin-migration-data-');
    const configDirectory = temporary('safeword-plugin-migration-config-');
    const marketplace = { source: { source: 'github', repo: 'ArcadeAI/safeword' } };
    const target = releasedAsset(projectDirectory);
    promptSettings(projectDirectory, marketplace);
    writeFileSync(
      nodePath.join(configDirectory, 'settings.json'),
      `${JSON.stringify({ enabledPlugins: {}, extraKnownMarketplaces: {} })}\n`,
    );

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'migration');
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(target)).toBe(false);
    expect(
      existsSync(nodePath.join(projectDirectory, '.safeword/claude-plugin/plugin-mode-v2.json')),
    ).toBe(true);
    const settings = JSON.parse(
      readFileSync(nodePath.join(projectDirectory, '.claude/settings.json'), 'utf8'),
    );
    expect(settings.enabledPlugins).toEqual({ 'safeword@safeword': true });
    expect(settings.extraKnownMarketplaces.safeword).toEqual(marketplace);
  });

  it('uses the hook cwd when Claude omits CLAUDE_PROJECT_DIR', () => {
    const projectDirectory = temporary('safeword-plugin-cwd-fallback-project-');
    const pluginData = temporary('safeword-plugin-cwd-fallback-data-');
    const configDirectory = temporary('safeword-plugin-cwd-fallback-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-cwd-fallback-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const target = releasedAsset(projectDirectory);
    promptSettings(projectDirectory, {
      source: { source: 'github', repo: 'ArcadeAI/safeword' },
    });
    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"nativeRan":true}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchEvent(projectDirectory, pluginData, configDirectory, 'cwd-fallback', {
      event: 'UserPromptSubmit',
      omitProjectDirectory: true,
      pluginRoot,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('nativeRan');
    expect(existsSync(target)).toBe(false);
    expect(
      existsSync(nodePath.join(projectDirectory, '.safeword/claude-plugin/plugin-mode-v2.json')),
    ).toBe(true);
  });

  it('recognizes legacy hook authority in Claude JSONC settings', () => {
    const projectDirectory = temporary('safeword-plugin-jsonc-project-');
    const pluginData = temporary('safeword-plugin-jsonc-data-');
    const configDirectory = temporary('safeword-plugin-jsonc-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-jsonc-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    promptSettings(projectDirectory, { source: { source: 'github', repo: 'ArcadeAI/safeword' } });
    const settingsPath = nodePath.join(projectDirectory, '.claude/settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      settingsPath,
      `{\n  // Claude settings permit comments and trailing commas.\n  "enabledPlugins": ${JSON.stringify(settings.enabledPlugins)},\n  "extraKnownMarketplaces": ${JSON.stringify(settings.extraKnownMarketplaces)},\n  "hooks": ${JSON.stringify(settings.hooks)},\n}\n`,
    );

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"nativeRan":true}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'jsonc', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('nativeRan');
  });

  it('does not treat partially parsed malformed settings as legacy authority', () => {
    const projectDirectory = temporary('safeword-plugin-malformed-settings-project-');
    const pluginData = temporary('safeword-plugin-malformed-settings-data-');
    const configDirectory = temporary('safeword-plugin-malformed-settings-config-');
    const pluginRoot = nodePath.join(
      temporary('safeword-plugin-malformed-settings-root-'),
      'plugin',
    );
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    promptSettings(projectDirectory, { source: { source: 'github', repo: 'ArcadeAI/safeword' } });
    const settingsPath = nodePath.join(projectDirectory, '.claude/settings.json');
    writeFileSync(settingsPath, `${readFileSync(settingsPath, 'utf8')} unexpected-token\n`);

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"nativeRan":true}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'malformed', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('nativeRan');
  });

  it('does not let an unrecognized legacy-looking entry suppress native hooks', () => {
    const projectDirectory = temporary('safeword-plugin-unrecognized-authority-project-');
    const pluginData = temporary('safeword-plugin-unrecognized-authority-data-');
    const configDirectory = temporary('safeword-plugin-unrecognized-authority-config-');
    const pluginRoot = nodePath.join(
      temporary('safeword-plugin-unrecognized-authority-root-'),
      'plugin',
    );
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const customHook = nodePath.join(projectDirectory, '.safeword/hooks/custom.ts');
    mkdirSync(nodePath.dirname(customHook), { recursive: true });
    writeFileSync(customHook, '// not owned by Safeword\n');
    const settingsPath = nodePath.join(projectDirectory, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settingsPath), { recursive: true });
    writeFileSync(
      settingsPath,
      `${JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/custom.ts',
                },
              ],
            },
          ],
        },
      })}\n`,
    );

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"nativeRan":true}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'unrecognized', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('nativeRan');
  });

  it('does not let a symlinked legacy hook directory suppress native hooks', () => {
    const projectDirectory = temporary('safeword-plugin-symlink-authority-project-');
    const pluginData = temporary('safeword-plugin-symlink-authority-data-');
    const configDirectory = temporary('safeword-plugin-symlink-authority-config-');
    const pluginRoot = nodePath.join(
      temporary('safeword-plugin-symlink-authority-root-'),
      'plugin',
    );
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    promptSettings(projectDirectory, { source: { source: 'github', repo: 'ArcadeAI/safeword' } });
    const settings = readFileSync(nodePath.join(projectDirectory, '.claude/settings.json'), 'utf8');
    const hookReference = /\.safeword\/hooks\/[^\s"';&|)]+/u.exec(settings)?.[0];
    if (hookReference === undefined) throw new Error('Historical settings have no hook path.');
    const hooksRoot = nodePath.join(projectDirectory, '.safeword/hooks');
    rmSync(hooksRoot, { recursive: true });
    const externalHooks = temporary('safeword-plugin-external-hooks-');
    const externalTarget = nodePath.join(
      externalHooks,
      nodePath.relative('.safeword/hooks', hookReference),
    );
    mkdirSync(nodePath.dirname(externalTarget), { recursive: true });
    writeFileSync(externalTarget, '// outside the project\n');
    symlinkSync(externalHooks, hooksRoot, 'dir');

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"nativeRan":true}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'symlinked', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('nativeRan');
  });

  it('treats valid non-object hook input as empty input', () => {
    const projectDirectory = temporary('safeword-plugin-non-object-input-project-');
    const pluginData = temporary('safeword-plugin-non-object-input-data-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-non-object-input-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.SessionStart = [
      {
        matcher: 'compact',
        hooks: [{ type: 'command', command: String.raw`printf '{"matched":true}\n'` }],
      },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PLUGIN_DATA: pluginData,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PROJECT_DIR: projectDirectory,
    };
    const result = spawnSync(
      'bun',
      [nodePath.join(pluginRoot, 'runtime/dispatch.js'), 'SessionStart', '--event-group'],
      { cwd: projectDirectory, env: environment, encoding: 'utf8', input: 'null' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('matched');
  });

  it('preserves legacy protection when execution proof cannot be recorded', () => {
    const projectDirectory = temporary('safeword-plugin-proof-failure-project-');
    const pluginData = nodePath.join(temporary('safeword-plugin-proof-failure-data-'), 'not-a-dir');
    const configDirectory = temporary('safeword-plugin-proof-failure-config-');
    const target = releasedAsset(projectDirectory);
    promptSettings(projectDirectory, { source: { source: 'github', repo: 'ArcadeAI/safeword' } });
    writeFileSync(pluginData, 'proof directory collision\n');

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'proof-failure');
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(result.stdout).toContain('could not record native plugin proof');
  });

  it('does not execute an aggregate manifest omitted from the verified inventory', () => {
    const projectDirectory = temporary('safeword-plugin-inventory-gap-project-');
    const pluginData = temporary('safeword-plugin-inventory-gap-data-');
    const configDirectory = temporary('safeword-plugin-inventory-gap-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-inventory-gap-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });

    const inventoryPath = nodePath.join(pluginRoot, 'inventory.json');
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
      assets: { path: string; sha256: string }[];
    };
    inventory.assets = inventory.assets.filter(asset => asset.path !== 'runtime/event-groups.json');
    writeFileSync(inventoryPath, `${JSON.stringify(inventory, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot);

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'inventory-gap', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('damaged native plugin cache');
    expect(result.stdout).toContain(
      'inventory is missing required asset: runtime/event-groups.json',
    );
    expect(existsSync(nodePath.join(pluginData, 'execution-proofs-v2'))).toBe(false);
  });

  it('returns Claude blocking status when a blockable hook has a damaged cache', () => {
    const projectDirectory = temporary('safeword-plugin-blockable-damage-project-');
    const pluginData = temporary('safeword-plugin-blockable-damage-data-');
    const configDirectory = temporary('safeword-plugin-blockable-damage-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-blockable-damage-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const inventoryPath = nodePath.join(pluginRoot, 'inventory.json');
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
      assets: { path: string; sha256: string }[];
    };
    inventory.assets = inventory.assets.filter(asset => asset.path !== 'runtime/event-groups.json');
    writeFileSync(inventoryPath, `${JSON.stringify(inventory, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot);

    const result = dispatchEvent(
      projectDirectory,
      pluginData,
      configDirectory,
      'blockable-damage',
      { event: 'PreToolUse', pluginRoot },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('could not safely start its PreToolUse hook');
    expect(result.stderr).toContain(
      'inventory is missing required asset: runtime/event-groups.json',
    );
  });

  it('does not execute an unlisted file from an otherwise verified plugin cache', () => {
    const projectDirectory = temporary('safeword-plugin-unlisted-project-');
    const pluginData = temporary('safeword-plugin-unlisted-data-');
    const configDirectory = temporary('safeword-plugin-unlisted-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-unlisted-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const unlistedPath = nodePath.join(pluginRoot, 'skills/unlisted/SKILL.md');
    mkdirSync(nodePath.dirname(unlistedPath), { recursive: true });
    writeFileSync(unlistedPath, 'untrusted cache addition\n');

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'unlisted', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('damaged native plugin cache');
    expect(result.stdout).toContain('contains an unlisted asset: skills/unlisted/SKILL.md');
    expect(existsSync(nodePath.join(pluginData, 'execution-proofs-v2'))).toBe(false);
  });

  it('rejects unlisted operating-system metadata in an otherwise verified cache', () => {
    const projectDirectory = temporary('safeword-plugin-os-metadata-project-');
    const pluginData = temporary('safeword-plugin-os-metadata-data-');
    const configDirectory = temporary('safeword-plugin-os-metadata-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-os-metadata-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    writeFileSync(nodePath.join(pluginRoot, '.DS_Store'), 'Finder metadata\n');

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'os-metadata', {
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('damaged native plugin cache');
    expect(result.stdout).toContain('contains an unlisted asset: .DS_Store');
  });

  it('returns one JSON response when a direct prompt hook also needs an advisory', () => {
    const projectDirectory = temporary('safeword-plugin-direct-prompt-project-');
    const pluginData = nodePath.join(temporary('safeword-plugin-direct-prompt-data-'), 'not-a-dir');
    writeFileSync(pluginData, 'proof directory collision\n');
    const result = spawnSync(
      'bun',
      [
        nodePath.join(PLUGIN_ROOT, 'runtime/dispatch.js'),
        'UserPromptSubmit',
        '--',
        'bun',
        '-e',
        String.raw`process.stdout.write(JSON.stringify({continue:true})+'\n')`,
      ],
      {
        cwd: projectDirectory,
        env: {
          ...process.env,
          CLAUDE_PLUGIN_DATA: pluginData,
          CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
          CLAUDE_PROJECT_DIR: projectDirectory,
        },
        encoding: 'utf8',
        input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'direct-prompt' }),
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
      },
    });
    expect(result.stdout).toContain('could not record native plugin proof');
  });

  it('lazily upgrades the legacy plugin-mode marker after current plugin proof', () => {
    const projectDirectory = temporary('safeword-plugin-marker-project-');
    const pluginData = temporary('safeword-plugin-marker-data-');
    const configDirectory = temporary('safeword-plugin-marker-config-');
    const markerDirectory = nodePath.join(projectDirectory, '.safeword/claude-plugin');
    mkdirSync(markerDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(markerDirectory, 'plugin-mode-v1.json'),
      `${JSON.stringify({ schema_version: 1, mode: 'plugin' })}\n`,
    );

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'legacy-marker');
    expect(result.status, result.stderr).toBe(0);
    const currentMarker = nodePath.join(markerDirectory, 'plugin-mode-v2.json');
    expect(JSON.parse(readFileSync(currentMarker, 'utf8'))).toMatchObject({
      schema_version: 2,
      state: 'clean',
      plugin_version: SAFEWORD_SCHEMA.version,
    });
    expect(existsSync(nodePath.join(markerDirectory, 'plugin-mode-v1.json'))).toBe(false);
  });

  it('reconciles legacy hooks that coexist with a stale plugin-mode marker', () => {
    const projectDirectory = temporary('safeword-plugin-stale-marker-project-');
    const pluginData = temporary('safeword-plugin-stale-marker-data-');
    const configDirectory = temporary('safeword-plugin-stale-marker-config-');
    const target = releasedAsset(projectDirectory);
    promptSettings(projectDirectory, { source: { source: 'github', repo: 'ArcadeAI/safeword' } });
    const markerDirectory = nodePath.join(projectDirectory, '.safeword/claude-plugin');
    mkdirSync(markerDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(markerDirectory, 'plugin-mode-v1.json'),
      `${JSON.stringify({ schema_version: 1, mode: 'plugin' })}\n`,
    );

    const result = dispatchPrompt(projectDirectory, pluginData, configDirectory, 'stale-marker');
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(target)).toBe(false);
    expect(existsSync(nodePath.join(markerDirectory, 'plugin-mode-v1.json'))).toBe(false);
    const currentMarkerPath = nodePath.join(markerDirectory, 'plugin-mode-v2.json');
    const currentMarker = JSON.parse(readFileSync(currentMarkerPath, 'utf8'));
    expect(currentMarker).toMatchObject({
      state: 'clean',
      plugin_version: SAFEWORD_SCHEMA.version,
    });
  });

  it('keeps prompts nonblocking when sibling hook outputs conflict', () => {
    const projectDirectory = temporary('safeword-plugin-conflict-project-');
    const pluginData = temporary('safeword-plugin-conflict-data-');
    const configDirectory = temporary('safeword-plugin-conflict-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-conflict-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.UserPromptSubmit = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"scalar":1}\n'` }] },
      { hooks: [{ type: 'command', command: String.raw`printf '{"scalar":2}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);

    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchPrompt(
      projectDirectory,
      pluginData,
      configDirectory,
      'conflicting-output',
      { pluginRoot },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain('sibling hooks returned conflicting');
    expect(result.stdout).toContain('could not combine its Claude hook output');
    expect(result.stdout).toContain('prompt was not blocked');
  });

  it('uses Claude precedence when blockable hooks return different authorization decisions', () => {
    const projectDirectory = temporary('safeword-plugin-authorization-conflict-project-');
    const pluginData = temporary('safeword-plugin-authorization-conflict-data-');
    const configDirectory = temporary('safeword-plugin-authorization-conflict-config-');
    const pluginRoot = nodePath.join(
      temporary('safeword-plugin-authorization-conflict-root-'),
      'plugin',
    );
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.PreToolUse = [
      {
        hooks: [
          {
            type: 'command',
            command: String.raw`printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'`,
          },
        ],
      },
      {
        hooks: [
          {
            type: 'command',
            command: String.raw`printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}\n'`,
          },
        ],
      },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchEvent(
      projectDirectory,
      pluginData,
      configDirectory,
      'authorization-conflict',
      { event: 'PreToolUse', pluginRoot },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
      },
    });
  });

  it('matches aggregate tool hooks against the Claude tool name', () => {
    const projectDirectory = temporary('safeword-plugin-tool-matcher-project-');
    const pluginData = temporary('safeword-plugin-tool-matcher-data-');
    const configDirectory = temporary('safeword-plugin-tool-matcher-config-');
    const pluginRoot = nodePath.join(temporary('safeword-plugin-tool-matcher-root-'), 'plugin');
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.PreToolUse = [
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: String.raw`printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"bash matched"}}\n'`,
          },
        ],
      },
      {
        matcher: 'Edit',
        hooks: [
          {
            type: 'command',
            command: String.raw`printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"edit matched"}}\n'`,
          },
        ],
      },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchEvent(projectDirectory, pluginData, configDirectory, 'tool-matcher', {
      event: 'PreToolUse',
      hookInput: { source: 'startup', tool_name: 'Bash', tool_input: { command: 'pwd' } },
      pluginRoot,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: 'bash matched',
      },
    });
  });

  it('returns Claude blocking status for unmergeable blockable hook output', () => {
    const projectDirectory = temporary('safeword-plugin-unmergeable-output-project-');
    const pluginData = temporary('safeword-plugin-unmergeable-output-data-');
    const configDirectory = temporary('safeword-plugin-unmergeable-output-config-');
    const pluginRoot = nodePath.join(
      temporary('safeword-plugin-unmergeable-output-root-'),
      'plugin',
    );
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });

    const eventGroupsPath = nodePath.join(pluginRoot, 'runtime/event-groups.json');
    const eventGroups = JSON.parse(readFileSync(eventGroupsPath, 'utf8')) as {
      groups: Record<string, unknown>;
    };
    eventGroups.groups.PreToolUse = [
      { hooks: [{ type: 'command', command: String.raw`printf '{"scalar":1}\n'` }] },
      { hooks: [{ type: 'command', command: String.raw`printf '{"scalar":2}\n'` }] },
    ];
    writeFileSync(eventGroupsPath, `${JSON.stringify(eventGroups, undefined, 2)}\n`);
    refreshPluginIdentity(pluginRoot, ['runtime/event-groups.json']);

    const result = dispatchEvent(
      projectDirectory,
      pluginData,
      configDirectory,
      'unmergeable-output',
      { event: 'PreToolUse', pluginRoot },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('could not safely combine its PreToolUse hook output');
    expect(result.stderr).toContain('sibling hooks returned conflicting scalar values');
  });

  it('preserves legacy delivery when project and user declarations differ', () => {
    const projectDirectory = temporary('safeword-plugin-overlap-project-');
    const pluginData = temporary('safeword-plugin-overlap-data-');
    const homeDirectory = temporary('safeword-plugin-overlap-home-');
    const configDirectory = nodePath.join(homeDirectory, '.claude');
    mkdirSync(configDirectory, { recursive: true });
    const target = releasedAsset(projectDirectory);
    promptSettings(projectDirectory, { source: { ref: 'v0.73.0' } });
    writeFileSync(
      nodePath.join(configDirectory, 'settings.json'),
      `${JSON.stringify({
        enabledPlugins: { 'safeword@safeword': true },
        extraKnownMarketplaces: { safeword: { source: { ref: 'stable' } } },
      })}\n`,
    );

    const result = dispatchPrompt(projectDirectory, pluginData, undefined, 'overlap', {
      homeDirectory,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(result.stdout).toContain('different project and user Claude plugin declarations');
  });
});
