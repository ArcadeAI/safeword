import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];
afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});
const parentPath = '.project/tickets/PRT123-parent/spec.md';
const childPath = '.project/tickets/CHD123-child/spec.md';
const parent = `# Product Plan: Trusted review

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Expected outcome:** PARENT OUTCOME: current review reaches the Builder.
- **Persona outcome inventory:** PARENT INVENTORY: Builder advances or receives a named refusal.
- **Known facts:** PARENT FACT: the Builder has authenticated review evidence.
- **Assumptions:** PARENT ASSUMPTION: approval latency remains acceptable.
- **Unresolved product decisions:** PARENT DECISION: none.
- **Success threshold:** PARENT THRESHOLD: a current approval advances.
- **Project non-goals:** PARENT BOUNDARY: no new approval authority.

## Jobs To Be Done

### trusted-review.BU1 — Trust approval

**Persona:** Builder (\`BU\`)

> When I request approval, I want current review, so I can trust advancement.

- **Outcome:** SELECTED JOB OUTCOME: current evidence is visible.
- **Constraints:** SELECTED JOB CONSTRAINT: preserve authentication.

#### trusted-review.BU1.R1 — Keep evidence current

Approval must use current evidence.

### trusted-review.RD1 — Unrelated job

**Persona:** Reader (\`RD\`)

> When I read a guide, I want an index, so I can find instructions.

## Shape

### M1 — Trust review

- **Outcome:** MILESTONE OUTCOME: review preserves trust.
- **Non-goals:** MILESTONE BOUNDARY: no provider routing changes.
`;
const child = `# Feature Contribution: Review inherited context

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** PRT123
- **Parent job:** trusted-review.BU1
- **Milestone:** M1

## Contribution

Supply current context to the reviewer.

## Rules

#### trusted-review.BU1.CHD123.R1 — Review inherited constraints

Review the current parent constraints.

## Surfaces

Affected:
- Safeword CLI
`;

async function fixture(parentPresent: boolean, explicitContext = false) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writeFileSync(
    nodePath.join(project, '.project/personas.md'),
    '# Personas\n\n## Builder (`BU`)\n\nBuilder needs trustworthy approval.\n\n## Reader (`RD`)\n\nReader finds guidance.\n',
  );
  writeFileSync(
    nodePath.join(project, '.project/surfaces.md'),
    '# Surfaces\n\n## Safeword CLI\n\nThe public CLI reviews plans.\n',
  );
  for (const [folder, metadata] of [
    ['PRT123-parent', 'id: PRT123\ntype: epic'],
    [
      'CHD123-child',
      'id: CHD123\ntype: feature\nparent: PRT123\nparent_job: trusted-review.BU1\nmilestone: M1',
    ],
  ] as const) {
    const directory = nodePath.join(project, '.project/tickets', folder);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'ticket.md'),
      `---\n${metadata}\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve review trust\nout_of_scope: new authority\ndone_when: inherited context reaches review\n---\n`,
    );
  }
  writeFileSync(nodePath.join(project, childPath), child);
  if (parentPresent) writeFileSync(nodePath.join(project, parentPath), parent);
  const bin = createTrustedReviewerDirectory('safeword-child-context-');
  const capture = nodePath.join(bin, 'received-prompt.txt');
  writeFileSync(
    nodePath.join(bin, 'claude'),
    String.raw`#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  writeFileSync(${JSON.stringify(capture)}, input);
  const packet = JSON.parse(input.trim().split('\n').pop());
  console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude', verdict: 'approve', summary: 'The supplied plan is otherwise reviewable.', findings: [] } }));
});
`,
    { mode: 0o755 },
  );
  const context = explicitContext ? ['--context', parentPath] : [];
  const result = await runCli(
    [
      'review',
      'run',
      'quality-review',
      childPath,
      ...context,
      '--cwd',
      project,
      '--json',
      '--no-input',
    ],
    { cwd: project, env: { PATH: `${bin}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  return { capture, result };
}

describe('inherited context through public child Product Plan review', () => {
  it('preserves explicit current parent context as a dispatch control', async () => {
    const { capture, result } = await fixture(true, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(existsSync(capture)).toBe(true);
    const packet = JSON.parse(readFileSync(capture, 'utf8').trim().split('\n').pop() ?? '');
    const expectedParent = expect.objectContaining({ path: parentPath, content: parent });
    expect(packet.context_files).toEqual(expect.arrayContaining([expectedParent]));
  });
  it('delivers the owning Product Bet and selected parent boundaries', async () => {
    const { capture, result } = await fixture(true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(existsSync(capture)).toBe(true);
    const packet = JSON.parse(readFileSync(capture, 'utf8').trim().split('\n').pop() ?? '');
    expect(packet.planning_phase).toBe('product-plan');
    const supplied = packet.context_files.find(
      (file: { path: string }) => file.path === parentPath,
    );
    expect(supplied, 'child Product review must enforce declared parent context').toBeDefined();
    for (const marker of [
      'PARENT OUTCOME:',
      'PARENT INVENTORY:',
      'PARENT FACT:',
      'PARENT ASSUMPTION:',
      'PARENT DECISION:',
      'PARENT THRESHOLD:',
      'PARENT BOUNDARY:',
      '**Persona:** Builder (`BU`)',
      'When I request approval, I want current review, so I can trust advancement.',
      'SELECTED JOB OUTCOME:',
      'SELECTED JOB CONSTRAINT:',
      'MILESTONE OUTCOME:',
      'MILESTONE BOUNDARY:',
    ]) {
      expect(
        supplied?.content,
        'child Product review must enforce declared parent context',
      ).toContain(marker);
    }
  });
  it('refuses an absent declared parent before reviewer execution', async () => {
    const { capture, result } = await fixture(false);
    expect(result.exitCode, 'child Product review must enforce declared parent context').not.toBe(
      0,
    );
    const output = JSON.parse(result.stdout);
    const missingParent = expect.objectContaining({
      code: 'missing_planning_context',
      metadata: { context_role: 'parent', context_path: parentPath },
    });
    expect(output.findings).toEqual(expect.arrayContaining([missingParent]));
    expect(existsSync(capture), 'missing parent must refuse before reviewer execution').toBe(false);
  });
});
