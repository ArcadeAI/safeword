import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '../..');
const SHIPPED_SKILLS = nodePath.join(CLI_ROOT, 'templates/skills');

/**
 * `PRINCIPLES.md` lives only at the safeword repo root: it is not under
 * `templates/`, has no `ConfiguredPathKey` entry, and is never installed into a
 * customer project. `ARCHITECTURE.md` is the opposite — `resolveArchitectureNarrative`
 * resolves `paths.architecture`, defaulting to the host's own root file — so
 * referencing that one is legitimate and stays allowed.
 *
 * The two look identical in prose and both resolve from inside this repo, which
 * is why the breakage is invisible here and only bites customers. PR #1210
 * removed two instances; this pins them out for good.
 */
const REPO_ONLY_DOCUMENT = 'PRINCIPLES';

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(prefix, entry.name);
    const absolutePath = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
    return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
  });
}

describe('shipped skills', () => {
  it('never cite a document that is not installed into customer projects', () => {
    const offenders = markdownFiles(SHIPPED_SKILLS).filter(relativePath =>
      readFileSync(nodePath.join(SHIPPED_SKILLS, relativePath), 'utf8').includes(
        REPO_ONLY_DOCUMENT,
      ),
    );

    expect(
      offenders,
      `These shipped skills cite ${REPO_ONLY_DOCUMENT}.md, which customers never receive. ` +
        `Name the principle inline instead — the prose already carries it, so the citation ` +
        `only adds a file path that cannot resolve outside this repo.`,
    ).toEqual([]);
  });

  it('still allows ARCHITECTURE.md, which resolves via paths.architecture', () => {
    const citingArchitecture = markdownFiles(SHIPPED_SKILLS).filter(relativePath =>
      readFileSync(nodePath.join(SHIPPED_SKILLS, relativePath), 'utf8').includes('ARCHITECTURE.md'),
    );

    // Guards the guard: if this ever empties, the check above stopped
    // discriminating and would pass for the wrong reason.
    expect(citingArchitecture.length).toBeGreaterThan(0);
  });
});
