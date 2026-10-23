import { stringify } from 'yaml';

import {
  type CanonicalCommandWrapper,
  readCanonicalWorkflowPurpose,
  readPackagedSkillContracts,
} from './host-contract/catalogue.js';

export type CursorCommandWrapper = CanonicalCommandWrapper;

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

export const CURSOR_RULE_WRAPPERS: readonly CursorRuleWrapper[] = [
  {
    name: 'safeword-core',
    alwaysApply: true,
    referencePath: '.safeword/SAFEWORD.md',
  },
  {
    name: 'safeword-brainstorming',
    alwaysApply: false,
    referencePath: '.safeword/skills/brainstorm/SKILL.md',
    skill: 'brainstorm',
  },
  {
    name: 'safeword-debugging',
    alwaysApply: false,
    referencePath: '.safeword/skills/debug/SKILL.md',
    skill: 'debug',
  },
  {
    name: 'safeword-demand-research',
    alwaysApply: false,
    referencePath: '.safeword/skills/demand-research/SKILL.md',
    skill: 'demand-research',
  },
  {
    name: 'safeword-elicitation',
    alwaysApply: false,
    referencePath: '.safeword/skills/elicit/SKILL.md',
    skill: 'elicit',
  },
  {
    name: 'safeword-figure-it-out',
    alwaysApply: false,
    referencePath: '.safeword/skills/figure-it-out/SKILL.md',
    skill: 'figure-it-out',
  },
  {
    name: 'safeword-finish-review',
    alwaysApply: false,
    referencePath: '.safeword/skills/finish-review/SKILL.md',
    skill: 'finish-review',
  },
  {
    name: 'safeword-pr-readiness',
    alwaysApply: false,
    referencePath: '.safeword/skills/pr-readiness/SKILL.md',
    skill: 'pr-readiness',
  },
  {
    name: 'safeword-quality-reviewing',
    alwaysApply: false,
    referencePath: '.safeword/skills/quality-review/SKILL.md',
    skill: 'quality-review',
  },
  {
    name: 'safeword-refactoring',
    alwaysApply: false,
    referencePath: '.safeword/skills/refactor/SKILL.md',
    skill: 'refactor',
  },
  {
    name: 'safeword-tdd-review',
    alwaysApply: false,
    referencePath: '.safeword/skills/tdd-review/SKILL.md',
    skill: 'tdd-review',
  },
  {
    name: 'safeword-testing',
    alwaysApply: false,
    referencePath: '.safeword/skills/testing/SKILL.md',
    skill: 'testing',
  },
  {
    name: 'safeword-ticket-system',
    alwaysApply: false,
    globs: ['.project/tickets/**', '.safeword-project/tickets/**', '.safeword/logs/**'],
    referencePath: '.safeword/skills/ticket-system/SKILL.md',
    skill: 'ticket-system',
  },
  {
    name: 'safeword-retro-filer',
    alwaysApply: false,
    referencePath: '.safeword/skills/retro-filer/SKILL.md',
    skill: 'retro-filer',
  },
  {
    name: 'bdd-core',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/SKILL.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-discovery',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/DISCOVERY.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-scenarios',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/SCENARIOS.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-plan-implementation',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/PLAN_IMPLEMENTATION.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-plan-execution',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/PLAN_EXECUTION.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-tdd',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/TDD.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-verify',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/VERIFY.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-done',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/DONE.md',
    skill: 'bdd',
  },
  {
    name: 'bdd-splitting',
    alwaysApply: false,
    frontmatterOrder: 'description-first',
    referencePath: '.safeword/skills/bdd/SPLITTING.md',
    skill: 'bdd',
  },
] as const;

/** Canonical workflow files own purpose; this table owns only Cursor discovery mechanics. */
export function readCursorRuleWrappers(templatesDirectory: string): CursorRuleWrapper[] {
  const skills = new Map(
    readPackagedSkillContracts(`${templatesDirectory}/skills`).map(skill => [skill.name, skill]),
  );
  return CURSOR_RULE_WRAPPERS.map(wrapper => {
    if (!wrapper.skill) return wrapper;
    const skill = skills.get(wrapper.skill);
    if (!skill)
      throw new Error(`Cursor rule ${wrapper.name} references an unknown canonical workflow`);
    const description = wrapper.referencePath.endsWith('/SKILL.md')
      ? skill.description
      : readCanonicalWorkflowPurpose(
          `${templatesDirectory}/${wrapper.referencePath.replace(/^\.safeword\//u, '')}`,
        );
    return { ...wrapper, description };
  });
}

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
  const metadata = stringify(Object.fromEntries(fields.map(field => [field.key, field.value])), {
    defaultStringType: 'BLOCK_LITERAL',
    defaultKeyType: 'PLAIN',
    lineWidth: 0,
  }).trimEnd();
  return `---\n${metadata}\n---`;
}

export function renderCursorCommandWrapper({
  wrapper,
}: {
  readonly wrapper: CursorCommandWrapper;
}): string {
  const metadata = stringify(
    { description: wrapper.description },
    { defaultStringType: 'BLOCK_LITERAL', defaultKeyType: 'PLAIN', lineWidth: 0 },
  ).trimEnd();
  return `---
${metadata}
---

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
