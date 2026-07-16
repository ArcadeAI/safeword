import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

function read(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

describe('persona-code authoring policy', () => {
  it('separates automatic, explicit, and legacy code bounds in the persona scaffold', () => {
    const template = read('packages/cli/templates/personas-template.md');

    expect(template).toMatch(/automatic codes.*3[–-]4 letters/i);
    expect(template).toMatch(/explicit codes.*2[–-]4 letters/i);
    expect(template).toContain('## Platform Operator (PO)');
    expect(template).toContain('"Platform Operator" → PLO');
    expect(template).toMatch(/legacy.*5[–-]6/i);
  });

  it.each([
    'packages/cli/templates/skills/bdd/DISCOVERY.md',
    'packages/cli/codex-plugin/skills/bdd/references/DISCOVERY.md',
    '.claude/skills/bdd/DISCOVERY.md',
  ])('%s carries the canonical persona code unchanged into JTBDs', relativePath => {
    const guidance = read(relativePath);

    expect(guidance).toContain('Platform Operator (PLO)');
    expect(guidance).toContain('**Persona:** Platform Operator (PLO)');
  });

  it.each([
    'packages/cli/templates/skills/bdd/SCENARIOS.md',
    'packages/cli/codex-plugin/skills/bdd/references/SCENARIOS.md',
    '.claude/skills/bdd/SCENARIOS.md',
  ])('%s carries the canonical persona code unchanged into Gherkin lineage', relativePath => {
    const guidance = read(relativePath);

    expect(guidance).toContain('persona Platform Operator (PLO)');
    expect(guidance).toMatch(/oauth-flow\.PLO1/);
  });

  it.each(['packages/cli/templates/spec-template.md', '.safeword/templates/spec-template.md'])(
    '%s uses canonical persona codes in new JTBD examples',
    relativePath => {
      const template = read(relativePath);
      expect(template).toContain('Platform Operator (PLO)');
      expect(template).not.toContain('Platform Operator (PO)');
    },
  );
});
