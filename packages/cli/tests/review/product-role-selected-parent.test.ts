import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const parentPath = '.project/tickets/000123-parent/spec.md';
const target = '.project/tickets/OWN123-child/spec.md';
const parent = `# Parent Product Plan

## Product Bet

- **Expected outcome:** Builder can trust approval.
- **Persona outcome inventory:** Builder receives current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review remains available.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No anonymous approval.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

### approval.BU2 — Unrelated work

Builder can do another task.

## Shape

### M1 — Current approval

- **Outcome:** Review is current.
- **Non-goals:** Anonymous approval.

### M2 — Unrelated milestone

An unrelated delivery remains available.
`;
function project() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-product-parent-'));
  roots.push(root);
  writePlanningInventories(root);
  for (const folder of ['.project/tickets/OWN123-child', '.project/tickets/000123-parent'])
    mkdirSync(nodePath.join(root, folder), { recursive: true });
  writeFileSync(
    nodePath.join(root, '.project/tickets/OWN123-child/ticket.md'),
    '---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1\n---\n',
  );
  writeFileSync(
    nodePath.join(root, '.project/tickets/000123-parent/ticket.md'),
    '---\nid: 000123\ntype: epic\n---\n',
  );
  writeFileSync(
    nodePath.join(root, target),
    '# Child Contribution\n\nFollow the selected parent job.\n',
  );
  writeFileSync(nodePath.join(root, parentPath), parent);
  return root;
}
function identity(root: string) {
  const prepared = prepareReviewPacket(root, 'quality-review', [target]);
  try {
    return createPlanningReviewIdentity(prepared.packet);
  } finally {
    prepared.cleanup();
  }
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Product child selected-parent review identity', () => {
  it('reports a malformed inherited Product Plan as parent context', () => {
    const root = project();
    writeFileSync(nodePath.join(root, parentPath), parent.replace('## Shape', '## Delivery'));
    expect(() => identity(root)).toThrow(/parent.*spec\.md/u);
  });
  it('retains approval after an unrelated parent job and milestone edit', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent
        .replace('An unrelated delivery remains available.', 'An unrelated delivery can change.')
        .replace('Builder can do another task.', 'Builder can do a revised unrelated task.'),
    );
    expect(identity(root)).toEqual(before);
  });
  it('changes after a selected milestone outcome edit', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Review is current.', 'Review is current and attributable.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('changes after the inherited Product Bet changes', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Approval is authenticated.', 'Approval is authenticated and scoped.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
});
