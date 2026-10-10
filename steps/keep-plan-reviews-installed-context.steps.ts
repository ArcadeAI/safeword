import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { parsePlanningContract } from '../packages/cli/src/planning/phase-contract.js';
import { extractPlanReviewRubric } from '../packages/cli/src/review/plan-rubric.js';
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
  runtimeRoot?: string;
  gate?: ReturnType<typeof spawnSync>;
  authorGate?: ReturnType<typeof spawnSync>;
  reviewDispatch?: ReturnType<typeof spawnSync>;
  contractCase?: 'reviewer-drift' | 'reviewer-missing' | 'canonical';
  cosmeticContractChanged?: boolean;
  reviewStatus?: ReturnType<typeof spawnSync>;
  reviewId?: string;
}
const states = new WeakMap<SafewordWorld, InstalledContextState>();

function copiedRuntimeReviewStatus(state: InstalledContextState) {
  assert.ok(state.runtimeRoot && state.reviewId);
  return spawnSync(
    'bun',
    [path.join(state.runtimeRoot, 'runtime/cli.js'), 'review', 'status', state.reviewId, '--json'],
    {
      cwd: state.root,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${state.reviewer}:${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: state.root,
        CLAUDE_PLUGIN_ROOT: state.runtimeRoot,
        CLAUDE_SESSION_ID: 'r3-installed',
        SAFEWORD_AGENT_RUNTIME: 'claude',
      },
    },
  );
}

export function fixtureProject(): string {
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

export function reviewerExecutable(reviewer: string): void {
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
    if (state.runtimeRoot) rmSync(state.runtimeRoot, { recursive: true, force: true });
  }
  states.delete(this);
});

function establishApprovedPlanningContext(this: SafewordWorld, overrideState: string) {
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
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(root, 'claude'),
        SAFEWORD_SKIP_INSTALL: '1',
        SAFEWORD_SKIP_SKILLS: '1',
      },
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
  const state = states.get(this);
  assert.ok(state);
  state.reviewId = result.data.review_id;
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
}

Given(
  /^a planning phase with a current approving receipt has a required project-knowledge override that is (.+)$/,
  establishApprovedPlanningContext,
);

Given(
  /^a planning phase with a current approving receipt has an installed authoring contract that (.+)$/,
  function (this: SafewordWorld, contractState: string) {
    establishApprovedPlanningContext.call(this, 'current');
    const state = states.get(this);
    assert.ok(state);
    state.runtimeRoot = mkdtempSync(path.join(tmpdir(), 'safeword-r5-installed-plugin-'));
    cpSync(pluginRoot, state.runtimeRoot, { recursive: true });
    if (contractState === 'matches the exact canonical bytes') return;
    assert.equal(contractState, 'deletes one clause but retains the canonical version label');
    const contractPath = path.join(state.runtimeRoot, 'skills/bdd/PLAN_IMPLEMENTATION.md');
    const original = readFileSync(contractPath, 'utf8');
    const clause = 'Accepted scope and exclusions belong to the user.';
    assert.ok(
      original.includes(clause),
      'The installed contract must contain the canonical clause.',
    );
    writeFileSync(contractPath, original.replace(clause, ''));
  },
);

Given(
  /^the installed authoring contract (deletes one clause but retains the canonical version label|differs from the canonical source only in whitespace or comments|is absent)$/,
  function (this: SafewordWorld, contractState: string) {
    establishApprovedPlanningContext.call(this, 'current');
    const state = states.get(this);
    assert.ok(state);
    state.runtimeRoot = mkdtempSync(path.join(tmpdir(), 'safeword-r5-installed-plugin-'));
    cpSync(pluginRoot, state.runtimeRoot, { recursive: true });
    const contractPath = path.join(state.runtimeRoot, 'skills/bdd/PLAN_IMPLEMENTATION.md');
    if (contractState === 'is absent') {
      rmSync(contractPath);
      return;
    }
    const original = readFileSync(contractPath, 'utf8');
    if (contractState === 'differs from the canonical source only in whitespace or comments') {
      writeFileSync(contractPath, `<!-- editorial -->\n${original}`);
      return;
    }
    const clause = 'Accepted scope and exclusions belong to the user.';
    assert.ok(original.includes(clause));
    writeFileSync(contractPath, original.replace(clause, ''));
  },
);

Given(
  /^the (generated reviewer rubric deletes one clause but retains the canonical version label|generated reviewer rubric is absent|authoring contract and reviewer rubric both match the exact canonical bytes)$/,
  function (this: SafewordWorld, contractState: string) {
    establishApprovedPlanningContext.call(this, 'current');
    const state = states.get(this);
    assert.ok(state);
    state.runtimeRoot = mkdtempSync(path.join(tmpdir(), 'safeword-r5-installed-plugin-'));
    cpSync(pluginRoot, state.runtimeRoot, { recursive: true });
    state.contractCase =
      contractState === 'generated reviewer rubric is absent'
        ? 'reviewer-missing'
        : contractState ===
            'generated reviewer rubric deletes one clause but retains the canonical version label'
          ? 'reviewer-drift'
          : 'canonical';
    if (state.contractCase === 'canonical') return;
    const runtime = path.join(state.runtimeRoot, 'runtime/cli.js');
    const source = readFileSync(runtime, 'utf8');
    const start = source.indexOf('var PLAN_REVIEW_RUBRIC = `');
    const end = source.indexOf('PLAN_REVIEW_RUBRIC_SHA256', start);
    if (state.contractCase === 'reviewer-missing') {
      const contentStart = start + 'var PLAN_REVIEW_RUBRIC = `'.length;
      const contentEnd = source.lastIndexOf('`', end);
      assert.ok(start >= 0 && contentEnd > contentStart);
      writeFileSync(runtime, source.slice(0, contentStart) + source.slice(contentEnd));
      return;
    }
    const clause = 'Accepted scope and exclusions belong to the user.';
    const clauseIndex = source.indexOf(clause, start);
    assert.ok(start >= 0 && clauseIndex > start && clauseIndex < end);
    writeFileSync(
      runtime,
      source.slice(0, clauseIndex) + source.slice(clauseIndex + clause.length),
    );
  },
);

Given(
  'a plan review is current and its authoring guidance changed only in comments outside the canonical contract after installed copies were generated',
  function (this: SafewordWorld) {
    establishApprovedPlanningContext.call(this, 'current');
    const state = states.get(this);
    assert.ok(state);
    state.runtimeRoot = mkdtempSync(path.join(tmpdir(), 'safeword-r5-cosmetic-plugin-'));
    cpSync(pluginRoot, state.runtimeRoot, { recursive: true });
    const baseline = copiedRuntimeReviewStatus(state);
    assert.equal(baseline.status, 0, `${baseline.stdout}\n${baseline.stderr}`);
    assert.equal(
      (JSON.parse(baseline.stdout) as { data?: { status?: string } }).data?.status,
      'approved',
    );
    const installed = path.join(state.runtimeRoot, 'skills/bdd/PLAN_IMPLEMENTATION.md');
    const template = path.join(state.runtimeRoot, 'templates/skills/bdd/PLAN_IMPLEMENTATION.md');
    const oldBytes = readFileSync(installed);
    const oldHash = createHash('sha256').update(oldBytes).digest('hex');
    const newBytes = Buffer.concat([oldBytes, Buffer.from('\n<!-- editorial -->\n')]);
    const newHash = createHash('sha256').update(newBytes).digest('hex');
    assert.equal(
      extractPlanReviewRubric(newBytes.toString('utf8')),
      extractPlanReviewRubric(oldBytes.toString('utf8')),
    );
    const originalTemplate = readFileSync(template, 'utf8');
    const changedTemplate = `${originalTemplate}\n<!-- editorial -->\n`;
    assert.deepEqual(
      parsePlanningContract('plan-implementation', changedTemplate),
      parsePlanningContract('plan-implementation', originalTemplate),
    );
    writeFileSync(template, changedTemplate);
    const runtime = path.join(state.runtimeRoot, 'runtime/cli.js');
    const source = readFileSync(runtime, 'utf8');
    const authorIdentity = `relativePath: "skills/bdd/PLAN_IMPLEMENTATION.md", sha256: "${oldHash}"`;
    assert.ok(
      source.includes(authorIdentity),
      'the installed runtime must name the old author copy',
    );
    writeFileSync(
      runtime,
      source.replace(authorIdentity, authorIdentity.replace(oldHash, newHash)),
    );
    state.cosmeticContractChanged = true;
  },
);

When(
  'the content identity of every generated contract copy is recomputed',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.runtimeRoot);
    const hook = path.join(state.runtimeRoot, 'runtime/hooks/pre-tool-quality.ts');
    state.authorGate = spawnSync('bun', [hook], {
      cwd: state.root,
      encoding: 'utf8',
      timeout: 60_000,
      input: JSON.stringify({
        session_id: 'r3-installed',
        tool_name: 'Edit',
        tool_input: {
          file_path: path.join(state.root, ticketRoot, 'impl-plan.md'),
          old_string: 'Use the current review receipt',
          new_string: 'Use the authenticated current review receipt',
        },
      }),
      env: {
        ...process.env,
        PATH: `${state.reviewer}:${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: state.root,
        CLAUDE_PLUGIN_ROOT: state.runtimeRoot,
        CLAUDE_SESSION_ID: 'r3-installed',
      },
    });
    state.gate = spawnSync('bun', [hook], {
      cwd: state.root,
      encoding: 'utf8',
      timeout: 60_000,
      input: JSON.stringify({
        session_id: 'r3-installed',
        tool_name: 'Edit',
        tool_input: {
          file_path: path.join(state.root, ticketRoot, 'ticket.md'),
          old_string: 'phase: plan-implementation',
          new_string: 'phase: plan-execution',
        },
      }),
      env: {
        ...process.env,
        PATH: `${state.reviewer}:${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: state.root,
        CLAUDE_PLUGIN_ROOT: state.runtimeRoot,
        CLAUDE_SESSION_ID: 'r3-installed',
      },
    });
    if (state.contractCase) {
      state.reviewDispatch = spawnSync(
        'bun',
        [
          path.join(state.runtimeRoot, 'runtime/cli.js'),
          'review',
          'run',
          'plan-implementation',
          `${ticketRoot}/impl-plan.md`,
          '--json',
          '--no-input',
        ],
        {
          cwd: state.root,
          encoding: 'utf8',
          timeout: 60_000,
          env: {
            ...process.env,
            PATH: `${state.reviewer}:${process.env.PATH ?? ''}`,
            CLAUDE_PROJECT_DIR: state.root,
            CLAUDE_PLUGIN_ROOT: state.runtimeRoot,
            CLAUDE_SESSION_ID: 'r3-installed',
            SAFEWORD_AGENT_RUNTIME: 'claude',
          },
        },
      );
    }
  },
);

Then(
  /^authoring and approval are blocked until (?:the exact canonical contract bytes|the canonical contract) (?:are|is) restored$/,
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.authorGate && state.gate);
    for (const result of [state.authorGate, state.gate]) {
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout) as {
        hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
      };
      assert.equal(output.hookSpecificOutput?.permissionDecision, 'deny');
      assert.match(
        output.hookSpecificOutput?.permissionDecisionReason ?? '',
        /(?:canonical_contract_copy_mismatch|missing_generated_contract_copy)/,
      );
    }
  },
);

Then(
  /^review dispatch and approval are blocked until (?:the exact canonical contract bytes|the canonical contract) (?:are|is) restored$/,
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.reviewDispatch && state.gate);
    assert.notEqual(state.reviewDispatch.status, 0);
    const dispatch = JSON.parse(state.reviewDispatch.stdout) as {
      findings?: Array<{ code?: string; message?: string }>;
    };
    assert.ok(
      dispatch.findings?.some(finding =>
        /reviewer contract|canonical contract/.test(finding.message ?? ''),
      ),
      state.reviewDispatch.stdout,
    );
    assert.equal(state.gate.status, 0, state.gate.stderr);
    assert.notEqual(state.gate.stdout.trim(), '', 'approval gate allowed a stale reviewer copy');
    const approval = JSON.parse(state.gate.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    assert.equal(approval.hookSpecificOutput?.permissionDecision, 'deny');
    const code = 'canonical_contract_copy_mismatch';
    assert.match(
      dispatch.findings?.find(finding => finding.code === code)?.message ?? '',
      /Restore the packaged decision-quality contract/,
    );
    assert.match(
      approval.hookSpecificOutput?.permissionDecisionReason ?? '',
      /Restore the packaged decision-quality contract/,
    );
    assert.ok(
      dispatch.findings?.some(finding => finding.code === code),
      state.reviewDispatch.stdout,
    );
    assert.match(
      approval.hookSpecificOutput?.permissionDecisionReason ?? '',
      new RegExp(`${code}.*plan-rubric\\.generated\\.ts`, 'su'),
    );
  },
);

Then(
  'both copies recompute to the same identity and contract identity does not block authoring, dispatch, or approval',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.authorGate && state.reviewDispatch && state.gate);
    assert.equal(state.authorGate.status, 0, state.authorGate.stderr);
    assert.equal(state.authorGate.stdout.trim(), '', state.authorGate.stdout);
    assert.equal(state.reviewDispatch.status, 0, state.reviewDispatch.stdout);
    assert.equal(state.gate.status, 0, state.gate.stderr);
    assert.equal(state.gate.stdout.trim(), '', state.gate.stdout);
  },
);

When(
  'actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const ticketPath = path.join(state.root, ticketRoot, 'ticket.md');
    const hook = path.join(state.runtimeRoot ?? pluginRoot, 'runtime/hooks/pre-tool-quality.ts');
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
        CLAUDE_PLUGIN_ROOT: state.runtimeRoot ?? pluginRoot,
        CLAUDE_SESSION_ID: 'r3-installed',
        SAFEWORD_AGENT_RUNTIME: 'claude',
      },
    });
    if (state.cosmeticContractChanged) {
      state.reviewStatus = copiedRuntimeReviewStatus(state);
    }
  },
);

Then('the phase transition proceeds', function (this: SafewordWorld) {
  if (this.nativePlanningGate) {
    const { host, output } = this.nativePlanningGate;
    if (host === 'Cursor') assert.equal(JSON.parse(output).permission, 'allow', output);
    else assert.equal(output, '', output);
    return;
  }
  const gate = states.get(this)?.gate;
  assert.ok(gate);
  assert.equal(gate.status, 0, `${gate.stdout}\n${gate.stderr}`);
  assert.equal(gate.stdout.trim(), '', gate.stdout);
});

Then(
  'the phase remains blocked with canonical contract reconciliation named',
  function (this: SafewordWorld) {
    const gate = states.get(this)?.gate;
    assert.ok(gate);
    assert.equal(gate.status, 0, gate.stderr);
    const output = JSON.parse(gate.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    assert.equal(output.hookSpecificOutput?.permissionDecision, 'deny');
    const reason = output.hookSpecificOutput?.permissionDecisionReason ?? '';
    assert.ok(
      reason.includes('canonical_contract_copy_mismatch'),
      `Canonical contract reconciliation was not named at the installed phase gate. Actual reason: ${reason}`,
    );
    assert.ok(
      reason.includes('skills/bdd/PLAN_IMPLEMENTATION.md'),
      `The installed authoring contract path was not named at the phase gate. Actual reason: ${reason}`,
    );
  },
);

Then(
  'the review receipt remains current and the phase remains blocked with canonical contract reconciliation named',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.reviewStatus && state.gate);
    assert.equal(
      state.reviewStatus.status,
      0,
      `cosmetic canonical copy drift incorrectly staled review: ${state.reviewStatus.stdout}\n${state.reviewStatus.stderr}`,
    );
    const status = JSON.parse(state.reviewStatus.stdout) as { data?: { status?: string } };
    assert.equal(status.data?.status, 'approved');
    assert.equal(state.gate.status, 0, state.gate.stderr);
    const gate = JSON.parse(state.gate.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    assert.equal(gate.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(
      gate.hookSpecificOutput?.permissionDecisionReason ?? '',
      /canonical_contract_copy_mismatch.*skills\/bdd\/PLAN_IMPLEMENTATION\.md/su,
    );
  },
);

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
