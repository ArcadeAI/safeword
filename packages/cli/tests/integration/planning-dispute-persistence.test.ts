import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const roots: string[] = [];
const ticketId = 'PEN123';
const folder = `.project/tickets/${ticketId}-portable-question`;
const suggestion = 'Consider adding an optional approval audit export.';
const reason = 'The accepted Product Plan says: No optional audit export.';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function createReviewedProject() {
  const root = createTemporaryDirectory();
  const authorityRoot = createTemporaryDirectory();
  roots.push(root, authorityRoot);
  await createConfiguredProject(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  const ticketPath = nodePath.join(root, folder, 'ticket.md');
  writeFileSync(
    ticketPath,
    `---\nid: ${ticketId}\ntype: feature\nproduct_plan_contract: v1\nphase: plan-implementation\nphase_anchors:\n  - scenario-gate: features/approval.feature\nscope:\n  - preserve current approval\nout_of_scope:\n  - optional audit export\n---\n`,
  );
  writeFileSync(
    nodePath.join(root, folder, 'spec.md'),
    `# Product Plan

## Product Bet

- **Expected outcome:** Builder can trust current approval.
- **Persona outcome inventory:** Builder receives current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review remains available.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No optional audit export.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

## Shape

### M1 — Current approval

- **Outcome:** Review is current.
- **Non-goals:** Optional audit export.

## Surfaces

Affected:
- Safeword CLI
`,
  );
  const planPath = nodePath.join(root, folder, 'impl-plan.md');
  writeFileSync(
    planPath,
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve current approval.\n\n## Decisions\n\nPreserve the coordinator.\n\n## Design alignment\n\nskip: no shared architecture change\n\n## Architecture applicability\n\nskip: no durable architecture records apply\n\n## Data applicability\n\nskip: no product data is stored\n\n## Known deviations\n\nskip: none\n\n## Assessment triggers\n\nRevisit if authority is lost.\n',
  );
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(root, 'features/approval.feature'),
    'Feature: Preserve approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  const reviewer = createTrustedReviewerDirectory(
    'safeword-pending-question-',
    nodePath.resolve(import.meta.dirname, '../../node_modules/.cache/planning-dispute-reviewers'),
  );
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    String.raw`#!${process.execPath}
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  console.log(JSON.stringify({ structured_output: {
    schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    evidence_records: { schema_version: 1, records: [] },
    verdict: 'approve', summary: 'The accepted boundary remains intact.',
    findings: [{ severity: 'warning', message: ${JSON.stringify(suggestion)} }],
  } }));
});
`,
    { mode: 0o755 },
  );
  const run = (args: string[], timeout?: number) =>
    runCli([...args, '--cwd', root, '--json', '--no-input'], {
      cwd: root,
      timeout,
      env: {
        PATH: `${reviewer}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_KEY_ROOT: authorityRoot,
      },
    });
  const review = await run([
    'review',
    'run',
    'plan-implementation',
    `${folder}/impl-plan.md`,
    '--context',
    `${folder}/spec.md`,
    'features/approval.feature',
  ]);
  expect(review.exitCode, `${review.stdout}\n${review.stderr}`).toBe(0);
  const reviewed = JSON.parse(review.stdout).data;
  expect(reviewed.status).toBe('approved');
  return { authorityRoot, ticketPath, planPath, run, reviewId: reviewed.review_id as string };
}

describe('portable pending planning question', () => {
  it('persists the pending question after the producer process exits', async () => {
    const project = await createReviewedProject();
    const planBefore = readFileSync(project.planPath, 'utf8');
    const args = [
      'ticket',
      'record-review-disposition',
      ticketId,
      project.reviewId,
      '1',
      '--reason',
      reason,
    ];
    // Each runCli invocation executes the installed CLI in a separate OS process.
    const producer = await project.run(args, 5000);
    expect(producer.timedOut).toBe(false);
    expect(producer.exitCode, producer.stderr).toBe(2);
    const produced = JSON.parse(producer.stdout);
    expect(produced.state).toBe('action_required');
    expect(produced.data).toMatchObject({ status: 'pending', review_id: project.reviewId });
    expect(JSON.stringify(produced)).toContain(suggestion);

    const savedTicket = readFileSync(project.ticketPath, 'utf8');
    const saved = parse(savedTicket.split('---', 2)[1] ?? '');
    expect(saved.review_dispositions, 'missing durable pending disposition').toEqual([
      expect.objectContaining({
        review_id: project.reviewId,
        finding_message: suggestion,
        disposition: 'pending-user-decision',
        reason,
        action: expect.any(String),
      }),
    ]);
    const consumer = await project.run(args, 5000);
    expect(consumer.timedOut).toBe(false);
    expect(consumer.exitCode, consumer.stderr).toBe(2);
    expect(JSON.parse(consumer.stdout).data).toEqual(produced.data);
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(savedTicket);
    expect(readFileSync(project.planPath, 'utf8')).toBe(planBefore);
    const status = await project.run(['review', 'status', project.reviewId]);
    expect(JSON.parse(status.stdout).data.status).toBe('approved');
    // Compare only a boolean so a failed assertion cannot print key material.
    const fixtureKey = readFileSync(
      nodePath.join(project.authorityRoot, 'safeword/review-integrity.key'),
      'utf8',
    ).trim();
    expect(`${savedTicket}\n${planBefore}`.includes(fixtureKey)).toBe(false);
    expect(saved).not.toHaveProperty('design_approval');
  });
});
