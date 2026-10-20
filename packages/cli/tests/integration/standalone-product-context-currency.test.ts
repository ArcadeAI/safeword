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

async function review() {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  mkdirSync(nodePath.join(project, folder), { recursive: true });
  writeFileSync(nodePath.join(project, ticketPath), metadata);
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
  const result = await runCli(
    ['review', 'run', 'quality-review', target, '--cwd', project, '--json', '--no-input'],
    { cwd: project, env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(capturedPacket(capture).planning_phase).toBe('product-plan');
  const receipt = JSON.parse(result.stdout).data;
  expect(receipt.status).toBe('approved');
  return {
    edit: (transform: (text: string) => string) => {
      const path = nodePath.join(project, ticketPath);
      const before = readFileSync(path, 'utf8');
      const after = transform(before);
      expect(after, 'the intended ticket mutation must change the source').not.toBe(before);
      writeFileSync(path, after);
    },
    status: async () => {
      const status = await runCli(
        ['review', 'status', receipt.review_id, '--cwd', project, '--json', '--no-input'],
        {
          cwd: project,
          env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' },
        },
      );
      const state = JSON.parse(status.stdout).data.status as string;
      expect(status.exitCode, `${status.stdout}\n${status.stderr}`).toBe(state === 'stale' ? 2 : 0);
      return state;
    },
  };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

describe('standalone ticket semantic currency through public status', () => {
  it('retains an unchanged authenticated approval as a control', async () => {
    const current = await review();
    expect(await current.status()).toBe('approved');
  });
  it.each([
    [
      'ordinary phase progress',
      (text: string) => text.replace('phase: intake', 'phase: define-behavior'),
    ],
    [
      'YAML formatting',
      (text: string) =>
        text.replace(
          'scope: preserve authenticated approval',
          'scope: "preserve authenticated approval"',
        ),
    ],
  ])('retains approval after %s', async (_label, transform) => {
    const current = await review();
    current.edit(transform);
    expect(
      await current.status(),
      'standalone ticket currency must ignore non-semantic edits',
    ).toBe('approved');
  });
  it('stales approval after an accepted scope change', async () => {
    const current = await review();
    current.edit(text =>
      text.replace('scope: preserve authenticated approval', 'scope: permit anonymous approval'),
    );
    expect(await current.status()).toBe('stale');
  });
});
