/**
 * Go Language Pack — Skill Manifest (pure declaration)
 *
 * DECLARES where Go judgment skills come from and how to select them; the harness
 * CONSUMES it (harness → pack pull).
 *
 * Source: jeffallan/claude-skills (MIT) — the same multi-language author as the
 * Python and TypeScript packs, so all three share one source/structure. Selection
 * is the NAMED language-tier skill `golang-pro` (not `'*'`): the source is a
 * multi-domain grab-bag, and we want one lean language-core skill, not its ~66
 * unrelated skills. Verified to install as `.claude/skills/golang-pro/`.
 *
 * Why not samber/cc-skills-golang (the previous source): samber ships 44 atomic
 * skills (half library-specific) plus a dispatcher. Every installed skill's
 * description is always-on context that competes with safeword's own skills in a
 * shared 1%-of-context budget, and our own efficacy probes (Go race trap, Python
 * concurrency trap) showed the *core* idioms these packs teach are already
 * internalized by frontier models — so the 44-skill footprint bought little. A
 * single lean skill makes Go uniform with Python/TS/Rust (single-skill, no
 * dispatcher) at the lowest always-on cost. samber remains a one-line registry
 * swap if depth or library-specific coverage is ever wanted.
 *
 * NOTE: efficacy is not separately probed for this skill; delivery is wired, and
 * the core-idiom headroom finding (see `.project/learnings/skill-pack-efficacy-gate.md`)
 * applies. Minor framework bleed (gRPC/microservices in the description) to keep
 * in mind — it surfaces verbatim in the nudge, same accepted tradeoff as TS.
 */

/** Where the skills come from. The harness owns the install command + ref policy. */
export const GOLANG_SKILL_SOURCE = 'github.com/jeffallan/claude-skills';

/** Named selection: the single language-tier skill (see module doc for why named). */
export const GOLANG_SKILL_SELECTION: readonly string[] = ['golang-pro'];

/** Directory-name shape the installed skill follows (`golang-pro`). */
export const GOLANG_SKILL_DIR_PATTERN = /^golang-pro$/;
