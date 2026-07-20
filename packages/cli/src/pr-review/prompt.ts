// Where the reviewer's judgment comes from (ticket 36EEMY).
//
// The prompt is an INJECTED input, not runner code. That is the whole point of
// the split: the eval (CWGYH0) reshapes what the reviewer thinks without
// touching how it runs, and the runner ships complete while the judgment is
// still being proven.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Where `safeword setup` installs the reviewer skill (G5337S's deliverable). */
const INSTALLED_SKILL = ['.claude', 'skills', 'pr-review', 'SKILL.md'];

/**
 * Resolve the review prompt, or `undefined` when there is none.
 *
 * Undefined is a normal state, not an error: the skill is a separate ticket that
 * is blocked on the eval, so a correct runner in a correctly configured project
 * can simply have nothing to say yet. The caller turns that into a skip with a
 * reason, never into a red job and never into an empty review posted as if the
 * reviewer had looked.
 */
export function resolveReviewPrompt(
  projectDirectory: string,
  configuredPath?: string,
): string | undefined {
  const candidate =
    configuredPath === undefined
      ? nodePath.join(projectDirectory, ...INSTALLED_SKILL)
      : nodePath.resolve(projectDirectory, configuredPath);

  if (!existsSync(candidate)) return undefined;

  try {
    const contents = readFileSync(candidate, 'utf8').trim();
    return contents.length > 0 ? contents : undefined;
  } catch {
    // Unreadable is the same as absent — say nothing rather than review with a
    // prompt we could not fully load.
    return undefined;
  }
}
