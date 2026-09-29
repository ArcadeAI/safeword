import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import {
  CURSOR_COMMAND_WRAPPERS,
  CURSOR_RULE_WRAPPERS,
  renderCursorCommandWrapper,
  renderCursorRuleWrapper,
} from '../../src/cursor-wrappers.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { VERSION } from '../../src/version.js';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');
const skillPath = nodePath.join(templates, 'skills/finish-review/SKILL.md');
const contractPath = nodePath.join(templates, 'skills/finish-review/REVIEWER.md');
const agentPath = nodePath.join(templates, 'agents/safeword-reviewer.md');

function read(path: string): string {
  expect(existsSync(path), `${path} must be shipped`).toBe(true);
  return readFileSync(path, 'utf8');
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

describe('job-bound host review continuation contract', () => {
  it('enters only for a sealed continuation and advances each host tier once', () => {
    const skill = read(skillPath);
    const normalizedSkill = skill.replaceAll(/\s+/gu, ' ');

    expect(skill).toContain('user-invocable: false');
    expect(skill).toContain("allowed-tools: '*'");
    expect(skill).toContain('REVIEW_CONTINUATION_REQUIRED');
    expect(skill).toContain('continuation_required');
    expect(skill).toContain('review_id');
    expect(skill).toContain('continuation.packet');
    expect(skill).toContain('review continue');
    expect(normalizedSkill).toContain('same sealed packet');
    expect(skill).toMatch(/one fresh-context reviewer/i);
    expect(skill).toMatch(/one main-thread self-review/i);
    expect(skill).toContain('host timeout');
    expect(skill).toContain('invalid reviewer output');
    expect(normalizedSkill).toMatch(/never (restart|rerun).*coordinator/i);
    expect(skill).toContain('REVIEW_ROUTES_EXHAUSTED');
  });

  it('pins structured output, hostile-input containment, policy, verdict, and assurance', () => {
    const skill = read(skillPath);
    const contract = read(contractPath);
    const normalizedSkill = skill.replaceAll(/^>\s?/gmu, '').replaceAll(/\s+/gu, ' ');
    const normalizedContract = contract.replaceAll(/\s+/gu, ' ');
    expect(contract).toContain('"schema_version": 1');
    expect(contract).toContain('"dispatch_id"');
    expect(contract).toContain('"reviewer_agent"');
    expect(contract).toContain('"verdict": "approve" | "request_changes"');
    expect(contract).toContain('"findings"');
    expect(contract).toContain('untrusted review material');
    expect(normalizedContract).toContain('Do not include failed-route diagnostics');
    expect(normalizedContract).toContain('credentials, or secrets');
    expect(contract).toContain('cannot independently prove');
    expect(contract).toContain('not a structural sandbox guarantee');
    expect(normalizedSkill).toContain('Read only the sealed packet');
    expect(normalizedSkill).toContain('actual reviewer and reduced independence');
    expect(normalizedSkill).toContain('.safeword/skills/finish-review/REVIEWER.md');
    expect(normalizedSkill).not.toContain('sibling `REVIEWER.md`');
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

    const generatedCodexAssets = generateCodexPluginAssets(
      nodePath.join(templates, 'skills'),
      VERSION,
    );
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
    const cursorCommand = required(
      CURSOR_COMMAND_WRAPPERS.find(command => command.name === 'finish-review'),
      'missing finish-review Cursor command',
    );
    expect(cursorCommand).toBeDefined();
    expect(SAFEWORD_SCHEMA.ownedFiles['.cursor/commands/finish-review.md']?.template).toBe(
      'commands/finish-review.md',
    );
    expect(read(nodePath.join(templates, 'commands/finish-review.md'))).toBe(
      renderCursorCommandWrapper({ wrapper: cursorCommand }),
    );
    expect(contract).toContain('Do not delegate');
  });
});
