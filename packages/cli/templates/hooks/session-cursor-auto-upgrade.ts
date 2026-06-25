#!/usr/bin/env bun
// Safeword: Cursor silent auto-upgrade wrapper (sessionStart).
//
// Cursor's sessionStart hook is fire-and-forget: it has no Claude-style
// asyncRewake message channel, and exit 2 is a block/error path. Run the shared
// auto-upgrade core silently and always return success so startup never breaks.

import process from 'node:process';

import { runAutoUpgrade } from './lib/auto-upgrade.ts';
import { filterSafewordFiles } from './lib/owned-paths.ts';
import { readHookInput, resolveProjectDir } from './lib/safeword-context.ts';

export async function runCursorAutoUpgrade(): Promise<number> {
  const hookInput = await readHookInput();
  const projectDir = resolveProjectDir(hookInput);

  try {
    await runAutoUpgrade({ projectDir, filterSafewordFiles });
  } catch {
    // Cursor has no reliable sessionStart notification channel. The next
    // session retries through the shared core's normal gates.
  }

  return 0;
}

if (import.meta.main) {
  process.exit(await runCursorAutoUpgrade());
}
