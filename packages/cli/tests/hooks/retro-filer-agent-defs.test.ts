/**
 * Syntactic pin for the shipped Claude/Cursor safeword-retro-filer definition.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { FILER_AGENT_NAME } from '../../templates/hooks/lib/retro-filing-gate.js';

const AGENTS_DIR = nodePath.resolve(import.meta.dirname, '../../templates/agents');

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
