/**
 * Content templates - static string content
 *
 * Note: Most templates (SAFEWORD.md, hooks, skills, guides, etc.) are now
 * file-based in the templates/ directory. This file contains only small
 * string constants that are used inline.
 */

/**
 * Legacy prose reference for AGENTS.md. Kept only so upgrade/reset can remove
 * old safeword-managed blocks from customer-owned context files.
 */
export const AGENTS_MD_LINK = `**⚠️ ALWAYS READ FIRST:** \`.safeword/SAFEWORD.md\`

The SAFEWORD.md file contains core development patterns, workflows, and conventions.
Read it BEFORE working on any task in this project.

---

`;

/**
 * Legacy import block for CLAUDE.md. Kept only so upgrade/reset can remove old
 * safeword-managed imports from customer-owned context files.
 */
export const CLAUDE_MD_IMPORT_BLOCK = `@./.safeword/SAFEWORD.md

---

`;
