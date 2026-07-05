/**
 * Deterministic architecture skeleton extractor (ticket QD5DTT, Slice 1).
 *
 * Enumerates the structural facts of a single-repo project — the top-level
 * `src/` modules, each with a code reference and a one-line purpose floor —
 * with zero language-model involvement, so the architecture state doc can
 * never hallucinate structure. The fingerprint and reconcile layers build on
 * the model this returns.
 */

import { type Dirent, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { exists, isDirectory } from './fs.js';

/** Placeholder purpose for a freshly extracted node awaiting human prose. */
export const PURPOSE_PLACEHOLDER = 'No description yet — awaiting prose.';

/**
 * Conventional top-level directories of a Go module (ticket ZD70P1). Used as the
 * structural modules when a directory has a `go.mod` and no `src/` tree, so a Go
 * project is described by its real layout instead of the empty skeleton that left
 * it "not introspected".
 */
const GO_LAYOUT_DIRECTORIES = ['cmd', 'internal', 'pkg'] as const;

/**
 * Crate-root files of a Rust crate (ticket YKFA5X) — entry points, not modules, so
 * they are excluded from the listed `src/` modules.
 */
const RUST_ROOT_FILES = new Set(['lib.rs', 'main.rs']);

/**
 * Files never listed as Python modules (ticket HWSEPV) — tooling scripts and dunder
 * modules are not top-level structural units.
 */
const PYTHON_EXCLUDED_FILES = new Set([
  'setup.py',
  'conftest.py',
  'noxfile.py',
  '__init__.py',
  '__main__.py',
]);

/**
 * Extensions a JS/TS source file can carry (issue #843). A package whose modules are
 * files rather than directories — a flat `src/`, a `lib/` root, or a top-level layout —
 * is described by these, the way the Python/Rust extractors already describe `*.py`/`*.rs`.
 */
const JS_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export interface SkeletonNode {
  /** Module name — the top-level `src/` subdirectory. */
  name: string;
  /** Code reference: the module's path relative to the project root. */
  path: string;
  /** One-line purpose (the purpose floor); a placeholder until prose is written. */
  purpose: string;
}

export interface Skeleton {
  /** Structural nodes, one per top-level module. */
  nodes: SkeletonNode[];
}

/**
 * Stable node ordering: every skeleton is sorted by name so the rendered doc and the
 * fingerprint are deterministic (readdirSync order is not guaranteed). Mirrors the
 * `byString` comparator the sibling monorepo/fingerprint modules use.
 */
const byNodeName = (a: SkeletonNode, b: SkeletonNode): number => a.name.localeCompare(b.name);

export function extractSkeleton(projectDirectory: string): Skeleton {
  // A Python project (a `pyproject.toml` is present) is described by its top-level
  // modules — src-layout uses `src/` packages + `src/*.py`, flat-layout uses root
  // `__init__.py` dirs + root `*.py` (ticket HWSEPV). Checked BEFORE Cargo because a
  // native-extension project (maturin/pyo3 — pydantic-core, cryptography, polars …)
  // ships both a `pyproject.toml` AND a `Cargo.toml`; it is Python-primary (the crate
  // is a build backend), so it must not dispatch to the Rust extractor and drop its
  // `*.py` modules. Also before the plain src-dir path so `src/*.py` files aren't lost.
  //
  // But Python only WINS when it actually yields modules: a Go service or a Rust crate
  // that merely carries a stray `pyproject.toml` (helper scripts, ruff/pre-commit config)
  // has no Python modules, and the ticket promises Go/Rust output is byte-for-byte
  // unchanged. So an empty Python result falls through to the Cargo/Go extractors below.
  if (exists(nodePath.join(projectDirectory, 'pyproject.toml'))) {
    const pythonNodes = pythonModuleNodes(projectDirectory);
    if (pythonNodes.length > 0) return { nodes: pythonNodes };
  }

  // A Rust crate (a `Cargo.toml` is present, and no `pyproject.toml`) is described by
  // its top-level `src/` modules — files AND directories, since a Rust module can be
  // either — minus the `lib.rs`/`main.rs` crate roots (ticket YKFA5X). Dispatched
  // before the plain src-dir path so a crate's file modules are not lost.
  if (exists(nodePath.join(projectDirectory, 'Cargo.toml'))) {
    return { nodes: rustModuleNodes(projectDirectory) };
  }

  // The `src/` layout (TS/JS) is authoritative: its child DIRECTORIES are the
  // modules, unchanged — a package that already has them never churns. Broadened
  // (issue #843) so a flat `src/` — holding only files, no subdirectories — is
  // introspected via those files, the same files-and-flat recognition the
  // Python/Rust extractors above already have.
  const sourceNodes = enumerateJsSourceRoot(
    nodePath.join(projectDirectory, 'src'),
    name => `src/${name}`,
  );
  if (sourceNodes.length > 0) return { nodes: sourceNodes };

  // No `src/` modules: a Go module (a `go.mod` is present) is described by its
  // conventional top-level layout directories instead (ticket ZD70P1). A flat Go
  // package with none of these stays an empty skeleton — honestly "not
  // introspected" (ZRW21K), never falsely complete. Checked BEFORE the lib/
  // and top-level JS fallbacks so a Go service carrying a stray build script
  // never dispatches to the JS recognizer.
  if (exists(nodePath.join(projectDirectory, 'go.mod'))) {
    return { nodes: goLayoutNodes(projectDirectory) };
  }

  // Still nothing under `src/`: a `lib/`-rooted package (component libraries like
  // design systems keep their sources under `lib/` — issue #843) is described the
  // same files-or-directories way. Last-resort JS fallbacks, so they never preempt
  // a recognized Go/Rust/Python layout above.
  const libraryNodes = enumerateJsSourceRoot(
    nodePath.join(projectDirectory, 'lib'),
    name => `lib/${name}`,
  );
  if (libraryNodes.length > 0) return { nodes: libraryNodes };

  // No source root at all: a flat or test-only package (e.g. top-level `*.test.ts`
  // with no `src/`) is described by its top-level source files (issue #843).
  return { nodes: topLevelJsModuleNodes(projectDirectory) };
}

/**
 * A JS/TS source root (`src/` or `lib/`) as skeleton nodes, sorted by name
 * (readdirSync order is not guaranteed; the doc and fingerprint must be
 * deterministic). Its child DIRECTORIES when it has any — the directory is the
 * module unit, so a package with `src/` subdirectories is byte-for-byte
 * unchanged. Only when the root has NO subdirectories (a flat package — issue
 * #843) does it fall back to the root's source FILES, mirroring how the Rust and
 * Python extractors list `*.rs`/`*.py`. `pathFor` maps an entry name to its
 * forward-slashed code reference — platform-stable, the way the fingerprint
 * normalizes paths. `[]` when the root is absent.
 */
function enumerateJsSourceRoot(
  directory: string,
  pathFor: (entryName: string) => string,
): SkeletonNode[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const directories = entries.filter(entry => entry.isDirectory());
  if (directories.length > 0) {
    return directories
      .map(entry => ({ name: entry.name, path: pathFor(entry.name), purpose: PURPOSE_PLACEHOLDER }))
      .toSorted(byNodeName);
  }
  return jsFileNodes(entries, pathFor);
}

/**
 * Top-level JS/TS source FILES as modules (issue #843) — a flat or test-only
 * package with no `src/`/`lib/` root (e.g. an integration-tests package whose
 * `*.test.ts` live at the root). Files only: a package root's directories are
 * ambiguous (build output, fixtures, docs) with no `__init__.py`-style marker to
 * qualify them the way the Python flat-layout extractor can, so only the source
 * roots above enumerate directories.
 */
function topLevelJsModuleNodes(projectDirectory: string): SkeletonNode[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(projectDirectory, { withFileTypes: true });
  } catch {
    return [];
  }
  return jsFileNodes(entries, name => name);
}

/** The source-file entries of a directory as skeleton nodes, sorted by name. */
function jsFileNodes(entries: Dirent[], pathFor: (entryName: string) => string): SkeletonNode[] {
  return entries
    .filter(entry => entry.isFile() && isJsSourceModuleFile(entry.name))
    .map(entry => ({
      name: jsModuleName(entry.name),
      path: pathFor(entry.name),
      purpose: PURPOSE_PLACEHOLDER,
    }))
    .toSorted(byNodeName);
}

/**
 * Whether a filename is a JS/TS source module: a recognized source extension that
 * is neither a declaration file (`*.d.ts`) nor a tooling config (`*.config.*`) —
 * the JS analogue of the Python dunder/tooling exclusion. Dotfiles are excluded here.
 */
function isJsSourceModuleFile(name: string): boolean {
  if (name.startsWith('.')) return false; // dotfiles (.eslintrc.js, .prettierrc.cjs)
  if (/\.d\.[mc]?ts$/.test(name)) return false; // type declarations, not modules
  if (/\.config\.[mc]?[jt]sx?$/.test(name)) return false; // vite.config.ts, eslint.config.mjs, …
  return JS_SOURCE_EXTENSIONS.some(extension => name.endsWith(extension));
}

/** A source file's module name: the filename minus its final extension (`db.test.ts` → `db.test`). */
function jsModuleName(filename: string): string {
  return filename.slice(0, filename.lastIndexOf('.'));
}

/** The recognized Go layout directories that actually exist, as sorted nodes. */
function goLayoutNodes(projectDirectory: string): SkeletonNode[] {
  return GO_LAYOUT_DIRECTORIES.filter(name => isDirectory(nodePath.join(projectDirectory, name)))
    .map(name => ({ name, path: name, purpose: PURPOSE_PLACEHOLDER }))
    .toSorted(byNodeName);
}

/**
 * A Rust crate's top-level `src/` modules: each subdirectory (`src/<name>/`) and each
 * `src/<name>.rs` file, excluding the `lib.rs`/`main.rs` crate roots. A directory wins
 * over a same-named file (an invalid layout, but keeps the node set unique). Sorted by
 * name, like every other skeleton. A crate with only a root file → empty (honest "not
 * introspected").
 */
function rustModuleNodes(projectDirectory: string): SkeletonNode[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(nodePath.join(projectDirectory, 'src'), { withFileTypes: true });
  } catch {
    return [];
  }

  const byName = new Map<string, SkeletonNode>();
  for (const entry of entries) {
    if (entry.isDirectory()) {
      byName.set(entry.name, {
        name: entry.name,
        path: `src/${entry.name}`,
        purpose: PURPOSE_PLACEHOLDER,
      });
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() || !entry.name.endsWith('.rs') || RUST_ROOT_FILES.has(entry.name)) {
      continue;
    }
    const name = entry.name.slice(0, -'.rs'.length);
    if (!byName.has(name)) {
      byName.set(name, { name, path: `src/${entry.name}`, purpose: PURPOSE_PLACEHOLDER });
    }
  }
  return byName.values().toArray().toSorted(byNodeName);
}

/**
 * A Python project's top-level modules (ticket HWSEPV). src-layout (a `src/` dir
 * exists): every `src/` subdirectory and every `src/*.py` module. flat-layout (no
 * `src/`): every root directory that holds an `__init__.py` (a package — so `tests/`,
 * `docs/` and other non-package dirs are skipped) and every root `*.py` module.
 * Tooling/dunder files are excluded; a project with none → empty ("not introspected").
 */
function pythonModuleNodes(projectDirectory: string): SkeletonNode[] {
  const sourceDirectory = nodePath.join(projectDirectory, 'src');
  if (isDirectory(sourceDirectory)) {
    return pythonModulesFrom(
      sourceDirectory,
      name => `src/${name}`,
      () => true,
    );
  }
  return pythonModulesFrom(
    projectDirectory,
    name => name,
    directory => exists(nodePath.join(directory, '__init__.py')),
  );
}

/**
 * Python modules under `directory`: each subdirectory `keepPackageDirectory` accepts and each
 * non-excluded `*.py` file, as sorted nodes (a dir wins over a same-named file). `pathFor`
 * maps a raw entry name to its forward-slashed code reference.
 */
function pythonModulesFrom(
  directory: string,
  pathFor: (entryName: string) => string,
  keepPackageDirectory: (absoluteDirectory: string) => boolean,
): SkeletonNode[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const byName = new Map<string, SkeletonNode>();
  for (const entry of entries) {
    if (entry.isDirectory() && keepPackageDirectory(nodePath.join(directory, entry.name))) {
      byName.set(entry.name, {
        name: entry.name,
        path: pathFor(entry.name),
        purpose: PURPOSE_PLACEHOLDER,
      });
    }
  }
  for (const entry of entries) {
    if (
      entry.isDirectory() ||
      !entry.name.endsWith('.py') ||
      PYTHON_EXCLUDED_FILES.has(entry.name)
    ) {
      continue;
    }
    const name = entry.name.slice(0, -'.py'.length);
    if (!byName.has(name)) {
      byName.set(name, { name, path: pathFor(entry.name), purpose: PURPOSE_PLACEHOLDER });
    }
  }
  return byName.values().toArray().toSorted(byNodeName);
}

/**
 * The names of nodes that violate the purpose floor — every skeleton node must
 * carry a non-empty one-line purpose. Catches a doc whose purpose was blanked
 * (e.g. hand-edited away), which would otherwise leave the floor unenforced.
 */
export function purposeFloorViolations(nodes: SkeletonNode[]): string[] {
  return nodes.filter(node => node.purpose.trim().length === 0).map(node => node.name);
}
