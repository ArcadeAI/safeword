#!/usr/bin/env bun
// Safeword: retired Cursor auto-upgrade compatibility entrypoint.
// Session hooks never install, upgrade, or access the network.

import process from 'node:process';

export async function runCursorAutoUpgrade(): Promise<number> {
  return 0;
}

if (import.meta.main) {
  process.exit(await runCursorAutoUpgrade());
}
