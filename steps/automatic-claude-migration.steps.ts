/**
 * Acceptance bindings for automatic Claude migration.
 *
 * Each scenario is driven at the altitude its claim lives at (see
 * `support/claude-migration-fixtures.ts`): most run the packaged generated
 * plugin hook at its process boundary over real released bytes; deadline and recovery scenarios drive the
 * migration module with an injected clock, and the release-contract scenarios
 * run the real contract scripts. No two scenarios share an assertion.
 */

import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  migrateClaudeLegacyAutomatically,
  recoverClaudeCleanup,
} from '../packages/cli/src/claude-plugin/cleanup.js';
import { historicalCatalogueDigest } from '../packages/cli/src/claude-plugin/historical-ownership.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import {
  claimClaudeMigrationAttempt,
  claudeProjectStatePath,
  readClaudePluginMode,
} from '../packages/cli/src/claude-plugin/migration-state.js';

import {
  acceptedHookEntry,
  type CommandRun,
  changedPaths,
  createLegacyProject,
  type HookRun,
  installFakeClaudeHost,
  type LegacyProject,
  legacyReleaseFiles,
  legacyReleaseHookEntry,
  occurrences,
  PLUGIN_ROOT,
  readProjectFile,
  removeCreatedProjects,
  resealPlugin,
  runPluginHook,
  runReleaseContract,
  runSafewordClaude,
  snapshotTree,
  type TreeSnapshot,
  writeProjectFile,
} from './support/claude-migration-fixtures.ts';

/**
 * Plugin state lives beside the plugin's data, not in the project (#3787), so
 * these resolve to absolute paths outside the working tree.
 */
const pluginModePath = (root: string): string => claudeProjectStatePath(root, 'pluginMarkerV2');
const cleanupTransactionPath = (root: string): string =>
  claudeProjectStatePath(root, 'transaction');
/** Migration's own state is the subject under test, never "unrelated bytes". */
const MIGRATION_STATE = ['.safeword/claude-plugin'];
/** Hook commands Safeword does not own and must never touch. */
const UNKNOWN_HOOK_COMMANDS = [
  'bun .safeword/hooks/edited-by-user.ts',
  'bun ./scripts/third-party.ts',
];

interface MigrationWorld {
  project?: LegacyProject;
  before?: TreeSnapshot;
  hook?: HookRun;
  command?: CommandRun;
  migration?: ReturnType<typeof migrateClaudeLegacyAutomatically>;
  recovery?: ReturnType<typeof recoverClaudeCleanup>;
  preserved?: string[];
  restoreMode?: string;
  externalFile?: string;
  symlinked?: string;
  acceptedEntry?: string;
  expectedSettings?: string;
  raceRuns?: readonly { status: number; output: string }[];
  winningTransactionId?: string;
}

function writeTransaction(root: string, content: string): void {
  const path = cleanupTransactionPath(root);
  mkdirSync(nodePath.dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, content);
}

function project(world: MigrationWorld): LegacyProject {
  assert.ok(world.project, 'no fixture project was created');
  return world.project;
}

/** What `claude plugin list --json` reports for an enrolled Safeword plugin. */
function installation(scope: 'project' | 'user', target: LegacyProject): Record<string, unknown> {
  return {
    id: 'safeword@safeword',
    version: SAFEWORD_SCHEMA.version,
    enabled: true,
    scope,
    installPath: target.plugin,
    ...(scope === 'project' && { projectPath: target.root }),
  };
}

function marker(world: MigrationWorld) {
  const mode = readClaudePluginMode(project(world).root);
  assert.ok(mode, 'no durable plugin-mode marker was written');
  return mode;
}

function advisory(world: MigrationWorld): string {
  return world.hook?.advisory ?? world.migration?.advisory ?? '';
}

function runUntilAutomaticMigrationSettles(
  target: LegacyProject,
  sessionId: string,
  maximumPrompts = 3,
): HookRun {
  let run: HookRun | undefined;
  for (let prompt = 1; prompt <= maximumPrompts; prompt += 1) {
    run = runPluginHook(target, { sessionId });
    assert.equal(run.status, 0, run.stderr);
    if (!DEFERRALS.some(deferral => run?.advisory.includes(deferral))) return run;
  }
  assert.fail(
    `migration never settled across ${String(maximumPrompts)} prompts: ${run?.advisory ?? ''}`,
  );
}

/** Asserts a Safeword advisory appears, naming each expected path, exactly once. */
function assertSingleAdvisory(text: string, sentence: string, names: readonly string[] = []): void {
  assert.equal(
    occurrences(text, sentence),
    1,
    `expected exactly one "${sentence}" advisory in: ${text}`,
  );
  for (const name of names) {
    assert.ok(text.includes(name), `advisory does not name ${name}: ${text}`);
  }
}

After(function (this: MigrationWorld) {
  if (this.restoreMode !== undefined) chmodSync(this.restoreMode, 0o700);
  removeCreatedProjects();
});

// ---------------------------------------------------------------------------
// NTB1.R1 — a proven plugin contracts exact assets and preserves the rest
// ---------------------------------------------------------------------------

Given(
  /^a clean legacy Claude project installed from Safeword (.+)$/u,
  function (this: MigrationWorld, release: string) {
    this.project = createLegacyProject({
      release,
      settings: { hooks: { SessionStart: [legacyReleaseHookEntry(release, 'SessionStart')] } },
    });
    assert.ok(project(this).installed.length > 1, 'fixture installed no legacy tree');
    this.before = snapshotTree(project(this).root);
  },
);

Given('the exact current plugin is effective for that repository', function (this: MigrationWorld) {
  // The fixture copies the real generated plugin; prove it is the one on disk.
  const packaged = readFileSync(nodePath.join(project(this).plugin, 'identity.json'), 'utf8');
  assert.equal(packaged, readFileSync(nodePath.join(PLUGIN_ROOT, 'identity.json'), 'utf8'));
});

/** Advisories that mean "not finished yet, ask again" rather than a result. */
const DEFERRALS = [
  'Safeword will finish removing its old Claude integration',
  'Another Safeword process is retiring',
  'Safeword deferred old Claude integration cleanup',
];

When('its UserPromptSubmit event completes successfully', function (this: MigrationWorld) {
  // Migration is deadline-bounded, so on a loaded machine one prompt may
  // legitimately defer — the feature specifies that at line 117. The claim
  // under test is that contraction converges, not that it fits in one budget,
  // so keep prompting while the hook says it deferred. A regression that never
  // converges still fails, on the bound.
  this.hook = runUntilAutomaticMigrationSettles(project(this), 'automatic-migration-session');
});

Then(
  "every asset in that release's independent manifest and its legacy settings entry is removed",
  function (this: MigrationWorld) {
    for (const relative of project(this).installed) {
      assert.ok(
        !existsSync(nodePath.join(project(this).root, relative)),
        `accepted legacy asset survived contraction: ${relative}`,
      );
    }
    assert.ok(
      !existsSync(nodePath.join(project(this).root, '.claude')),
      'contraction left a husk .claude tree behind',
    );
  },
);

Then(
  'the project enters durable plugin mode without blocking the prompt',
  function (this: MigrationWorld) {
    assert.equal(this.hook?.status, 0);
    assert.equal(marker(this).state, 'clean');
    assert.deepEqual(marker(this).unresolved_paths, []);
    assert.equal(
      occurrences(advisory(this), 'Safeword '),
      0,
      `a clean contraction must stay silent, got: ${advisory(this)}`,
    );
    assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
  },
);

Given(
  'a proven legacy project contains accepted assets, a modified Safeword file, a modified Safeword hook, and a third-party hook',
  function (this: MigrationWorld) {
    const release = '0.72.0';
    const [modified] = [...legacyReleaseFiles(release).keys()];
    assert.ok(modified);
    this.project = createLegacyProject({
      release,
      settings: {
        hooks: {
          SessionStart: [acceptedHookEntry(release, 'SessionStart')],
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'bun .safeword/hooks/edited-by-user.ts' }] },
            { hooks: [{ type: 'command', command: 'bun ./scripts/third-party.ts' }] },
          ],
        },
      },
    });
    writeProjectFile(project(this).root, modified, 'a change the user made by hand\n');
    this.preserved = [modified];
    this.before = snapshotTree(project(this).root);
  },
);

Then(
  'accepted legacy content is removed and every unknown byte is preserved',
  function (this: MigrationWorld) {
    const preserved = this.preserved ?? [];
    for (const relative of project(this).installed) {
      const survived = existsSync(nodePath.join(project(this).root, relative));
      assert.equal(
        survived,
        preserved.includes(relative),
        `${relative} was ${survived ? 'kept' : 'removed'} against expectation`,
      );
    }
    for (const relative of preserved) {
      assert.equal(
        readProjectFile(project(this).root, relative),
        'a change the user made by hand\n',
      );
    }
    const settings = JSON.parse(readProjectFile(project(this).root, '.claude/settings.json')) as {
      hooks: Record<string, unknown[]>;
    };
    assert.equal(settings.hooks.SessionStart?.length, 0, 'accepted hook was not removed');
    assert.equal(settings.hooks.PreToolUse?.length, 2, 'unknown hooks were not preserved');
  },
);

Then(
  'the prompt continues with one plain-language advisory naming the preserved paths',
  function (this: MigrationWorld) {
    assert.equal(this.hook?.status, 0);
    assertSingleAdvisory(
      advisory(this),
      'Safeword removed the old Claude integration it could verify',
      this.preserved ?? [],
    );
  },
);

Given(
  'a proven legacy project settings file contains an accepted Safeword hook, a modified Safeword hook, a third-party hook, and unrelated settings',
  function (this: MigrationWorld) {
    const release = '0.72.0';
    const accepted = JSON.stringify(acceptedHookEntry(release, 'SessionStart'));
    this.project = createLegacyProject({
      release,
      assetLimit: 1,
      rawSettings: `{
  // Safeword owns the entry below; the ones after it are ours.
  "hooks": {
    "SessionStart": [${accepted}],
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "bun .safeword/hooks/edited-by-user.ts" }] },

      { "hooks": [{ "type": "command", "command": "bun ./scripts/third-party.ts" }] }
    ]
  },
  /* Unrelated settings must survive byte-for-byte. */
  "permissions": { "allow": ["Bash(ls:*)", "Read"] },
  "model": "opus"
}
`,
    });
    // The one and only edit a correct rewrite may make.
    this.acceptedEntry = accepted;
    const rawSettings = readProjectFile(project(this).root, '.claude/settings.json');
    this.expectedSettings = rawSettings.replace(`[${accepted}]`, '[]');
    this.before = snapshotTree(project(this).root);
  },
);

Then(
  'only the accepted Safeword hook is removed from that settings file',
  function (this: MigrationWorld) {
    // This fixture carries comments, so it is asserted as text: the root
    // acceptance lane depends only on node builtins and cucumber, and byte
    // claims are stronger than parsed ones here anyway.
    const text = readProjectFile(project(this).root, '.claude/settings.json');
    assert.ok(this.acceptedEntry);
    assert.equal(occurrences(text, this.acceptedEntry), 0, 'the accepted hook survived');
    assert.match(text, /"SessionStart": \[\]/u, text);
    for (const command of UNKNOWN_HOOK_COMMANDS) {
      assert.ok(text.includes(command), `an unknown hook was removed: ${command}`);
    }
  },
);

Then(
  'the parsed values and array order of every modified, third-party, and unrelated settings entry are unchanged',
  function (this: MigrationWorld) {
    const text = readProjectFile(project(this).root, '.claude/settings.json');
    const [first, second] = UNKNOWN_HOOK_COMMANDS;
    assert.ok(first && second);
    // Both survive, still in their original relative order.
    assert.ok(text.indexOf(first) > -1 && text.indexOf(first) < text.indexOf(second), text);
    assert.ok(text.includes('"permissions": { "allow": ["Bash(ls:*)", "Read"] }'), text);
    assert.ok(text.includes('"model": "opus"'), text);
  },
);

Then(
  'every untouched settings byte, comment, and whitespace region is preserved exactly',
  function (this: MigrationWorld) {
    // Byte equality is the honest form of "preserved exactly": comments,
    // indentation, the deliberate blank line, and key order all have to survive
    // an edit that only empties the accepted hook array.
    assert.equal(
      readProjectFile(project(this).root, '.claude/settings.json'),
      this.expectedSettings,
      'the settings rewrite changed bytes it does not own',
    );
  },
);

Then(
  'one plain-language advisory names the preserved unknown settings entries',
  function (this: MigrationWorld) {
    assertSingleAdvisory(
      advisory(this),
      'Safeword removed the old Claude integration it could verify',
      ['.claude/settings.json#hooks.PreToolUse[0]'],
    );
  },
);

Given(
  'a proven legacy project settings file is an exact released file containing only accepted Safeword hooks',
  function (this: MigrationWorld) {
    const release = '0.72.0';
    this.project = createLegacyProject({
      release,
      assetLimit: 1,
      settings: { hooks: { SessionStart: [acceptedHookEntry(release, 'SessionStart')] } },
    });
    this.before = snapshotTree(project(this).root);
  },
);

Then(
  'the obsolete Claude settings file is removed instead of replaced by an empty object',
  function (this: MigrationWorld) {
    assert.ok(
      !existsSync(nodePath.join(project(this).root, '.claude/settings.json')),
      'an obsolete settings file was left behind',
    );
  },
);

Given(
  'a proven legacy project also contains project-owned Safeword state and active Cursor and Codex delivery',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({
      release: '0.72.0',
      extraFiles: {
        '.codex/config.toml': '[safeword]\nenabled = true\n',
        '.cursor/hooks.json': '{"hooks":{"beforeSubmitPrompt":[]}}\n',
        '.cursor/rules/safeword.mdc': '---\nalwaysApply: true\n---\n',
        '.project/tickets/INDEX.md': '# Tickets\n',
        '.safeword/config.json': '{"version":"0.72.0"}\n',
        'src/app.ts': 'export const value = 1;\n',
      },
    });
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then(
  'every byte outside Claude-only legacy delivery is unchanged',
  function (this: MigrationWorld) {
    const after = snapshotTree(project(this).root, MIGRATION_STATE);
    assert.ok(this.before);
    const outside = changedPaths(this.before, after).filter(path => !path.startsWith('.claude/'));
    assert.deepEqual(outside, [], `migration touched bytes it does not own: ${outside.join(', ')}`);
  },
);

Given(
  'a proven accepted legacy target cannot be replaced because the filesystem refuses the operation',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 1 });
    const [target] = project(this).installed;
    assert.ok(target);
    this.preserved = [target];
    this.before = snapshotTree(project(this).root);
    // A read-only parent directory is a real EACCES on unlink, not a stub.
    this.restoreMode = nodePath.dirname(nodePath.join(project(this).root, target));
    chmodSync(this.restoreMode, 0o500);
  },
);

Then(
  'the prompt remains successful with one advisory naming the target and retry action',
  function (this: MigrationWorld) {
    assert.equal(this.hook?.status, 0, 'a filesystem refusal must not block the prompt');
    assertSingleAdvisory(advisory(this), 'Safeword preserved the old Claude integration', [
      'safeword claude recover',
    ]);
  },
);

Then(
  'the durable transaction records a recoverable before image without changing that target',
  function (this: MigrationWorld) {
    assert.ok(
      existsSync(cleanupTransactionPath(project(this).root)),
      'the recovery transaction was discarded',
    );
    const [target] = this.preserved ?? [];
    assert.ok(target);
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      state?: string;
      entries?: Array<{
        path?: string;
        before_base64?: string;
        before_sha256?: string;
        after_base64?: string | null;
        after_sha256?: string | null;
      }>;
    };
    assert.equal(transaction.state, 'recoverable');
    const entry = transaction.entries?.find(candidate => candidate.path === target);
    assert.ok(entry, `transaction does not record failed target ${target}`);
    assert.equal(entry.before_sha256, this.before?.files.get(target));
    assert.equal(
      Buffer.from(entry.before_base64 ?? '', 'base64').toString(),
      readProjectFile(project(this).root, target),
    );
    assert.equal(entry.after_base64, null);
    assert.equal(entry.after_sha256, null);
    const after = snapshotTree(project(this).root, MIGRATION_STATE);
    assert.equal(after.files.get(target), this.before?.files.get(target));
    assert.equal(readClaudePluginMode(project(this).root), undefined);
  },
);

Then(
  'restoring filesystem access lets recovery complete from that transaction',
  function (this: MigrationWorld) {
    assert.ok(this.restoreMode);
    chmodSync(this.restoreMode, 0o700);
    this.restoreMode = undefined;
    const recovered = recoverClaudeCleanup(project(this).root);
    assert.equal(recovered.state, 'changed', JSON.stringify(recovered));
    const [target] = this.preserved ?? [];
    assert.ok(target);
    assert.equal(existsSync(nodePath.join(project(this).root, target)), false);
    assert.equal(existsSync(cleanupTransactionPath(project(this).root)), false);
    assert.equal(marker(this).state, 'clean');
  },
);

Given(
  'a cleanup-ready legacy project whose transaction path cannot store a durable record',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0' });
    mkdirSync(cleanupTransactionPath(project(this).root), { recursive: true });
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then(
  'every legacy byte remains unchanged and plugin mode is not written',
  function (this: MigrationWorld) {
    assert.ok(this.before);
    assert.deepEqual(
      changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE)),
      [],
    );
    assert.ok(!existsSync(pluginModePath(project(this).root)));
  },
);

Then('the prompt continues with one recovery advisory', function (this: MigrationWorld) {
  assert.equal(this.hook?.status, 0);
  assertSingleAdvisory(advisory(this), 'Safeword preserved', ['safeword claude recover']);
});

Given(
  'a catalogued legacy path is a symlink to a file outside the canonical project',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 1 });
    const [target] = project(this).installed;
    assert.ok(target);
    this.symlinked = target;
    const outside = nodePath.join(project(this).root, '..', 'outside-the-project.md');
    writeFileSync(outside, 'bytes that live outside the project\n');
    this.externalFile = outside;
    // Replace the real asset with a symlink escaping the project.
    const link = nodePath.join(project(this).root, target);
    rmSync(link);
    symlinkSync(outside, link);
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then(
  'the symlink and external file remain byte-for-byte unchanged',
  function (this: MigrationWorld) {
    assert.ok(this.externalFile && this.symlinked);
    assert.equal(readFileSync(this.externalFile, 'utf8'), 'bytes that live outside the project\n');
    const link = nodePath.join(project(this).root, this.symlinked);
    assert.ok(existsSync(link), 'the symlinked catalogued path was removed');
    assert.equal(readFileSync(link, 'utf8'), 'bytes that live outside the project\n');
  },
);

Then('no cleanup transaction includes that path', function (this: MigrationWorld) {
  assert.ok(this.symlinked);
  assert.ok(
    !existsSync(cleanupTransactionPath(project(this).root)),
    'an unsafe path left a transaction behind',
  );
  assert.ok(
    marker(this).unresolved_paths.includes(this.symlinked),
    'the unsafe path was not recorded as unresolved, so it was not excluded deliberately',
  );
});

Then(
  'the prompt continues with one advisory naming the unsafe path and repair action',
  function (this: MigrationWorld) {
    assert.equal(this.hook?.status, 0);
    assert.ok(this.symlinked);
    assertSingleAdvisory(
      advisory(this),
      'Safeword removed the old Claude integration it could verify',
      [this.symlinked, 'Review those paths'],
    );
  },
);

Given(
  'a proven legacy project contains only managed-path bytes from an uncatalogued release',
  function (this: MigrationWorld) {
    const paths = [...legacyReleaseFiles('0.72.0').keys()].slice(0, 3);
    this.project = createLegacyProject({
      extraFiles: Object.fromEntries(
        paths.map(path => [path, `bytes from a release Safeword never shipped: ${path}\n`]),
      ),
    });
    this.preserved = paths;
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then('every uncatalogued byte remains unchanged', function (this: MigrationWorld) {
  for (const path of this.preserved ?? []) {
    assert.equal(
      readProjectFile(project(this).root, path),
      `bytes from a release Safeword never shipped: ${path}\n`,
    );
  }
});

Then(
  'plugin mode records the unresolved paths and current catalogue digest',
  function (this: MigrationWorld) {
    assert.equal(marker(this).state, 'unresolved');
    assert.deepEqual(
      [...marker(this).unresolved_paths].toSorted(),
      [...(this.preserved ?? [])].toSorted(),
    );
    assert.equal(marker(this).catalogue_sha256, historicalCatalogueDigest());
  },
);

Then(
  'another prompt does not launch migration until the catalogue digest changes',
  function (this: MigrationWorld) {
    const before = snapshotTree(project(this).root, MIGRATION_STATE);
    const repeat = runPluginHook(project(this), { sessionId: 'same-session' });
    assert.equal(repeat.status, 0);
    assert.deepEqual(changedPaths(before, snapshotTree(project(this).root, MIGRATION_STATE)), []);

    // Move the digest on: the same project must be re-evaluated, proving the
    // suppression is keyed on the catalogue and not simply permanent.
    const markerPath = pluginModePath(project(this).root);
    const stale = JSON.parse(readFileSync(markerPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      markerPath,
      `${JSON.stringify({ ...stale, state: 'unresolved', catalogue_sha256: 'f'.repeat(64) })}\n`,
    );
    const reevaluated = runPluginHook(project(this), { sessionId: 'fresh-session' });
    assert.equal(reevaluated.status, 0);
    assert.equal(
      readClaudePluginMode(project(this).root)?.catalogue_sha256,
      historicalCatalogueDigest(),
      'a changed catalogue digest did not re-launch migration',
    );
  },
);

Given(
  'the exact current plugin has handled a prompt in a project with no legacy Claude delivery',
  function (this: MigrationWorld) {
    this.project = createLegacyProject();
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

When('automatic migration observes the repository', function (this: MigrationWorld) {
  // Two different observers are legitimate here: a project whose plugin has run
  // observes through the hook; one whose plugin never ran can only be observed
  // by the CLI, because an unexecuted plugin has nothing to run.
  if (this.command !== undefined) return;
  this.hook = runPluginHook(project(this));
});

Then(
  'a durable plugin-mode marker is written with no conflict or cleanup action',
  function (this: MigrationWorld) {
    assert.equal(marker(this).state, 'clean');
    assert.deepEqual(marker(this).unresolved_paths, []);
    assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
    assert.equal(occurrences(advisory(this), 'Safeword '), 0);
  },
);

// ---------------------------------------------------------------------------
// NTB1.R2 — no proof, no contraction
// ---------------------------------------------------------------------------

Given(
  'a legacy Claude project has an enabled plugin without current execution proof',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({
      release: '0.72.0',
      settings: {
        enabledPlugins: { 'safeword@safeword': true },
        extraKnownMarketplaces: {
          safeword: { source: { source: 'github', repo: 'ArcadeAI/safeword' } },
        },
      },
    });
    installFakeClaudeHost(project(this), [installation('project', project(this))]);
    this.before = snapshotTree(project(this).root);
    // Deliberately never run the hook: the plugin is enrolled and enabled, but
    // has never executed here, so no execution proof exists.
    this.command = runSafewordClaude(project(this), 'status');
  },
);

Then('every project byte is unchanged', function (this: MigrationWorld) {
  assert.ok(this.before);
  const changed = changedPaths(this.before, snapshotTree(project(this).root));
  assert.deepEqual(changed, [], `unproven plugin mutated: ${changed.join(', ')}`);
});

Then('the prompt continues with reload as the sole next action', function (this: MigrationWorld) {
  const output = this.command?.output ?? '';
  assert.match(output, /"classification":\s*"unproven"/u, output);
  assert.ok(output.includes('/reload-plugins'), output);
});

Given(
  /^a legacy Claude project has a (.+) execution proof$/u,
  function (this: MigrationWorld, defect: string) {
    this.project = createLegacyProject({ release: '0.72.0' });
    installFakeClaudeHost(project(this), [installation('project', project(this))]);
    const identity = JSON.parse(
      readFileSync(nodePath.join(project(this).plugin, 'identity.json'), 'utf8'),
    ) as {
      plugin_version: string;
      hook_manifest_sha256: string;
    };
    const digest = createHash('sha256').update(project(this).root).digest('hex');
    const proof: Record<string, unknown> = {
      schema_version: 2,
      project_root: project(this).root,
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      canonical_plugin_root: project(this).plugin,
      event: 'UserPromptSubmit',
      session_id: 'replayed-session',
      recorded_at: new Date(0).toISOString(),
    };
    if (defect === 'different-repository') proof.project_root = `${project(this).root}-other`;
    else if (defect === 'previous-plugin-version') proof.plugin_version = '0.1.0';
    else if (defect === 'wrong-event') proof.event = 'Stop';
    else if (defect === 'different-plugin-identity') proof.hook_manifest_sha256 = 'f'.repeat(64);
    else assert.fail(`unknown proof defect: ${defect}`);
    writeProjectFile(
      project(this).config,
      `plugins/data/safeword-safeword/execution-proofs-v2/${digest}.json`,
      `${JSON.stringify(proof)}\n`,
    );
    this.before = snapshotTree(project(this).root);
    this.command = runSafewordClaude(project(this), 'status');
  },
);

Given(
  'a legacy Claude project whose final plugin UserPromptSubmit sibling fails',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0' });
    this.before = snapshotTree(project(this).root);
  },
);

When('the failed event finishes', function (this: MigrationWorld) {
  // Drive the real dispatcher with a functional command that exits non-zero,
  // which is exactly how a failing sibling hook presents to it.
  this.hook = runPluginHook(project(this), {
    functionalCommand: 'sh -c \'echo "policy hook rejected the prompt" >&2; exit 9\'',
  });
});

Then('no execution proof or migration transaction is written', function (this: MigrationWorld) {
  assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
  assert.ok(!existsSync(pluginModePath(project(this).root)));
});

Then(
  'every legacy file, settings entry, and plugin-mode marker equals its pre-event image',
  function (this: MigrationWorld) {
    assert.ok(this.before);
    const changed = changedPaths(this.before, snapshotTree(project(this).root));
    assert.deepEqual(changed, [], `a failed event mutated: ${changed.join(', ')}`);
  },
);

Then(
  'the prompt continues with one action to repair or retry the reported plugin error',
  function (this: MigrationWorld) {
    const text = `${this.hook?.stdout ?? ''}${this.hook?.stderr ?? ''}`;
    assert.notEqual(this.hook?.status, 0, 'a failed sibling must surface as a failure');
    assert.ok(text.trim() !== '', 'a failed event reported nothing actionable');
  },
);

// ---------------------------------------------------------------------------
// TBU1.R1 — one durable winner, idempotent recovery
// ---------------------------------------------------------------------------

Given(
  'two plugin processes observe the same cleanup-ready repository',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({
      release: '0.72.0',
      extraFiles: { '.project/context.txt': 'untouched by either racer\n' },
    });
  },
);

When(
  'a barrier releases both automatic contraction attempts against the absent transaction',
  async function (this: MigrationWorld) {
    const target = project(this);
    const manifest = JSON.parse(
      readFileSync(nodePath.join(target.plugin, 'hooks', 'hooks.json'), 'utf8'),
    ) as Record<string, Record<string, { hooks?: { command?: string }[] }[]>>;
    const command = manifest.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command;
    assert.ok(command);
    const launch = (sessionId: string): Promise<{ status: number; output: string }> =>
      new Promise(resolve => {
        const child = spawn('bash', ['-lc', command], {
          cwd: target.root,
          env: {
            ...process.env,
            CLAUDE_CONFIG_DIR: target.config,
            CLAUDE_PLUGIN_DATA: target.data,
            CLAUDE_PLUGIN_ROOT: target.plugin,
            CLAUDE_PROJECT_DIR: target.root,
          },
        });
        let output = '';
        child.stdout.on('data', chunk => (output += String(chunk)));
        child.stderr.on('data', chunk => (output += String(chunk)));
        child.stdin.end(
          `${JSON.stringify({
            cwd: target.root,
            hook_event_name: 'UserPromptSubmit',
            prompt: 'race',
            session_id: sessionId,
          })}\n`,
        );
        child.on('close', status => resolve({ status: status ?? 1, output }));
      });
    // Both are in flight before either can finish: the exclusive-create claim,
    // not the schedule, is what has to make this converge.
    const [first, second] = await Promise.all([launch('racer-one'), launch('racer-two')]);
    this.raceRuns = [first, second];
    this.command = {
      status: Math.max(first.status, second.status),
      output: `${first.output}${second.output}`,
    };
  },
);

Then(
  'the racing prompts expose one winning transaction without conflicting mutations',
  function (this: MigrationWorld) {
    assert.equal(this.raceRuns?.length, 2);
    for (const run of this.raceRuns ?? []) assert.equal(run.status, 0, run.output);
    // A non-exclusive claim lets the loser re-plan and collide, which surfaces
    // as a migration-error advisory; silence here is the real signal.
    assert.equal(
      occurrences(this.command?.output ?? '', 'Safeword preserved the old Claude integration'),
      0,
      this.command?.output,
    );
    const transactionPath = cleanupTransactionPath(project(this).root);
    const transaction = existsSync(transactionPath)
      ? (JSON.parse(readFileSync(cleanupTransactionPath(project(this).root), 'utf8')) as {
          transaction_id?: string;
          state?: string;
        })
      : undefined;
    const completed = readClaudePluginMode(project(this).root);
    this.winningTransactionId = transaction?.transaction_id ?? completed?.transaction_id;
    assert.match(this.winningTransactionId ?? '', /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu);
    if (transaction !== undefined) {
      assert.ok(['active', 'recoverable'].includes(transaction.state ?? ''));
    }
    assert.equal(
      readProjectFile(project(this).root, '.project/context.txt'),
      'untouched by either racer\n',
    );
  },
);

Then('the next prompt completes that same winning transaction', function (this: MigrationWorld) {
  runUntilAutomaticMigrationSettles(project(this), 'concurrent-migration-follow-up');
  assert.equal(existsSync(cleanupTransactionPath(project(this).root)), false);
  assert.equal(marker(this).state, 'clean');
  assert.equal(marker(this).transaction_id, this.winningTransactionId);
  for (const relative of project(this).installed) {
    assert.equal(existsSync(nodePath.join(project(this).root, relative)), false, relative);
  }
});

Given(
  "two plugin processes race and the transaction winner remains active beyond the loser's bounded wait",
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 2 });
    // The winner's transaction is on disk and its plugin-mode marker is not:
    // that is precisely "still active" from the loser's point of view.
    writeTransaction(
      project(this).root,
      `${JSON.stringify({ schema_version: 1, transaction_id: 'winner', disposition: 'complete-forward', entries: [] })}\n`,
    );
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

When(
  'the losing automatic contraction attempt reaches its deadline',
  function (this: MigrationWorld) {
    // Inside the deadline on entry, past it once the bounded wait is spent:
    // exactly "the winner was still active when the loser gave up".
    let reads = 0;
    this.migration = migrateClaudeLegacyAutomatically(project(this).root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: 'a'.repeat(64),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 5,
      now: () => (reads++ === 0 ? 0 : 10),
    });
  },
);

Then(
  'it creates no second transaction and keeps the prompt successful with one retry advisory',
  function (this: MigrationWorld) {
    assert.equal(this.migration?.state, 'deferred');
    assertSingleAdvisory(advisory(this), 'Another Safeword process is retiring');
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      transaction_id: string;
    };
    assert.equal(transaction.transaction_id, 'winner', 'the loser overwrote the winner');
    assert.ok(this.before);
    assert.deepEqual(
      changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE)),
      [],
    );
  },
);

Then(
  'the next successful prompt enters plugin mode without creating another transaction',
  function (this: MigrationWorld) {
    // The winner finished and cleared its transaction; the next prompt converges.
    rmSync(cleanupTransactionPath(project(this).root));
    const run = runPluginHook(project(this), { sessionId: 'after-the-race' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(marker(this).state, 'clean');
    assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
  },
);

Given(
  /^an interrupted migration contains (.+) target images$/u,
  function (this: MigrationWorld, entryState: string) {
    this.project = createLegacyProject({
      release: '0.72.0',
      assetLimit: 3,
      extraFiles: { 'src/unrelated.ts': 'export const untouched = true;\n' },
    });
    // Plan a real transaction, then stop before applying it: the recorded
    // "before" images are exactly what a crash at that instant would leave.
    let reads = 0;
    const deferred = migrateClaudeLegacyAutomatically(project(this).root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: 'a'.repeat(64),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 5,
      now: () => (reads++ === 0 ? 0 : 10),
    });
    assert.equal(deferred.state, 'deferred', 'fixture failed to record a transaction');
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      entries: { path: string }[];
    };
    assert.ok(transaction.entries.length >= 3, 'need several targets to interleave images');
    const advance = {
      'all before': 0,
      'mixed before/after': 1,
      'all after': transaction.entries.length,
    }[entryState];
    assert.notEqual(advance, undefined, `unknown entry state: ${entryState}`);
    for (const entry of transaction.entries.slice(0, advance)) {
      rmSync(nodePath.join(project(this).root, entry.path), { force: true });
    }
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

When('automatic recovery runs', function (this: MigrationWorld) {
  this.recovery = recoverClaudeCleanup(project(this).root);
});

Then('every target contains its recorded after image', function (this: MigrationWorld) {
  assert.notEqual(this.recovery?.state, 'failed', JSON.stringify(this.recovery));
  for (const relative of project(this).installed) {
    assert.ok(
      !existsSync(nodePath.join(project(this).root, relative)),
      `recovery left ${relative} at its before image`,
    );
  }
});

Then('the completed transaction is removed', function (this: MigrationWorld) {
  assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
});

Then(
  'the project enters plugin mode without losing unrelated bytes',
  function (this: MigrationWorld) {
    assert.equal(marker(this).state, 'clean');
    assert.equal(
      readProjectFile(project(this).root, 'src/unrelated.ts'),
      'export const untouched = true;\n',
    );
  },
);

Given(
  'an automatic migration is interrupted after its durable transaction is written',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 2 });
  },
);

When('the outer migration deadline expires', function (this: MigrationWorld) {
  let reads = 0;
  this.migration = migrateClaudeLegacyAutomatically(project(this).root, {
    pluginVersion: '0.73.0',
    hookManifestSha256: 'a'.repeat(64),
    catalogueSha256: historicalCatalogueDigest(),
    deadline: 5,
    now: () => (reads++ === 0 ? 0 : 10),
  });
});

Then(
  'the current prompt remains successful with one retry advisory',
  function (this: MigrationWorld) {
    assert.equal(this.migration?.state, 'deferred');
    assertSingleAdvisory(
      advisory(this),
      'Safeword will finish removing its old Claude integration',
    );
    assert.ok(existsSync(cleanupTransactionPath(project(this).root)));
  },
);

Then(
  'the next successful prompt completes the recorded transaction and enters plugin mode',
  function (this: MigrationWorld) {
    const run = runPluginHook(project(this), { sessionId: 'next-prompt' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(marker(this).state, 'clean');
    assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
    for (const relative of project(this).installed) {
      assert.ok(!existsSync(nodePath.join(project(this).root, relative)));
    }
  },
);

Given(
  'a later Claude session has spent its normal launch and a durable transaction remains',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 2 });
    assert.ok(claimClaudeMigrationAttempt(project(this).root, 'initial-session'));
    assert.ok(claimClaudeMigrationAttempt(project(this).root, 'later-session'));
    let reads = 0;
    const interrupted = migrateClaudeLegacyAutomatically(project(this).root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: 'a'.repeat(64),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 5,
      now: () => (reads++ === 0 ? 0 : 10),
    });
    assert.equal(interrupted.state, 'deferred');
    assert.ok(existsSync(cleanupTransactionPath(project(this).root)));
  },
);

When('another prompt succeeds in that later session', function (this: MigrationWorld) {
  this.hook = runPluginHook(project(this), { sessionId: 'later-session' });
  assert.equal(this.hook.status, 0, this.hook.stderr);
});

Then(
  'its dedicated recovery launch completes the transaction and enters plugin mode',
  function (this: MigrationWorld) {
    assert.equal(marker(this).state, 'clean');
    assert.ok(!existsSync(cleanupTransactionPath(project(this).root)));
    for (const relative of project(this).installed) {
      assert.ok(!existsSync(nodePath.join(project(this).root, relative)));
    }
  },
);

Given(
  'automatic migration has recorded three calls in one Claude session',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0' });
    for (let call = 1; call <= 3; call += 1) {
      assert.ok(
        claimClaudeMigrationAttempt(project(this).root, 'exhausted-session'),
        `call ${String(call)} should have been permitted`,
      );
    }
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

When('another prompt succeeds in that session', function (this: MigrationWorld) {
  this.hook = runPluginHook(project(this), { sessionId: 'exhausted-session' });
  assert.equal(this.hook.status, 0, this.hook.stderr);
});

Then(
  'no automatic migration call runs and one explicit repair action is advised',
  function (this: MigrationWorld) {
    assert.ok(this.before);
    assert.deepEqual(
      changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE)),
      [],
      'a fourth call in the same session mutated the project',
    );
    assertSingleAdvisory(
      advisory(this),
      'Safeword could not finish retiring the old Claude integration in this session',
      ['safeword claude recover'],
    );
  },
);

Then(
  'the first successful prompt in a new session permits one automatic recovery attempt',
  function (this: MigrationWorld) {
    runUntilAutomaticMigrationSettles(project(this), 'a-brand-new-session', 2);
    assert.equal(marker(this).state, 'clean');
    for (const relative of project(this).installed) {
      assert.ok(!existsSync(nodePath.join(project(this).root, relative)));
    }
  },
);

Given(
  'an interrupted migration target differs from both recorded images',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 2 });
    let reads = 0;
    migrateClaudeLegacyAutomatically(project(this).root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: 'a'.repeat(64),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 5,
      now: () => (reads++ === 0 ? 0 : 10),
    });
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      entries: { path: string }[];
    };
    const [entry] = transaction.entries;
    assert.ok(entry);
    this.preserved = [entry.path];
    writeProjectFile(project(this).root, entry.path, 'a third image, written concurrently\n');
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then(
  'the concurrent bytes and durable recovery evidence remain unchanged',
  function (this: MigrationWorld) {
    const [path] = this.preserved ?? [];
    assert.ok(path);
    assert.equal(
      readProjectFile(project(this).root, path),
      'a third image, written concurrently\n',
    );
    assert.ok(
      existsSync(cleanupTransactionPath(project(this).root)),
      'recovery evidence was discarded on conflict',
    );
    assert.ok(this.before);
    assert.deepEqual(
      changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE)),
      [],
    );
  },
);

Then('the prompt continues with one recovery-conflict advisory', function (this: MigrationWorld) {
  assert.equal(this.recovery?.state, 'failed');
  assert.equal(this.recovery?.errors?.[0]?.code, 'CLAUDE_RECOVERY_CONFLICT');
  const [path] = this.preserved ?? [];
  assert.ok(path && this.recovery?.errors?.[0]?.message.includes(path));
});

Given(
  /^an interrupted migration transaction has a (.+)$/u,
  function (this: MigrationWorld, defect: string) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 1 });
    let reads = 0;
    migrateClaudeLegacyAutomatically(project(this).root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: 'a'.repeat(64),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 5,
      now: () => (reads++ === 0 ? 0 : 10),
    });
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      entries: Array<{ path: string; before_sha256: string }>;
    };
    const entry = transaction.entries[0];
    assert.ok(entry);
    this.preserved = [entry.path];
    this.externalFile = nodePath.join(nodePath.dirname(project(this).root), 'external-target');
    writeFileSync(this.externalFile, 'external bytes\n');
    if (defect === 'absolute target') entry.path = this.externalFile;
    else if (defect === 'parent traversal') entry.path = '../external-target';
    else if (defect === 'malformed before digest') entry.before_sha256 = 'invalid';
    else if (defect === 'post-claim symlink') {
      rmSync(nodePath.join(project(this).root, entry.path));
      symlinkSync(this.externalFile, nodePath.join(project(this).root, entry.path));
    } else assert.fail(`unknown transaction defect: ${defect}`);
    writeTransaction(project(this).root, `${JSON.stringify(transaction)}\n`);
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then(
  'no project or external byte changes and the transaction remains',
  function (this: MigrationWorld) {
    assert.equal(this.recovery?.state, 'failed');
    assert.equal(readFileSync(this.externalFile ?? '', 'utf8'), 'external bytes\n');
    assert.ok(this.before);
    assert.deepEqual(
      changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE)),
      [],
    );
    assert.equal(existsSync(cleanupTransactionPath(project(this).root)), true);
  },
);

Given(
  'a cleanup-ready target changes after the durable transaction claim',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({ release: '0.72.0', assetLimit: 1 });
    const [target] = project(this).installed;
    assert.ok(target);
    this.preserved = [target];
  },
);

When('automatic migration runs against the changed target', function (this: MigrationWorld) {
  const [target] = this.preserved ?? [];
  assert.ok(target);
  this.migration = migrateClaudeLegacyAutomatically(project(this).root, {
    pluginVersion: '0.73.0',
    hookManifestSha256: 'a'.repeat(64),
    catalogueSha256: historicalCatalogueDigest(),
    deadline: Date.now() + 10_000,
    beforeApply: () => writeProjectFile(project(this).root, target, 'changed after claim\n'),
  });
});

Then(
  'the changed bytes remain and the recoverable transaction records the original preimage',
  function (this: MigrationWorld) {
    const [target] = this.preserved ?? [];
    assert.ok(target);
    assert.equal(readProjectFile(project(this).root, target), 'changed after claim\n');
    const transaction = JSON.parse(
      readFileSync(cleanupTransactionPath(project(this).root), 'utf8'),
    ) as {
      state: string;
      entries: Array<{ path: string; before_base64: string }>;
    };
    assert.equal(transaction.state, 'recoverable');
    const entry = transaction.entries.find(candidate => candidate.path === target);
    assert.ok(entry);
    assert.notEqual(Buffer.from(entry.before_base64, 'base64').toString(), 'changed after claim\n');
  },
);

// ---------------------------------------------------------------------------
// SWM1.R1 — enrollment survives, scope overlap resolves or stays visible
// ---------------------------------------------------------------------------

const MARKETPLACE = { source: { source: 'github', repo: 'ArcadeAI/safeword' } };
const PROJECT_SETTINGS_WITH_ENROLLMENT = `{
  // teammate-owned setting must retain its exact bytes
  "theme": "dark",
  "enabledPlugins": { "safeword@safeword": true },
  "extraKnownMarketplaces": { "safeword": { "source": { "source": "github", "repo": "ArcadeAI/safeword" } } },
  "hooks": { "SessionStart": [${JSON.stringify(acceptedHookEntry('0.72.0', 'SessionStart'))}] }
}\n`;
const PROJECT_SETTINGS_AFTER_CONTRACTION = `{
  // teammate-owned setting must retain its exact bytes
  "theme": "dark",
  "enabledPlugins": { "safeword@safeword": true },
  "extraKnownMarketplaces": { "safeword": { "source": { "source": "github", "repo": "ArcadeAI/safeword" } } },
  "hooks": {
    "SessionStart": []
  }
}\n`;

Given(
  'a cleanup-ready project declares the exact marketplace and plugin at project scope',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({
      release: '0.72.0',
      rawSettings: PROJECT_SETTINGS_WITH_ENROLLMENT,
    });
  },
);

When('automatic contraction completes', function (this: MigrationWorld) {
  this.hook = runUntilAutomaticMigrationSettles(project(this), 'automatic-migration-session');
});

Then(
  'the exact project-scoped declaration and unrelated settings remain byte-for-byte intact',
  function (this: MigrationWorld) {
    assert.equal(
      readProjectFile(project(this).root, '.claude/settings.json'),
      PROJECT_SETTINGS_AFTER_CONTRACTION,
    );
  },
);

Then(
  'no legacy asset remains alongside the preserved project declaration',
  function (this: MigrationWorld) {
    for (const relative of project(this).installed) {
      assert.ok(!existsSync(nodePath.join(project(this).root, relative)), relative);
    }
    const settings = readProjectFile(project(this).root, '.claude/settings.json');
    assert.match(settings, /"SessionStart": \[\]/u);
    assert.doesNotMatch(settings, /session-version|\.safeword\/hooks/u);
  },
);

Given(
  'the exact plugin is declared at both project and user scope',
  function (this: MigrationWorld) {
    const declaration = {
      enabledPlugins: { 'safeword@safeword': true },
      extraKnownMarketplaces: { safeword: MARKETPLACE },
    };
    this.project = createLegacyProject({
      release: '0.72.0',
      assetLimit: 1,
      settings: declaration,
      userSettings: declaration,
    });
    // Both scopes really are enrolled; scope precedence, not the fixture, has
    // to be what collapses them to one effective installation.
    installFakeClaudeHost(project(this), [
      installation('project', project(this)),
      installation('user', project(this)),
    ]);
  },
);

When('Safeword observes and dispatches it for the repository', function (this: MigrationWorld) {
  this.hook = runPluginHook(project(this));
  assert.equal(this.hook.status, 0, this.hook.stderr);
  this.command = runSafewordClaude(project(this), 'status');
});

Then('status reports one healthy effective project installation', function (this: MigrationWorld) {
  const output = this.command?.output ?? '';
  const result = JSON.parse(output.slice(output.indexOf('{'))) as {
    state: string;
    data: { classification: string; applicable_scope?: string };
  };
  assert.equal(result.state, 'healthy', output);
  // Two declarations, one effective installation: had scope precedence failed
  // to collapse them, status would classify this as an overlap instead.
  assert.equal(result.data.classification, 'plugin-mode', output);
  assert.equal(result.data.applicable_scope, 'project', output);
});

Then('one prompt timestamp context block is emitted', function (this: MigrationWorld) {
  assert.equal(
    occurrences(this.hook?.advisory ?? '', 'Current time:'),
    1,
    `duplicate declarations produced duplicate context: ${this.hook?.advisory ?? ''}`,
  );
});

Given(
  'project and user scopes resolve to incompatible Safeword plugin identities',
  function (this: MigrationWorld) {
    this.project = createLegacyProject({
      release: '0.72.0',
      settings: {
        enabledPlugins: { 'safeword@safeword': true },
        extraKnownMarketplaces: { safeword: MARKETPLACE },
      },
      userSettings: {
        enabledPlugins: { 'safeword@safeword': true },
        extraKnownMarketplaces: {
          safeword: { source: { source: 'github', repo: 'someone-else/safeword-fork' } },
        },
      },
    });
    this.before = snapshotTree(project(this).root, MIGRATION_STATE);
  },
);

Then('legacy delivery and both declarations remain unchanged', function (this: MigrationWorld) {
  assert.ok(this.before);
  const changed = changedPaths(this.before, snapshotTree(project(this).root, MIGRATION_STATE));
  assert.deepEqual(changed, [], `an unresolved scope conflict contracted: ${changed.join(', ')}`);
});

Then('the prompt continues with one scope-conflict advisory', function (this: MigrationWorld) {
  assert.equal(this.hook?.status, 0);
  assertSingleAdvisory(
    advisory(this),
    'Safeword found different project and user Claude plugin declarations',
  );
});

Then(
  'unchanged declarations suppress another migration launch in that session',
  function (this: MigrationWorld) {
    const repeat = runPluginHook(project(this), { sessionId: 'automatic-migration-session' });
    assert.equal(repeat.status, 0);
    assert.equal(
      occurrences(repeat.advisory, 'Safeword found different project and user'),
      0,
      `the same advisory repeated in one session: ${repeat.advisory}`,
    );
  },
);

Then('a new session permits one re-evaluation', function (this: MigrationWorld) {
  const fresh = runPluginHook(project(this), { sessionId: 'a-second-session' });
  assert.equal(fresh.status, 0);
  assertSingleAdvisory(
    fresh.advisory,
    'Safeword found different project and user Claude plugin declarations',
  );
});

// ---------------------------------------------------------------------------
// SWM1.R2 — the release contract is checked against real artifacts
// ---------------------------------------------------------------------------

Given(
  'every supported pre-plugin fixture is catalogued and the generated dispatcher reaches automatic migration',
  function (this: MigrationWorld) {},
);

When('the Claude migration release contract runs', function (this: MigrationWorld) {
  this.command ??= runReleaseContract('check:claude-historical-catalogue');
});

Then(
  'validation passes with every fixture path and runtime entrypoint accounted for',
  function (this: MigrationWorld) {
    assert.equal(this.command?.status, 0, this.command?.output);
    assert.match(this.command?.output ?? '', /catalogue covers \d+ releases/u);
    assert.equal(runReleaseContract('check:claude-plugin').status, 0);
  },
);

Given(
  'a supported pre-plugin release fixture contains an uncatalogued managed Claude asset',
  function (this: MigrationWorld) {
    // Drop one release's asset fingerprints from a COPY of the catalogue: that
    // is exactly the state "this release shipped an asset we never recorded".
    this.project = createLegacyProject();
    const doctored = nodePath.join(project(this).root, 'incomplete-catalogue.generated.ts');
    const committed = readFileSync(
      nodePath.join(
        PLUGIN_ROOT,
        '../packages/cli/src/claude-plugin/historical-catalogue.generated.ts',
      ),
      'utf8',
    );
    const fingerprint = /'([\da-f]{64})'/u.exec(committed)?.[1];
    assert.ok(fingerprint, 'catalogue exposes no fingerprint to remove');
    writeFileSync(doctored, committed.replaceAll(fingerprint, '0'.repeat(64)));
    this.command = runReleaseContract('check:claude-historical-catalogue', {
      SAFEWORD_CLAUDE_CATALOGUE_PATH: doctored,
    });
  },
);

Then(
  'validation fails naming the release, path, and missing fingerprint',
  function (this: MigrationWorld) {
    assert.notEqual(this.command?.status, 0, 'an incomplete catalogue passed validation');
    const output = this.command?.output ?? '';
    assert.match(
      output,
      /Claude historical catalogue is missing release \S+ (asset|hook) \S+/u,
      output,
    );
    assert.match(output, /fingerprint [\da-f]{64}/u, output);
  },
);

Given(
  'the committed historical catalogue contains content absent from the independent release fixtures',
  function (this: MigrationWorld) {
    this.project = createLegacyProject();
    const doctored = nodePath.join(project(this).root, 'stale-catalogue.generated.ts');
    const committed = readFileSync(
      nodePath.join(
        PLUGIN_ROOT,
        '../packages/cli/src/claude-plugin/historical-catalogue.generated.ts',
      ),
      'utf8',
    );
    writeFileSync(doctored, `${committed}\n// stale catalogue content with no released fixture\n`);
    this.command = runReleaseContract('check:claude-historical-catalogue', {
      SAFEWORD_CLAUDE_CATALOGUE_PATH: doctored,
    });
  },
);

Then(
  'validation fails naming catalogue drift and the regeneration action',
  function (this: MigrationWorld) {
    assert.notEqual(this.command?.status, 0, 'a stale catalogue passed validation');
    const output = this.command?.output ?? '';
    assert.match(output, /(?:stale for releases|missing release)/u);
    assert.match(output, /regenerate it/u);
  },
);

Given(
  /^the committed historical catalogue has a (.+)$/u,
  function (this: MigrationWorld, defect: string) {
    this.project = createLegacyProject();
    const doctored = nodePath.join(project(this).root, 'malformed-catalogue.generated.ts');
    const path = nodePath.join(
      PLUGIN_ROOT,
      '../packages/cli/src/claude-plugin/historical-catalogue.generated.ts',
    );
    let content = readFileSync(path, 'utf8');
    const fingerprint = /'[\da-f]{64}'/u.exec(content)?.[0];
    const asset = /'\.claude\/[^']+'/u.exec(content)?.[0];
    assert.ok(fingerprint && asset);
    if (defect === 'duplicate path')
      content = content.replace(asset, `${asset}: ${fingerprint},\n      ${asset}`);
    else if (defect === 'ambiguous fingerprint')
      content = content.replace(fingerprint, `${fingerprint}, ${fingerprint}`);
    else if (defect === 'malformed digest')
      content = content.replace(fingerprint, `'${'z'.repeat(64)}'`);
    else if (defect === 'nondeterministic order') {
      const lines = content.split('\n');
      [lines[3], lines[4]] = [lines[4] ?? '', lines[3] ?? ''];
      content = lines.join('\n');
    } else if (defect === 'escaped managed path')
      content = content.replace(asset, "'../escaped.md'");
    else assert.fail(`unknown catalogue defect: ${defect}`);
    writeFileSync(doctored, content);
    this.command = runReleaseContract('check:claude-historical-catalogue', {
      SAFEWORD_CLAUDE_CATALOGUE_PATH: doctored,
    });
  },
);

Given(
  'the canonical dispatcher can migrate but the generated plugin cannot reach that behavior',
  function (this: MigrationWorld) {
    const source = readFileSync(
      nodePath.join(PLUGIN_ROOT, '../packages/cli/src/claude-plugin/runtime/dispatch.ts'),
      'utf8',
    );
    assert.ok(
      source.includes('migrateClaudeLegacyAutomatically'),
      'canonical dispatcher cannot migrate',
    );
    this.project = createLegacyProject();
    const damaged = nodePath.join(project(this).root, 'damaged-plugin');
    cpSync(PLUGIN_ROOT, damaged, { recursive: true });
    const dispatcher = nodePath.join(damaged, 'runtime/dispatch.js');
    writeFileSync(
      dispatcher,
      readFileSync(dispatcher, 'utf8').replaceAll(
        'migrateClaudeLegacyAutomatically',
        'unwiredStub',
      ),
    );
    // Re-seal the package so its own integrity checks pass. The risk this
    // scenario guards is a CONSISTENTLY packaged plugin that simply lost the
    // wiring — a tamper the digest checks already catch is a different bug.
    resealPlugin(damaged);
    this.project = { ...project(this), plugin: damaged };
  },
);

When(
  'the automatic Claude migration release catalogue is validated',
  function (this: MigrationWorld) {
    this.command = runReleaseContract('check:claude-plugin', {
      SAFEWORD_CLAUDE_PLUGIN_ROOT: project(this).plugin,
    });
  },
);

Then(
  'validation fails naming the missing runtime dependency or wiring proof',
  function (this: MigrationWorld) {
    assert.notEqual(this.command?.status, 0, 'an unwired dispatcher passed validation');
    assert.match(
      this.command?.output ?? '',
      /missing automatic migration wiring: migrateClaudeLegacyAutomatically/u,
      this.command?.output,
    );
  },
);

// ---------------------------------------------------------------------------
// SWM1.R3 — the safeword dev repo is exempt from automatic contraction
// ---------------------------------------------------------------------------

Given(
  'a proven legacy project is the safeword dev repository itself',
  function (this: MigrationWorld) {
    // `isDogfoodRepo` (packages/cli/templates/hooks/lib/dogfood.ts) treats a
    // `package.json` named "safeword" as one of its two OR'd signals — the
    // cheaper one to plant here without copying the whole templates tree.
    this.project = createLegacyProject({
      release: '0.72.0',
      extraFiles: { 'package.json': '{"name":"safeword"}\n' },
    });
    this.before = snapshotTree(project(this).root);
  },
);
