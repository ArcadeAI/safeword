import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];

function capturedClaudeAuthorModel(project: string, model: string): string {
  const envFile = nodePath.join(project, 'claude-session.env');
  const started = spawnSync(
    'bun',
    [nodePath.join(project, '.safeword/hooks/session-author-model.ts')],
    {
      cwd: project,
      encoding: 'utf8',
      input: JSON.stringify({ hook_event_name: 'SessionStart', model }),
      env: { ...process.env, CLAUDE_ENV_FILE: envFile },
    },
  );
  expect(started.status, started.stderr).toBe(0);
  const captured = /^SAFEWORD_AUTHOR_MODEL=(.+)$/mu.exec(readFileSync(envFile, 'utf8'))?.[1];
  expect(captured).toBe(model);
  return captured ?? '';
}

function confirmedCodexReviewer(invoked: string): string {
  return String.raw`#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('codex 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(process.argv.includes('app-server') ? '--stdio --config' : ${JSON.stringify(REVIEWER_CAPABILITIES.codex)}); process.exit(0); }
writeFileSync(${JSON.stringify(invoked)}, 'yes');
let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; let end; while ((end = input.indexOf('\n')) !== -1) { const message = JSON.parse(input.slice(0, end)); input = input.slice(end + 1); if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} })); if (message.id === 2) console.log(JSON.stringify({ id: 2, result: { thread: { id: 'thread-1' }, model: message.params.model, modelProvider: 'openai' } })); if (message.id === 3) { const prompt = message.params.input[0].text; const packet = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1)); const output = { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'codex', verdict: 'approve', summary: 'Reviewer approval.', findings: [{ severity: 'warning', message: 'Check the migration note.' }], evidence_records: { schema_version: 1, records: [] } }; console.log(JSON.stringify({ id: 3, result: { turn: { id: 'turn-1' } } })); console.log(JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', items: [{ type: 'agentMessage', phase: 'final_answer', text: JSON.stringify(output) }] } } })); } } });
`;
}

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

function expectCapabilityFinding(
  output: {
    readonly data: Record<string, unknown>;
    readonly findings: readonly { readonly code: string }[];
  },
  qualified: boolean,
  unknownAuthor: boolean,
): void {
  if (qualified) {
    expect(output.data.capability_failure).toBeUndefined();
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'REVIEW_INDEPENDENCE' }),
    );
    return;
  }
  expect(output.findings).toContainEqual(
    expect.objectContaining({
      code: unknownAuthor ? 'AUTHOR_CAPABILITY_UNKNOWN' : 'REVIEWER_CAPABILITY_UNKNOWN',
    }),
  );
}

it.each([
  ['codex', 'prefer', undefined, false],
  ['codex', 'require', undefined, false],
  ['cursor', 'prefer', undefined, false],
  ['cursor', 'require', undefined, false],
  ['opencode', 'prefer', undefined, false],
  ['opencode', 'require', undefined, false],
  ['claude', 'prefer', undefined, false],
  ['claude', 'require', undefined, false],
  ['claude', 'prefer', 'claude-opus-5', false],
  ['claude', 'require', 'claude-opus-5', false],
  ['claude', 'prefer', 'claude-opus-5', true],
  ['claude', 'require', 'claude-opus-5', true],
] as const)(
  'labels a %s-authored planning review under %s with author model %s and confirmed reviewer %s',
  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- The host matrix keeps routing and admission assertions on one installed fixture.
  async (author, policy, authorModel, confirmedReviewer) => {
    const reviewerAgent = author === 'claude' ? 'codex' : 'claude';
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
    const configPath = nodePath.join(project, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReview: policy,
        crossAgentReviewRoutes: {
          [author]: [
            { reviewer: reviewerAgent, ...(confirmedReviewer && { model: 'gpt-6-astra' }) },
          ],
        },
      }),
    );
    const ticket = '.project/tickets/AUT123-unknown-author-capability';
    mkdirSync(nodePath.join(project, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(project, ticket, 'ticket.md'),
      '---\nid: AUT123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: anonymous approval\ndone_when: unknown author capability is explicit\nphase_anchors:\n  - scenario-gate: features/author-capability.feature\n---\n',
    );
    writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    writeFileSync(
      nodePath.join(project, ticket, 'impl-plan.md'),
      '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve authenticated approval.\n\n## Decisions\n\nUse the current review receipt.\n\n## Design alignment\n\nEnsure independent review is attempted first.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
    );
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(project, 'features/author-capability.feature'),
      `@author-capability.BU1.R1\nFeature: Capability truth\n  Scenario: Unverified capability\n    Given the author model is ${authorModel ?? 'unknown'}\n    When a different reviewer approves\n    Then independence remains unverified\n`,
    );
    const reviewer = createTrustedReviewerDirectory('safeword-author-capability-');
    const invoked = nodePath.join(reviewer, 'invoked');
    writeFileSync(
      nodePath.join(reviewer, reviewerAgent),
      confirmedReviewer
        ? confirmedCodexReviewer(invoked)
        : `#!${process.execPath}\nconst { writeFileSync } = require('node:fs');\nif (process.argv.includes('--version')) { console.log('${reviewerAgent} 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES[reviewerAgent])}); process.exit(0); }\nwriteFileSync(${JSON.stringify(invoked)}, 'yes');\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); const output = { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: '${reviewerAgent}', verdict: 'approve', summary: 'Reviewer approval.', findings: [{ severity: 'warning', message: 'Check the migration note.' }], evidence_records: { schema_version: 1, records: [] } }; if ('${reviewerAgent}' === 'claude') { console.log(JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5' } })); console.log(JSON.stringify({ type: 'result', subtype: 'success', structured_output: output, modelUsage: { 'claude-opus-5': { canonicalModel: 'claude-opus-5', provider: 'firstParty' } } })); } else console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } })); });\n`,
      { mode: 0o755 },
    );
    const reviewed = await runCli(
      [
        'review',
        'run',
        'plan-implementation',
        `${ticket}/impl-plan.md`,
        '--context',
        `${ticket}/spec.md`,
        '--cwd',
        project,
        '--json',
        '--no-input',
      ],
      {
        cwd: project,
        env: {
          PATH: `${reviewer}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: author,
          SAFEWORD_NO_UPDATE_CHECK: '1',
          ...(author === 'claude' &&
            authorModel !== undefined && {
              SAFEWORD_AUTHOR_MODEL: capturedClaudeAuthorModel(project, authorModel),
            }),
        },
      },
    );
    const output = JSON.parse(reviewed.stdout);
    const unknownAuthor = authorModel === undefined;
    const qualified = authorModel !== undefined && confirmedReviewer;
    const admitted = qualified || (unknownAuthor && policy === 'prefer');
    const continuationRequired =
      author === 'claude' && policy === 'prefer' && authorModel !== undefined && !confirmedReviewer;
    let expectedStatus = admitted ? 'approved' : 'blocked';
    if (continuationRequired) expectedStatus = 'continuation_required';
    expect(reviewed.exitCode).toBe(admitted ? 0 : 2);
    expect(output.state).toBe(admitted ? 'healthy' : 'action_required');
    expect(output.data).toMatchObject({
      status: expectedStatus,
      independence: admitted ? 'reduced' : 'none',
      ...(qualified && { independence: 'cross-agent' }),
      ...(!continuationRequired && { actual_reviewer: reviewerAgent }),
      ...(reviewerAgent === 'claude' && {
        confirmed_reviewer_model: { provider: 'anthropic', model: 'claude-opus-5' },
      }),
      ...(!qualified &&
        !continuationRequired && {
          capability_failure: unknownAuthor
            ? 'author_capability_unknown'
            : 'reviewer_capability_unknown',
        }),
    });
    if (continuationRequired) {
      expect(output.data.continuation).toMatchObject({ tier: 'fresh-context' });
      expect(output.data.review_routes).toContainEqual(
        expect.objectContaining({ failure: 'reviewer_capability_unknown' }),
      );
    }
    if (author === 'cursor') expect(output.data.review_routes).toHaveLength(1);
    if (!continuationRequired) expectCapabilityFinding(output, qualified, unknownAuthor);
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'REVIEWER_FINDING', message: 'Check the migration note.' }),
    );
    expect(existsSync(invoked)).toBe(true);
  },
);
