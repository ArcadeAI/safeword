/**
 * Shape-fingerprint of a project's architecture-relevant structure (ticket
 * QD5DTT, Slice 1).
 *
 * Hashes the *shape* — top-level module names, dependency names (not versions),
 * the dependency-cruiser boundary config, and schema files — never source-file
 * bytes. So a structural change moves the fingerprint while semantics-preserving
 * noise (a version bump, a comment edit) does not. This is the cheap, LLM-free
 * drift signal the self-heal path compares against the recorded value.
 */

import { createHash } from 'node:crypto';
import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { extractSkeleton } from './architecture-skeleton.js';
import { readCargoDependencyNames } from './cargo-manifest.js';
import { readDelimitedBlock } from './manifest-block.js';
import { dependencySectionNames } from './manifest-dependencies.js';
import { readPyprojectDependencies } from './pyproject-manifest.js';

/** Candidate dependency-cruiser config filenames, in resolution order. */
const DEPENDENCY_CRUISER_CONFIG_NAMES = [
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.mjs',
  '.dependency-cruiser.json',
];

/** File extensions treated as schema definitions. */
const SCHEMA_EXTENSIONS = new Set(['.sql', '.prisma']);

/** Directories never walked when collecting schema files. */
const SHAPE_SCAN_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.project',
  '.safeword',
  'dist',
  'node_modules',
]);

/** Stable string ordering for the fingerprint's sorted inputs. */
const byString = (a: string, b: string): number => a.localeCompare(b);

interface ShapeInputs {
  /** Top-level module names. */
  moduleNames: string[];
  /** Dependency names (keys only — versions are deliberately excluded). */
  dependencyNames: string[];
  /** Raw dependency-cruiser boundary config, or '' when none is present. */
  boundaryConfig: string;
  /** Schema file paths, relative to the project root. */
  schemaFiles: string[];
}

function collectShapeInputs(projectDirectory: string): ShapeInputs {
  const moduleNames = extractSkeleton(projectDirectory)
    .nodes.map(node => node.name)
    .toSorted(byString);

  return {
    moduleNames,
    dependencyNames: readDependencyNames(projectDirectory),
    boundaryConfig: readBoundaryConfig(projectDirectory),
    schemaFiles: collectSchemaFiles(projectDirectory),
  };
}

export function shapeFingerprint(projectDirectory: string): string {
  const inputs = collectShapeInputs(projectDirectory);
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

function readDependencyNames(projectDirectory: string): string[] {
  const names = new Set<string>(readPackageJsonDependencyNames(projectDirectory));
  // Go module requires (ticket ZD70P1): a `go.mod`'s require set is part of the
  // shape, so Go dependency drift moves the fingerprint the same way a package.json
  // dependency change does. A JS-only project has no go.mod, so this is a no-op there.
  for (const goModule of readGoModuleRequires(projectDirectory)) names.add(goModule);
  // Cargo dependencies (ticket YKFA5X): a crate's Cargo.toml dependency keys are part
  // of the shape too. A non-Rust project has no Cargo.toml, so this is a no-op there.
  for (const crate of readCargoDependencies(projectDirectory)) names.add(crate);
  // Python dependencies (ticket HWSEPV): the `[project] dependencies` distribution names.
  // A non-Python project has no pyproject.toml, so this is a no-op there.
  for (const distribution of readPyprojectDependencyNames(projectDirectory))
    names.add(distribution);
  return [...names].toSorted(byString);
}

function readPackageJsonDependencyNames(projectDirectory: string): string[] {
  const manifest = readJson(nodePath.join(projectDirectory, 'package.json'));
  return manifest === undefined ? [] : dependencySectionNames(manifest);
}

/** Dependency names from a directory's `Cargo.toml`, or `[]` when there is none. */
function readCargoDependencies(projectDirectory: string): string[] {
  try {
    return readCargoDependencyNames(
      readFileSync(nodePath.join(projectDirectory, 'Cargo.toml'), 'utf8'),
    );
  } catch {
    return [];
  }
}

/** PEP 621 dependency distribution names from a directory's `pyproject.toml`, or `[]`. */
function readPyprojectDependencyNames(projectDirectory: string): string[] {
  try {
    return readPyprojectDependencies(
      readFileSync(nodePath.join(projectDirectory, 'pyproject.toml'), 'utf8'),
    );
  } catch {
    return [];
  }
}

/**
 * Module paths from a `go.mod`'s require directives — keys only, versions
 * excluded (a version bump is noise, like a package.json version bump). Reads both
 * the `require (\n  path v1\n)` block and single-line `require path v1` forms; a
 * dependency-free parse, consistent with the go.work / pnpm hand-parses.
 */
function readGoModuleRequires(projectDirectory: string): string[] {
  let content: string;
  try {
    content = readFileSync(nodePath.join(projectDirectory, 'go.mod'), 'utf8');
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const modules = new Set<string>();
  collectGoRequireBlock(lines, modules);
  collectGoRequireLines(lines, modules);
  return [...modules].toSorted(byString);
}

/** Module paths from the `require (\n … \n)` block, stopping at the closing paren. */
function collectGoRequireBlock(lines: string[], modules: Set<string>): void {
  for (const entry of readDelimitedBlock(lines, /^require\s*\(\s*$/)) {
    const [modulePath] = entry.split(/\s+/);
    if (modulePath !== undefined && modulePath.length > 0) modules.add(modulePath);
  }
}

/** Module paths from single-line `require <path> <version>` directives. */
function collectGoRequireLines(lines: string[], modules: Set<string>): void {
  for (const line of lines) {
    const match = /^require\s+(\S+)\s+\S/.exec(line.trim());
    if (match?.[1] !== undefined) modules.add(match[1]);
  }
}

function readBoundaryConfig(projectDirectory: string): string {
  for (const name of DEPENDENCY_CRUISER_CONFIG_NAMES) {
    try {
      return readFileSync(nodePath.join(projectDirectory, name), 'utf8');
    } catch {
      // Try the next candidate name.
    }
  }
  return '';
}

function collectSchemaFiles(projectDirectory: string): string[] {
  const schemaFiles: string[] = [];
  const pending: string[] = [projectDirectory];

  while (pending.length > 0) {
    const directory = pending.pop();
    if (directory !== undefined) {
      scanDirectoryForSchema(projectDirectory, directory, schemaFiles, pending);
    }
  }

  return schemaFiles.toSorted(byString);
}

function scanDirectoryForSchema(
  projectDirectory: string,
  directory: string,
  schemaFiles: string[],
  pending: string[],
): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SHAPE_SCAN_EXCLUDED_DIRECTORIES.has(entry.name)) {
        pending.push(nodePath.join(directory, entry.name));
      }
    } else if (SCHEMA_EXTENSIONS.has(nodePath.extname(entry.name))) {
      const absolutePath = nodePath.join(directory, entry.name);
      schemaFiles.push(nodePath.relative(projectDirectory, absolutePath).replaceAll('\\', '/'));
    }
  }
}

function readJson(filePath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
