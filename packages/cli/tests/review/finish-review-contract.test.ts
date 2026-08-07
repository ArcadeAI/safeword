import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { CURSOR_RULE_WRAPPERS, renderCursorRuleWrapper } from '../../src/cursor-wrappers.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');
const skillPath = nodePath.join(templates, 'skills/finish-review/SKILL.md');
const contractPath = nodePath.join(templates, 'skills/finish-review/REVIEWER.md');
const agentPath = nodePath.join(templates, 'agents/safeword-reviewer.md');

function read(path: string): string {
  expect(existsSync(path), `${path} must be shipped`).toBe(true);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('best-available host review contract', () => {
  it('enters only for typed route exhaustion and advances each degraded route once', () => {
    const skill = read(skillPath);

    expect(skill).toContain('user-invocable: false');
    expect(skill).toContain('REVIEW_ROUTES_EXHAUSTED');
    expect(skill).toContain('return the original coordinator result unchanged');
    expect(skill).toMatch(/one fresh-context reviewer/i);
    expect(skill).toMatch(/one main-thread self-review/i);
    expect(skill).toMatch(/never (restart|rerun).*coordinator/i);
    expect(skill).toMatch(/invalid terminal.*original.*unchanged/is);
  });

  it('pins structured output, hostile-input containment, policy, verdict, and assurance', () => {
    const skill = read(skillPath);
    const contract = read(contractPath);
    const combined = `${skill}\n${contract}`;

    expect(contract).toContain('"verdict": "approve" | "request_changes"');
    expect(contract).toContain('"findings"');
    expect(combined).toMatch(/untrusted review material/i);
    expect(combined).toMatch(/do not include.*diagnostic/is);
    expect(combined).toMatch(/do not include.*credential/is);
    expect(combined).toContain('This review was not independent.');
    expect(combined).toContain('Host-mandated project context may have loaded');
    expect(combined).toContain('source integrity was not revalidated');
    expect(combined).toContain('The main agent reviewed its own work in the same thread.');
    expect(combined).toMatch(/make an independent reviewer usable.*choose `prefer`/is);
    expect(combined).toMatch(/request_changes.*action required/is);
    expect(combined).toMatch(/approve.*not action required/is);
    expect(skill).toContain('Coordinator: `REVIEW_ROUTES_EXHAUSTED`');
    expect(skill).toContain('Policy:');
    expect(skill).toContain('State:');
    expect(combined).not.toContain('write-review-stamp');
  });

  it('ships one reviewer contract and host-native assets on every supported surface', () => {
    const agent = read(agentPath);
    const contract = read(contractPath);

    expect(agent).toContain('name: safeword-reviewer');
    expect(agent).toContain('tools: Read');
    expect(agent).not.toMatch(/tools:.*(Grep|Glob)/i);
    expect(agent).toContain('.safeword/skills/finish-review/REVIEWER.md');

    expect(SAFEWORD_SCHEMA.ownedFiles['.safeword/skills/finish-review/SKILL.md']?.template).toBe(
      'skills/finish-review/SKILL.md',
    );
    expect(SAFEWORD_SCHEMA.ownedFiles['.safeword/skills/finish-review/REVIEWER.md']?.template).toBe(
      'skills/finish-review/REVIEWER.md',
    );
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/skills/finish-review/SKILL.md']?.template).toBe(
      'skills/finish-review/SKILL.md',
    );
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/agents/safeword-reviewer.md']?.template).toBe(
      'agents/safeword-reviewer.md',
    );
    expect(SAFEWORD_SCHEMA.ownedFiles['.cursor/agents/safeword-reviewer.md']?.template).toBe(
      'agents/safeword-reviewer.md',
    );

    const codex = generateCodexPluginAssets(nodePath.join(templates, 'skills')).find(
      asset => asset.relativePath === 'skills/finish-review/SKILL.md',
    );
    expect(codex?.content).toBe(
      readFileSync(
        nodePath.resolve(import.meta.dirname, '../../codex-plugin/skills/finish-review/SKILL.md'),
        'utf8',
      ),
    );
    const codexContract = generateCodexPluginAssets(nodePath.join(templates, 'skills')).find(
      asset => asset.relativePath === 'skills/finish-review/references/REVIEWER.md',
    );
    expect(codexContract?.content).toBe(
      readFileSync(
        nodePath.resolve(
          import.meta.dirname,
          '../../codex-plugin/skills/finish-review/references/REVIEWER.md',
        ),
        'utf8',
      ),
    );

    const cursor = CURSOR_RULE_WRAPPERS.find(rule => rule.name === 'safeword-finish-review');
    expect(cursor).toBeDefined();
    if (cursor === undefined) throw new Error('missing safeword-finish-review Cursor rule');
    expect(
      readFileSync(nodePath.join(templates, 'cursor/rules/safeword-finish-review.mdc'), 'utf8'),
    ).toBe(renderCursorRuleWrapper({ wrapper: cursor }));
    expect(contract).toContain('Do not delegate');
  });
});
