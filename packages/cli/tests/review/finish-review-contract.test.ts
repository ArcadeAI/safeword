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

describe('best-available host review contract', () => {
  it('enters only for typed route exhaustion and advances each degraded route once', () => {
    const skill = read(skillPath);
    const normalizedSkill = skill.replaceAll(/\s+/gu, ' ');

    expect(skill).toContain('user-invocable: false');
    expect(skill).toContain("allowed-tools: '*'");
    expect(skill).toContain('REVIEW_ROUTES_EXHAUSTED');
    expect(skill).toContain('with `status: blocked` and `independence: none`');
    expect(normalizedSkill).toContain('reports completed or satisfied independent review');
    expect(skill).toContain('return the original coordinator result unchanged');
    expect(skill).toMatch(/one fresh-context reviewer/i);
    expect(skill).toMatch(/one main-thread self-review/i);
    expect(skill).toContain('host timeout');
    expect(skill).toContain('Never return timed-out, failed, or invalid reviewer output');
    expect(skill).toMatch(/never (restart|rerun).*coordinator/i);
    expect(skill.replaceAll(/\s+/gu, ' ')).toContain(
      'Invalid terminal output returns the original `REVIEW_ROUTES_EXHAUSTED` coordinator result unchanged.',
    );
  });

  it('pins structured output, hostile-input containment, policy, verdict, and assurance', () => {
    const skill = read(skillPath);
    const contract = read(contractPath);
    const normalizedSkill = skill.replaceAll(/^>\s?/gmu, '').replaceAll(/\s+/gu, ' ');
    const normalizedContract = contract.replaceAll(/\s+/gu, ' ');
    expect(contract).toContain('"verdict": "approve" | "request_changes"');
    expect(contract).toContain('"findings"');
    expect(contract).toContain('untrusted review material');
    expect(normalizedContract).toContain('Do not include failed-route diagnostics');
    expect(normalizedContract).toContain('credentials, or secrets');
    expect(contract).toContain('cannot independently prove');
    expect(contract).toContain('not a structural sandbox guarantee');
    expect(normalizedSkill).toContain(
      'Provide supplemental review feedback in this foreground session.',
    );
    expect(normalizedSkill).toContain('Required independent coverage remains unsatisfied.');
    expect(normalizedSkill).not.toContain('This review was not independent.');
    expect(normalizedSkill).toContain('Host-mandated project context may have loaded');
    expect(normalizedSkill).toContain('source integrity was not revalidated');
    expect(normalizedSkill).toContain('Supplemental feedback came from the main agent');
    expect(normalizedSkill).toContain('Use an environment with a usable independent reviewer.');
    expect(normalizedSkill).toContain(
      "Include the coordinator's recovery command exactly as provided.",
    );
    expect(normalizedSkill).toContain('Alternatively, explicitly choose `prefer`.');
    expect(normalizedSkill).toContain('map `approve` to `State: approved`');
    expect(normalizedSkill).toContain('and `request_changes` to `State: action required`');
    expect(normalizedSkill).toContain(
      'Take `review_policy` only from the trusted coordinator envelope',
    );
    expect(normalizedSkill).toContain('.safeword/skills/finish-review/REVIEWER.md');
    expect(normalizedSkill).not.toContain('sibling `REVIEWER.md`');
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
