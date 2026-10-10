import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { prepareReviewPacket } from '../packages/cli/src/review/packet.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { resolveConfiguredPath } from '../packages/cli/src/utils/configured-paths.js';
import { evaluateFeatureTicketReadiness } from '../packages/cli/templates/hooks/lib/active-ticket.js';
import { planningContractCases } from '../packages/cli/tests/fixtures/planning-contracts-eval.js';
import { runCliWithLiteralArguments } from '../packages/cli/tests/helpers.js';
import { fixtureProject } from './keep-plan-reviews-installed-context.steps.js';
import {
  nativeReviewEnvironment,
  runJudgedNativeReview,
  type NativeScopeState,
} from './keep-plan-reviews-native-scope.steps.js';
import type { SafewordWorld } from './world.js';

const folder = 'CTX123-current-context';
const states = new WeakMap<SafewordWorld, NativeScopeState>();

function productDispatch(root: string): string {
  const settings = JSON.parse(readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
  const command = settings.hooks.PreToolUse.flatMap(
    (group: { hooks: { command: string }[] }) => group.hooks,
  ).find((hook: { command: string }) => hook.command.includes('pre-tool-quality.ts')).command;
  const result = spawnSync('/bin/sh', ['-c', command], {
    cwd: root,
    env: { ...process.env, ...nativeReviewEnvironment(root) },
    encoding: 'utf8',
    timeout: 60_000,
    input: JSON.stringify({
      cwd: root,
      session_id: 'r12-native-scope',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(root, '.project/tickets', folder, 'ticket.md'),
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      },
    }),
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

Given(
  /^a Product Plan in the installed Claude Code workflow (inventories every accepted persona's consequential outcomes|omits the Non-Technical Builder's recovery outcome)$/u,
  { timeout: 60_000 },
  async function (this: SafewordWorld, inventory: string) {
    const root = fixtureProject();
    const planPath = `.project/tickets/${folder}/spec.md`;
    const caseId = inventory.startsWith('inventories')
      ? 'r16-complete-persona-outcomes'
      : 'r16-missing-persona-recovery';
    const evaluation = planningContractCases.find(item => item.id === caseId);
    assert.ok(evaluation);
    const state: NativeScopeState = {
      roots: [root],
      project: { root, planPath, input: { context: '', reviewed_plan: '' } },
      caseId,
      runs: [],
    };
    states.set(this, state);
    const installed = await runCliWithLiteralArguments(
      ['install', '--agents', 'cursor', '--offline', '--no-input', '--json', '--cwd', root],
      { cwd: root, env: nativeReviewEnvironment(root) },
    );
    assert.equal(installed.exitCode, 0, installed.stdout + installed.stderr);
    mkdirSync(path.join(root, '.claude'), { recursive: true });
    writeFileSync(
      path.join(root, '.claude/settings.json'),
      JSON.stringify(SAFEWORD_SCHEMA.jsonMerges['.claude/settings.json'].merge({})),
    );
    const configPath = path.join(root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.crossAgentReviewRoutes = { claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }] };
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(
      path.join(root, '.project/tickets', folder, 'ticket.md'),
      `---
id: CTX123
type: feature
phase: intake
status: in_progress
product_plan_contract: v1
scope: manual owner-authorized account changes for Technical Builder and Non-Technical Builder
out_of_scope: automatic migration, background mutation, batching and token disclosure
done_when: authorized changes succeed and denied changes leave the account intact for both personas
---
`,
    );
    writeFileSync(
      resolveConfiguredPath(root, 'personas'),
      '# Personas\n\n## Technical Builder (TB)\n\n**Role:** Developer using the manual account CLI.\n**Context:** Needs owner-authorized changes and recovery.\n\n## Non-Technical Builder (NTB)\n\n**Role:** Operator using the manual account CLI.\n**Context:** Needs owner-authorized changes and recovery.\n',
    );
    writeFileSync(
      resolveConfiguredPath(root, 'surfaces'),
      '# Surfaces\n\n## Account CLI\n\n**Kind:** CLI\n**Description:** Requests a manual account change and presents its receipt or refusal.\n**Audience:** Technical Builder (TB), Non-Technical Builder (NTB)\n',
    );
    const jobs = ['Technical Builder (TB)', 'Non-Technical Builder (NTB)']
      .map((persona, index) => {
        const id = `account.${index === 0 ? 'TB' : 'NTB'}1`;
        return `### ${id} — Make an owner-authorized account change
**Persona:** ${persona}
> When I request a manual account change, I want only an explicitly authorized change to take effect, so I can trust the account remains intact on refusal or failure.
#### ${id}.R1 — Preserve owner consent
The owner authorizes one target change. Absent, expired or mismatched consent permits no mutation. The receipt names the consenting owner without exposing the token.
`;
      })
      .join('\n');
    const plan = `# Product Plan: Safe manual account changes
<!-- safeword:product-plan-contract:v1 -->
## Intake Brief
Both named builders need to make a manual change safely. A refused or failed change must not alter the account. This behavior is reversible before acceptance; no shipping claim is made.
## Product Bet
- **Expected outcome:** Both accepted personas can make a safe manual account change.
- **Persona outcome inventory:** ${evaluation.reviewed_plan.replace('Non-Technical Builder recovery is absent. ', '')}
- **Known facts:** Account changes require explicit owner authorization.
- **Assumptions:** The existing consent-token API can support the approved experience.
- **Unresolved product decisions:** The exact approval copy remains with the product owner before shipping.
- **Success threshold:** Authorized changes succeed; refused or failed changes leave the account intact.
- **Project non-goals:** No automatic migration, background mutation, batching or token disclosure.
## Jobs To Be Done
${jobs}
## Shape
### M1 — Safe manual changes
- **Outcome:** Each accepted persona receives a manual authorized change or a named refusal/error.
- **Non-goals:** Automatic migration, background mutation, batching and token disclosure.
## Surfaces
Affected:
- Account CLI
`;
    writeFileSync(path.join(root, planPath), plan);
    writeFileSync(
      path.join(root, '.project/tickets', folder, 'dimensions.md'),
      '# Behavior dimensions\n\n| Dimension | Partitions |\n| --- | --- |\n| Persona | Technical Builder, Non-Technical Builder |\n| Consent | valid, refused, expired, mismatched |\n| Endpoint | success, transient failure |\n\nThese are prospective partitions for scenario definition; no scenario coverage or execution is claimed.\n',
    );
    const readiness = evaluateFeatureTicketReadiness(root, folder);
    assert.equal(readiness.ok, true, JSON.stringify(readiness.issues));
    assert.match(productDispatch(root), /deny/u, 'No review receipt exists before dispatch.');
    const packet = prepareReviewPacket(root, 'quality-review', [planPath]).packet;
    assert.equal(packet.planning_phase, 'product-plan');
    state.project.input = { context: JSON.stringify(packet), reviewed_plan: plan };
  },
);

When(
  'actual lifecycle dispatch from installed local project hooks runs its judged Product Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries',
  { timeout: 240_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    await runJudgedNativeReview(state, {
      kind: 'quality-review',
      phase: 'intake',
      dispatch: productDispatch,
    });
  },
);

Then('Product Plan approval proceeds', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  assert.ok(
    state.runs.filter(
      run =>
        run.correct &&
        run.output.verdict === 'approve' &&
        run.stampStatus === 0 &&
        !/deny/u.test(run.gate),
    ).length >= 2,
    JSON.stringify(state.runs),
  );
});

Then(
  'Product Plan approval remains blocked with the missing persona outcome named',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    assert.ok(
      state.runs.filter(
        run =>
          run.correct &&
          run.output.verdict === 'request_changes' &&
          run.stampStatus !== 0 &&
          /did not approve \(status: changes_requested\)/u.test(run.stampOutput) &&
          /deny/u.test(run.gate) &&
          run.output.findings.some(finding =>
            /Non[- ]Technical Builder.*recover|recover.*Non[- ]Technical Builder/iu.test(
              finding.message,
            ),
          ),
      ).length >= 2,
      JSON.stringify(state.runs),
    );
  },
);

After(function (this: SafewordWorld) {
  for (const root of states.get(this)?.roots ?? []) rmSync(root, { recursive: true, force: true });
  states.delete(this);
});
