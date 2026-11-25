/** Codex-native bundle paths; portable hosts retain their own registrations. */
export const CODEX_WORKFLOW_LAYOUT = {
  skills: 'skills',
  internal: 'internal',
  index: 'resources/workflow-index.json',
  templates: 'templates',
  handbook: 'resources/SAFEWORD.md',
} as const;

export const CODEX_SKILL_METADATA_LIMIT = 8000;
export const CODEX_STARTUP_CONTEXT_LIMIT = 8192;

/** Existing managed consumers; shared instructions are materialized before projection. */
export const TESTING_CORE_LAYOUT = {
  owner: 'src/testing/shared-core.ts',
  maxBytes: 2048,
  templates: [
    'skills/testing/SKILL.md',
    'skills/quality-review/SKILL.md',
    'skills/tdd-review/SKILL.md',
    'skills/debug/SKILL.md',
    'skills/refactor/SKILL.md',
    'skills/bdd/TDD.md',
    'guides/testing-guide.md',
  ],
  runtimeConsumers: ['quality-review'],
} as const;

export const PLANNING_DATA_GUIDE_PATH = '.safeword/guides/data-architecture-guide.md';

/** Schema-owned guide files, shared without importing the schema/catalogue cycle. */
export const PROJECT_GUIDE_FILES: Readonly<Record<string, { readonly template: string }>> = {
  '.safeword/guides/architecture-guide.md': {
    template: 'guides/architecture-guide.md',
  },
  '.safeword/guides/self-report-filing.md': {
    template: 'guides/self-report-filing.md',
  },
  '.safeword/guides/retro.md': {
    template: 'guides/retro.md',
  },
  '.safeword/guides/cold-start-check.md': {
    template: 'guides/cold-start-check.md',
  },
  '.safeword/guides/context-files-guide.md': {
    template: 'guides/context-files-guide.md',
  },
  [PLANNING_DATA_GUIDE_PATH]: {
    template: 'guides/data-architecture-guide.md',
  },
  '.safeword/guides/interface-contract-guide.md': {
    template: 'guides/interface-contract-guide.md',
  },
  '.safeword/guides/design-doc-guide.md': {
    template: 'guides/design-doc-guide.md',
  },
  '.safeword/guides/learning-extraction.md': {
    template: 'guides/learning-extraction.md',
  },
  '.safeword/guides/llm-writing-guide.md': {
    template: 'guides/llm-writing-guide.md',
  },
  '.safeword/guides/llm-evals-guide.md': {
    template: 'guides/llm-evals-guide.md',
  },
  '.safeword/guides/planning-guide.md': {
    template: 'guides/planning-guide.md',
  },
  '.safeword/guides/release-recovery-guide.md': {
    template: 'guides/release-recovery-guide.md',
  },
  '.safeword/guides/measurement-design-guide.md': {
    template: 'guides/measurement-design-guide.md',
  },
  '.safeword/guides/skill-eval-optimization-guide.md': {
    template: 'guides/skill-eval-optimization-guide.md',
  },
  '.safeword/guides/testing-guide.md': {
    template: 'guides/testing-guide.md',
  },
  '.safeword/guides/verification-lanes-guide.md': {
    template: 'guides/verification-lanes-guide.md',
  },
  '.safeword/guides/zombie-process-cleanup.md': {
    template: 'guides/zombie-process-cleanup.md',
  },
};
