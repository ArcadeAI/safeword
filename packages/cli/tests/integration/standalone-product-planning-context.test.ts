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
const target = `${folder}/spec.md`;
const metadata = `---
id: OWN123
type: feature
phase: intake
status: in_progress
product_plan_contract: v1
scope: preserve authenticated approval
out_of_scope: anonymous approval
done_when: current approval advances
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

async function review(ticket: string | undefined, explicit = false) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  mkdirSync(nodePath.join(project, folder), { recursive: true });
  if (ticket !== undefined) writeFileSync(nodePath.join(project, ticketPath), ticket);
  writeFileSync(nodePath.join(project, target), product);
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
  const context = explicit ? ['--context', ticketPath] : [];
  const result = await runCli(
    [
      'review',
      'run',
      'quality-review',
      target,
      ...context,
      '--cwd',
      project,
      '--json',
      '--no-input',
    ],
    { cwd: project, env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  return { capture, result };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

describe('owned standalone Product context through public review dispatch', () => {
  it('preserves an explicitly supplied current ticket as a dispatch control', async () => {
    const { result, capture } = await review(metadata, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    const packet = capturedPacket(capture);
    expect(packet.planning_phase).toBe('product-plan');
    expect(packet.context_files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ticketPath, content: metadata })]),
    );
  });
  it('automatically supplies the current standalone ticket', async () => {
    const { result, capture } = await review(metadata);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    const packet = capturedPacket(capture);
    expect(packet.planning_phase).toBe('product-plan');
    expect(packet.context_files, 'owned Product review must resolve its current ticket').toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ticketPath, content: metadata })]),
    );
  });
  it('recognizes valid quoted YAML ownership without downgrading planning review', async () => {
    const quoted = metadata
      .replace('id: OWN123', 'id: "OWN123"')
      .replace('product_plan_contract: v1', "product_plan_contract: 'v1'");
    expect(quoted).not.toBe(metadata);
    const { result, capture } = await review(quoted, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(
      capturedPacket(capture).planning_phase,
      'owned Product review must resolve its current ticket',
    ).toBe('product-plan');
  });
  it('refuses a missing ticket for a marked owned Product Plan before reviewer execution', async () => {
    const { result, capture } = await review(undefined);
    expect(result.exitCode, 'owned Product review must resolve its current ticket').not.toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_planning_context',
          metadata: { context_role: 'ticket', context_path: ticketPath },
        }),
      ]),
    );
    expect(existsSync(capture), 'missing owner ticket must refuse before reviewer execution').toBe(
      false,
    );
  });
});
