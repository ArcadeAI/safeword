import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];
const parentFolder = '.project/tickets/PRT123-parent';
const childFolder = '.project/tickets/CHD123-child';
const parentSpec = `${parentFolder}/spec.md`;
const childTicket = `${childFolder}/ticket.md`;
const parent = `# Product Plan: Trust review

## Product Bet

- **Expected outcome:** Builders advance with current approval.
- **Persona outcome inventory:** Builder receives approval or a named refusal.
- **Known facts:** Approval authenticates the current source.
- **Assumptions:** Review latency is acceptable.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No new approval authority.

## Jobs To Be Done

### trust.BU1 — Trust approval

**Persona:** Builder (BU)

> When I request approval, I want current evidence, so I can trust advancement.

- **Outcome:** Current evidence is visible.
- **Constraints:** Preserve authentication.

#### trust.BU1.R1 — Preserve authenticated approval

Only current approval advances.

### trust.RD1 — Find guidance

**Persona:** Reader (RD)

> When I read a guide, I want an index, so I can find instructions.

#### trust.RD1.R1 — Keep guidance discoverable

Guidance has a readable index.

## Shape

### M1 — Trust review

- **Outcome:** Review preserves trust.
- **Non-goals:** No provider routing changes.

### M2 — Find guidance

- **Outcome:** Guidance has a readable index.
- **Non-goals:** No approval changes.
`;

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function fixture(prepare?: (project: string) => void) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  for (const [folder, metadata] of [
    [parentFolder, 'id: PRT123\ntype: epic'],
    [
      childFolder,
      'id: CHD123\ntype: feature\nparent: PRT123\nparent_job: trust.BU1\nmilestone: M1',
    ],
  ] as const) {
    mkdirSync(nodePath.join(project, folder), { recursive: true });
    writeFileSync(
      nodePath.join(project, folder, 'ticket.md'),
      `---\n${metadata}\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: new authority\ndone_when: current approval advances\n---\n`,
    );
  }
  writeFileSync(nodePath.join(project, parentSpec), parent);
  const target = `${childFolder}/spec.md`;
  writeFileSync(
    nodePath.join(project, target),
    '# Feature Contribution: Current review\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Parent References\n\n- **Parent:** PRT123\n- **Parent job:** trust.BU1\n- **Milestone:** M1\n\n## Contribution\n\nPreserve current approval.\n\n## Rules\n\n#### trust.BU1.CHD123.R1 — Preserve approval\n\nOnly current approval advances.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n',
  );
  prepare?.(project);
  const reviewer = createTrustedReviewerDirectory('safeword-context-currency-');
  const capture = nodePath.join(reviewer, 'packet.json');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    String.raw`#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  writeFileSync(${JSON.stringify(capture)}, JSON.stringify(packet));
  console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude', verdict: 'approve', summary: 'Review fixture approves the supplied source.',
    findings: [], evidence_records: { schema_version: 1, records: [] } } }));
});
`,
    { mode: 0o755 },
  );
  const run = (args: string[]) =>
    runCli([...args, '--cwd', project, '--json', '--no-input'], {
      cwd: project,
      env: { PATH: `${reviewer}:${process.env.PATH ?? ''}`, SAFEWORD_AGENT_RUNTIME: 'codex' },
    });
  const reviewed = await run(['review', 'run', 'quality-review', target]);
  expect(reviewed.exitCode, `${reviewed.stdout}\n${reviewed.stderr}`).toBe(0);
  expect(JSON.parse(readFileSync(capture, 'utf8')).planning_phase).toBe('product-plan');
  const receipt = JSON.parse(reviewed.stdout).data;
  expect(receipt.status).toBe('approved');
  expect(receipt.review_id).toEqual(expect.any(String));
  let reviewId: string = receipt.review_id;
  return {
    edit: (path: string, transform: (text: string) => string) => {
      const absolute = nodePath.join(project, path);
      const before = readFileSync(absolute, 'utf8');
      const after = transform(before);
      expect(after, 'the intended context mutation must change the source').not.toBe(before);
      writeFileSync(absolute, after);
    },
    status: async () => {
      const result = await run(['review', 'status', reviewId]);
      return JSON.parse(result.stdout).data.status as string;
    },
    rerun: async () => {
      const result = await run(['review', 'run', 'quality-review', target]);
      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
      const next = JSON.parse(result.stdout).data;
      expect(next.status).toBe('approved');
      reviewId = next.review_id;
    },
  };
}

describe('semantic planning context currency through public review status', () => {
  it('retains an unchanged authenticated approval as a control', async () => {
    const review = await fixture();
    expect(await review.status()).toBe('approved');
  });
  it('stales approval when selected Product context gains math', async () => {
    const review = await fixture();
    review.edit(parentSpec, text =>
      text.replace(
        'Approval authenticates the current source.',
        () => 'Approval authenticates the current source for $5 to $10.',
      ),
    );
    expect(await review.status()).toBe('stale');
    await review.rerun();
    review.edit(parentSpec, text => text.replace('$5 to $10', () => '$5 to $11'));
    expect(await review.status()).toBe('stale');
  });
  it('stales approval when selected Product context gains a footnote', async () => {
    const review = await fixture();
    review.edit(
      parentSpec,
      text =>
        `${text.replace('Approval authenticates the current source.', 'Approval authenticates the current source.[^source]')}\n[^source]: Evidence requires current approval.\n`,
    );
    expect(await review.status()).toBe('stale');
    await review.rerun();
    review.edit(parentSpec, text =>
      text.replace('Evidence requires current approval.', 'Evidence permits anonymous approval.'),
    );
    expect(await review.status()).toBe('stale');
  });
  it('keeps approval when an unrelated persona name overlaps the referenced persona', async () => {
    const review = await fixture(project => {
      const personas = nodePath.join(project, '.project/personas.md');
      writeFileSync(
        personas,
        `${readFileSync(personas, 'utf8').replace('## Builder (BU)', '## Non-Technical Builder (BU)')}\n## Technical Builder (TB)\n\n**Role:** An unrelated technical contributor.\n**Context:** Does not request this approval.\n\n## Builder (BD)\n\n**Role:** Another unrelated contributor.\n`,
      );
      const specification = nodePath.join(project, parentSpec);
      writeFileSync(
        specification,
        readFileSync(specification, 'utf8').replace(
          'Builder receives approval or a named refusal.',
          'Non-Technical Builder receives approval or a named refusal. Non-Technical Builder also reads the result.',
        ),
      );
    });
    review.edit('.project/personas.md', text =>
      text
        .replace('An unrelated technical contributor.', 'An unrelated technical reader.')
        .replace('Another unrelated contributor.', 'Another unrelated reader.'),
    );
    expect(await review.status(), 'unrelated overlapping persona changed review currency').toBe(
      'approved',
    );
  });
  it.each([
    [
      'administrative ticket progress',
      childTicket,
      (text: string) => text.replace('phase: intake', 'phase: define-behavior'),
    ],
    [
      'administrative parent ticket progress',
      `${parentFolder}/ticket.md`,
      (text: string) => text.replace('phase: intake', 'phase: define-behavior'),
    ],
    [
      'an unrelated milestone',
      parentSpec,
      (text: string) =>
        text.replace(
          '- **Non-goals:** No approval changes.',
          '- **Non-goals:** No routing changes.',
        ),
    ],
    [
      'parent comments and layout',
      parentSpec,
      (text: string) =>
        text.replace('## Product Bet\n\n', '## Product Bet\n\n<!-- editorial note -->\n\n'),
    ],
    [
      'an unrelated parent job',
      parentSpec,
      (text: string) => text.replace('I want an index', 'I want a searchable index'),
    ],
    [
      'an unrelated persona entry',
      '.project/personas.md',
      // Reader belongs to the unselected parent job; the child selected Builder.
      (text: string) => `${text}\n## Reader (RD)\n\n**Role:** Reads project guidance.\n`,
    ],
    [
      'an unrelated surface entry',
      '.project/surfaces.md',
      (text: string) => `${text}\n## Documentation site\n\n**Kind:** Website\n`,
    ],
  ])('retains approval after %s changes', async (_label, path, transform) => {
    const review = await fixture();
    review.edit(path, transform);
    expect(
      await review.status(),
      'planning context identity must ignore cosmetic and unrelated edits',
    ).toBe('approved');
  });
  it('invalidates a cosmetic edit to the exact Product Plan target', async () => {
    const review = await fixture();
    review.edit(`${childFolder}/spec.md`, text => `${text}\n<!-- editorial note -->\n`);
    expect(await review.status()).toBe('stale');
  });
  it.each([
    [
      'ticket scope',
      childTicket,
      (text: string) => text.replace('scope: preserve approval', 'scope: allow anonymous approval'),
    ],
    [
      'parent ticket scope',
      `${parentFolder}/ticket.md`,
      (text: string) => text.replace('scope: preserve approval', 'scope: allow anonymous approval'),
    ],
    [
      'selected milestone outcome',
      parentSpec,
      (text: string) => text.replace('Review preserves trust.', 'Review permits stale approval.'),
    ],
    [
      'selected milestone non-goals',
      parentSpec,
      (text: string) =>
        text.replace('No provider routing changes.', 'Provider routing changes are allowed.'),
    ],
    [
      'global Product Bet facts',
      parentSpec,
      (text: string) =>
        text.replace(
          'authenticates the current source',
          'does not authenticate the current source',
        ),
    ],
    [
      'selected parent constraints',
      parentSpec,
      (text: string) => text.replace('Preserve authentication.', 'Remove authentication.'),
    ],
    [
      'a new project principle',
      '.project/principles.md',
      (text: string) =>
        `${text}\n## Require explicit scope\n\nNever infer an additional product goal.\n`,
    ],
    [
      'the referenced persona',
      '.project/personas.md',
      (text: string) =>
        text.replace('Needs current authenticated approval', 'Needs fresh authenticated approval'),
    ],
    [
      'the referenced surface',
      '.project/surfaces.md',
      (text: string) =>
        text.replace('Requests and presents planning approval', 'Rejects planning approval'),
    ],
  ])('invalidates approval after %s changes', async (_label, path, transform) => {
    const review = await fixture();
    review.edit(path, transform);
    expect(await review.status()).toBe('stale');
  });
});
