import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { writePlanningInventories } from '../packages/cli/tests/planning-fixtures.js';
import {
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../packages/cli/tests/review-fixtures.js';
import type { SafewordWorld } from './world.js';

const packageRoot = path.resolve(import.meta.dirname, '../packages/cli');
const pluginRoot = path.resolve(import.meta.dirname, '../plugin');
const ticketFolder = 'CTX123-current-context';
const ticketRoot = `.project/tickets/${ticketFolder}`;

interface InstalledContextState {
  root: string;
  reviewer: string;
  overrideState: string;
  gate?: ReturnType<typeof spawnSync>;
}
const states = new WeakMap<SafewordWorld, InstalledContextState>();

function fixtureProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-r3-installed-'));
  writePlanningInventories(root);
  mkdirSync(path.join(root, ticketRoot), { recursive: true });
  mkdirSync(path.join(root, 'features'));
  writeFileSync(path.join(root, 'package.json'), '{"name":"r3-installed","private":true}\n');
  writeFileSync(
    path.join(root, ticketRoot, 'ticket.md'),
    `---\nid: CTX123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve authenticated approval\nout_of_scope: new approval authority\ndone_when: current context reaches review\nphase_anchors:\n  - scenario-gate: features/current-context.feature\n---\n# Ticket\n`,
  );
  writeFileSync(
    path.join(root, ticketRoot, 'spec.md'),
    `# Product Plan: Preserve approval\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Expected outcome:** Builders advance with current approval.\n- **Persona outcome inventory:** Builder receives approval or a named refusal.\n- **Known facts:** Approval authenticates the current source.\n- **Assumptions:** Review latency is acceptable.\n- **Unresolved product decisions:** none\n- **Success threshold:** Current approval advances.\n- **Project non-goals:** No new approval authority.\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust approval\n\n**Persona:** Builder (BU)\n\n> When I request approval, I want current evidence, so I can trust advancement.\n\n#### approval.BU1.R1 — Preserve approval\n\nOnly current approval advances.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n`,
  );
  writeFileSync(
    path.join(root, ticketRoot, 'impl-plan.md'),
    `# Implementation Plan: Preserve approval\n\n**Status:** planned\n\n## Approach\n\nUse the current review receipt to guard the transition.\n\n## Decisions\n\n### Recorded Decisions\n\n| Decision | Choice | Alternatives considered | Rejected because |\n| --- | --- | --- | --- |\n| review gate | current receipt | unchecked transition | stale approval can advance |\n\n## Design alignment\n\nskip: No additional principle trace applies to this fixture.\n\n## Architecture applicability\n\nskip: No durable architecture record applies.\n\n## Data applicability\n\nskip: No product data is stored.\n\n## Known deviations\n\nskip: No known deviations.\n\n## Doc impact\n\nskip: No documentation changes.\n\n## Assessment triggers\n\nRevisit when the approval authority changes.\n`,
  );
  writeFileSync(
    path.join(root, 'features/current-context.feature'),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust current approval\n  Scenario: Approval\n    Given a current review\n    When the Builder requests approval\n    Then the current context reaches review\n',
  );
  return root;
}

function configure(root: string, override: string): void {
  const configPath = path.join(root, '.safeword/config.json');
  const installed = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(
    configPath,
    JSON.stringify({
      ...installed,
      reviewGate: true,
      crossAgentReview: 'prefer',
      crossAgentReviewRoutes: { claude: [{ reviewer: 'opencode' }] },
      paths: { ...(installed.paths as Record<string, unknown>), principles: override },
      pathLineage: { principles: { packagedSourceVersion: SAFEWORD_SCHEMA.version } },
    }),
  );
}

function reviewerExecutable(reviewer: string): void {
  writeFileSync(
    path.join(reviewer, 'opencode'),
    String.raw`#!${process.execPath}
if (process.argv.includes('--version')) { console.log('opencode 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.opencode)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  const output = { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'opencode', verdict: 'approve', summary: 'Current plan approved.',
    findings: [], evidence_records: { schema_version: 1, records: [] } };
  console.log(JSON.stringify({ type: 'text', part: { type: 'text', time: { end: 1 }, text: JSON.stringify(output) } }));
});
`,
    { mode: 0o755 },
  );
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(state.reviewer, { recursive: true, force: true });
  }
  states.delete(this);
});

Given(
  /^a planning phase with a current approving receipt has a required project-knowledge override that is (.+)$/,
  function (this: SafewordWorld, overrideState: string) {
    const root = fixtureProject();
    const reviewer = createTrustedReviewerDirectory('safeword-r3-reviewer-');
    states.set(this, { root, reviewer, overrideState });
    const install = spawnSync(
      'bun',
      [
        path.join(packageRoot, 'src/cli.ts'),
        'install',
        '--agents=claude',
        '--no-input',
        '--no-modify',
        '--json',
        '--cwd',
        root,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
      },
    );
    const installOutput = JSON.parse(install.stdout) as { errors: unknown[] };
    assert.deepEqual(installOutput.errors, [], `${install.stdout}\n${install.stderr}`);
    const override = 'docs/principles.md';
    mkdirSync(path.join(root, 'docs'));
    writeFileSync(path.join(root, override), '# Project principles\n\nKeep approval current.\n');
    configure(root, override);
    reviewerExecutable(reviewer);
    const environment = {
      ...process.env,
      PATH: `${reviewer}:${process.env.PATH ?? ''}`,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_SESSION_ID: 'r3-installed',
      SAFEWORD_AGENT_RUNTIME: 'claude',
    };
    const reviewed = spawnSync(
      'bun',
      [
        path.join(packageRoot, 'src/cli.ts'),
        'review',
        'run',
        'plan-implementation',
        `${ticketRoot}/impl-plan.md`,
        '--json',
        '--no-input',
      ],
      { cwd: root, encoding: 'utf8', timeout: 60_000, env: environment },
    );
    assert.equal(reviewed.status, 0, `${reviewed.stdout}\n${reviewed.stderr}`);
    const result = JSON.parse(reviewed.stdout) as { data: { status: string; review_id: string } };
    assert.equal(result.data.status, 'approved');
    const stamp = spawnSync(
      'bun',
      [
        path.join(pluginRoot, 'runtime/hooks/write-review-stamp.ts'),
        '--ticket',
        ticketFolder,
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'opencode',
        '--independence',
        'reduced',
        '--review-id',
        result.data.review_id,
        'impl-plan',
      ],
      { cwd: root, encoding: 'utf8', timeout: 60_000, env: environment },
    );
    assert.equal(stamp.status, 0, `${stamp.stdout}\n${stamp.stderr}`);
    const phaseStamp = spawnSync(
      'bun',
      [
        path.join(pluginRoot, 'runtime/hooks/write-review-stamp.ts'),
        '--ticket',
        ticketFolder,
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'opencode',
        '--independence',
        'reduced',
        '--review-id',
        result.data.review_id,
        '--phase',
        'plan-implementation',
      ],
      { cwd: root, encoding: 'utf8', timeout: 60_000, env: environment },
    );
    assert.equal(phaseStamp.status, 0, `${phaseStamp.stdout}\n${phaseStamp.stderr}`);
    const current = spawnSync(
      'bun',
      [path.join(packageRoot, 'src/cli.ts'), 'review', 'status', result.data.review_id, '--json'],
      { cwd: root, encoding: 'utf8', timeout: 60_000, env: environment },
    );
    const currentStatus = JSON.parse(current.stdout) as { data: { status: string } };
    assert.equal(currentStatus.data.status, 'approved', `${current.stdout}\n${current.stderr}`);
    if (overrideState === 'blank') writeFileSync(path.join(root, override), ' \n');
    if (overrideState.startsWith('stale')) {
      const configPath = path.join(root, '.safeword/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(
        configPath,
        JSON.stringify({
          ...config,
          pathLineage: { principles: { packagedSourceVersion: '0.0.0' } },
        }),
      );
    }
  },
);

When(
  'actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const ticketPath = path.join(state.root, ticketRoot, 'ticket.md');
    const hook = path.join(pluginRoot, 'runtime/hooks/pre-tool-quality.ts');
    assert.ok(existsSync(hook));
    state.gate = spawnSync('bun', [hook], {
      cwd: state.root,
      encoding: 'utf8',
      timeout: 60_000,
      input: JSON.stringify({
        session_id: 'r3-installed',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketPath,
          old_string: 'phase: plan-implementation',
          new_string: 'phase: plan-execution',
        },
      }),
      env: {
        ...process.env,
        PATH: `${state.reviewer}:${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: state.root,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_SESSION_ID: 'r3-installed',
      },
    });
  },
);

Then('the phase transition proceeds', function (this: SafewordWorld) {
  const gate = states.get(this)?.gate;
  assert.ok(gate);
  assert.equal(gate.status, 0, `${gate.stdout}\n${gate.stderr}`);
  assert.equal(gate.stdout.trim(), '', gate.stdout);
});

Then(
  'the phase remains blocked with override reconciliation named',
  function (this: SafewordWorld) {
    const state = states.get(this);
    const gate = state?.gate;
    assert.ok(gate);
    assert.ok(state);
    assert.equal(gate.status, 0, gate.stderr);
    const output = JSON.parse(gate.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    assert.equal(output.hookSpecificOutput?.permissionDecision, 'deny');
    const reason = output.hookSpecificOutput?.permissionDecisionReason ?? '';
    const expected =
      state.overrideState === 'blank'
        ? 'Planning principles override at docs/principles.md needs reconciliation with the current packaged source.'
        : 'Planning principles override at .safeword/config.json:pathLineage.principles needs reconciliation with the current packaged source.';
    assert.ok(
      reason.includes(expected),
      `Override reconciliation was not named at the installed phase gate. Actual reason: ${reason}`,
    );
  },
);
