import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

function readSurface(relativePath: string): string {
  return readFileSync(nodePath.join(ROOT, relativePath), 'utf8');
}

/**
 * Extract the domain-docs bash block by its sentinel marker rather than by
 * ordinal — robust to bash blocks added earlier in the skill.
 */
function extractDomainDocumentationBlock(): string {
  const content = readSurface('packages/cli/templates/skills/audit/SKILL.md');
  const block = content
    .matchAll(/```bash\n([\s\S]*?)\n```/g)
    .map(match => match[1])
    .find(body => body.includes('domain-docs-check'));
  if (!block) throw new Error('domain-docs-check bash block not found in audit SKILL.md');
  return block;
}

/**
 * Materialize a fixture project, run the extracted domain-docs block against it,
 * and return combined stdout+stderr. `bun` is NOT stubbed: the block's
 * `[ -d "$NS_ROOT" ]` fallback resolves the fixture's `.project/` even though
 * the real resolver hook is absent in the temp dir.
 */
function runDomainDocumentationCheck(files: Record<string, string>): {
  output: string;
  status: number;
} {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-domain-docs-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = nodePath.join(projectDirectory, relativePath);
      mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content);
    }
    const result = spawnSync('bash', ['-c', extractDomainDocumentationBlock()], {
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory, PATH: process.env.PATH ?? '' },
      encoding: 'utf8',
    });
    return { output: `${result.stdout ?? ''}${result.stderr ?? ''}`, status: result.status ?? 0 };
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

const SURFACES_SCAFFOLD = readSurface('packages/cli/templates/surfaces-template.md');
const GLOSSARY_SCAFFOLD = readSurface('packages/cli/templates/glossary-template.md');

const POPULATED_SURFACES = `# Surfaces\n\n## Claude Code\n\n**Kind:** Agent runtime\n**Description:** Local CLI.\n`;

describe('audit domain-documentation emptiness (W008)', () => {
  it('reports a verbatim surfaces scaffold as empty, naming its template', () => {
    const { output } = runDomainDocumentationCheck({ '.project/surfaces.md': SURFACES_SCAFFOLD });

    expect(output).toContain('[W008]');
    expect(output).toContain('surfaces.md');
    expect(output).toContain('packages/cli/templates/surfaces-template.md');
  });

  it('reports a verbatim glossary scaffold as empty, naming its template', () => {
    const { output } = runDomainDocumentationCheck({ '.project/glossary.md': GLOSSARY_SCAFFOLD });

    expect(output).toContain('[W008]');
    expect(output).toContain('glossary.md');
    expect(output).toContain('packages/cli/templates/glossary-template.md');
  });

  it('does not report a populated surfaces doc as empty', () => {
    const { output } = runDomainDocumentationCheck({ '.project/surfaces.md': POPULATED_SURFACES });

    expect(output).not.toContain('[W008]');
  });

  it('skips absent domain docs without erroring', () => {
    const { output, status } = runDomainDocumentationCheck({
      '.project/surfaces.md': POPULATED_SURFACES,
    });

    // personas.md and glossary.md are absent here — no W008 for them, no crash.
    expect(status).toBe(0);
    expect(output).not.toContain('personas.md');
    expect(output).not.toContain('glossary.md');
  });
});

const MULTIWORD_SURFACES = `# Surfaces\n\n## Claude Code on the Web\n\n**Kind:** Agent runtime\n\n## Cursor\n\n**Kind:** Agent runtime\n`;

function tagLineFeature(...tags: string[]): string {
  return `Feature: fixture\n\n  ${tags.join(' ')}\n  Scenario: one\n    Given a thing\n    When it happens\n    Then it holds\n`;
}

describe('audit domain-documentation surface drift (E008)', () => {
  it('reports a surface tag with no matching inventory entry', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/surfaces.md': POPULATED_SURFACES,
      'features/x.feature': tagLineFeature('@surface.safeword-cli'),
    });

    expect(output).toContain('[E008]');
    expect(output).toContain('safeword-cli');
  });

  it('does not report drift when every tag resolves, including multi-word headings', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/surfaces.md': MULTIWORD_SURFACES,
      'features/x.feature': tagLineFeature('@surface.claude-code-on-the-web', '@surface.cursor'),
    });

    expect(output).not.toContain('[E008]');
  });

  it('does not report a surface defined but referenced by no tag', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/surfaces.md': POPULATED_SURFACES,
      'features/x.feature': tagLineFeature('@surface.claude-code'),
    });

    expect(output).not.toContain('[E008]');
  });

  it('does not treat a surface slug mentioned only in prose as a reference', () => {
    const proseOnly = `Feature: fixture\n\n  Scenario: one\n    Given the @surface.safeword-cli tag is discussed in prose\n    When it happens\n    Then it holds\n`;
    const { output } = runDomainDocumentationCheck({
      '.project/surfaces.md': POPULATED_SURFACES,
      'features/x.feature': proseOnly,
    });

    expect(output).not.toContain('[E008]');
  });

  it('suppresses surface drift when surfaces.md is an empty scaffold', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/surfaces.md': SURFACES_SCAFFOLD,
      'features/x.feature': tagLineFeature('@surface.safeword-cli'),
    });

    expect(output).toContain('[W008]');
    expect(output).not.toContain('[E008]');
  });
});

const PERSONAS_TB = `# Personas\n\n## Technical Builder (TB)\n\n**Role:** Runs the agent.\n`;

describe('audit domain-documentation persona drift (E009)', () => {
  it('reports a persona code named in a live spec line but undefined', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/personas.md': PERSONAS_TB,
      '.project/tickets/T1-x/spec.md': `# Spec\n\n**Persona:** Growth Marketer (GM)\n`,
    });

    expect(output).toContain('[E009]');
    expect(output).toContain('GM');
  });

  it('does not report drift when every live spec persona code resolves', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/personas.md': PERSONAS_TB,
      '.project/tickets/T1-x/spec.md': `# Spec\n\n**Persona:** Technical Builder (TB)\n`,
    });

    expect(output).not.toContain('[E009]');
  });

  it('does not report a persona code that appears only in a commented-out spec example', () => {
    const { output } = runDomainDocumentationCheck({
      '.project/personas.md': PERSONAS_TB,
      '.project/tickets/T1-x/spec.md': `# Spec\n\n<!--\n**Persona:** Growth Marketer (GM)\n-->\n`,
    });

    expect(output).not.toContain('[E009]');
  });

  it('resolves a persona defined by name only via derived code', () => {
    const { output } = runDomainDocumentationCheck({
      // No explicit (PO) — derived from "Platform Operator" -> PO.
      '.project/personas.md': `# Personas\n\n## Platform Operator\n\n**Role:** Owns infra.\n`,
      '.project/tickets/T1-x/spec.md': `# Spec\n\n**Persona:** Platform Operator (PO)\n`,
    });

    expect(output).not.toContain('[E009]');
  });
});

const IN_SYNC_FIXTURE: Record<string, string> = {
  '.project/personas.md': PERSONAS_TB,
  '.project/surfaces.md': POPULATED_SURFACES,
  '.project/glossary.md': `# Glossary\n\n## Tool\n\n**Definition:** A callable capability.\n`,
  '.project/tickets/T1-x/spec.md': `# Spec\n\n**Persona:** Technical Builder (TB)\n`,
  'features/x.feature': tagLineFeature('@surface.claude-code'),
};

describe('audit domain-documentation content is advisory only (R4)', () => {
  it('produces no findings on a fully-populated, in-sync docs set', () => {
    const { output } = runDomainDocumentationCheck(IN_SYNC_FIXTURE);

    expect(output).not.toContain('[E008]');
    expect(output).not.toContain('[E009]');
    expect(output).not.toContain('[W008]');
  });

  it('emits the same result when a curated definition is reworded', () => {
    const inSync = runDomainDocumentationCheck(IN_SYNC_FIXTURE);
    const edited = runDomainDocumentationCheck({
      ...IN_SYNC_FIXTURE,
      '.project/glossary.md': `# Glossary\n\n## Tool\n\n**Definition:** A wholly different, arguably stale wording.\n`,
    });

    expect(edited.output).toBe(inSync.output);
    expect(edited.output).not.toContain('[E');
    expect(edited.output).not.toContain('[W');
  });
});

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  '.agents/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
];

describe('audit domain-documentation skill guidance parity', () => {
  it.each(AUDIT_SURFACES)('%s documents the domain-docs codes and advisory rule', relativePath => {
    const content = readSurface(relativePath);

    // The check exists and carries its sentinel + codes.
    expect(content).toContain('domain-docs-check');
    expect(content).toContain('Namespace Domain Docs');
    // Codes appear in the Report Format legend, not only inline.
    expect(content).toContain('[E008] Surface drift');
    expect(content).toContain('[E009] Persona drift');
    expect(content).toContain('[W008] Empty domain doc');
    // R4: human-curated content is advisory-only, never an error.
    expect(content).toContain('advisory');
    expect(content).toMatch(/never (an? )?error/i);
  });
});
