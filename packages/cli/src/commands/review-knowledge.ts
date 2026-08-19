/**
 * `safeword project review-knowledge` — resolve the principles, personas, and
 * surfaces sources an independent review should read, with their current
 * content. Replaces the project-local `.safeword/hooks/resolve-project-knowledge.ts`
 * script for hosts with no installed hooks directory (Codex's self-contained
 * plugin).
 */

import { readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { readConfiguredPath, resolveConfiguredPath } from '../utils/configured-paths.js';

const REVIEW_KNOWLEDGE_KEYS = ['principles', 'personas', 'surfaces'] as const;

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function observeReviewKnowledge(cwd: string): Promise<CliResult> {
  const sources = REVIEW_KNOWLEDGE_KEYS.map(key => {
    const path = resolveConfiguredPath(cwd, key);
    const exists = isRegularFile(path);
    return {
      key,
      configured: readConfiguredPath(cwd, key) !== undefined,
      // Project-relative so machine output is identical across checkouts.
      path: nodePath.relative(cwd, path),
      exists,
      content: exists ? readFileSync(path, 'utf8') : undefined,
    };
  });

  return Promise.resolve(
    createResult({
      state: 'healthy',
      data: { command: 'project review-knowledge', sources },
    }),
  );
}
