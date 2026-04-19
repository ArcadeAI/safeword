/**
 * Content templates - static string content
 *
 * Note: Most templates (SAFEWORD.md, hooks, skills, guides, etc.) are now
 * file-based in the templates/ directory. This file contains only small
 * string constants that are used inline.
 */

/**
 * Prose reference for AGENTS.md — Cursor and other non-Claude agents read
 * this file directly, so a human-readable "read this first" is the right
 * signal for them.
 */
export const AGENTS_MD_LINK = `**⚠️ ALWAYS READ FIRST:** \`.safeword/SAFEWORD.md\`

The SAFEWORD.md file contains core development patterns, workflows, and conventions.
Read it BEFORE working on any task in this project.

---`;

/**
 * Import block for CLAUDE.md — uses Claude Code's \`@\` import syntax so
 * SAFEWORD.md is inlined into context at launch and re-expanded on every
 * \`/compact\`. Without this, customer installs would rely on the agent
 * following a cross-file delegation chain that our own research
 * (\`.safeword-project/learnings/instruction-attention-hierarchy.md\`)
 * measures at ~20% compliance.
 */
export const CLAUDE_MD_IMPORT_BLOCK = `@./.safeword/SAFEWORD.md

---`;
