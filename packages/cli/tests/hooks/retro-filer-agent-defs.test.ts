/**
 * Syntactic pin for the shipped Claude/Cursor safeword-retro-filer definition.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { FILER_AGENT_NAME } from '../../templates/hooks/lib/retro-filing-gate.js';

const AGENTS_DIR = nodePath.resolve(import.meta.dirname, '../../templates/agents');
const SKILLS_DIR = nodePath.resolve(import.meta.dirname, '../../templates/skills');
const PLUGIN_SKILLS_DIR = nodePath.resolve(import.meta.dirname, '../../codex-plugin/skills');
const CURSOR_RULES_DIR = nodePath.resolve(import.meta.dirname, '../../templates/cursor/rules');

describe('safeword-retro-filer agent definitions (GH628F — shipped artifacts parse)', () => {
  it('the Claude/Cursor markdown frontmatter carries the gate-matching name and a description', () => {
    const text = readFileSync(nodePath.join(AGENTS_DIR, 'safeword-retro-filer.md'), 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
    expect(frontmatter, 'markdown agent definition must open with YAML frontmatter').toBeDefined();
    expect(frontmatter?.split('\n')).toContain(`name: ${FILER_AGENT_NAME}`);
    expect(frontmatter).toMatch(/^description: .+$/m);
    // The body (the agent's prompt) must name the only allowed target repo.
    expect(text).toContain('ArcadeAI/safeword');
  });
});

// GH644A SM2.AC1: shipped prompts and the guide carry the ack procedure and
// the drain prohibition — the behavioral half of the bare-drain tripwire.
describe('filer ack procedure in shipped prompts (GH644A)', () => {
  const mdText = readFileSync(nodePath.join(AGENTS_DIR, 'safeword-retro-filer.md'), 'utf8');
  const guideText = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../templates/guides/self-report-filing.md'),
    'utf8',
  );

  it('the markdown filer definition instructs ack-after-post-before-drain', () => {
    expect(mdText).toContain('.acks.jsonl');
    expect(mdText.toLowerCase()).toMatch(/after each successful post/);
    expect(mdText.toLowerCase()).toMatch(/before (draining|you drain)/);
  });

  it('the dispatch text states that only the filer drains the spool', async () => {
    const { formatFilingDispatch } = await import('../../templates/hooks/lib/retro-filing-gate.js');
    expect(formatFilingDispatch(1, '/p/s.jsonl').toLowerCase()).toContain(
      'only the safeword-retro-filer drains',
    );
  });

  it("the guide's inline-fallback section documents appending the ack record", () => {
    expect(guideText).toContain('.acks.jsonl');
    expect(guideText.toLowerCase()).toMatch(/ack record|ack line/);
  });
});

describe('canonical spool dedupe contract (#1031)', () => {
  const mdText = readFileSync(nodePath.join(AGENTS_DIR, 'safeword-retro-filer.md'), 'utf8');
  const codexText = readFileSync(nodePath.join(PLUGIN_SKILLS_DIR, 'retro-filer/SKILL.md'), 'utf8');
  const guideText = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../templates/guides/self-report-filing.md'),
    'utf8',
  );

  it.each([
    ['markdown (Claude/Cursor)', mdText],
    ['plugin skill (Codex)', codexText],
  ])('%s follows the exact legacy-first canonical contract', (_label, text) => {
    const legacy = text.indexOf('safeword-retro-signature');
    const canonical = text.indexOf('safeword-retro-canonical');
    expect(legacy).toBeGreaterThanOrEqual(0);
    expect(canonical).toBeGreaterThan(legacy);
    expect(text).toContain('canonicalSignature');
    expect(text).toContain('is:issue');
    expect(text).toContain('is:open');
    expect(text.toLowerCase()).toMatch(/never.*title/);
    expect(text.toLowerCase()).toContain('body contains its exact');
    expect(text).toContain('safeword-retro-canonical');
  });

  it('ships the Codex filer skill from the canonical template through the schema', async () => {
    const source = readFileSync(nodePath.join(SKILLS_DIR, 'retro-filer/SKILL.md'), 'utf8');
    const { generateCodexPluginAssets } = await import('../../src/codex-plugin/catalogue.js');
    const generatedSkill = generateCodexPluginAssets(SKILLS_DIR).find(
      asset => asset.relativePath === 'skills/retro-filer/SKILL.md',
    );
    expect(source).toContain('name: retro-filer');
    expect(codexText).toBe(generatedSkill?.content);

    const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/skills/retro-filer/SKILL.md']?.template).toBe(
      'skills/retro-filer/SKILL.md',
    );
  });

  it('pairs the Claude fallback skill with the generated Cursor rule', async () => {
    const { CURSOR_RULE_WRAPPERS, renderCursorRuleWrapper } =
      await import('../../src/cursor-wrappers.js');
    const wrapper = CURSOR_RULE_WRAPPERS.find(entry => entry.name === 'safeword-retro-filer');
    const expected = renderCursorRuleWrapper({
      wrapper: {
        name: 'safeword-retro-filer',
        alwaysApply: false,
        description:
          "Files Safe Word's sanitized spooled retrospective drafts to its upstream tracker. Use only when a trusted Safe Word Stop continuation names a spool path. Do not use for ordinary retros, project issues, or user-authored drafts.",
        referencePath: '.claude/skills/retro-filer/SKILL.md',
        skill: 'retro-filer',
      },
    });

    expect(wrapper).toEqual({
      name: 'safeword-retro-filer',
      alwaysApply: false,
      description:
        "Files Safe Word's sanitized spooled retrospective drafts to its upstream tracker. Use only when a trusted Safe Word Stop continuation names a spool path. Do not use for ordinary retros, project issues, or user-authored drafts.",
      referencePath: '.claude/skills/retro-filer/SKILL.md',
      skill: 'retro-filer',
    });
    expect(readFileSync(nodePath.join(CURSOR_RULES_DIR, 'safeword-retro-filer.mdc'), 'utf8')).toBe(
      expected,
    );
  });

  it('keeps the shared inline fallback on the exact-marker contract', () => {
    expect(guideText).toContain('canonicalSignature');
    expect(guideText).toContain('is:issue is:open');
    expect(guideText.toLowerCase()).toContain('never by title');
    expect(guideText).toContain('safeword-retro-canonical');
  });
});
