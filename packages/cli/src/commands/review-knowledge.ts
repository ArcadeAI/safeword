/**
 * `safeword project review-knowledge` — resolve the principles, personas, and
 * surfaces sources an independent review should read, with their current
 * content. Replaces the project-local `.safeword/hooks/resolve-project-knowledge.ts`
 * script for hosts with no installed hooks directory (Codex's self-contained
 * plugin).
 *
 * The resolution itself is not restated here: this delegates to the same
 * exported function the hook entrypoint uses, so the two callers cannot report
 * different sources for the same project. Only the path is re-expressed —
 * project-relative, so machine output is identical across checkouts.
 */

import nodePath from 'node:path';

import { resolveReviewKnowledgeSources } from '../../templates/hooks/lib/project-knowledge.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';

export function observeReviewKnowledge(cwd: string): Promise<CliResult> {
  const sources = resolveReviewKnowledgeSources(cwd).map(source => ({
    ...source,
    path: nodePath.relative(cwd, source.path),
  }));

  return Promise.resolve(
    createResult({
      state: 'healthy',
      data: { command: 'project review-knowledge', sources },
    }),
  );
}
