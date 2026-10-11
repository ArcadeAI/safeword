import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const roots: string[] = [];
const folder = 'CTX123-current-context';
const principle = 'PROJECT PRINCIPLE: Preserve the authenticated approval authority.';
const plan =
  '# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve the existing approval authority.\n\n## Decisions\n\nRead the current configured principles before judging the approach.\n\n## Design alignment\n\nApply the Builder approval principle.\n\n## Architecture applicability\n\nskip: no durable architecture records are configured\n\n## Data applicability\n\nskip: this contribution stores no product data\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: fixture has no customer documentation change\n\n## Assessment triggers\n\nRevisit when approval authority changes.\n';
const spec =
  '# Product Plan: Preserve current approval authority\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Problem / Why now:** Builders need trustworthy approval.\n- **Expected outcome:** Builders advance only with current approval.\n- **Success threshold:** Current approval advances and missing context refuses.\n- **Project non-goals:** Changing approval authority.\n- **Persona outcome inventory:** Builder succeeds with current approval; missing required context refuses with a named repair action.\n- **Known facts:** The fixture has one Builder and one CLI surface.\n- **Assumptions:** none\n- **Unresolved product decisions:** none\n\n## Jobs To Be Done\n\n### current-context.BU1 — Advance with current approval\n\n**Persona:** Builder (`BU`)\n\n> When I request approval, I want the current principles reviewed, so I can trust advancement.\n\n#### current-context.BU1.R1 — Required principles reach the reviewer\n\nReview the actual configured principles; refuse a missing configured source.\n\n## Shape\n\n### M1 — Trust approval\n\n- **Outcome:** Current required context reaches review.\n- **Non-goals:** New approval authority.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

function fixture() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-planning-context-'));
  roots.push(root);
  const distribution = nodePath.join(root, 'package');
  mkdirSync(distribution);
  for (const part of ['dist', 'templates', 'package.json'])
    cpSync(nodePath.join(packageRoot, part), nodePath.join(distribution, part), {
      recursive: true,
    });
  symlinkSync(
    nodePath.join(packageRoot, 'node_modules'),
    nodePath.join(distribution, 'node_modules'),
  );
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  const reviewer = createTrustedReviewerDirectory('safeword-required-context-');
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
  const complete = packet.context_files?.some(file => file.content.includes(${JSON.stringify(principle)}));
  console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude', verdict: complete ? 'approve' : 'request_changes',
    summary: complete ? 'The current principles reached review.' : 'Required principles were omitted.',
    evidence_records: { schema_version: 1, records: [] },
    findings: complete ? [] : [{ severity: 'error', message: 'Required principles were omitted from the actual packet.' }] } }));
});
`,
    { mode: 0o755 },
  );
  const capability = spawnSync(nodePath.join(reviewer, 'claude'), ['--help'], { encoding: 'utf8' });
  expect(capability.status, `${capability.stdout}\n${capability.stderr}`).toBe(0);
  expect(capability.stdout.trim()).toBe(REVIEWER_CAPABILITIES.claude);
  symlinkSync(process.execPath, nodePath.join(reviewer, 'node'));
  const bun = spawnSync('which', ['bun'], { encoding: 'utf8' });
  expect(bun.status).toBe(0);
  symlinkSync(bun.stdout.trim(), nodePath.join(reviewer, 'bun'));
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    PATH: `${reviewer}:/usr/bin:/bin`,
    SAFEWORD_AGENT_RUNTIME: 'codex',
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, 'keys'),
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
    SAFEWORD_SKIP_SKILLS: '1',
  };
  const run = (args: string[]) =>
    spawnSync(
      'bun',
      [
        nodePath.join(distribution, 'dist/cli.js'),
        ...args,
        '--cwd',
        project,
        '--json',
        '--no-input',
      ],
      { cwd: project, encoding: 'utf8', timeout: 30_000, env: environment },
    );
  const installed = run(['install', '--agents=cursor', '--no-modify', '--offline']);
  expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(0);
  const configPath = nodePath.join(project, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      paths: { ...config.paths, principles: '.project/approval-principles.md' },
    }),
  );
  const ticket = nodePath.join(project, '.project/tickets', folder);
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: CTX123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve current approval authority\nout_of_scope: changing approval authority\ndone_when: current context reaches review\nphase_anchors:\n  - scenario-gate: features/current-context.feature\n---\n# Ticket\n',
  );
  writeFileSync(nodePath.join(ticket, 'spec.md'), spec);
  writeFileSync(nodePath.join(ticket, 'impl-plan.md'), plan);
  writeFileSync(
    nodePath.join(project, '.project/approval-principles.md'),
    `# Principles\n\n${principle}\n`,
  );
  writeFileSync(
    nodePath.join(project, '.project/personas.md'),
    '# Personas\n\n## Builder (`BU`)\n\nBuilder needs trustworthy approvals.\n',
  );
  writeFileSync(
    nodePath.join(project, '.project/surfaces.md'),
    '# Surfaces\n\n## Safeword CLI\n\nThe public CLI approves plans.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/current-context.feature'),
    '@current-context.BU1.R1 @surface.safeword-cli\nFeature: Trust current approval\n  Scenario: Required principles reach review\n    Given current configured principles exist\n    When the Builder requests plan review\n    Then the current principles reach the reviewer\n',
  );
  const review = () =>
    run([
      'review',
      'run',
      'plan-implementation',
      `.project/tickets/${folder}/impl-plan.md`,
      '--context',
      `.project/tickets/${folder}/spec.md`,
    ]);
  return { project, capture, review };
}

describe('required context through installed planning review', () => {
  it(
    'resolves current configured principles without requiring the caller to supply them',
    { timeout: 60_000 },
    () => {
      const project = fixture();
      const result = project.review();
      expect(
        result.status,
        `installed review must resolve current configured principles\n${result.stdout}\n${result.stderr}`,
      ).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'healthy',
        data: { status: 'approved', actual_reviewer: 'claude' },
      });
      const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
      const expectedPrinciples = expect.objectContaining({
        path: '.project/approval-principles.md',
        content: expect.stringContaining(principle),
      });
      expect(packet.context_files).toEqual(expect.arrayContaining([expectedPrinciples]));
    },
  );
  it(
    'refuses a missing configured principles file before invoking the reviewer',
    { timeout: 60_000 },
    () => {
      const project = fixture();
      rmSync(nodePath.join(project.project, '.project/approval-principles.md'));
      const result = project.review();
      expect(
        result.status,
        'missing configured principles must not enter reviewer execution',
      ).not.toBe(0);
      const output = JSON.parse(result.stdout);
      const expectedMissingContext = expect.objectContaining({
        code: 'missing_planning_context',
        metadata: expect.objectContaining({
          context_role: 'principles',
          context_path: '.project/approval-principles.md',
        }),
      });
      expect(output.findings).toEqual(expect.arrayContaining([expectedMissingContext]));
      const repair = output.recovery
        .map((action: { description: string }) => action.description)
        .join('\n');
      expect(repair).toContain('paths.principles');
      expect(repair).toContain('rerun the planning review');
      expect(
        existsSync(project.capture),
        'missing configured context must block before reviewer execution',
      ).toBe(false);
      expect(output.data?.status).not.toBe('approved');
    },
  );
  it.each([
    ['personas', 'Builder needs trustworthy approvals.'],
    ['surfaces', 'The public CLI approves plans.'],
  ])('sends the current %s source through the installed reviewer packet', (role, marker) => {
    const project = fixture();
    const result = project.review();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
    const expectedSource = expect.objectContaining({
      path: `.project/${role}.md`,
      content: expect.stringContaining(marker),
    });
    expect(packet.context_files, `installed review must include current ${role}`).toEqual(
      expect.arrayContaining([expectedSource]),
    );
  });

  it.each(['personas', 'surfaces'])(
    'refuses missing %s before installed reviewer execution',
    role => {
      const project = fixture();
      rmSync(nodePath.join(project.project, '.project', `${role}.md`));
      const result = project.review();
      expect(result.status, `missing ${role} must not enter reviewer execution`).not.toBe(0);
      const output = JSON.parse(result.stdout);
      const expectedMissingContext = expect.objectContaining({
        code: 'missing_planning_context',
        metadata: { context_role: role, context_path: `.project/${role}.md` },
      });
      expect(output.findings).toEqual(expect.arrayContaining([expectedMissingContext]));
      const repair = output.recovery
        .map((action: { description: string }) => action.description)
        .join('\n');
      expect(repair).toContain(`paths.${role}`);
      expect(repair).toContain('rerun the planning review');
      expect(
        existsSync(project.capture),
        `missing ${role} must block before reviewer execution`,
      ).toBe(false);
      expect(output.data?.status).not.toBe('approved');
    },
  );
});
