/**
 * Go Language Pack — Skill Manifest (pure declaration)
 *
 * The pack DECLARES where Go judgment skills come from and how to select them.
 * It has no knowledge of prompts, hooks, injection, or timing — the safeword
 * harness CONSUMES this manifest to install the skills and, separately, to build
 * any availability reminder. Dependency is harness → pack (pull), never the
 * reverse.
 *
 * No skill NAMES are stored here, on purpose. Writing them down manufactures
 * drift: upstream adds/renames/removes skills on its own cadence, and a hardcoded
 * list silently rots against the installed reality. The names that matter are the
 * `golang-*` directories that actually land on disk after install — the harness
 * derives them from there at runtime. The manifest stays at the level that does
 * not drift: the source and the selection policy.
 *
 * Source: samber/cc-skills-golang (MIT), tracked @latest (no pin).
 *
 * Selection: 'all'. The upstream installer (`npx skills`) exposes only `--all`
 * or an explicit `--skill <names...>` list — there is NO general-purpose-group
 * flag. Selecting "general-purpose only" would therefore require enumerating
 * names here, which is exactly the drift we refuse. samber's own atomicity rule
 * also says the general-purpose skills install together (they cross-reference),
 * so a curated subset risks partial/inconsistent guidance. We install the full
 * set; library-specific skills that never match the project simply never fire.
 */

/** Where the skills come from. The harness owns the install command + ref policy. */
export const GOLANG_SKILL_SOURCE = 'github.com/samber/cc-skills-golang';

/**
 * How the harness should select skills from the source.
 *
 * - `'all'`: install every skill the source publishes (no name list to maintain).
 *
 * Kept as a union so a future curated mode is a type change, not a refactor — but
 * any named mode reintroduces drift and must justify carrying a list.
 */
export type GolangSkillSelection = 'all';

/** Install selection policy. See the module doc for why this is `'all'`. */
export const GOLANG_SKILL_SELECTION: GolangSkillSelection = 'all';

/**
 * Directory-name shape every installed skill follows (`golang-*`). The harness
 * uses this to discover installed skills on disk — the single source of truth for
 * "which skills exist" — instead of any list stored here.
 */
export const GOLANG_SKILL_DIR_PATTERN = /^golang-[a-z0-9-]+$/;
