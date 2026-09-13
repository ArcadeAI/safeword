#!/usr/bin/env bun
// Safeword: Cursor silent auto-upgrade wrapper (sessionStart).

import process from 'node:process';

import { runAutoUpgrade } from './lib/auto-upgrade.ts';
import { acquireAutoUpgradeLock, releaseAutoUpgradeLock } from './lib/auto-upgrade-lock.ts';
import { filterSafewordFiles } from './lib/owned-paths.ts';
import { readHookInput, resolveProjectDir } from './lib/safeword-context.ts';

export async function runCursorAutoUpgrade(): Promise<number> {
  const hookInput = await readHookInput();
  const projectDir = resolveProjectDir(hookInput);
  const lockPath = acquireAutoUpgradeLock({ projectDir });
  if (!lockPath) return 0;

  try {
    await runAutoUpgrade({ projectDir, filterSafewordFiles });
  } catch {
    // Cursor has no reliable sessionStart notification channel.
  } finally {
    releaseAutoUpgradeLock({ lockPath });
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await runCursorAutoUpgrade());
}
