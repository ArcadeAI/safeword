#!/usr/bin/env bun
// Safeword: inject standing SAFEWORD.md instructions at session start.

import {
  createSafewordContextResponse,
  needsSafewordContext,
  parseAgent,
  readHookInput,
  readSafewordContext,
  resolveProjectDir,
} from './lib/safeword-context.ts';

export async function runSessionSafewordContext(): Promise<number> {
  const agent = parseAgent();
  const hookInput = await readHookInput();
  if (!needsSafewordContext(hookInput)) return 0;
  const context = readSafewordContext(resolveProjectDir(hookInput));
  const response = createSafewordContextResponse(agent, context);

  if (response) {
    process.stdout.write(response);
  }

  return 0;
}

if (import.meta.main) {
  process.exit(await runSessionSafewordContext());
}
