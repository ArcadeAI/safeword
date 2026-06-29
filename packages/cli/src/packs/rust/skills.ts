/**
 * Rust Language Pack — Skill Manifest (pure declaration)
 *
 * DECLARES the Rust skill source + selection; the harness CONSUMES it
 * (harness → pack pull).
 *
 * Source: leonardomso/rust-skills (MIT) — a Rust-DEDICATED, single-skill repo
 * (one SKILL.md of ~265 rules across ownership/borrowing, `Result`/`?`, traits,
 * lifetimes, async, `unsafe`). Because it's single-language, selection is `'all'`
 * (`--skill '*'`) — drift-free, and here it resolves to exactly one skill,
 * verified to install as `.claude/skills/rust-skills/`.
 *
 * NOTE: efficacy is not yet probed. Rust has the highest inherent headroom
 * (ownership/borrowing is where agents stumble) but the thinnest ecosystem; the
 * headroom-probe gate (#540 Done-when) decides whether this pack — or authoring
 * our own — is the answer.
 */

/** Where the skills come from. The harness owns the install command + ref policy. */
export const RUST_SKILL_SOURCE = 'github.com/leonardomso/rust-skills';

/**
 * Selection: `'all'`. The source is a single-skill, Rust-dedicated repo, so `'*'`
 * is both drift-free and exactly the one skill we want — no name list to carry.
 */
export const RUST_SKILL_SELECTION = 'all' as const;

/** Directory-name shape the installed skill follows (`rust-skills`). */
export const RUST_SKILL_DIR_PATTERN = /^rust-skills$/;
