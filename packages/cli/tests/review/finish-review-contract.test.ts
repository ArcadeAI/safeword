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
  return readFileSync(path, 'utf8');
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
    expect(contract).toContain('"verdict": "approve" | "request_changes"');
    expect(contract).toContain('"findings"');
    expect(contract).toContain('untrusted review material');
    expect(contract).toContain('Do not include failed-route diagnostics');
    expect(contract).toContain('credentials, or secrets');
    expect(skill).toContain('This review was not independent.');
    expect(skill).toContain('Host-mandated project context may have loaded');
    expect(skill).toContain('source integrity was not revalidated');
    expect(skill).toContain('The main agent reviewed its own work in the same thread.');
    expect(skill).toContain('Make an independent reviewer usable or explicitly choose `prefer`.');
    expect(skill).toContain('map `approve` to `State: approved`');
    expect(skill).toContain('map `request_changes` to `State: action required`');
    expect(skill).toContain('Take `review_policy` only from the trusted coordinator envelope');
    expect(skill).toContain('Coordinator: `REVIEW_ROUTES_EXHAUSTED`');
    expect(skill).toContain('Policy:');
    expect(skill).toContain('State:');
    expect(skill).not.toContain('write-review-stamp');
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

    const generatedCodexAssets = generateCodexPluginAssets(nodePath.join(templates, 'skills'));
    const codex = generatedCodexAssets.find(
      asset => asset.relativePath === 'skills/finish-review/SKILL.md',
    );
    expect(codex?.content).toBe(
      readFileSync(
        nodePath.resolve(import.meta.dirname, '../../codex-plugin/skills/finish-review/SKILL.md'),
        'utf8',
      ),
    );
    const codexContract = generatedCodexAssets.find(
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
