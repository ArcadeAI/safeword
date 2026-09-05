import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CLAUDE_PLUGIN_ID } from '../../src/claude-plugin/inventory.js';
import {
  claudeProjectStatePath,
  readClaudePluginMode,
  writeClaudePluginMode,
} from '../../src/claude-plugin/migration-state.js';
import {
  claudePluginDataDirectory,
  claudePluginDataId,
  claudeProofDirectory,
} from '../../src/claude-plugin/plugin-data.js';
import { checkHealth } from '../../src/health.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';

const roots: string[] = [];
const digest = 'a'.repeat(64);

function temporary(prefix: string): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function marker(): Parameters<typeof writeClaudePluginMode>[1] {
  return {
    schema_version: 2,
    state: 'clean',
    plugin_version: '0.83.1',
    hook_manifest_sha256: digest,
    catalogue_sha256: digest,
    unresolved_paths: [],
  };
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

useIsolatedClaudePluginState();

describe('Claude plugin data location (#3788)', () => {
  it('reads proofs from the directory the hook runtime exports', () => {
    // The runtime writes into ${CLAUDE_PLUGIN_DATA}. A reader that rebuilds the
    // path from a literal install id looks somewhere else entirely, and reports
    // "never ran" from the same branch that handles a genuinely missing proof.
    const exported = temporary('safeword-plugin-data-');
    process.env.CLAUDE_PLUGIN_DATA = exported;
    expect(claudeProofDirectory()).toBe(nodePath.join(exported, 'execution-proofs-v2'));
  });

  it('reconstructs the documented location when no hook exported one', () => {
    const configDirectory = process.env.CLAUDE_CONFIG_DIR;
    expect(configDirectory).toBeDefined();
    expect(claudePluginDataDirectory()).toBe(
      nodePath.join(configDirectory ?? '', 'plugins', 'data', claudePluginDataId()),
    );
  });

  it('sanitizes the install id the way Claude Code documents', () => {
    expect(claudePluginDataId(CLAUDE_PLUGIN_ID)).toBe('safeword-safeword');
    expect(claudePluginDataId('safeword@inline')).toBe('safeword-inline');
  });
});

describe('Claude plugin session state placement (#3787)', () => {
  it('keeps per-session state out of the customer working tree', () => {
    const root = temporary('safeword-plugin-state-');
    writeClaudePluginMode(root, marker());

    expect(readClaudePluginMode(root)?.state).toBe('clean');
    expect(claudeProjectStatePath(root, 'pluginMarkerV2').startsWith(root)).toBe(false);
    expect(claudeProjectStatePath(root, 'pluginMarkerV2')).toContain(claudePluginDataDirectory());
  });

  it('adopts state an earlier release left in the working tree', () => {
    const root = temporary('safeword-plugin-adopt-');
    const legacy = nodePath.join(root, '.safeword/claude-plugin');
    mkdirSync(nodePath.join(legacy, 'attempts-v1'), { recursive: true });
    writeFileSync(
      nodePath.join(legacy, 'plugin-mode-v2.json'),
      JSON.stringify({ ...marker(), plugin_version: '0.83.1' }),
    );
    writeFileSync(nodePath.join(legacy, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');

    // The cleanup transaction is the only record a half-finished migration can
    // be recovered from, so adoption has to carry it across rather than orphan it.
    expect(readClaudePluginMode(root)?.plugin_version).toBe('0.83.1');
    expect(readFileSync(claudeProjectStatePath(root, 'transaction'), 'utf8')).toContain('"t"');
    expect(existsSync(nodePath.join(legacy, 'plugin-mode-v2.json'))).toBe(false);
    expect(existsSync(nodePath.join(legacy, 'cleanup-transaction-v1.json'))).toBe(false);
  });
});

describe('configured-ness of a plugin-only repository (#3786)', () => {
  it('does not treat plugin-created state as a project install', async () => {
    const root = temporary('safeword-plugin-only-repo-');
    writeFileSync(nodePath.join(root, 'package.json'), '{"name":"t","version":"1.0.0"}\n');
    mkdirSync(nodePath.join(root, '.safeword/claude-plugin'), { recursive: true });
    writeFileSync(nodePath.join(root, '.safeword/claude-plugin/plugin-mode-v2.json'), '{}\n');

    const health = await checkHealth(root);

    expect(health.configured).toBe(false);
    expect(health.issues).toEqual([]);
  });

  it('still reports a real project install as configured', async () => {
    const root = temporary('safeword-installed-repo-');
    writeFileSync(nodePath.join(root, 'package.json'), '{"name":"t","version":"1.0.0"}\n');
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(root, '.safeword/version'), '0.83.1\n');

    const health = await checkHealth(root);

    expect(health.configured).toBe(true);
  });
});
