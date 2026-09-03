import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';

function gitAlreadyIgnores(cwd: string, path: string): boolean {
  const relativePath = nodePath.relative(cwd, path);
  if (relativePath.startsWith('..') || nodePath.isAbsolute(relativePath)) return false;
  return (
    spawnSync('git', ['check-ignore', '--no-index', '--quiet', '--', relativePath], {
      cwd,
      stdio: 'ignore',
    }).status === 0
  );
}

/** Ensure a transient namespace-root file is ignored before any caller creates it. */
export function ensureTransientStateIgnore(
  cwd: string,
  basename: string,
  rule = `/${basename}`,
): void {
  const namespaceRoot = resolveNamespaceRoot(cwd);
  const ignorePath = nodePath.join(namespaceRoot, '.gitignore');
  const statePath = nodePath.join(namespaceRoot, basename);

  mkdirSync(namespaceRoot, { recursive: true });
  if (gitAlreadyIgnores(cwd, statePath)) return;
  if (!existsSync(ignorePath)) {
    writeFileSync(ignorePath, `${rule}\n`, 'utf8');
    return;
  }

  const content = readFileSync(ignorePath, 'utf8');
  if (content.split(/\r?\n/u).includes(rule)) return;
  appendFileSync(
    ignorePath,
    `${content.endsWith('\n') || content.length === 0 ? '' : '\n'}${rule}\n`,
  );
}
