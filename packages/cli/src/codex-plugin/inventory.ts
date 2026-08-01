const LEGACY_SKILL_FILES = [
  'audit/SKILL.md',
  'bdd/SKILL.md',
  'bdd/DISCOVERY.md',
  'bdd/PLAN_IMPLEMENTATION.md',
  'bdd/SCENARIOS.md',
  'bdd/TDD.md',
  'bdd/DONE.md',
  'bdd/SPLITTING.md',
  'bdd/VERIFY.md',
  'brainstorm/SKILL.md',
  'cleanup-zombies/SKILL.md',
  'debug/SKILL.md',
  'elicit/SKILL.md',
  'explain/SKILL.md',
  'figure-it-out/SKILL.md',
  'lint/SKILL.md',
  'quality-review/SKILL.md',
  'refactor/SKILL.md',
  'retro/SKILL.md',
  'review-spec/SKILL.md',
  'self-review/SKILL.md',
  'tdd-review/SKILL.md',
  'testing/SKILL.md',
  'ticket-system/SKILL.md',
  'verify/SKILL.md',
] as const;

const LEGACY_SKILL_PATHS = LEGACY_SKILL_FILES.map(file => `.agents/skills/${file}`);
const LEGACY_SKILL_DIRECTORIES = [
  ...new Set(LEGACY_SKILL_FILES.map(file => `.agents/skills/${file.split('/', 1)[0]}`)),
];
const LEGACY_AGENT_PATHS = ['.codex/agents/safeword-retro-filer.toml'];
const LEGACY_HOOK_EVENTS = [
  'session-start',
  'user-prompt-submit',
  'pre-tool-use',
  'post-tool-use',
  'stop',
];
const LEGACY_HOOK_EVENT_NAMES: Record<string, string> = {
  'session-start': 'SessionStart',
  'user-prompt-submit': 'UserPromptSubmit',
  'pre-tool-use': 'PreToolUse',
  'post-tool-use': 'PostToolUse',
  stop: 'Stop',
};
const LEGACY_HOOK_SCRIPT_EVENTS: Record<string, string> = {
  'session-codex-start.ts': 'session-start',
  'session-safeword-context.ts': 'session-start',
  'prompt-timestamp.ts': 'user-prompt-submit',
  'prompt-retro-nudge.ts': 'user-prompt-submit',
  'codex/pre-tool-quality.ts': 'pre-tool-use',
  'codex/stop.ts': 'stop',
  'codex/post-tool-skill-nudge.ts': 'post-tool-use',
  'codex/post-tool-quality.ts': 'post-tool-use',
};
const LEGACY_HOOK_SCRIPTS = Object.keys(LEGACY_HOOK_SCRIPT_EVENTS);
const LEGACY_RUNTIME_PATHS = LEGACY_HOOK_SCRIPTS.map(script => `.safeword/hooks/${script}`);

/**
 * Canonical inventory for historical Codex assets. The root schema composes
 * this fragment, while migration safety checks consume the same values.
 */
export const CODEX_MIGRATION_SCHEMA = {
  legacyFiles: [...LEGACY_SKILL_PATHS, ...LEGACY_AGENT_PATHS, ...LEGACY_RUNTIME_PATHS],
  legacyDirs: LEGACY_SKILL_DIRECTORIES,
  hookEvents: LEGACY_HOOK_EVENTS,
  hookEventNames: LEGACY_HOOK_EVENT_NAMES,
  hookScripts: LEGACY_HOOK_SCRIPTS,
  hookScriptEvents: LEGACY_HOOK_SCRIPT_EVENTS,
  hookScriptPrefix: 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/',
  packageRunner: 'npx' as const,
  projectMarker: '.safeword/SAFEWORD.md',
  paths: {
    config: '.codex/config.toml',
    backupRoot: '.safeword/codex-migration-backup',
    pluginMarker: '.safeword/codex-plugin.json',
    bootstrapSkill: '.agents/skills/safeword-plugin-setup/SKILL.md',
    hookRuntimeRoot: '.safeword/hooks',
  },
};
