import { describe, expect, it } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import {
  productParentContextIdentity,
  semanticMarkdownIdentity,
} from '../../src/review/planning-context-identity.js';

describe('meaning retained by planning context Markdown identity', () => {
  it.each([
    ['blank lines', '# Rule\n\nPreserve approval.\n', '# Rule\n\n\nPreserve approval.\n\n'],
    ['prose wrapping', 'Preserve approval for Builders.', 'Preserve approval\nfor Builders.'],
    [
      'standalone comments',
      '# Rule\n\nPreserve approval.',
      '<!-- editorial -->\n\n# Rule\n\nPreserve approval.',
    ],
    ['inline comments', 'Preserve approval.', 'Preserve <!-- editorial -->approval.'],
    ['heading edge comments', '## Product Bet', '## Product Bet <!-- editorial -->'],
    ['paragraph edge comments', 'Preserve approval.', 'Preserve approval. <!-- editorial -->'],
    [
      'table-cell edge comments',
      '| Rule | Value |\n| --- | --- |\n| Approval | current |',
      '| Rule | Value |\n| --- | --- |\n| Approval | current <!-- editorial --> |',
    ],
    ['list spacing', '- First\n- Second\n', '- First\n\n- Second\n'],
    ['code fence spelling', '```js\nconst value = 1;\n```', '~~~js\nconst value = 1;\n~~~'],
  ])('ignores cosmetic %s', (_label, original, cosmetic) => {
    expect(semanticMarkdownIdentity(cosmetic)).toBe(semanticMarkdownIdentity(original));
  });
  it.each([
    ['literal identifiers', 'Rule scope_guard must pass.', 'Rule scopeguard must pass.'],
    ['leading nonbreaking space', '\u{A0}Preserve approval.', 'Preserve approval.'],
    ['trailing nonbreaking space', 'Preserve approval.\u{A0}', 'Preserve approval.'],
    ['inline code whitespace', 'Use `a  b`.', 'Use `a b`.'],
    ['code block whitespace', '```text\na  b\n```', '```text\na b\n```'],
    ['comments inside code', '```text\n<!-- preserve -->\n```', '```text\n<!-- remove -->\n```'],
    [
      'link destinations',
      '[guide](https://example.test/current)',
      '[guide](https://example.test/obsolete)',
    ],
    ['meaningful order', '1. Authenticate\n2. Approve\n', '1. Approve\n2. Authenticate\n'],
    ['hard line breaks', 'First\nSecond', 'First  \nSecond'],
    [
      'table values',
      '| Rule | Value |\n| --- | --- |\n| Approval | current |',
      '| Rule | Value |\n| --- | --- |\n| Approval | stale |',
    ],
    ['text between comments', '<!-- note -->approved<!-- note -->', '<!-- note --><!-- note -->'],
  ])('retains meaningful %s', (_label, original, changed) => {
    expect(semanticMarkdownIdentity(changed)).not.toBe(semanticMarkdownIdentity(original));
  });
});

const childPath = '.project/tickets/CHD123-child/spec.md';
const parentPath = '.project/tickets/PRT123-parent/spec.md';
const productFields = [
  'Expected outcome',
  'Persona outcome inventory',
  'Known facts',
  'Assumptions',
  'Unresolved product decisions',
  'Success threshold',
  'Project non-goals',
];
const productBet = productFields
  .map(field => `- **${field}:** preserve current approval`)
  .join('\n');
const parentContext = `## Product Bet\n\n${productBet}\n\n## Jobs To Be Done\n\n### trust.BU1 — Trust approval\n\n**Persona:** Builder (BU)\n\n> When I request approval, I want current evidence, so I can trust advancement.\n\n- **Outcome:** Current evidence is visible.\n- **Constraints:** Follow [policy][current].\n\n#### trust.BU1.R1 — Keep parent evidence current\n\nCurrent parent evidence is required.\n\n### trust.RD1 — Find guidance\n\n**Persona:** Reader (RD)\n\n#### trust.RD1.R1 — Find current guidance\n\nGuidance has a readable index.\n\n## Shape\n\n### M1 — Trust review\n\n- **Outcome:** Preserve trust.\n- **Non-goals:** No provider changes.\n`;
function parentIdentity(content: string) {
  const packet: ReviewPacket = {
    schema_version: 1,
    dispatch_id: 'unit-projection',
    kind: 'quality-review',
    planning_phase: 'product-plan',
    planning_context: {
      schema_version: 1,
      ticket_id: 'CHD123',
      ticket_path: '.project/tickets/CHD123-child/ticket.md',
      dependencies: [{ role: 'ticket', path: '.project/tickets/CHD123-child/ticket.md' }],
      absences: [],
    },
    logical_files: [{ path: childPath, content: '# Feature Contribution' }],
    context_files: [
      {
        path: '.project/tickets/CHD123-child/ticket.md',
        content:
          '---\nid: CHD123\nparent: PRT123\nparent_job: trust.BU1\nmilestone: M1\nscope: preserve approval\n---\n',
      },
      {
        path: '.project/tickets/PRT123-parent/ticket.md',
        content: '---\nid: PRT123\ntype: epic\nscope: preserve trust\n---\n',
      },
      { path: parentPath, content },
    ],
  };
  return productParentContextIdentity(packet).get(parentPath);
}

describe('selected parent Markdown context meaning', () => {
  const definition = '[current]: https://example.test/current\n';
  it.each(['Jobs To Be Done', 'Shape'])(
    'refuses selected content reclassified outside its owning %s section',
    section => {
      const original = `${parentContext}\n## Notes\n\n${definition}`;
      const reclassified = original.replace(`## ${section}`, '## Unrelated Notes');
      expect(reclassified).not.toBe(original);
      expect(() => parentIdentity(reclassified)).toThrow(`one ${section} section`);
    },
  );
  it('refuses ambiguous selected-job ownership', () => {
    expect(() => parentIdentity(`${parentContext}\n${definition}\n## Jobs To Be Done\n`)).toThrow(
      'one Jobs To Be Done section',
    );
  });
  it('ignores an inline comment in a required section heading', () => {
    const original = `${parentContext}\n## Notes\n\n${definition}`;
    const cosmetic = original.replace('## Product Bet', '## Product<!-- editorial --> Bet');
    expect(parentIdentity(cosmetic)).toBe(parentIdentity(original));
  });
  it('ignores a trailing comment in a required section heading', () => {
    const original = `${parentContext}\n## Notes\n\n${definition}`;
    const cosmetic = original.replace('## Product Bet', '## Product Bet <!-- editorial -->');
    expect(parentIdentity(cosmetic)).toBe(parentIdentity(original));
  });
  it.each([
    ['lineage ID', 'trust.BU1.R1', 'trust.BU1.R2'],
    ['text', 'Current parent evidence is required.', 'Stale parent evidence is permitted.'],
  ])('retains a selected inherited Rule %s', (_label, before, after) => {
    const original = `${parentContext}\n## Notes\n\n${definition}`;
    const changed = original.replace(before, () => after);
    expect(changed).not.toBe(original);
    expect(parentIdentity(changed)).not.toBe(parentIdentity(original));
  });
  it('ignores an unrelated inherited Rule change', () => {
    const original = `${parentContext}\n## Notes\n\n${definition}`;
    const unrelated = original.replace(
      'Guidance has a readable index.',
      'Guidance has a searchable index.',
    );
    expect(unrelated).not.toBe(original);
    expect(parentIdentity(unrelated)).toBe(parentIdentity(original));
  });
  it('ignores where a referenced link definition is placed', () => {
    expect(parentIdentity(`${parentContext}\n${definition}`)).toBe(
      parentIdentity(`${parentContext}\n## Notes\n\n${definition}`),
    );
  });
  it('retains a referenced destination outside the selected sections', () => {
    const original = `${parentContext}\n## Notes\n\n${definition}`;
    expect(
      parentIdentity(
        original.replace('https://example.test/current', 'https://example.test/obsolete'),
      ),
    ).not.toBe(parentIdentity(original));
  });
  it('refuses duplicate definitions for a selected reference', () => {
    expect(() =>
      parentIdentity(`${parentContext}\n## Notes\n\n${definition}${definition}`),
    ).toThrow('missing or duplicate referenced definitions');
  });
});
