import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './utils/configured-paths.js';

/** Ensure a transient namespace-root file is ignored before any caller creates it. */
export function ensureTransientStateIgnore(cwd: string, basename: string): void {
  const namespaceRoot = resolveNamespaceRoot(cwd);
  const ignorePath = nodePath.join(namespaceRoot, '.gitignore');
  const rule = `/${basename}`;

  mkdirSync(namespaceRoot, { recursive: true });
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
