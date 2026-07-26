import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

/** Paths git currently tracks under `.agents/`, repo-relative. */
function trackedAgentsPaths(): string[] {
  return execFileSync('git', ['ls-files', '.agents'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/**
 * `.agents/skills/` held safeword's own skills until V5V4YP (#1442). The schema
 * lists those exact paths in `deprecatedFiles`, so `safeword upgrade` deletes
 * them from every project — the dogfood repo was the last place they survived,
 * hand-synced, while `parity:fix` could not reach them because they were never
 * an owned pair.
 *
 * The directory itself is NOT retired: the upstream skills CLI installs
 * third-party packs under `.agents/skills/` for Codex and Cursor, which is why
 * the schema's cleanup is file-scoped. This guards the files, not the folder.
 */
describe('.agents/skills is retired for safeword-owned skills (V5V4YP)', () => {
  it('tracks no safeword skill file under .agents/skills', () => {
    expect(trackedAgentsPaths().filter(path => path.startsWith('.agents/skills/'))).toEqual([]);
  });

  it('keeps every retired path in deprecatedFiles so upgrade still cleans installed projects', () => {
    // Deleting them here without leaving the deprecation in place would strand
    // the copies already on customer disks: nothing would ever remove them.
    const deprecated = SAFEWORD_SCHEMA.deprecatedFiles.filter(file =>
      file.startsWith('.agents/skills/'),
    );

    expect(deprecated.length).toBeGreaterThan(0);
    expect(deprecated).toContain('.agents/skills/review-spec/SKILL.md');
  });

  it('leaves the shared .agents directory itself usable', () => {
    // A sibling that is not a safeword skill must survive — the marketplace
    // manifest proves the directory was pruned file-scoped, not deleted.
    expect(trackedAgentsPaths()).toContain('.agents/plugins/marketplace.json');
  });
});
