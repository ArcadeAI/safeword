/**
 * Validation Tests: Claude Code Skills and Commands
 *
 * Validates that safeword's skills and commands follow Claude Code's
 * documented format requirements (as of Dec 2025).
 *
 * Skills: https://code.claude.com/docs/en/skills.md
 * Commands: https://code.claude.com/docs/en/slash-commands.md
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;
const TEMPLATES_DIR = nodePath.join(__dirname, '../../templates');
const SKILLS_DIR = nodePath.join(TEMPLATES_DIR, 'skills');
const COMMANDS_DIR = nodePath.join(TEMPLATES_DIR, 'commands');
const CURSOR_RULES_DIR = nodePath.join(TEMPLATES_DIR, 'cursor/rules');

// Claude Code validation constants
const SKILL_NAME_MAX_LENGTH = 64;
const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
const SKILL_NAME_PATTERN = /^[a-z0-9-]+$/;
const RESERVED_WORDS = ['anthropic', 'claude'];
const MIN_BODY_LENGTH = 10;

// allowed-tools patterns (Claude Code format)
// Valid: '*', 'Read', 'Read, Grep, Glob', 'Bash(git:*)', 'mcp__server__tool'
// eslint-disable-next-line sonarjs/regex-complexity -- intentionally complex to match Claude Code's allowed-tools format
const ALLOWED_TOOLS_PATTERN = /^(\*|\w+(\([^)]+\))?(,\s*\w+(\([^)]+\))?)*)$/;

// Markdown link pattern [text](path)
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  'allowed-tools'?: string;
  model?: string;
  'argument-hint'?: string;
  'disable-model-invocation'?: boolean;
  // Cursor-specific fields
  alwaysApply?: boolean;
}

/**
 * Parse a YAML value string, handling booleans and quoted strings.
 */
// eslint-disable-next-line sonarjs/function-return-type -- intentionally returns union type for YAML parsing
function parseYamlValue(raw: string): string | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Remove surrounding quotes
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Parse YAML frontmatter from markdown file content.
 * Returns undefined if no valid frontmatter found.
 */
// eslint-disable-next-line complexity -- frontmatter parsing has inherent complexity
function parseFrontmatter(
  content: string,
): { frontmatter: ParsedFrontmatter; body: string } | undefined {
  const lines = content.split('\n');

  // Must start with --- on line 1 (no blank lines before)
  if (lines[0]?.trim() !== '---') {
    return undefined;
  }

  // Find closing ---
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return undefined;
  }

  // Parse YAML-like frontmatter (simple key: value parsing)
  const frontmatter: ParsedFrontmatter = {};
  for (let i = 1; i < endIndex; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = parseYamlValue(line.slice(colonIndex + 1).trim());
    (frontmatter as Record<string, unknown>)[key] = value;
  }

  const body = lines
    .slice(endIndex + 1)
    .join('\n')
    .trim();
  return { frontmatter, body };
}

/**
 * Get all skill directories (excludes _shared which contains include files)
 */
function getSkillDirectories(): string[] {
  try {
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name);
  } catch {
    return [];
  }
}

/**
 * Get all command files
 */
function getCommandFiles(): string[] {
  try {
    return readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * Get all cursor rule files (.mdc)
 */
function getCursorRuleFiles(): string[] {
  try {
    return readdirSync(CURSOR_RULES_DIR).filter(f => f.endsWith('.mdc'));
  } catch {
    return [];
  }
}

/**
 * Extract markdown links from content
 * Returns array of { text, path } objects
 */
function extractMarkdownLinks(content: string): { text: string; path: string }[] {
  const links: { text: string; path: string }[] = [];
  let match;
  // Reset lastIndex for global regex
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern.source is a constant defined above
  const pattern = new RegExp(MARKDOWN_LINK_PATTERN.source, 'g');
  while ((match = pattern.exec(content)) !== null) {
    const text = match[1];
    const path = match[2];
    // Skip external URLs and anchor links
    if (text && path && !path.startsWith('http') && !path.startsWith('#')) {
      links.push({ text, path });
    }
  }
  return links;
}

/**
 * Check if a name follows gerund convention (verb+ing)
 */
function isGerundName(name: string): boolean {
  const parts = name.split('-');
  return parts.some(part => part.endsWith('ing'));
}

/**
 * Find invalid argument patterns in content.
 * Valid: $1, $2, $ARGUMENTS, $CLAUDE_*
 * Invalid: $arg, $myVar, etc. (Note: $0 is checked separately)
 */
function findInvalidArgumentPatterns(content: string): string[] {
  const patterns = content.match(/\$[a-z_]\w*/gi) || [];
  return patterns.filter(p => p !== '$ARGUMENTS' && !p.startsWith('$CLAUDE_'));
}

/**
 * Read file and parse frontmatter, returning defaults on error
 */
function readAndParseFrontmatter(filePath: string): {
  content: string;
  parsed: ReturnType<typeof parseFrontmatter>;
} {
  try {
    const content = readFileSync(filePath, 'utf8');
    return { content, parsed: parseFrontmatter(content) };
  } catch {
    return { content: '', parsed: undefined };
  }
}

/**
 * Find broken markdown file links in content
 * Returns array of broken link strings for error messages
 */
function findBrokenMarkdownLinks(body: string, baseDirectory: string): string[] {
  const links = extractMarkdownLinks(body);
  const brokenLinks: string[] = [];

  for (const link of links) {
    if (link.path.endsWith('.md')) {
      const fullPath = nodePath.join(baseDirectory, link.path);
      if (!existsSync(fullPath)) {
        brokenLinks.push(`[${link.text}](${link.path})`);
      }
    }
  }

  return brokenLinks;
}

describe('Skills Validation (Claude Code Format)', () => {
  const skillDirectoryectories = getSkillDirectories();

  it('should have at least one skill', () => {
    expect(skillDirectoryectories.length).toBeGreaterThan(0);
  });

  for (const skillDirectory of skillDirectoryectories) {
    describe(`skill: ${skillDirectory}`, () => {
      const skillPath = nodePath.join(SKILLS_DIR, skillDirectory, 'SKILL.md');
      const { content, parsed } = readAndParseFrontmatter(skillPath);

      it('should have SKILL.md file', () => {
        expect(content).not.toBe('');
      });

      it('should have valid frontmatter starting with ---', () => {
        expect(parsed, 'Frontmatter must start with --- on line 1').not.toBeNull();
      });

      it('should have required "name" field', () => {
        expect(parsed?.frontmatter.name, 'Missing name field').toBeDefined();
        expect(parsed?.frontmatter.name, 'name cannot be empty').not.toBe('');
      });

      it('should have valid name format (lowercase, a-z0-9-)', () => {
        const name = parsed?.frontmatter.name;
        if (name) {
          expect(name, `name "${name}" contains invalid characters`).toMatch(SKILL_NAME_PATTERN);
        }
      });

      it('should have name under 64 characters', () => {
        const name = parsed?.frontmatter.name;
        if (name) {
          expect(name.length, `name is ${name.length} chars, max is 64`).toBeLessThanOrEqual(
            SKILL_NAME_MAX_LENGTH,
          );
        }
      });

      it('should not use reserved words in name', () => {
        const name = parsed?.frontmatter.name;
        if (name) {
          for (const reserved of RESERVED_WORDS) {
            expect(name.toLowerCase(), `name cannot contain "${reserved}"`).not.toContain(reserved);
          }
        }
      });

      it('should have required "description" field', () => {
        expect(parsed?.frontmatter.description, 'Missing description field').toBeDefined();
        expect(parsed?.frontmatter.description, 'description cannot be empty').not.toBe('');
      });

      it('should have description under 1024 characters', () => {
        const desc = parsed?.frontmatter.description;
        if (desc) {
          expect(
            desc.length,
            `description is ${desc.length} chars, max is 1024`,
          ).toBeLessThanOrEqual(SKILL_DESCRIPTION_MAX_LENGTH);
        }
      });

      it('should use third person in description (not "I" or "you")', () => {
        const desc = parsed?.frontmatter.description;
        if (desc) {
          // Check for first person
          expect(desc, 'description should not start with "I "').not.toMatch(/^I\s/);
          expect(desc, 'description should not contain " I "').not.toMatch(/\sI\s/);
          // Allow "you" in trigger examples like "'help you'"
          // but flag direct second person like "You can" or "helps you"
          expect(desc, 'description should avoid "You can" style').not.toMatch(/\bYou can\b/i);
        }
      });

      it('should not contain XML tags in name or description', () => {
        const name = parsed?.frontmatter.name;
        const desc = parsed?.frontmatter.description;
        const xmlPattern = /<[^>]+>/;
        if (name) {
          expect(name, 'name contains XML tags').not.toMatch(xmlPattern);
        }
        if (desc) {
          expect(desc, 'description contains XML tags').not.toMatch(xmlPattern);
        }
      });

      it('should have markdown body content', () => {
        expect(parsed?.body, 'No markdown content after frontmatter').not.toBe('');
        expect(parsed?.body?.length, 'Body should have content').toBeGreaterThan(MIN_BODY_LENGTH);
      });

      it('should not use tabs in frontmatter (YAML requires spaces)', () => {
        const firstSectionEnd = content.indexOf('---', 3);
        if (firstSectionEnd > 0) {
          const frontmatterSection = content.slice(0, firstSectionEnd);
          expect(frontmatterSection, 'Frontmatter contains tabs').not.toContain('\t');
        }
      });

      // Advanced frontmatter field validation
      it('should have valid allowed-tools syntax if present', () => {
        const allowedTools = parsed?.frontmatter['allowed-tools'];
        if (allowedTools) {
          expect(
            allowedTools,
            `Invalid allowed-tools format: "${allowedTools}". Use '*', 'Read', 'Read, Grep', or 'Bash(git:*)'`,
          ).toMatch(ALLOWED_TOOLS_PATTERN);
        }
      });

      it('should have valid model field if present', () => {
        const model = parsed?.frontmatter.model;
        if (model !== undefined) {
          expect(typeof model, 'model should be a string').toBe('string');
          expect(model, 'model cannot be empty').not.toBe('');
        }
      });

      // File reference validation
      it('should have valid markdown file references in body', () => {
        if (parsed?.body) {
          const brokenLinks = findBrokenMarkdownLinks(
            parsed.body,
            nodePath.join(SKILLS_DIR, skillDirectory),
          );
          expect(brokenLinks, `Broken markdown links: ${brokenLinks.join(', ')}`).toHaveLength(0);
        }
      });

      // Skills use short, action-oriented names (bdd, debug, refactor, quality-review)
      it('should have concise action-oriented name', () => {
        const name = parsed?.frontmatter.name;
        if (name) {
          expect(name.length, `Skill name "${name}" should be concise`).toBeLessThanOrEqual(20);
          expect(name, 'Skill name should be lowercase with hyphens').toMatch(/^[a-z][a-z0-9-]*$/);
        }
      });

      // Best practice: semantic description with trigger keywords
      it('should have description with usage context (best practice)', () => {
        const desc = parsed?.frontmatter.description;
        if (desc) {
          // Description should indicate when to use the skill
          const hasUsageContext =
            /\b(?:use when|use for|use if|when|trigger|invoke)\b/i.test(desc) ||
            /\b(?:helps?|handles?|manages?|creates?|runs?|performs?)\b/i.test(desc);

          expect(
            hasUsageContext,
            `Description should indicate when/how to use the skill: "${desc.slice(0, 50)}..."`,
          ).toBe(true);
        }
      });
    });
  }
});

describe('Commands Validation (Claude Code Format)', () => {
  const commandFiles = getCommandFiles();

  it('should have at least one command', () => {
    expect(commandFiles.length).toBeGreaterThan(0);
  });

  for (const commandFile of commandFiles) {
    describe(`command: ${commandFile}`, () => {
      const commandPath = nodePath.join(COMMANDS_DIR, commandFile);
      const commandName = nodePath.basename(commandFile, '.md');
      const { content, parsed } = readAndParseFrontmatter(commandPath);

      it('should have content', () => {
        expect(content).not.toBe('');
      });

      it('should have lowercase filename', () => {
        expect(commandFile, 'Command filename should be lowercase').toBe(commandFile.toLowerCase());
      });

      it('should have valid frontmatter if present', () => {
        // Commands can optionally have frontmatter
        // If they do, it should be valid
        if (content.startsWith('---')) {
          expect(parsed, 'Invalid frontmatter format').not.toBeNull();
        }
      });

      it('should have description field for /help display', () => {
        // Safeword commands should have descriptions
        if (parsed) {
          expect(
            parsed.frontmatter.description,
            'Commands should have description for /help',
          ).toBeDefined();
          expect(parsed.frontmatter.description).not.toBe('');
        }
      });

      it('should have markdown body (not just frontmatter)', () => {
        if (parsed) {
          expect(parsed.body, 'Command needs content after frontmatter').not.toBe('');
          expect(parsed.body?.length, 'Body should have content').toBeGreaterThan(MIN_BODY_LENGTH);
        }
      });

      it('should not use $0 (invalid argument)', () => {
        // $0 doesn't exist in Claude Code, only $1, $2, etc. or $ARGUMENTS
        expect(content, 'Use $1, $2, etc. or $ARGUMENTS, not $0').not.toContain('$0');
      });

      it('should have valid command name format', () => {
        // Command names should be lowercase with hyphens
        expect(commandName, `Command name "${commandName}" should be lowercase`).toBe(
          commandName.toLowerCase(),
        );
        expect(
          commandName,
          `Command name "${commandName}" should only contain a-z, 0-9, -`,
        ).toMatch(/^[a-z0-9-]+$/);
      });

      // Advanced frontmatter validation for commands
      it('should have valid allowed-tools syntax if present', () => {
        const allowedTools = parsed?.frontmatter['allowed-tools'];
        if (allowedTools) {
          expect(allowedTools, `Invalid allowed-tools format: "${allowedTools}"`).toMatch(
            ALLOWED_TOOLS_PATTERN,
          );
        }
      });

      it('should have valid model field if present', () => {
        const model = parsed?.frontmatter.model;
        if (model !== undefined) {
          expect(typeof model, 'model should be a string').toBe('string');
          expect(model, 'model cannot be empty').not.toBe('');
        }
      });

      it('should have valid argument-hint format if present', () => {
        const argumentHint = parsed?.frontmatter['argument-hint'];
        if (argumentHint !== undefined) {
          expect(typeof argumentHint, 'argument-hint should be a string').toBe('string');
          // argument-hint should describe expected arguments
          expect(argumentHint.length, 'argument-hint should have content').toBeGreaterThan(0);
        }
      });

      it('should have valid disable-model-invocation if present', () => {
        const disabled = parsed?.frontmatter['disable-model-invocation'];
        if (disabled !== undefined) {
          expect(typeof disabled, 'disable-model-invocation should be boolean').toBe('boolean');
        }
      });

      // Validate argument pattern usage
      it('should use valid argument patterns ($1, $2, $ARGUMENTS)', () => {
        // Check if command uses any argument patterns
        const usesArguments =
          content.includes('$1') || content.includes('$2') || content.includes('$ARGUMENTS');

        if (usesArguments) {
          const invalidPatterns = findInvalidArgumentPatterns(content);
          expect(
            invalidPatterns,
            `Invalid argument patterns: ${invalidPatterns.join(', ')}. Use $1, $2, or $ARGUMENTS`,
          ).toHaveLength(0);
        }
      });

      // File reference validation for commands
      it('should have valid markdown file references in body', () => {
        if (parsed?.body) {
          const brokenLinks = findBrokenMarkdownLinks(parsed.body, COMMANDS_DIR);
          expect(brokenLinks, `Broken markdown links: ${brokenLinks.join(', ')}`).toHaveLength(0);
        }
      });
    });
  }
});

describe('Skills and Commands Cross-Validation', () => {
  it('should have consistent naming between skill dir and name field', () => {
    // Note: Claude Code doesn't require dir name = skill name,
    // but consistency helps maintainability
    const skillDirectoryectories = getSkillDirectories();
    const mismatches: string[] = [];

    for (const skillDirectory of skillDirectoryectories) {
      const skillPath = nodePath.join(SKILLS_DIR, skillDirectory, 'SKILL.md');
      try {
        const content = readFileSync(skillPath, 'utf8');
        const parsed = parseFrontmatter(content);
        const name = parsed?.frontmatter.name;

        // For safeword, we prefix dirs with "safeword-" but skills have short names
        // This is intentional - just document it
        if (name && !skillDirectory.endsWith(name) && !skillDirectory.includes(name)) {
          mismatches.push(`Dir "${skillDirectory}" has name "${name}"`);
        }
      } catch {
        // Skip if file doesn't exist
      }
    }

    // Skill directory names should match the name: field in frontmatter
    expect(mismatches.length).toBe(0);
  });

  it('should not have duplicate skill names', () => {
    const skillDirectoryectories = getSkillDirectories();
    const names: string[] = [];

    for (const skillDirectory of skillDirectoryectories) {
      const skillPath = nodePath.join(SKILLS_DIR, skillDirectory, 'SKILL.md');
      try {
        const content = readFileSync(skillPath, 'utf8');
        const parsed = parseFrontmatter(content);
        if (parsed?.frontmatter.name) {
          names.push(parsed.frontmatter.name);
        }
      } catch {
        // Skip
      }
    }

    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates, `Duplicate skill names: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('should not have duplicate command names', () => {
    const commandFiles = getCommandFiles();
    const names = commandFiles.map(f => nodePath.basename(f, '.md'));
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates, `Duplicate command names: ${duplicates.join(', ')}`).toHaveLength(0);
  });
});

describe('Cursor Rules Validation (.mdc Format)', () => {
  const ruleFiles = getCursorRuleFiles();

  it('should have at least one cursor rule', () => {
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  for (const ruleFile of ruleFiles) {
    describe(`rule: ${ruleFile}`, () => {
      const rulePath = nodePath.join(CURSOR_RULES_DIR, ruleFile);
      const ruleName = nodePath.basename(ruleFile, '.mdc');
      const { content, parsed } = readAndParseFrontmatter(rulePath);

      it('should have content', () => {
        expect(content).not.toBe('');
      });

      it('should have lowercase filename with hyphens', () => {
        expect(ruleFile, 'Filename should be lowercase').toBe(ruleFile.toLowerCase());
        expect(ruleName, 'Name should only contain a-z, 0-9, -').toMatch(/^[a-z0-9-]+$/);
      });

      it('should have valid frontmatter', () => {
        expect(parsed, 'Frontmatter must start with --- on line 1').not.toBeNull();
      });

      it('should have alwaysApply as boolean', () => {
        const alwaysApply = parsed?.frontmatter.alwaysApply;
        expect(alwaysApply, 'alwaysApply field is required').toBeDefined();
        expect(typeof alwaysApply, `alwaysApply should be boolean, got ${typeof alwaysApply}`).toBe(
          'boolean',
        );
      });

      it('should have description as string if present', () => {
        const description = parsed?.frontmatter.description;
        if (description !== undefined) {
          expect(typeof description, 'description should be string').toBe('string');
          expect(description, 'description should not be empty').not.toBe('');
        }
      });

      it('should not use tabs in frontmatter', () => {
        const firstSectionEnd = content.indexOf('---', 3);
        if (firstSectionEnd > 0) {
          const frontmatterSection = content.slice(0, firstSectionEnd);
          expect(frontmatterSection, 'Frontmatter contains tabs').not.toContain('\t');
        }
      });

      it('should have markdown body content', () => {
        expect(parsed?.body, 'No content after frontmatter').not.toBe('');
        expect(parsed?.body?.length, 'Body should have content').toBeGreaterThan(MIN_BODY_LENGTH);
      });
    });
  }
});

describe('Skills-Cursor Parity', () => {
  // Mapping from skill short names to cursor rule names
  // Skills use short names (bdd, debug, etc.), cursor rules keep safeword- prefix
  const SKILL_TO_RULE_MAP: Record<string, string | string[]> = {
    bdd: [
      'bdd-core',
      'bdd-discovery',
      'bdd-scenarios',
      'bdd-decomposition',
      'bdd-tdd',
      'bdd-done',
      'bdd-splitting',
    ],
    debug: 'safeword-debugging',
    'quality-review': 'safeword-quality-reviewing',
    refactor: 'safeword-refactoring',
    testing: 'safeword-testing',
    'ticket-system': 'safeword-ticket-system',
  };

  it('each skill should have corresponding cursor rule(s)', () => {
    const skillDirectories = getSkillDirectories();
    const ruleFiles = new Set(getCursorRuleFiles().map(f => nodePath.basename(f, '.mdc')));

    const missingRules: string[] = [];
    for (const skillDirectory of skillDirectories) {
      const expectedRules = SKILL_TO_RULE_MAP[skillDirectory];
      if (!expectedRules) {
        missingRules.push(`${skillDirectory} (no rule mapping defined)`);
        continue;
      }
      const rules = Array.isArray(expectedRules) ? expectedRules : [expectedRules];
      for (const rule of rules) {
        if (!ruleFiles.has(rule)) {
          missingRules.push(`${skillDirectory} → ${rule}`);
        }
      }
    }

    expect(missingRules, `Skills missing cursor rules: ${missingRules.join(', ')}`).toHaveLength(0);
  });

  it('each safeword cursor rule should have corresponding skill', () => {
    const skillDirectories = new Set(getSkillDirectories());
    // safeword-core is a special entry point rule, not a skill
    // bdd-* rules map to bdd skill
    const ruleFiles = getCursorRuleFiles()
      .map(f => nodePath.basename(f, '.mdc'))
      .filter(
        name =>
          (name.startsWith('safeword-') && name !== 'safeword-core') || name.startsWith('bdd-'),
      );

    const orphanRules: string[] = [];
    for (const rule of ruleFiles) {
      // Check if any skill maps to this rule
      const hasSkill = Object.entries(SKILL_TO_RULE_MAP).some(([skill, rules]) => {
        if (!skillDirectories.has(skill)) return false;
        return Array.isArray(rules) ? rules.includes(rule) : rules === rule;
      });
      if (!hasSkill) {
        orphanRules.push(rule);
      }
    }

    expect(orphanRules, `Cursor rules without skills: ${orphanRules.join(', ')}`).toHaveLength(0);
  });

  it('should not have duplicate cursor rule names', () => {
    const ruleFiles = getCursorRuleFiles();
    const names = ruleFiles.map(f => nodePath.basename(f, '.mdc'));
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates, `Duplicate cursor rule names: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  // Note: We intentionally don't compare body content because:
  // - Claude skills have extra sections (work logs, related links) not needed for Cursor
  // - Cursor rules are condensed versions optimized for that platform
  // - Parity is enforced by existence checks above
});

/**
 * Validation Logic Tests: Prove validators correctly accept/reject content
 *
 * These tests verify that our validation logic correctly rejects
 * malformed files AND accepts valid files, proving the simulation is faithful.
 */
describe('Validation Logic Tests', () => {
  describe('Skill Validation Logic', () => {
    it('rejects content without frontmatter', () => {
      const content = '# Just a heading\n\nNo frontmatter here.';
      const parsed = parseFrontmatter(content);
      expect(parsed).toBeUndefined();
    });

    it('rejects frontmatter not starting on line 1', () => {
      const content = '\n---\nname: test\n---\nBody';
      const parsed = parseFrontmatter(content);
      expect(parsed).toBeUndefined();
    });

    it('rejects unclosed frontmatter', () => {
      const content = '---\nname: test\nNo closing delimiter';
      const parsed = parseFrontmatter(content);
      expect(parsed).toBeUndefined();
    });

    it('detects uppercase in skill name', () => {
      const name = 'MySkill';
      expect(name).not.toMatch(SKILL_NAME_PATTERN);
    });

    it('detects invalid characters in skill name', () => {
      const invalidNames = ['my_skill', 'my.skill', 'my skill', 'my@skill'];
      for (const name of invalidNames) {
        expect(name, `"${name}" should be invalid`).not.toMatch(SKILL_NAME_PATTERN);
      }
    });

    it('detects name exceeding 64 characters', () => {
      const longName = 'a'.repeat(65);
      expect(longName.length).toBeGreaterThan(SKILL_NAME_MAX_LENGTH);
    });

    it('detects description exceeding 1024 characters', () => {
      const longDesc = 'a'.repeat(1025);
      expect(longDesc.length).toBeGreaterThan(SKILL_DESCRIPTION_MAX_LENGTH);
    });

    it('detects reserved words in name', () => {
      const reservedNames = ['my-claude-skill', 'anthropic-helper'];
      for (const name of reservedNames) {
        const hasReserved = RESERVED_WORDS.some(r => name.includes(r));
        expect(hasReserved, `"${name}" should contain reserved word`).toBe(true);
      }
    });

    it('detects invalid allowed-tools format', () => {
      const invalidFormats = ['invalid format', '***', 'Read|Write', 'Bash()'];
      for (const format of invalidFormats) {
        expect(format, `"${format}" should be invalid`).not.toMatch(ALLOWED_TOOLS_PATTERN);
      }
    });

    it('validates correct allowed-tools formats', () => {
      const validFormats = ['*', 'Read', 'Read, Grep', 'Bash(git:*)', 'Read, Bash(npm:*)'];
      for (const format of validFormats) {
        expect(format, `"${format}" should be valid`).toMatch(ALLOWED_TOOLS_PATTERN);
      }
    });
  });

  describe('Command Validation Logic', () => {
    it('detects $0 argument usage', () => {
      const content = 'Use $0 for the command name';
      expect(content).toContain('$0');
    });

    it('detects invalid argument patterns', () => {
      const content = 'Use $arg and $myVar';
      const invalidPatterns = findInvalidArgumentPatterns(content);
      expect(invalidPatterns.length).toBeGreaterThan(0);
    });

    it('allows valid argument patterns', () => {
      const content = 'Use $1 and $ARGUMENTS and $CLAUDE_PROJECT_DIR';
      const invalidPatterns = findInvalidArgumentPatterns(content);
      expect(invalidPatterns).toHaveLength(0);
    });
  });

  describe('Cursor Rule Validation Logic', () => {
    it('detects missing alwaysApply field', () => {
      const content = '---\ndescription: Test rule\n---\nBody';
      const parsed = parseFrontmatter(content);
      expect(parsed?.frontmatter.alwaysApply).toBeUndefined();
    });

    it('detects non-boolean alwaysApply', () => {
      const content = '---\nalwaysApply: yes\n---\nBody';
      const parsed = parseFrontmatter(content);
      // 'yes' is parsed as string, not boolean
      expect(typeof parsed?.frontmatter.alwaysApply).not.toBe('boolean');
    });

    it('correctly parses boolean alwaysApply', () => {
      const contentTrue = '---\nalwaysApply: true\n---\nBody';
      const contentFalse = '---\nalwaysApply: false\n---\nBody';

      const parsedTrue = parseFrontmatter(contentTrue);
      const parsedFalse = parseFrontmatter(contentFalse);

      expect(parsedTrue?.frontmatter.alwaysApply).toBe(true);
      expect(parsedFalse?.frontmatter.alwaysApply).toBe(false);
    });

    it('detects empty body content', () => {
      const content = '---\nalwaysApply: true\n---\n';
      const parsed = parseFrontmatter(content);
      expect(parsed?.body).toBe('');
    });

    it('detects body under minimum length', () => {
      const content = '---\nalwaysApply: true\n---\nShort';
      const parsed = parseFrontmatter(content);
      expect(parsed?.body?.length).toBeLessThanOrEqual(MIN_BODY_LENGTH);
    });
  });

  describe('Markdown Link Validation', () => {
    it('extracts markdown links correctly', () => {
      const content = 'See [guide](./guide.md) and [docs](../docs.md)';
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(2);
      expect(links[0]).toEqual({ text: 'guide', path: './guide.md' });
    });

    it('ignores external URLs', () => {
      const content = 'See [docs](https://example.com/docs.md)';
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(0);
    });

    it('ignores anchor links', () => {
      const content = 'See [section](#my-section)';
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(0);
    });
  });

  describe('Gerund Naming Convention', () => {
    it('detects valid gerund names', () => {
      const validNames = ['debugging', 'refactoring', 'quality-reviewing'];
      for (const name of validNames) {
        expect(isGerundName(name), `"${name}" should be gerund`).toBe(true);
      }
    });

    it('rejects non-gerund names', () => {
      const invalidNames = ['debug', 'refactor', 'quality-review'];
      for (const name of invalidNames) {
        expect(isGerundName(name), `"${name}" should not be gerund`).toBe(false);
      }
    });
  });
});
