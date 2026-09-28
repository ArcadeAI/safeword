import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-owned';
const target = `${folder}/impl-plan.md`;
const ticketPath = `${folder}/ticket.md`;
const scenario = `${folder}/behavior.feature`;
const metadata = `---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nphase_anchors:\n  - scenario-gate: ${scenario}\n---\n`;
const spec = `# Product Plan

## Product Bet

- **Expected outcome:** Builders retain approval.
- **Persona outcome inventory:** Builder receives approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review is available.
- **Unresolved product decisions:** none
- **Success threshold:** Approval advances.
- **Project non-goals:** No anonymous approval.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Current approval advances.
`;
const implementation = `# Impl Plan

## Architecture applicability

skip: No durable architecture records apply.

## Data applicability

skip: No product data is stored.
`;
function project() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-role-context-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  for (const [path, content] of [
    [ticketPath, metadata],
    [`${folder}/spec.md`, spec],
    [target, implementation],
    [scenario, 'Feature: Trust approval\n  Scenario: Approval\n    Given current evidence\n'],
  ] as const)
    writeFileSync(nodePath.join(root, path), content);
  return root;
}
function context(root: string) {
  const prepared = prepareReviewPacket(root, 'plan-implementation', [target]);
  try {
    return prepared.packet.planning_context;
  } finally {
    prepared.cleanup();
  }
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('owned Implementation role resolution', () => {
  it('derives required scenarios and authorized optional absences', () => {
    const result = context(project());
    expect(result?.dependencies).toContainEqual({ role: 'scenarios', path: scenario });
    expect(result?.absences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'dimensions', authority: ticketPath }),
        expect.objectContaining({ role: 'architecture', authority: target }),
        expect.objectContaining({ role: 'data', authority: target }),
      ]),
    );
  });
  it('uses the latest scenario anchor when a phase is repeated', () => {
    const root = project();
    writeFileSync(
      nodePath.join(root, ticketPath),
      metadata.replace('phase_anchors:\n', 'phase_anchors:\n  - scenario-gate: missing.feature\n'),
    );
    expect(context(root)?.dependencies).toContainEqual({ role: 'scenarios', path: scenario });
  });
  it.each(['missing', 'blank'])('refuses a %s scenario source', state => {
    const root = project();
    const path = nodePath.join(root, scenario);
    if (state === 'missing') rmSync(path);
    else writeFileSync(path, ' \n');
    expect(() => context(root)).toThrow(
      expect.objectContaining({ contextRole: 'scenarios', contextPath: scenario }),
    );
  });
  it('captures present dimensions instead of claiming absence', () => {
    const root = project();
    const path = `${folder}/dimensions.md`;
    writeFileSync(nodePath.join(root, path), '# Dimensions\n\nRequired versus optional.\n');
    const result = context(root);
    expect(result?.dependencies).toContainEqual({ role: 'dimensions', path });
    expect(result?.absences.some(row => row.role === 'dimensions')).toBe(false);
  });
  it('captures existing architecture records despite a plan skip', () => {
    const root = project();
    writeFileSync(
      nodePath.join(root, '.project/architecture.md'),
      '# Decision\n\nPreserve authenticated authority.\n',
    );
    expect(context(root)?.dependencies).toContainEqual({
      role: 'architecture',
      path: '.project/architecture.md',
    });
  });
  it('refuses an unjustified architecture absence', () => {
    const root = project();
    writeFileSync(
      nodePath.join(root, target),
      implementation.replace(
        'skip: No durable architecture records apply.',
        'Apply current architecture.',
      ),
    );
    expect(() => context(root)).toThrow(expect.objectContaining({ contextRole: 'architecture' }));
  });
  it('names the first required inventory when config is malformed', () => {
    const root = project();
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(root, '.safeword/config.json'), '{"paths":');
    expect(() => context(root)).toThrow(expect.objectContaining({ contextRole: 'principles' }));
  });
  it('names the missing plan declaration instead of the data guide', () => {
    const root = project();
    writeFileSync(
      nodePath.join(root, target),
      implementation.replace(
        '## Data applicability\n\nskip: No product data is stored.',
        '## Data decisions\n\nNo data declaration is present.',
      ),
    );
    expect(() => context(root)).toThrow(
      expect.objectContaining({
        contextRole: 'data',
        message: expect.stringContaining('Data applicability declaration'),
      }),
    );
  });
  it('refuses a missing triggered data guide', () => {
    const root = project();
    writeFileSync(
      nodePath.join(root, target),
      implementation.replace('skip: No product data is stored.', 'Persist product data.'),
    );
    expect(() => context(root)).toThrow(expect.objectContaining({ contextRole: 'data' }));
  });
  it.each(['blank', 'duplicate'])('refuses %s required Product framing', state => {
    const root = project();
    const changed =
      state === 'blank'
        ? spec.replace('Builders retain approval.', '')
        : spec.replace(
            '## Jobs To Be Done',
            '- **Expected outcome:** Duplicate outcome.\n\n## Jobs To Be Done',
          );
    writeFileSync(nodePath.join(root, folder, 'spec.md'), changed);
    expect(() => context(root)).toThrow(expect.objectContaining({ contextRole: 'project' }));
  });
});
