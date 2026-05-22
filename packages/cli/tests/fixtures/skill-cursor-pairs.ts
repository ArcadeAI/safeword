/**
 * Canonical mapping of safeword skills to their Cursor rules.
 *
 * Source of truth for parity tests across:
 * - `tests/schema.test.ts` (Claude/Cursor schema parity)
 * - `tests/integration/skills-commands-validation.test.ts` (Skills-Cursor parity)
 *
 * - `cursorRules: string[]` — skill maps to one or more cursor rules
 * - `cursorRules: undefined` — action skill (uses Cursor commands instead of rules,
 *   per `disable-model-invocation`)
 */
export interface SkillCursorPair {
  skill: string;
  cursorRules: string[] | undefined;
}

export const SKILL_CURSOR_PAIRS: readonly SkillCursorPair[] = [
  {
    skill: 'bdd',
    cursorRules: [
      'bdd-core',
      'bdd-discovery',
      'bdd-scenarios',
      'bdd-decomposition',
      'bdd-tdd',
      'bdd-done',
      'bdd-splitting',
    ],
  },
  { skill: 'brainstorm', cursorRules: ['safeword-brainstorming'] },
  { skill: 'debug', cursorRules: ['safeword-debugging'] },
  { skill: 'elicit', cursorRules: ['safeword-elicitation'] },
  { skill: 'figure-it-out', cursorRules: ['safeword-figure-it-out'] },
  { skill: 'quality-review', cursorRules: ['safeword-quality-reviewing'] },
  { skill: 'refactor', cursorRules: ['safeword-refactoring'] },
  { skill: 'tdd-review', cursorRules: ['safeword-tdd-review'] },
  { skill: 'testing', cursorRules: ['safeword-testing'] },
  { skill: 'ticket-system', cursorRules: ['safeword-ticket-system'] },
  // Action skills use Cursor commands, not rules
  { skill: 'lint', cursorRules: undefined },
  { skill: 'verify', cursorRules: undefined },
  { skill: 'audit', cursorRules: undefined },
  { skill: 'cleanup-zombies', cursorRules: undefined },
];
