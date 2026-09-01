export interface CursorCommandWrapper {
  readonly name: string;
  readonly description: string;
  readonly skillPath: string;
}

export interface CursorRuleWrapper {
  readonly name: string;
  readonly alwaysApply: boolean;
  readonly description?: string;
  readonly frontmatterOrder?: 'description-first';
  readonly globs?: readonly string[];
  readonly referencePath: string;
  readonly skill?: string;
}

export interface SkillCursorPair {
  readonly skill: string;
  readonly cursorRules: readonly string[] | undefined;
}

interface FrontmatterField {
  readonly key: string;
  readonly value: string | boolean | readonly string[];
}

const CURSOR_ACTION_SKILLS = [
  'lint',
  'verify',
  'closeout',
  'audit',
  'explain',
  'cleanup-zombies',
  'self-review',
  'review-spec',
  'retro',
  'spike',
] as const;

// Shared verbatim by a skill's command wrapper and its rule wrapper.
const DEBUG_DESCRIPTION =
  "Finds the real cause of a bug, in four steps, before you touch a fix. Use when encountering bugs, test failures, unexpected behavior, or when previous fix attempts failed. Enforces investigate-first discipline ('debug this', 'fix this error', 'test is failing', 'not working').";

const REFACTOR_DESCRIPTION =
  "Systematic refactoring with small-step discipline. Use when user says 'refactor', 'clean up', 'restructure', 'extract', 'rename', 'simplify', or mentions code smells. Enforces one change → test → commit when the commit can stay scoped. For structural improvements, NOT style/formatting (use /lint). NOT for adding features or fixing bugs.";

export const CURSOR_COMMAND_WRAPPERS: readonly CursorCommandWrapper[] = [
  {
    name: 'pr-readiness',
    description:
      'Prepare a pull request for human review and decide whether it may leave Draft. Use when creating or rewriting a PR description, marking a PR ready, responding to review, or checking mergeability.',
    skillPath: 'pr-readiness/SKILL.md',
  },
  {
    name: 'bdd',
    description:
      "BDD orchestrator for feature-level work. Use when user says 'add', 'implement', 'build', 'feature', 'iteration', 'story', 'phase', 'resume', 'continue', or references a ticket/iteration/story. Also use when work touches 3+ files with new state/flows, or when user runs /bdd. Do NOT use for bug fixes, typos, config changes, or 1-2 file tasks.",
    skillPath: 'bdd/SKILL.md',
  },
  {
    name: 'debug',
    description: DEBUG_DESCRIPTION,
    skillPath: 'debug/SKILL.md',
  },
  {
    name: 'quality-review',
    description:
      "Deep code review with web research. Use when the user says 'double check against latest', 'verify versions', or 'check security'. Adds live research on top of the automatic quality hook — confirms you're using current library versions and APIs, not stale ones.",
    skillPath: 'quality-review/SKILL.md',
  },
  {
    name: 'finish-review',
    description:
      "Internal fallback used only right after the shared review coordinator reports it's run out of reviewer routes. Not something a user invokes directly.",
    skillPath: 'finish-review/SKILL.md',
  },
  {
    name: 'audit',
    description: 'Run comprehensive code audit for architecture, dead code, and test quality',
    skillPath: 'audit/SKILL.md',
  },
  {
    name: 'closeout',
    description:
      "Close a completed local delivery safely after verification. Use when wrapping up a finished coding session: merging only when you've been explicitly told to merge, running the retro, and cleaning up the exact merged branch and worktree.",
    skillPath: 'closeout/SKILL.md',
  },
  {
    name: 'refactor',
    description: REFACTOR_DESCRIPTION,
    skillPath: 'refactor/SKILL.md',
  },
  {
    name: 'retro',
    description:
      'Run a safeword retrospective on the current session on demand — mine the transcript for friction (bugs / rough edges / gaps) and submit it through the outbound safety check before filing upstream. Use when the user says "run a retro", "/retro", or wants to capture friction before the session ends.',
    skillPath: 'retro/SKILL.md',
  },
  {
    name: 'spike',
    description:
      'Run a quick, throwaway experiment to answer one open technical question before committing to the real build. Only runs when you ask for it directly.',
    skillPath: 'spike/SKILL.md',
  },
  {
    name: 'testing',
    description: 'How to write good tests — quality knowledge for any testing context',
    skillPath: 'testing/SKILL.md',
  },
] as const;

export const CURSOR_RULE_WRAPPERS: readonly CursorRuleWrapper[] = [
  {
    name: 'safeword-core',
    alwaysApply: true,
    referencePath: '.safeword/SAFEWORD.md',
  },
  {
    name: 'safeword-brainstorming',
    alwaysApply: false,
    description:
      "Collaborative brainstorming and rubber-ducking — divergence-first thinking partner. Use when the user wants to explore options, weigh approaches, or think through uncertainty before committing to a direction ('brainstorm', 'rubber duck', 'help me think', 'explore options', 'what are the tradeoffs').",
    referencePath: '.safeword/skills/brainstorm/SKILL.md',
    skill: 'brainstorm',
  },
  {
    name: 'safeword-debugging',
    alwaysApply: false,
    description: DEBUG_DESCRIPTION,
    referencePath: '.safeword/skills/debug/SKILL.md',
    skill: 'debug',
  },
  {
    name: 'safeword-elicitation',
    alwaysApply: false,
    description:
      "Extract tacit knowledge through non-obvious microquestions — things only the user knows that can't be found in code, docs, or research. Use when about to guess at intent, context, or constraints, or when user says 'ask me', 'what do you need to know', 'what's missing'. Skips questions answerable by reading the codebase or searching the web.",
    referencePath: '.safeword/skills/elicit/SKILL.md',
    skill: 'elicit',
  },
  {
    name: 'safeword-figure-it-out',
    alwaysApply: false,
    description:
      'Explore and debate options with fresh documentation and research before committing. Use when facing a real decision with multiple plausible approaches — library/framework choice, architecture call, API or schema design, algorithm selection. Looks up current docs and recent research, weighs options on correctness and elegance, and resists bloat.',
    referencePath: '.safeword/skills/figure-it-out/SKILL.md',
    skill: 'figure-it-out',
  },
  {
    name: 'safeword-finish-review',
    alwaysApply: false,
    description:
      "Internal fallback used only right after the shared review coordinator reports it's run out of reviewer routes. Not something a user invokes directly.",
    referencePath: '.safeword/skills/finish-review/SKILL.md',
    skill: 'finish-review',
  },
  {
    name: 'safeword-pr-readiness',
    alwaysApply: false,
    description:
      'Prepare a pull request for human review and decide whether it may leave Draft. Use when creating or rewriting a PR description, marking a PR ready, responding to review, or checking mergeability.',
    referencePath: '.safeword/skills/pr-readiness/SKILL.md',
    skill: 'pr-readiness',
  },
  {
    name: 'safeword-quality-reviewing',
    alwaysApply: false,
    description:
      "Deep quality review of any work-product — code, docs, specs, plans, decisions — with web research. Use when explicitly verifying against latest docs ('double check against latest', 'verify versions', 'check security'), pressure-testing correctness and elegance, or needing deeper analysis beyond the automatic hook. Fetches current sources, checks versions and claims, and weighs alternatives.",
    referencePath: '.safeword/skills/quality-review/SKILL.md',
    skill: 'quality-review',
  },
  {
    name: 'safeword-refactoring',
    alwaysApply: false,
    description: REFACTOR_DESCRIPTION,
    referencePath: '.safeword/skills/refactor/SKILL.md',
    skill: 'refactor',
  },
  {
    name: 'safeword-tdd-review',
    alwaysApply: false,
    description:
      "Step-aware quality review at TDD phase boundaries — review test quality after RED, implementation correctness after GREEN, completed scenario after REFACTOR. Use when user says 'review my test', 'review my implementation', 'is this GREEN solid?', or just finished a TDD step. (Note: Claude Code triggers this automatically via the phase-tracking hook; Cursor users must invoke explicitly.)",
    referencePath: '.safeword/skills/tdd-review/SKILL.md',
    skill: 'tdd-review',
  },
  {
    name: 'safeword-testing',
    alwaysApply: false,
    description:
      "How to write good tests. Use when writing tests in any context — 'write tests', 'add tests', 'test this', 'need tests for', 'improve coverage'. Also consult when writing tests during BDD or debugging. Core knowledge for test quality across all workflows.",
    referencePath: '.safeword/skills/testing/SKILL.md',
    skill: 'testing',
  },
  {
    name: 'safeword-ticket-system',
    alwaysApply: false,
    description:
      'Ticket system and work logs for context anchoring during complex work. Use when creating tickets, managing work logs, referencing ticket IDs, or when work needs context anchoring (multi-step tasks, debugging, investigation).',
    globs: ['.project/tickets/**', '.safeword-project/tickets/**', '.safeword/logs/**'],
    referencePath: '.safeword/skills/ticket-system/SKILL.md',
    skill: 'ticket-system',
  },
  {
    name: 'safeword-retro-filer',
    alwaysApply: false,
    description:
      "Files Safeword's sanitized spooled retrospective drafts to its upstream tracker. Use only when a trusted Safeword Stop continuation or authenticated closeout cleanup guard output names a spool path. Do not use for ordinary retros, project issues, or user-authored drafts.",
    referencePath: '.safeword/skills/retro-filer/SKILL.md',
    skill: 'retro-filer',
  },
  {
    name: 'bdd-core',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      "USE WHEN starting feature work, running /bdd, resuming a BDD ticket, or user says 'add', 'implement', 'build', 'feature', 'resume', 'continue'. Orchestrates BDD phases.",
    referencePath: '.safeword/skills/bdd/SKILL.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-discovery',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN in BDD intake phase OR ticket has phase:intake. Guides discovery and context gathering for features.',
    referencePath: '.safeword/skills/bdd/DISCOVERY.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-scenarios',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN in BDD define-behavior or scenario-gate phase. Guides Given/When/Then scenario creation and validation.',
    referencePath: '.safeword/skills/bdd/SCENARIOS.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-plan-implementation',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN in BDD plan-implementation phase. Author impl-plan.md, run figure-it-out on load-bearing choices, ADR lifecycle, review before implement.',
    referencePath: '.safeword/skills/bdd/PLAN_IMPLEMENTATION.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-tdd',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description: 'USE WHEN in BDD implement phase. RED/GREEN TDD cycle; run /refactor after GREEN.',
    referencePath: '.safeword/skills/bdd/TDD.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-verify',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN in BDD verify phase OR all scenarios marked [x]. Evidence gate — cross-scenario refactor, then /verify and /audit.',
    referencePath: '.safeword/skills/bdd/VERIFY.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-done',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN in BDD done phase (verify.md exists). Close the ticket — verification already happened in verify.',
    referencePath: '.safeword/skills/bdd/DONE.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-splitting',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    description:
      'USE WHEN BDD thresholds exceeded (2+ stories, >15 scenarios, >20 tasks). Split protocol and examples.',
    referencePath: '.safeword/skills/bdd/SPLITTING.md',
    skill: 'bdd',
  },
] as const;

function cursorRuleSkillPairs(): SkillCursorPair[] {
  const skillRules = new Map<string, string[]>();

  for (const wrapper of CURSOR_RULE_WRAPPERS) {
    if (wrapper.skill === undefined) continue;

    const rules = skillRules.get(wrapper.skill);
    if (rules === undefined) {
      skillRules.set(wrapper.skill, [wrapper.name]);
      continue;
    }

    rules.push(wrapper.name);
  }

  return [...skillRules].map(([skill, cursorRules]) => ({ skill, cursorRules }));
}

export const SKILL_CURSOR_PAIRS: readonly SkillCursorPair[] = [
  ...cursorRuleSkillPairs(),
  ...CURSOR_ACTION_SKILLS.map(skill => ({ skill, cursorRules: undefined })),
];

function renderFrontmatter({ fields }: { readonly fields: readonly FrontmatterField[] }): string {
  const lines = fields.flatMap(field => {
    if (Array.isArray(field.value)) {
      return [`${field.key}:`, ...field.value.map(item => `  - ${item}`)];
    }

    return [`${field.key}: ${field.value}`];
  });

  return `---\n${lines.join('\n')}\n---`;
}

export function renderCursorCommandWrapper({
  wrapper,
}: {
  readonly wrapper: CursorCommandWrapper;
}): string {
  return `${renderFrontmatter({
    fields: [{ key: 'description', value: wrapper.description }],
  })}

Read and follow the instructions in .safeword/skills/${wrapper.skillPath}
`;
}

export function renderCursorRuleWrapper({
  wrapper,
}: {
  readonly wrapper: CursorRuleWrapper;
}): string {
  const fields: FrontmatterField[] = [];
  if (wrapper.frontmatterOrder === 'description-first' && wrapper.description !== undefined) {
    fields.push({ key: 'description', value: wrapper.description });
  }

  fields.push({ key: 'alwaysApply', value: wrapper.alwaysApply });

  if (wrapper.frontmatterOrder !== 'description-first' && wrapper.description !== undefined) {
    fields.push({ key: 'description', value: wrapper.description });
  }

  if (wrapper.globs !== undefined) {
    fields.push({ key: 'globs', value: wrapper.globs });
  }

  return `${renderFrontmatter({ fields })}

@${wrapper.referencePath}
`;
}
