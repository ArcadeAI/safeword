/**
 * Sync Learnings command — regenerates `.safeword-project/learnings/INDEX.md`
 * from the `*.md` files in that folder so agents can navigate via a
 * Karpathy-style LLM Wiki index (CLAUDE.md/SAFEWORD.md instruction → read
 * INDEX.md → grep/read specific file).
 *
 * Fired by PostToolUse hook; also runnable manually via
 * `safeword sync-learnings`.
 *
 * Ticket #130.
 */

import process from 'node:process';

import { syncLearnings } from '../learning-sync/index.js';
import { info, success, warn } from '../utils/output.js';

interface SyncLearningsOptions {
  quiet?: boolean;
}

export function syncLearningsCommand(options: SyncLearningsOptions = {}): void {
  const cwd = process.cwd();
  const result = syncLearnings(cwd);

  for (const skip of result.skipped) {
    process.stderr.write(`skipping .safeword-project/learnings/${skip.fileName}: ${skip.reason}\n`);
  }

  if (options.quiet) return;

  if (result.wrote) {
    success(`Regenerated learnings INDEX.md (${result.entries.length} entries)`);
  } else {
    info(`learnings INDEX.md already current (${result.entries.length} entries)`);
  }

  if (result.skipped.length > 0) {
    warn(`${result.skipped.length} learning file(s) skipped — see stderr for details`);
  }
}
