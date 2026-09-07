/**
 * Types for the lint-staged config so tests can import it and assert on the
 * commands it produces (see packages/cli/tests/markdown-suppression-gate.test.ts).
 *
 * lint-staged accepts either a literal command list or a function of the staged
 * paths; this repo uses both, so a value is one or the other.
 */
type LintStagedRule = readonly string[] | ((files: string[]) => string[]);

declare const config: Record<string, LintStagedRule>;

export default config;
