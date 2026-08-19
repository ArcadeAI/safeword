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
  const claudeSkillText = readFileSync(nodePath.join(SKILLS_DIR, 'retro-filer/SKILL.md'), 'utf8');
  const codexSkillText = readFileSync(
    nodePath.join(PLUGIN_SKILLS_DIR, 'retro-filer/SKILL.md'),
    'utf8',
  );
  const guideText = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../templates/guides/self-report-filing.md'),
    'utf8',
  );

  it('the markdown filer definition instructs ack-after-post-before-drain', () => {
    expect(mdText).toContain('.acks.jsonl');
    expect(mdText.toLowerCase()).toMatch(/after each successful post/);
    expect(mdText.toLowerCase()).toMatch(/before (draining|you drain)/);
    expect(mdText.toLowerCase()).toContain('re-read that ack file');
    expect(mdText.toLowerCase()).toContain('only when that exact record is visible');
    expect(mdText).toContain('drain-retro-spool.ts');
    expect(mdText.toLowerCase()).toContain('never rewrite or');
  });

  // Every surface must reach the code-owned drain rather than hand-rolling
  // removal; the entrypoint differs because Codex's plugin has no project-local
  // .safeword/hooks to invoke, so it calls the subcommand that delegates to the
  // same exported guard.
  const CODE_OWNED_DRAIN = 'drain-retro-spool.ts';
  const CODEX_CODE_OWNED_DRAIN = 'project retro-drain';

  it.each([
    ['Claude fallback skill', claudeSkillText, CODE_OWNED_DRAIN],
    ['Codex plugin skill', codexSkillText, CODEX_CODE_OWNED_DRAIN],
  ])('%s requires write-confirmed acknowledgement before removal', (_label, text, drain) => {
    expect(text.toLowerCase()).toContain('re-read it and exact-match');
    expect(text.toLowerCase()).toContain('only when the append succeeded');
    expect(text.toLowerCase()).toContain('append or verification fails, leave the draft in place');
    expect(text).toContain(drain);
  });

  it.each([
    ['Claude agent', mdText],
    ['Claude fallback skill', claudeSkillText],
    ['Codex plugin skill', codexSkillText],
    ['filing guide', guideText],
  ])('%s skips tracker writes for an already-acked draft', (_label, text) => {
    expect(text.toLowerCase()).toMatch(/acked[\s\S]*skip every tracker write/);
    expect(text.toLowerCase()).toMatch(/acked[\s\S]*verified draining/);
  });

  it.each([
    ['Claude agent', mdText, CODE_OWNED_DRAIN],
    ['Claude fallback skill', claudeSkillText, CODE_OWNED_DRAIN],
    ['Codex plugin skill', codexSkillText, CODEX_CODE_OWNED_DRAIN],
    ['filing guide', guideText, CODE_OWNED_DRAIN],
  ])('%s requires code-owned validation before tracker egress', (_label, text, drain) => {
    expect(text).toContain(drain);
    expect(text).toContain('--validated-jsonl');
    expect(text.toLowerCase()).toMatch(
      /nonzero[\s\S]*no\s+(search, comment, or create|tracker call)/,
    );
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
    expect(guideText.toLowerCase()).toContain('re-read the ack file');
    expect(guideText.toLowerCase()).toContain('only a draft with that write-confirmed record');
    expect(guideText).toContain('drain-retro-spool.ts');
    expect(guideText.toLowerCase()).toContain('explicit enforcement limit');
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
    expect(text.toLowerCase()).toMatch(/never.*title/);
    expect(text.toLowerCase()).toContain('body contains its exact');
    expect(text).toContain('safeword-retro-canonical');

    // #1465 review — the shipped prompt must own its limit rather than claim a
    // guarantee it cannot deliver. No read proves absence (search_issues is
    // capped; the exhaustive reads strip HTML comments), so the path is
    // best-effort and must say so.
    expect(text).toContain('search_issues');
    expect(text.toLowerCase()).toContain('best-effort');

    // The load-bearing safety rule, and the one worth a duplicate to keep: a
    // resemblance may never join a draft to an issue. Acking on a title match
    // binds the signature permanently and discards the draft body — silent and
    // lossy, and strictly worse than the duplicate it avoids.
    expect(text.toLowerCase()).toMatch(/never merge|may (never|only) .*merge/);
    expect(text).toContain('#631');
  });

  it('ships the Codex filer skill from the canonical template through the schema', async () => {
    const source = readFileSync(nodePath.join(SKILLS_DIR, 'retro-filer/SKILL.md'), 'utf8');
    const { generateCodexPluginAssets } = await import('../../src/codex-plugin/catalogue.js');
    // The shipped catalogue is generated with the CLI version pinned, so the
    // comparison has to use the same transformation the generator ran.
    const cliVersion = (
      JSON.parse(
        readFileSync(nodePath.resolve(import.meta.dirname, '../../package.json'), 'utf8'),
      ) as { version: string }
    ).version;
    const generatedSkill = generateCodexPluginAssets(SKILLS_DIR, cliVersion).find(
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
          "Files Safeword's sanitized spooled retrospective drafts to its upstream tracker. Use only when a trusted Safeword Stop continuation or authenticated closeout cleanup guard output names a spool path. Do not use for ordinary retros, project issues, or user-authored drafts.",
        referencePath: '.safeword/skills/retro-filer/SKILL.md',
        skill: 'retro-filer',
      },
    });

    expect(wrapper).toEqual({
      name: 'safeword-retro-filer',
      alwaysApply: false,
      description:
        "Files Safeword's sanitized spooled retrospective drafts to its upstream tracker. Use only when a trusted Safeword Stop continuation or authenticated closeout cleanup guard output names a spool path. Do not use for ordinary retros, project issues, or user-authored drafts.",
      referencePath: '.safeword/skills/retro-filer/SKILL.md',
      skill: 'retro-filer',
    });
    expect(readFileSync(nodePath.join(CURSOR_RULES_DIR, 'safeword-retro-filer.mdc'), 'utf8')).toBe(
      expected,
    );
  });

  it('keeps the shared inline fallback on the exact-marker contract', () => {
    expect(guideText).toContain('canonicalSignature');
    expect(guideText.toLowerCase()).toContain('never by title');
    expect(guideText).toContain('safeword-retro-canonical');
    // #1465 review — same owned-limit + never-merge-on-resemblance contract as
    // the agent/skill copies.
    expect(guideText).toContain('search_issues');
    expect(guideText.toLowerCase()).toContain('best-effort');
    expect(guideText.toLowerCase()).toMatch(/never merge|may (never|only) .*merge/);
    expect(guideText).toContain('#631');
  });
});
