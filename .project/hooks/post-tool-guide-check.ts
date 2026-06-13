#!/usr/bin/env bun
// Safeword project-specific: Guide compliance check for template files (PostToolUse)
// This hook is ONLY for the safeword repo itself, not distributed to end users.
// Prompts for LLM guide + context-files guide compliance when editing templates

interface HookInput {
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

// Patterns for files that need guide compliance checks
const SKILL_PATTERNS = ['/skills/', '/rules/safeword-', 'AGENTS.md'];
const TEMPLATE_PATTERNS = ['packages/cli/templates/'];

function isSkillFile(filePath: string): boolean {
  return SKILL_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isTemplateFile(filePath: string): boolean {
  return TEMPLATE_PATTERNS.some(pattern => filePath.includes(pattern));
}

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

if (!file) {
  process.exit(0);
}

const isTemplate = isTemplateFile(file);
const isSkill = isSkillFile(file);

// Only check template files
if (!isTemplate) {
  process.exit(0);
}

// Build compliance message
const checks: string[] = [];

checks.push('- Verify against `.safeword/guides/llm-writing-guide.md` (MECE, explicit, examples)');

if (isSkill) {
  checks.push('- Verify against `.safeword/guides/context-files-guide.md` (triggers, scope, size)');
}

const message = `Guide compliance check for: ${file.split('/').slice(-2).join('/')}

${checks.join('\n')}`;

console.log(JSON.stringify({ message }));
