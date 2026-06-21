/**
 * `safeword architecture` — refresh the architecture state document (ticket
 * QD5DTT, Slice 1).
 *
 * Thin CLI entry over `selfHeal`: re-extracts the skeleton and reconciles prose
 * markers at the configured `paths.architecture`. The SessionStart hook shells
 * out to this command so the heal logic lives in one place (the CLI), not
 * duplicated into the hook lib.
 */

import process from 'node:process';

import { selfHeal } from '../utils/architecture-document.js';
import { success } from '../utils/output.js';

export function architecture(cwd: string = process.cwd()): Promise<void> {
  const result = selfHeal(cwd);
  success(`Architecture state document ${result.action}: ${result.path}`);
  return Promise.resolve();
}
