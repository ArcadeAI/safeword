/**
 * TypeScript Language Pack — Skill Manifest (pure declaration)
 *
 * DECLARES the TypeScript skill source + selection; the harness CONSUMES it off
 * the pack (harness → pack pull).
 *
 * Source: jeffallan/claude-skills (MIT) — the same multi-language author as the
 * Python pack, so Python and TS share one source/structure. Selection is the
 * NAMED language-tier skill `typescript-pro` (not `'*'`, which would pull ~65
 * unrelated skills). Verified to install as `.claude/skills/typescript-pro/`.
 *
 * Picked over wshobson/agents (1 language-core skill bundled with 2 framework
 * ones) and vercel-labs (React-skewed). jwynia/typescript-best-practices is the
 * purer-scope alternative held for the head-to-head headroom probe (#539).
 *
 * NOTE: efficacy is not yet probed; delivery is wired, the behavior-change gate
 * is the headroom probe (#539 Done-when). Minor framework bleed (tRPC/monorepo in
 * the trigger) to confirm fires cleanly on plain `.ts`/`.tsx` at probe time.
 */

import type { PackSkillManifest } from '../types.js';

export const typescriptSkillManifest: PackSkillManifest = {
  source: 'github.com/jeffallan/claude-skills',
  /** Named selection: the single language-tier skill (see module doc for why named). */
  selection: ['typescript-pro'],
  /** Directory-name shape the installed skill follows (`typescript-pro`). */
  dirPattern: /^typescript-pro$/,
};
