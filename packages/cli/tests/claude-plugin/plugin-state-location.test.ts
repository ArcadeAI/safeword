import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CLAUDE_PLUGIN_ID } from '../../src/claude-plugin/inventory.js';
import {
  claudeProjectStatePath,
  readClaudePluginMode,
  relocateLegacyState,
  writeClaudePluginMode,
} from '../../src/claude-plugin/migration-state.js';
import {
  claudePluginDataDirectory,
  claudePluginDataId,
  claudeProjectStateDirectory,
  claudeProofDirectory,
} from '../../src/claude-plugin/plugin-data.js';
import { checkHealth } from '../../src/health.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';
import { blockChildren } from '../helpers/io-failure.js';

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

describe('cross-filesystem adoption (#3787 review follow-up)', () => {
  /** Forces the copy branch: every rename reports the state dir is another device. */
  const crossDevice = (): never => {
    const error: NodeJS.ErrnoException = new Error('EXDEV');
    error.code = 'EXDEV';
    throw error;
  };

  it('publishes nothing when the staging copy cannot be published', () => {
    // Failure at the publish step: the copy completed into staging and the
    // rename into place did not.
    const root = temporary('safeword-relocate-partial-');
    const from = nodePath.join(root, 'legacy');
    const to = nodePath.join(root, 'adopted');
    mkdirSync(from, { recursive: true });
    writeFileSync(nodePath.join(from, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');

    expect(() => {
      relocateLegacyState(from, to, crossDevice);
    }).toThrow();

    expect(existsSync(to)).toBe(false);
    expect(existsSync(nodePath.join(from, 'cleanup-transaction-v1.json'))).toBe(true);
    expect(readdirSync(root).filter(entry => entry.endsWith('.partial'))).toEqual([]);
  });

  it('publishes nothing when the copy itself fails partway', () => {
    // The failure that motivated staging. Copying straight into the destination
    // left a partial directory behind, and because adoption treats an existing
    // destination as the newer authoritative state, the next run would delete
    // the intact working-tree copy in its favour — losing the cleanup
    // transaction that is the only record a half-finished migration recovers
    // from. The injected copy writes part of the payload, then fails.
    const root = temporary('safeword-relocate-partial-copy-');
    const from = nodePath.join(root, 'legacy');
    const to = nodePath.join(root, 'adopted');
    mkdirSync(from, { recursive: true });
    writeFileSync(nodePath.join(from, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');
    const copyHalfThenFail = (_source: string, destination: string): never => {
      mkdirSync(destination, { recursive: true });
      writeFileSync(nodePath.join(destination, 'cleanup-transaction-v1.json'), '{"transac');
      throw new Error('ENOSPC: no space left on device');
    };

    expect(() => {
      relocateLegacyState(from, to, crossDevice, copyHalfThenFail);
    }).toThrow();

    expect(existsSync(to)).toBe(false);
    expect(readFileSync(nodePath.join(from, 'cleanup-transaction-v1.json'), 'utf8')).toContain(
      '"t"',
    );
    expect(readdirSync(root).filter(entry => entry.endsWith('.partial'))).toEqual([]);
  });

  it('leaves the source for the caller to remove after a staged publish', () => {
    // Removal used to happen inside the move, after publication and inside the
    // same throw path — so a source that could not be deleted took the adoption
    // receipt down with it, leaving two copies and no record of the move. The
    // caller now owns that ordering, and this is the contract it depends on:
    // publication reports whether the source outlived it.
    const root = temporary('safeword-relocate-ordering-');
    const from = nodePath.join(root, 'legacy');
    const to = nodePath.join(root, 'adopted');
    mkdirSync(from, { recursive: true });
    writeFileSync(nodePath.join(from, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');
    let renames = 0;
    const crossDeviceOnce = (source: string, destination: string): void => {
      renames += 1;
      if (renames === 1) crossDevice();
      renameSync(source, destination);
    };

    const sourceRemains = relocateLegacyState(from, to, crossDeviceOnce);

    expect(sourceRemains).toBe(true);
    expect(existsSync(nodePath.join(from, 'cleanup-transaction-v1.json'))).toBe(true);
    expect(readFileSync(nodePath.join(to, 'cleanup-transaction-v1.json'), 'utf8')).toContain('"t"');
  });

  it('publishes the whole payload when the copy succeeds', () => {
    const root = temporary('safeword-relocate-ok-');
    const from = nodePath.join(root, 'legacy');
    const to = nodePath.join(root, 'adopted');
    mkdirSync(from, { recursive: true });
    writeFileSync(nodePath.join(from, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');
    let renames = 0;
    const crossDeviceOnce = (source: string, destination: string): void => {
      renames += 1;
      if (renames === 1) {
        const error: NodeJS.ErrnoException = new Error('EXDEV');
        error.code = 'EXDEV';
        throw error;
      }
      renameSync(source, destination);
    };

    const sourceRemains = relocateLegacyState(from, to, crossDeviceOnce);

    expect(readFileSync(nodePath.join(to, 'cleanup-transaction-v1.json'), 'utf8')).toContain('"t"');
    // The staged path leaves the source for the caller, which removes it only
    // after the adoption receipt is durable.
    expect(sourceRemains).toBe(true);
    expect(readdirSync(root).filter(entry => entry.endsWith('.partial'))).toEqual([]);
  });
});

describe('adoption that cannot complete (#3787 review follow-up)', () => {
  it('still resolves state left in the working tree', () => {
    // Adoption leaves the legacy bytes alone when it cannot move them. Readers
    // must follow: a stranded cleanup transaction that resolves to the empty
    // adopted path reads as "no migration in progress", and the recovery record
    // is invisible even though it survived. `blockChildren` occupies the state
    // directory with a regular file so nothing can be created beneath it —
    // permission bits would simulate nothing under uid 0.
    const root = temporary('safeword-adoption-blocked-');
    const legacy = nodePath.join(root, '.safeword/claude-plugin');
    mkdirSync(legacy, { recursive: true });
    writeFileSync(nodePath.join(legacy, 'cleanup-transaction-v1.json'), '{"transaction_id":"t"}\n');
    blockChildren(claudeProjectStateDirectory(root));

    const resolved = claudeProjectStatePath(root, 'transaction');

    expect(readFileSync(resolved, 'utf8')).toContain('"t"');
    expect(resolved.startsWith(root)).toBe(true);
  });
});

describe('adoption receipts (#3787 review follow-up)', () => {
  it('does not resurrect a legacy copy that outlived its adoption', () => {
    // Adoption can publish and still fail to remove the source. Deleting the
    // adopted transaction after a completed cleanup must not make the stale twin
    // read as pending again — that would loop recovery forever.
    const root = temporary('safeword-adoption-resurrect-');
    const legacy = nodePath.join(root, '.safeword/claude-plugin');
    mkdirSync(legacy, { recursive: true });
    const legacyTransaction = nodePath.join(legacy, 'cleanup-transaction-v1.json');
    writeFileSync(legacyTransaction, '{"transaction_id":"t"}\n');

    const adopted = claudeProjectStatePath(root, 'transaction');
    expect(readFileSync(adopted, 'utf8')).toContain('"t"');
    // Simulate the source surviving removal, then a completed cleanup deleting
    // the authoritative entry.
    writeFileSync(legacyTransaction, '{"transaction_id":"t"}\n');
    rmSync(adopted, { force: true });

    expect(existsSync(claudeProjectStatePath(root, 'transaction'))).toBe(false);
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
