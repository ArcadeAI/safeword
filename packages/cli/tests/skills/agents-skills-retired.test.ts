import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const PLUGIN_SETUP_BOOTSTRAP = '.agents/skills/safeword-plugin-setup/SKILL.md';

/** Paths git currently tracks under `.agents/`, repo-relative. */
function trackedAgentsPaths(): string[] {
  return execFileSync('git', ['ls-files', '.agents'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/**
 * `.agents/skills/` held safeword's own skills until V5V4YP (#1442). The schema
 * records those exact paths in the Codex migration inventory. Generic
 * `safeword upgrade` preserves them until profile-plugin execution is proven
 * and the user explicitly finalizes migration.
 *
 * The directory itself is NOT retired: the upstream skills CLI installs
 * third-party packs under `.agents/skills/` for Codex and Cursor, which is why
 * the schema's cleanup is file-scoped. This guards the files, not the folder.
 */
describe('.agents/skills retires legacy safeword-owned skills (V5V4YP)', () => {
  it('tracks only the finalized profile-plugin bootstrap under .agents/skills', () => {
    expect(trackedAgentsPaths().filter(path => path.startsWith('.agents/skills/'))).toEqual([
      PLUGIN_SETUP_BOOTSTRAP,
    ]);
  });

  it('keeps every retired path in the explicit Codex migration inventory', () => {
    const legacy = SAFEWORD_SCHEMA.codexMigration.legacyFiles.filter(file =>
      file.startsWith('.agents/skills/'),
    );

    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy).toContain('.agents/skills/review-spec/SKILL.md');
    expect(SAFEWORD_SCHEMA.deprecatedFiles).not.toContain('.agents/skills/review-spec/SKILL.md');
  });

  it('leaves the shared .agents directory itself usable', () => {
    // A sibling that is not a safeword skill must survive — the marketplace
    // manifest proves the directory was pruned file-scoped, not deleted.
    expect(trackedAgentsPaths()).toContain('.agents/plugins/marketplace.json');
  });
});
