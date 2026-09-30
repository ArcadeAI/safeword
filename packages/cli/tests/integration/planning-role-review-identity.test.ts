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
const target = `${folder}/impl-plan.md`;
const scenarioPath = `${folder}/behavior.feature`;
const implementation = `# Impl Plan

**Status:** planned

## Approach

Preserve authenticated approval.

## Architecture applicability

skip: No durable architecture records are configured.

## Data applicability

skip: No product data is stored.

## Implementation Inspiration

skip: No reusable evidence is referenced.
`;
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
  - scenario-gate: .project/tickets/OWN123-owned-product/behavior.feature
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
  writeFileSync(nodePath.join(project, specPath), product);
  writeFileSync(nodePath.join(project, target), implementation);
  writeFileSync(
    nodePath.join(project, scenarioPath),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n    When approval is requested\n    Then approval is current\n',
  );
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
    reviewer_agent: 'claude', verdict: 'approve', summary: 'Fixture approves the supplied packet.', findings: [], evidence_records: { schema_version: 1, records: [] } } }));
});
`,
    { mode: 0o755 },
  );
  const result = await runCli(
    [
      'review',
      'run',
      'plan-implementation',
      target,
      '--context',
      scenarioPath,
      '--cwd',
      project,
      '--json',
      '--no-input',
    ],
    { cwd: project, env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(capturedPacket(capture).kind).toBe('plan-implementation');
  expect(capturedPacket(capture).context_files).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: ticketPath, content: metadata })]),
  );
  const receipt = JSON.parse(result.stdout).data;
  expect(receipt.status).toBe('approved');
  return {
    identity: receipt.review_identity,
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
      return JSON.parse(status.stdout).data;
    },
  };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

const roles = [
  'ticket',
  'project',
  'parent',
  'milestone',
  'rules',
  'scenarios',
  'dimensions',
  'principles',
  'personas',
  'surfaces',
  'architecture',
  'data',
  'reusable-evidence',
  'accepted-upstream-plan',
];

describe('complete planning role identity through authenticated public review', () => {
  it('keeps an unchanged authenticated approval as a passing control', async () => {
    const current = await review();
    const status = await current.status();
    expect(status.status).toBe('approved');
  });
  it('exposes every required or explicitly absent role in a versioned identity', async () => {
    const current = await review();
    const identity = current.identity;
    expect(identity, 'owned planning approval must expose complete review identity').toMatchObject({
      schema_version: 1,
      ticket_id: 'OWN123',
      ticket_path: ticketPath,
      review_kind: 'plan-implementation',
    });
    const targetIdentity = expect.objectContaining({
      path: target,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(identity.targets).toEqual(expect.arrayContaining([targetIdentity]));
    expect(identity.canonical_contract_digest).toMatch(/^[a-f0-9]{64}$/u);
    const recordedRoles = new Set([
      ...identity.dependencies.map((entry: { role: string }) => entry.role),
      ...identity.absences.map((entry: { role: string }) => entry.role),
    ]);
    expect(recordedRoles).toEqual(new Set(roles));
    expect(identity.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'ticket', path: ticketPath }),
        expect.objectContaining({ role: 'project', path: specPath }),
        expect.objectContaining({ role: 'rules', path: specPath }),
        expect.objectContaining({ role: 'scenarios', path: scenarioPath }),
        expect.objectContaining({ role: 'principles', path: '.project/principles.md' }),
        expect.objectContaining({ role: 'personas', path: '.project/personas.md' }),
        expect.objectContaining({ role: 'surfaces', path: '.project/surfaces.md' }),
      ]),
    );
    for (const entry of identity.dependencies) {
      expect(entry.semantic_digest).toMatch(/^[a-f0-9]{64}$/u);
    }
    for (const entry of identity.absences) {
      expect(entry.reason.trim()).not.toBe('');
      expect(entry.authority.trim()).not.toBe('');
      expect(
        identity.dependencies.some(
          (dependency: { role: string }) => dependency.role === entry.role,
        ),
      ).toBe(false);
    }
  });
  it('returns the same reviewed identity from durable status after a scope edit', async () => {
    const current = await review();
    expect(
      current.identity,
      'owned planning approval must expose complete review identity',
    ).toMatchObject({ schema_version: 1 });
    current.edit(text =>
      text.replace('scope: preserve authenticated approval', 'scope: permit anonymous approval'),
    );
    const status = await current.status();
    expect(status.status).toBe('stale');
    expect(status.review_identity).toEqual(current.identity);
  });
  it('retains approval for ordinary ticket progress as a passing control', async () => {
    const current = await review();
    current.edit(text => text.replace('phase: intake', 'phase: define-behavior'));
    const status = await current.status();
    expect(status.status).toBe('approved');
  });
  it('stales approval for an accepted scope change as a passing control', async () => {
    const current = await review();
    current.edit(text =>
      text.replace('scope: preserve authenticated approval', 'scope: permit anonymous approval'),
    );
    const status = await current.status();
    expect(status.status).toBe('stale');
  });
});
