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

/** Dependency manifest sections whose *keys* contribute to the shape. */
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export interface ShapeInputs {
  /** Top-level module names. */
  moduleNames: string[];
  /** Dependency names (keys only — versions are deliberately excluded). */
  dependencyNames: string[];
  /** Raw dependency-cruiser boundary config, or '' when none is present. */
  boundaryConfig: string;
  /** Schema file paths, relative to the project root. */
  schemaFiles: string[];
}

export function collectShapeInputs(projectDirectory: string): ShapeInputs {
  const moduleNames = extractSkeleton(projectDirectory)
    .nodes.map(node => node.name)
    .toSorted((a, b) => a.localeCompare(b));

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
  const manifest = readJson(nodePath.join(projectDirectory, 'package.json'));
  if (manifest === undefined) return [];

  const names = new Set<string>();
  for (const section of DEPENDENCY_SECTIONS) {
    const entry = manifest[section];
    if (entry !== null && typeof entry === 'object') {
      for (const name of Object.keys(entry)) names.add(name);
    }
  }

  return [...names].toSorted((a, b) => a.localeCompare(b));
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

  return schemaFiles.toSorted((a, b) => a.localeCompare(b));
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
