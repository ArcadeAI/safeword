/**
 * Derive the set of top-level path prefixes that safeword may write to,
 * sourced from SAFEWORD_SCHEMA at build time. Consumed by the auto-upgrade
 * hook to identify files to stage after `safeword upgrade` runs.
 *
 * Why this exists: the hook previously hardcoded the prefix list, which
 * silently drifts when a pack introduces a new top-level directory.
 *
 * Matching semantics: dir prefixes (trailing `/`) match by `startsWith`;
 * bare file paths match by exact equality. The generated module exports
 * both the flat list and an `isSafewordPath(file)` helper that uses these
 * semantics.
 */

import nodePath from 'node:path';

import type { JsonMergeDefinition, ProjectContext } from './packs/types.js';
import type { SafewordSchema } from './schema.js';
import { resolveNamespaceRoot } from './utils/configured-paths.js';

/**
 * Safeword-owned top-level directories a customer's OWN formatter must skip, so
 * safeword's files never churn in their diffs/CI (ticket EYRK34). Single source
 * for every formatter's ignore wiring — `.prettierignore`, Biome excludes, ruff
 * `extend-exclude`, etc. — so adding an owned dir updates all of them in one
 * place. Bare names (no trailing slash); each tool maps to its own syntax.
 *
 * Covers the two well-known namespace roots; a *custom* `paths.projectRoot` is
 * layered on at apply time via `safewordIgnoreDirectories(resolvedNamespaceDirectory(ctx))`
 * (issue #273), since this static list can't name an arbitrary root.
 *
 * `features/` and `steps/` are intentionally absent: the customer authors the
 * BDD feature files and step definitions there and wants them formatted. A drift
 * test asserts every entry here is a directory the schema actually manages.
 */
export const SAFEWORD_IGNORE_DIRS: readonly string[] = [
  '.safeword',
  '.claude',
  '.cursor',
  '.codex',
  '.agents',
  '.project',
  '.safeword-project',
];

/**
 * Safeword-owned dirs a formatter must skip, including a custom `paths.projectRoot`
 * (issue #273). `namespaceRootLabel` is the repo-relative resolved root from
 * `resolvedNamespaceDirectory`; undefined (default/legacy/repo-root) leaves the static
 * base list untouched.
 */
export function safewordIgnoreDirectories(namespaceRootLabel?: string): readonly string[] {
  return namespaceRootLabel !== undefined && !SAFEWORD_IGNORE_DIRS.includes(namespaceRootLabel)
    ? [...SAFEWORD_IGNORE_DIRS, namespaceRootLabel]
    : SAFEWORD_IGNORE_DIRS;
}

/**
 * The resolved namespace root as a repo-relative dir label, returned only when it
 * is a custom root the static lists don't already cover. Returns undefined for the
 * default `.project`/legacy `.safeword-project` roots, for `paths.projectRoot:'.'`
 * (the repo root — excluding or staging it would match the whole repo), and for any
 * root resolved OUTSIDE the repo ('../…' would leak nonsensical entries).
 */
export function resolvedNamespaceDirectory(ctx: ProjectContext): string | undefined {
  const label = resolvedNamespaceRootLabel(ctx);
  // Skip the repo root ('.'), the well-known roots (already in the static lists),
  // and any root resolved OUTSIDE the repo ('../…') — a traversal label would leak
  // nonsensical ignore/prefix entries that match nothing under the repo.
  if (label === '.' || label.startsWith('..') || SAFEWORD_IGNORE_DIRS.includes(label)) {
    return undefined;
  }
  return label;
}

/**
 * The repo-relative resolved namespace-root label — always concrete (`.project` by
 * default, the legacy or custom `paths.projectRoot` otherwise), unlike
 * {@link resolvedNamespaceDirectory} which suppresses the well-known roots. Used where a
 * managed file must name the actual root path (e.g. the `.gitattributes` ticket-index
 * entries, #566). Repo-root namespace (`.`) yields `.`, so callers prefix-join cleanly.
 */
export function resolvedNamespaceRootLabel(ctx: ProjectContext): string {
  const root = ctx.namespaceRoot ?? resolveNamespaceRoot(ctx.cwd);
  return nodePath.relative(ctx.cwd, root) || '.';
}

/**
 * The safeword-owned ignore directories for a context — the static base list plus
 * the resolved custom `paths.projectRoot` (issue #273). Composition used by the
 * formatter merges so the two-step resolution lives in one place.
 */
export function resolvedIgnoreDirectories(ctx: ProjectContext): readonly string[] {
  return safewordIgnoreDirectories(resolvedNamespaceDirectory(ctx));
}

/**
 * Build a JSON-merge that adds safeword-owned dirs to a customer formatter's
 * string-array exclude/ignore field so the tool skips them (ticket EYRK34).
 * Resolved at apply time from `ctx`, so a custom `paths.projectRoot` is excluded
 * too (issue #273); `skipIfMissing` → only ever touches a config the customer has.
 *
 * `globForDir` controls the per-dir glob and defaults to the bare trailing-globstar
 * form used by dprint (`excludes`) and oxfmt (`ignorePatterns`). markdownlint-cli2
 * (`ignores`) overrides it with a leading-globstar form so the glob also matches
 * the absolute paths lint-staged passes (ticket #262).
 */
export function dirGlobExcludeMerge(
  field: string,
  globForDirectory: (dir: string) => string = dir => `${dir}/**`,
): JsonMergeDefinition {
  return {
    keys: [field],
    skipIfMissing: true,
    merge: (existing, ctx) => {
      const safewordGlobs = resolvedIgnoreDirectories(ctx).map(dir => globForDirectory(dir));
      const current = Array.isArray(existing[field]) ? (existing[field] as string[]) : [];
      const merged = [...current];
      for (const glob of safewordGlobs) {
        if (!merged.includes(glob)) merged.push(glob);
      }
      return { ...existing, [field]: merged };
    },
    unmerge: (existing, ctx) => {
      const safewordGlobs = new Set(
        resolvedIgnoreDirectories(ctx).map(dir => globForDirectory(dir)),
      );
      const current = Array.isArray(existing[field]) ? (existing[field] as string[]) : [];
      const cleaned = current.filter(entry => !safewordGlobs.has(entry));
      // Drop the field without a dynamic `delete` or unused binding, re-adding it
      // only when entries remain.
      const rest = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== field));
      return cleaned.length > 0 ? { ...rest, [field]: cleaned } : rest;
    },
  };
}

export function computeSafewordPathPrefixes(schema: SafewordSchema): readonly string[] {
  const allPaths = [
    ...Object.keys(schema.ownedFiles),
    ...Object.keys(schema.managedFiles),
    ...Object.keys(schema.jsonMerges),
    ...Object.keys(schema.textPatches),
  ];

  const prefixes = new Set<string>();
  for (const path of allPaths) {
    const slashIndex = path.indexOf('/');
    prefixes.add(slashIndex === -1 ? path : path.slice(0, slashIndex + 1));
  }

  return [...prefixes].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Reference implementation of the matching predicate. The generated module's
 * `isSafewordPath` is a closure over SAFEWORD_PATHS that runs this same logic.
 * Extracted so tests can verify semantics without evaluating generated code.
 */
export function matchesSafewordPath(file: string, prefixes: readonly string[]): boolean {
  for (const prefix of prefixes) {
    if (prefix.endsWith('/')) {
      if (file.startsWith(prefix)) return true;
    } else if (file === prefix) {
      return true;
    }
  }
  return false;
}

/**
 * Reference implementation of the auto-upgrade staging filter. Mirrors the
 * `filterSafewordFiles` exported from the generated module so tests can
 * exercise the exact behavior the hook relies on.
 */
export function referenceFilterSafewordFiles(
  changedFiles: readonly string[],
  untrackedFiles: readonly string[],
  prefixes: readonly string[],
): readonly string[] {
  return [...changedFiles, ...untrackedFiles].filter(f => matchesSafewordPath(f, prefixes));
}

export function generateOwnedPathsModule(
  schema: SafewordSchema,
  namespaceRootLabel?: string,
): string {
  // The schema manifest carries legacy-prefixed namespace entries; installed
  // projects may run either well-known root (AQJ95G), so emit both prefixes —
  // plus the resolved custom root (issue #273) so the auto-upgrade hook stages
  // files scaffolded under a custom `paths.projectRoot`.
  const customPrefix = namespaceRootLabel === undefined ? [] : [`${namespaceRootLabel}/`];
  const prefixes = [
    ...new Set([
      ...computeSafewordPathPrefixes(schema).flatMap(prefix =>
        prefix === '.safeword-project/' ? ['.safeword-project/', '.project/'] : [prefix],
      ),
      ...customPrefix,
    ]),
  ];
  const entries = prefixes.map(prefix => `  '${prefix}',`).join('\n');

  return `// Auto-generated by safeword from SAFEWORD_SCHEMA. Do not edit by hand.
// Source: ownedFiles ∪ managedFiles ∪ jsonMerges ∪ textPatches → top-level prefixes.
// Regenerated on every \`safeword setup\` and \`safeword upgrade\`.

export const SAFEWORD_PATHS: readonly string[] = [
${entries}
];

/**
 * Match a file path against the safeword-managed set. Directory prefixes
 * (entries ending in \`/\`) match by \`startsWith\`; bare file paths must
 * match exactly so e.g. \`package.json.bak\` does not match \`package.json\`.
 */
export function isSafewordPath(file: string): boolean {
  for (const prefix of SAFEWORD_PATHS) {
    if (prefix.endsWith('/')) {
      if (file.startsWith(prefix)) return true;
    } else if (file === prefix) {
      return true;
    }
  }
  return false;
}

/**
 * Pick the safeword-managed subset of files reported by \`git diff --name-only\`
 * (changed) and \`git ls-files --others --exclude-standard\` (untracked).
 * Used by the auto-upgrade hook to decide what to stage after \`safeword upgrade\`.
 */
export function filterSafewordFiles(
  changedFiles: readonly string[],
  untrackedFiles: readonly string[],
): readonly string[] {
  return [...changedFiles, ...untrackedFiles].filter(f => isSafewordPath(f));
}
`;
}
