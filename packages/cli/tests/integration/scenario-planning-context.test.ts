import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const folder = '.project/tickets/OWN123-owned-product';
const ticketPath = `${folder}/ticket.md`;
const specPath = `${folder}/spec.md`;
const target = 'features/approval.feature';
const metadata = `---
id: OWN123
type: feature
phase: intake
status: in_progress
product_plan_contract: v1
scope: preserve authenticated approval
out_of_scope: anonymous approval
done_when: current approval advances
phase_anchors:
  - scenario-gate: ${target}
---
`;
const product = `# Product Plan: Preserve approval

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Expected outcome:** Builders advance with current approval.
- **Persona outcome inventory:** Builder receives approval or a named refusal.
- **Known facts:** Approval authenticates the current source.
- **Assumptions:** Review latency is acceptable.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No new approval authority.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

> When I request approval, I want current evidence, so I can trust advancement.

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

## Surfaces

Affected:
- Safeword CLI
`;

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function review(missing?: 'ticket' | 'principles', explicit = false, multiple = false) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  mkdirSync(nodePath.join(project, folder), { recursive: true });
  if (missing !== 'ticket') writeFileSync(nodePath.join(project, ticketPath), metadata);
  writeFileSync(nodePath.join(project, specPath), product);
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, target),
    'Feature: Trust approval\n  Scenario: Current approval\n    Given an authenticated approval\n    When the Builder requests advancement\n    Then current approval advances\n',
  );
  const secondTarget = 'features/rejection.feature';
  if (multiple)
    writeFileSync(
      nodePath.join(project, secondTarget),
      'Feature: Refuse stale approval\n  Scenario: Changed approval\n    Given changed approval evidence\n    When the Builder requests advancement\n    Then Safeword refuses it\n',
    );
  if (missing === 'principles') rmSync(nodePath.join(project, '.project/principles.md'));
  const reviewer = createTrustedReviewerDirectory('safeword-standalone-context-');
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
    reviewer_agent: 'claude', verdict: 'approve', summary: 'Fixture approves the supplied packet.', findings: [] } }));
});
`,
    { mode: 0o755 },
  );
  const context = [
    '--context',
    specPath,
    ...(explicit
      ? [ticketPath, '.project/principles.md', '.project/personas.md', '.project/surfaces.md']
      : []),
  ];
  const result = await runCli(
    [
      'review',
      'run',
      'scenario-gate',
      target,
      ...(multiple ? [secondTarget] : []),
      ...context,
      '--cwd',
      project,
      '--json',
      '--no-input',
    ],
    { cwd: project, env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  return { capture, result, project };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

describe('owned scenario review resolves required context', () => {
  it('persists a readable current record for two reviewed feature targets', async () => {
    const { result, capture, project } = await review(undefined, false, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(capturedPacket(capture).logical_files).toHaveLength(2);
    const reviewId = (JSON.parse(result.stdout).data as { review_id: string }).review_id;
    const status = await runCli(['review', 'status', reviewId, '--cwd', project, '--json'], {
      cwd: project,
    });
    expect(status.exitCode, `${status.stdout}\n${status.stderr}`).toBe(0);
    expect(JSON.parse(status.stdout).data.status).toBe('approved');
  });

  it('preserves explicitly supplied required sources as a control', async () => {
    const { result, capture } = await review(undefined, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(capturedPacket(capture).context_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ticketPath, content: metadata }),
        expect.objectContaining({ path: '.project/principles.md' }),
        expect.objectContaining({ path: '.project/personas.md' }),
        expect.objectContaining({ path: '.project/surfaces.md' }),
      ]),
    );
  });
  it('resolves its ticket and project inventories from the owning spec context', async () => {
    const { result, capture } = await review();
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(
      capturedPacket(capture).context_files,
      'owned scenario review must resolve required context',
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ticketPath, content: metadata }),
        expect.objectContaining({ path: '.project/principles.md' }),
        expect.objectContaining({ path: '.project/personas.md' }),
        expect.objectContaining({ path: '.project/surfaces.md' }),
      ]),
    );
  });
  it.each([
    ['ticket', ticketPath],
    ['principles', '.project/principles.md'],
  ] as const)('refuses missing required %s before reviewer execution', async (role, path) => {
    const { result, capture } = await review(role);
    expect(result.exitCode, 'owned scenario review must resolve required context').not.toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_planning_context',
          metadata: { context_role: role, context_path: path },
        }),
      ]),
    );
    expect(
      existsSync(capture),
      'missing required context must refuse before reviewer execution',
    ).toBe(false);
  });
});
