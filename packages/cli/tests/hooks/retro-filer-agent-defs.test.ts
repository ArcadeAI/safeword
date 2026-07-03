/**
 * Syntactic pin for the shipped safeword-retro-filer agent definitions (GH628F,
 * quality-review follow-up): the TOML and markdown templates are the only
 * shipped artifacts a harness parses directly — a stray escape inside the TOML
 * multi-line string would install cleanly and silently break the Codex filer.
 * Parses both templates and asserts the harness-required fields.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { FILER_AGENT_NAME } from '../../templates/hooks/lib/retro-filing-gate.js';

const AGENTS_DIR = nodePath.resolve(import.meta.dirname, '../../templates/agents');

describe('safeword-retro-filer agent definitions (GH628F — shipped artifacts parse)', () => {
  it('the Codex TOML parses and carries the three required fields with the gate-matching name', () => {
    // Vitest runs under node (no Bun.TOML); parse with bun the same way the
    // integration suites spawn the bun-run hooks.
    const result = spawnSync(
      'bun',
      [
        '-e',
        `const p = Bun.TOML.parse(await Bun.file(${JSON.stringify(
          nodePath.join(AGENTS_DIR, 'safeword-retro-filer.toml'),
        )}).text()); console.log(JSON.stringify(p));`,
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.name).toBe(FILER_AGENT_NAME);
    expect(typeof parsed.description).toBe('string');
    expect((parsed.description as string).length).toBeGreaterThan(0);
    expect(typeof parsed.developer_instructions).toBe('string');
    expect(parsed.developer_instructions as string).toContain('ArcadeAI/safeword');
  });

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
  const tomlText = readFileSync(nodePath.join(AGENTS_DIR, 'safeword-retro-filer.toml'), 'utf8');
  const mdText = readFileSync(nodePath.join(AGENTS_DIR, 'safeword-retro-filer.md'), 'utf8');
  const guideText = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../templates/guides/self-report-filing.md'),
    'utf8',
  );

  it.each([
    ['markdown (Claude/Cursor)', mdText],
    ['TOML (Codex)', tomlText],
  ])('the %s filer definition instructs ack-after-post-before-drain', (_label, text) => {
    expect(text).toContain('.acks.jsonl');
    expect(text.toLowerCase()).toMatch(/after each successful post/);
    expect(text.toLowerCase()).toMatch(/before (draining|you drain)/);
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
