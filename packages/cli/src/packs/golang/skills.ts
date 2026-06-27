/**
 * Go Language Pack — Skill Manifest (pure declaration)
 *
 * The pack DECLARES which judgment skills belong to Go; it has no knowledge of
 * prompts, hooks, injection, or timing. The safeword harness CONSUMES this
 * manifest to: (1) install the skills, (2) drift-check installed names against
 * this list, (3) optionally build an availability reminder. Dependency is
 * harness → pack (pull), never pack → harness.
 *
 * Source: samber/cc-skills-golang (MIT), tracked @latest. We install the
 * general-purpose set only — samber's atomicity rule says install all of them
 * together (they cross-reference); a subset gives partial/inconsistent guidance.
 * Library-specific skills (grpc, graphql, spf13-*, uber-*, samber-libs, testify,
 * swagger, temporal) are intentionally excluded.
 */

/** Where the skills come from. The harness owns the install command + ref policy. */
export const GOLANG_SKILL_SOURCE = 'github.com/samber/cc-skills-golang';

/**
 * samber's general-purpose skills, grouped by samber's own taxonomy. Grouping is
 * carried as data so the harness can present a grouped reminder without
 * re-deriving categories. Names must match the upstream skill directory names
 * exactly (the drift check compares against these).
 */
export const GOLANG_SKILLS = {
  quality: [
    'golang-error-handling',
    'golang-naming',
    'golang-code-style',
    'golang-safety',
    'golang-security',
    'golang-documentation',
    'golang-lint',
  ],
  architecture: [
    'golang-concurrency',
    'golang-context',
    'golang-structs-interfaces',
    'golang-design-patterns',
    'golang-dependency-injection',
    'golang-data-structures',
    'golang-database',
    'golang-modernize',
  ],
  qaPerf: [
    'golang-testing',
    'golang-benchmark',
    'golang-performance',
    'golang-observability',
    'golang-troubleshooting',
  ],
  setup: [
    'golang-project-layout',
    'golang-dependency-management',
    'golang-continuous-integration',
    'golang-cli',
  ],
  meta: ['golang-how-to', 'golang-stay-updated', 'golang-pkg-go-dev', 'golang-popular-libraries'],
} as const;

/** Flat list of all declared general-purpose skill names — for install + drift check. */
export const GOLANG_SKILL_NAMES: readonly string[] = Object.values(GOLANG_SKILLS).flat();
