import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
} from 'node:fs';
import nodePath from 'node:path';

function filesUnder(root: string, relative = ''): string[] {
  return readdirSync(nodePath.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const path = nodePath.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(root, path) : [path];
  });
}

function assertNoSymbolicLinks(root: string, relative = ''): void {
  if (relative === '' && lstatSync(root).isSymbolicLink()) {
    throw new Error('Refusing to reconcile generated files through symbolic link: .');
  }
  const entries = readdirSync(nodePath.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    const path = nodePath.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to reconcile generated files through symbolic link: ${path}`);
    }
    if (entry.isDirectory()) assertNoSymbolicLinks(root, path);
  }
}

function directoriesUnder(root: string, relative = ''): string[] {
  return readdirSync(nodePath.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    if (!entry.isDirectory()) return [];
    const path = nodePath.join(relative, entry.name);
    return [path, ...directoriesUnder(root, path)];
  });
}

export function generatedTreeDifferences(
  generatedRoot: string,
  shippedRoot: string,
  allowedShippedOnly: readonly string[] = [],
): string[] {
  assertNoSymbolicLinks(generatedRoot);
  assertNoSymbolicLinks(shippedRoot);
  const generatedFiles = filesUnder(generatedRoot).toSorted((left, right) =>
    left.localeCompare(right),
  );
  const shippedFiles = filesUnder(shippedRoot).toSorted((left, right) => left.localeCompare(right));
  const generatedSet = new Set(generatedFiles);
  const shippedSet = new Set(shippedFiles);
  const allowedShippedSet = new Set(allowedShippedOnly);
  return [
    ...generatedFiles
      .filter(relative => !shippedSet.has(relative))
      .map(relative => `missing ${relative}`),
    ...shippedFiles
      .filter(relative => !generatedSet.has(relative) && !allowedShippedSet.has(relative))
      .map(relative => `unexpected ${relative}`),
    ...generatedFiles
      .filter(relative => shippedSet.has(relative))
      .filter(
        relative =>
          !readFileSync(nodePath.join(generatedRoot, relative)).equals(
            readFileSync(nodePath.join(shippedRoot, relative)),
          ),
      )
      .map(relative => `changed ${relative}`),
  ].toSorted((left, right) => left.localeCompare(right));
}

export function reconcileGeneratedTree(
  generatedRoot: string,
  shippedRoot: string,
  allowedShippedOnly: readonly string[] = [],
): void {
  assertNoSymbolicLinks(generatedRoot);
  assertNoSymbolicLinks(shippedRoot);
  const generatedFiles = filesUnder(generatedRoot);
  const generatedSet = new Set(generatedFiles);
  const allowedShippedSet = new Set(allowedShippedOnly);
  for (const relative of filesUnder(shippedRoot)) {
    if (!generatedSet.has(relative) && !allowedShippedSet.has(relative)) {
      rmSync(nodePath.join(shippedRoot, relative));
    }
  }
  const shippedDirectoriesDeepestFirst = directoriesUnder(shippedRoot).toSorted(
    (left, right) => right.length - left.length,
  );
  for (const relative of shippedDirectoriesDeepestFirst) {
    if (readdirSync(nodePath.join(shippedRoot, relative)).length === 0) {
      rmdirSync(nodePath.join(shippedRoot, relative));
    }
  }
  for (const relative of generatedFiles) {
    const destination = nodePath.join(shippedRoot, relative);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    copyFileSync(nodePath.join(generatedRoot, relative), destination);
  }
}
