import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAffectedSurfaceReferences } from '../../src/utils/scenario-coverage.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relative: string): string => readFileSync(nodePath.join(repoRoot, relative), 'utf8');
const flow = (relative: string): string => read(relative).replaceAll(/\s+/gu, ' ');

/**
 * `## Surfaces` had three readers and no writer. SCENARIOS.md required an
 * `@surface.<slug>` tag per entry, health.ts reported stale tags against it, and
 * /verify built its surface-evidence matrix from it -- while DISCOVERY.md said
 * to keep "the four template sections and no others" and neither spec template
 * scaffolded one. A spec authored to the rules could never legitimately carry
 * the section those three checks read, so all three were dead by construction.
 *
 * surfaces-template.md states the intent plainly: "One-spec-only contexts can
 * stay under that ticket's ## Surfaces section."
 */

const specTemplates = [
  'packages/cli/templates/spec-template.md',
  'packages/cli/templates/child-spec-template.md',
  '.safeword/templates/spec-template.md',
  '.safeword/templates/child-spec-template.md',
];

const discoverySurfaces = [
  'packages/cli/templates/skills/bdd/DISCOVERY.md',
  '.safeword/skills/bdd/DISCOVERY.md',
  '.claude/skills/bdd/DISCOVERY.md',
  'packages/cli/codex-plugin/skills/bdd/references/DISCOVERY.md',
  'plugin/skills/bdd/DISCOVERY.md',
];

describe('surfaces section', () => {
  it.each(specTemplates)('%s scaffolds the section its readers expect', relative => {
    expect(read(relative)).toContain('## Surfaces');
  });

  it.each(specTemplates)('%s declares no surfaces until filled in', relative => {
    // The guidance is HTML-commented and the parser skips commented content, so
    // an untouched template must not register phantom affected surfaces --
    // otherwise every new ticket would open owing scenario tags it never chose.
    expect(parseAffectedSurfaceReferences(read(relative))).toEqual([]);
  });

  it('parses the documented shape once a spec fills it in', () => {
    // Guards the template's example against drifting from the real parser:
    // the label, the bullet form, and the inline skip all have to keep working.
    const filled = [
      '## Surfaces',
      '',
      'Affected:',
      '- Claude Code',
      '- OpenAI Codex — skip: covered by a shared fixture',
      '',
      'Unaffected:',
      '- Cursor — cannot reach it',
      '',
    ].join('\n');

    expect(parseAffectedSurfaceReferences(filled)).toEqual([
      { name: 'Claude Code', slug: 'claude-code', skipped: false },
      { name: 'OpenAI Codex', slug: 'openai-codex', skipped: true },
    ]);
  });

  it.each(discoverySurfaces)('%s stops forbidding the section', relative => {
    const content = flow(relative);

    expect(content).toContain('Keep the five template sections and no others');
    expect(content).not.toContain('Keep the four template sections');
    // Children reach surfaces the parent never did, so they declare their own.
    expect(content).toContain('`Rules`, and `Surfaces` in the child');
  });

  it.each(discoverySurfaces)('%s adds no fifth confirmation', relative => {
    // #3688 cut intake to four checkpoints. Surfaces rides with engineering
    // scope rather than reinstating a confirmation that change removed.
    expect(flow(relative)).toContain(
      'confirmed with engineering scope, not as their own checkpoint',
    );
  });
});
