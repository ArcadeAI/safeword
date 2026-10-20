import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const child = '.project/tickets/OWN123-child';
const parentPath = '.project/tickets/000123-parent/spec.md';
const feature = 'features/child.feature';
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
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-scenario-parent-'));
  roots.push(root);
  writePlanningInventories(root);
  for (const folder of [child, '.project/tickets/000123-parent', 'features'])
    mkdirSync(nodePath.join(root, folder), { recursive: true });
  writeFileSync(
    nodePath.join(root, `${child}/ticket.md`),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1\nphase_anchors:\n  - scenario-gate: ${feature}\n---\n`,
  );
  writeFileSync(
    nodePath.join(root, '.project/tickets/000123-parent/ticket.md'),
    '---\nid: 000123\ntype: epic\n---\n',
  );
  writeFileSync(
    nodePath.join(root, `${child}/spec.md`),
    '# Child Contribution\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust approval\n\n#### approval.BU1.R1 — Preserve approval\n\nOnly current approval advances.\n',
  );
  writeFileSync(nodePath.join(root, parentPath), parent);
  writeFileSync(
    nodePath.join(root, feature),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  return root;
}
function identity(root: string) {
  const prepared = prepareReviewPacket(root, 'scenario-gate', [feature], [`${child}/spec.md`]);
  try {
    return createPlanningReviewIdentity(prepared.packet);
  } finally {
    prepared.cleanup();
  }
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  vi.unstubAllEnvs();
});

describe('Scenario child selected-parent review identity', () => {
  it('retains approval after an unrelated parent job and milestone edit', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace(
        'An unrelated delivery remains available.',
        'An unrelated delivery can change.',
      ),
    );
    expect(identity(root)).toEqual(before);
  });
  it('stales approval after a selected inherited outcome changes', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Review is current.', 'Review is current and attributable.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('retains approval after an unreferenced persona changes', () => {
    const root = project();
    const personas = nodePath.join(root, '.project/personas.md');
    const original =
      '# Personas\n\n## Builder (BU)\n\n**Role:** Requests current approval.\n\n## Analyst (AN)\n\n**Role:** Reads unrelated reports.\n';
    writeFileSync(personas, original);
    const before = identity(root);
    writeFileSync(
      personas,
      original.replace('Reads unrelated reports.', 'Reads unrelated metrics.'),
    );
    expect(identity(root)).toEqual(before);
  });
  it('stales approval after the referenced persona changes', () => {
    const root = project();
    const personas = nodePath.join(root, '.project/personas.md');
    const original = '# Personas\n\n## Builder (BU)\n\n**Role:** Requests current approval.\n';
    writeFileSync(personas, original);
    const before = identity(root);
    writeFileSync(personas, original.replace('current approval', 'authenticated approval'));
    expect(identity(root)).not.toEqual(before);
  });
  it('stales approval after a Product Bet persona without a JTBD changes', () => {
    const root = project();
    const personas = nodePath.join(root, '.project/personas.md');
    const original =
      '# Personas\n\n## Builder (BU)\n\n**Role:** Requests current approval.\n\n## Analyst (AN)\n\n**Role:** Checks the outcome inventory.\n';
    writeFileSync(personas, original);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace(
        'Builder receives current approval.',
        'Builder receives current approval; Analyst (AN) can check the outcome.',
      ),
    );
    const before = identity(root);
    writeFileSync(
      personas,
      original.replace('Checks the outcome inventory.', 'Audits the outcome inventory.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('retains approval after an unreferenced surface changes', () => {
    const root = project();
    const surfaces = nodePath.join(root, '.project/surfaces.md');
    const original =
      '# Surfaces\n\n## Safeword CLI\n\n**Kind:** CLI\n**Description:** Requests approval.\n\n## Reports UI\n\n**Kind:** UI\n**Description:** Shows unrelated reports.\n';
    writeFileSync(surfaces, original);
    const before = identity(root);
    writeFileSync(surfaces, original.replace('unrelated reports', 'unrelated metrics'));
    expect(identity(root)).toEqual(before);
  });
  it('stales approval after the referenced surface changes', () => {
    const root = project();
    const surfaces = nodePath.join(root, '.project/surfaces.md');
    const original =
      '# Surfaces\n\n## Safeword CLI\n\n**Kind:** CLI\n**Description:** Requests approval.\n';
    writeFileSync(surfaces, original);
    const before = identity(root);
    writeFileSync(surfaces, original.replace('Requests approval.', 'Presents approval.'));
    expect(identity(root)).not.toEqual(before);
  });
  it('stores a canonical target when the caller uses an equivalent path', async () => {
    const root = project();
    const worker = nodePath.join(root, 'worker.mjs');
    writeFileSync(worker, 'process.exit(0);\n');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', nodePath.join(root, 'keys'));
    await expect(
      startReviewJob({
        cwd: root,
        kind: 'scenario-gate',
        targets: [`./${feature}`],
        context: [`${child}/spec.md`],
      }),
    ).resolves.toBeDefined();
    const jobs = nodePath.join(root, '.safeword/state/reviews');
    const record = readdirSync(jobs).find(name => name.endsWith('.json'));
    expect(record).toBeDefined();
    const saved = JSON.parse(readFileSync(nodePath.join(jobs, record ?? ''), 'utf8')) as {
      targets: string[];
    };
    expect(saved.targets).toEqual([feature]);
  });
  it('resolves an equivalent scenario path in the ticket anchor', () => {
    const root = project();
    const ticket = nodePath.join(root, `${child}/ticket.md`);
    writeFileSync(
      ticket,
      readFileSync(ticket, 'utf8').replace(feature, './features/child.feature'),
    );
    expect(identity(root)?.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'scenarios', path: feature })]),
    );
  });
  it('resolves the canonical scenario source when the ticket has no anchor', () => {
    const root = project();
    const ticket = nodePath.join(root, `${child}/ticket.md`);
    writeFileSync(
      ticket,
      readFileSync(ticket, 'utf8').replace(`phase_anchors:\n  - scenario-gate: ${feature}\n`, ''),
    );
    expect(identity(root)?.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'scenarios', path: feature })]),
    );
  });
  it('keeps a generic scenario review outside owned tickets runnable', async () => {
    const root = project();
    writeFileSync(nodePath.join(root, 'spec.md'), '# Generic spec\n\nNo owned ticket.\n');
    const worker = nodePath.join(root, 'worker.mjs');
    writeFileSync(worker, 'process.exit(0);\n');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', nodePath.join(root, 'keys'));
    await expect(
      startReviewJob({
        cwd: root,
        kind: 'scenario-gate',
        targets: [feature],
        context: ['spec.md'],
      }),
    ).resolves.toBeDefined();
  });
  it('retains approval after an unrelated persona edit with AC-style criteria', () => {
    const root = project();
    const childSpec = nodePath.join(root, `${child}/spec.md`);
    const featurePath = nodePath.join(root, feature);
    writeFileSync(childSpec, readFileSync(childSpec, 'utf8').replaceAll('.R1', '.AC1'));
    writeFileSync(featurePath, readFileSync(featurePath, 'utf8').replaceAll('.R1', '.AC1'));
    const personas = nodePath.join(root, '.project/personas.md');
    const original =
      '# Personas\n\n## Builder (BU)\n\n**Role:** Requests approval.\n\n## Analyst (AN)\n\n**Role:** Reads unrelated reports.\n';
    writeFileSync(personas, original);
    const before = identity(root);
    writeFileSync(
      personas,
      original.replace('Reads unrelated reports.', 'Reads unrelated metrics.'),
    );
    expect(identity(root)).toEqual(before);
  });
});
