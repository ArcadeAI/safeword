/**
 * Sync Learnings command — regenerates `.claude/skills/project-learnings/SKILL.md`
 * from `.safeword-project/learnings/*.md` so the learnings folder is
 * discoverable via Claude Code's native Agent Skills mechanism.
 *
 * Fired by PostToolUse + SessionStart + pre-commit hooks; also runnable
 * manually via `safeword sync-learnings`.
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
    success(`Synced project-learnings skill (${result.entries.length} learnings)`);
  } else {
    info(`project-learnings skill already current (${result.entries.length} learnings)`);
  }

  if (result.skipped.length > 0) {
    warn(`${result.skipped.length} learning file(s) skipped — see stderr for details`);
  }
}
