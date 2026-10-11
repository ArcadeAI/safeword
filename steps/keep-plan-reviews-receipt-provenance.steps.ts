import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  admitThroughInstalledCli,
  executionPlan,
  featureFixture,
  installedReviewCli,
} from '../packages/cli/tests/fixtures/execution-review.js';
import { cleanupTrustedReviewerDirectories } from '../packages/cli/tests/review-fixtures.js';
import type { SafewordWorld } from './world.js';

// A committed pre-fix plugin can run the identical assertions as a regression control.
const pluginRoot = path.resolve(
  process.env.SAFEWORD_RECEIPT_PROOF_PLUGIN_ROOT ?? path.resolve(import.meta.dirname, '../plugin'),
);
const ticketFolder = 'ABC123-feature';
const implementation =
  '# Implementation Plan\n\n**Status:** planned\n\n## Approach\nUse the authenticated current plan review.\n\n## Decisions\nskip: No unresolved decision.\n\n## Design alignment\nskip: No additional principle trace applies.\n\n## Known deviations\nskip: No known deviations.\n\n## Assessment triggers\nRevisit when approval authority changes.\n';

interface ReceiptState {
  root: string;
  reviewer: string;
  gate?: ReturnType<typeof spawnSync>;
}
const states = new WeakMap<SafewordWorld, ReceiptState>();

Given(
  /^the Execution Plan gate receives (.+)$/,
  { timeout: 60_000 },
  async function (this: SafewordWorld, identity: string) {
    const root = featureFixture();
    const current = { root, reviewer: '' };
    states.set(this, current);
    const ticketDirectory = path.join(root, '.project', 'tickets', ticketFolder);
    writeFileSync(
      path.join(ticketDirectory, 'ticket.md'),
      '---\nid: ABC123\ntype: feature\nphase: plan-execution\n---\n',
    );
    writeFileSync(path.join(ticketDirectory, 'impl-plan.md'), implementation);
    if (identity === 'an Implementation Plan approval for the current ticket and same plan bytes') {
      const commonPlan = `${implementation}\n${executionPlan().replace(/^\*\*Status:\*\*.*\n/gmu, '')}`;
      writeFileSync(path.join(ticketDirectory, 'impl-plan.md'), commonPlan);
      writeFileSync(path.join(ticketDirectory, 'execution-plan.md'), commonPlan);
    }
    const runCli = installedReviewCli(root);
    current.reviewer = await admitThroughInstalledCli(runCli, root);
    const positive = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: path.join(root, '.review-keys'),
        },
      },
    );
    assert.equal(positive.exitCode, 0, positive.stdout);
    assert.equal(JSON.parse(positive.stdout).data.coding_authorization, 'authorized');
    if (
      identity === 'an Execution Plan approval for the current ticket and exact current plan bytes'
    )
      return;

    const ledgerPath = path.join(root, '.project', 'skill-invocations.log');
    const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n');
    let alias: string;
    if (identity === 'an Implementation Plan approval for the current ticket and same plan bytes') {
      const receipt = rows.find(row => row.includes(':phase@plan-implementation '));
      assert.ok(receipt);
      assert.equal(
        readFileSync(path.join(ticketDirectory, 'impl-plan.md'), 'utf8'),
        readFileSync(path.join(ticketDirectory, 'execution-plan.md'), 'utf8'),
      );
      alias = receipt.replace(':phase@plan-implementation ', ':phase@plan-execution ');
    } else {
      assert.equal(identity, 'an Execution Plan approval for a sibling ticket and same plan bytes');
      const sibling = 'XYZ789-feature';
      const siblingDirectory = path.join(root, '.project', 'tickets', sibling);
      cpSync(ticketDirectory, siblingDirectory, { recursive: true });
      writeFileSync(
        path.join(siblingDirectory, 'ticket.md'),
        '---\nid: XYZ789\ntype: feature\nphase: plan-execution\n---\n',
      );
      await admitThroughInstalledCli(runCli, root, ['plan-execution'], { ticketFolder: sibling });
      assert.equal(
        readFileSync(path.join(siblingDirectory, 'execution-plan.md'), 'utf8'),
        readFileSync(path.join(ticketDirectory, 'execution-plan.md'), 'utf8'),
      );
      alias = readFileSync(ledgerPath, 'utf8')
        .trim()
        .replace(`review:${sibling}:`, `review:${ticketFolder}:`);
    }
    writeFileSync(
      ledgerPath,
      `${[...rows.filter(row => !row.includes(':phase@plan-execution ')), alias].join('\n')}\n`,
    );
  },
);

When('the gate validates receipt provenance', function (this: SafewordWorld) {
  const current = states.get(this);
  assert.ok(current);
  current.gate = spawnSync('bun', [path.join(pluginRoot, 'runtime/hooks/pre-tool-quality.ts')], {
    cwd: current.root,
    encoding: 'utf8',
    timeout: 60_000,
    input: JSON.stringify({
      session_id: 'r9-receipt',
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(current.root, '.project', 'tickets', ticketFolder, 'ticket.md'),
        old_string: 'phase: plan-execution',
        new_string: 'phase: implement',
      },
    }),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      XDG_STATE_HOME: path.join(current.root, '.review-keys'),
      SAFEWORD_REVIEW_KEY_ROOT: path.join(current.root, '.review-keys'),
      PATH: `${current.reviewer}:${process.env.PATH ?? ''}`,
      CLAUDE_PROJECT_DIR: current.root,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_SESSION_ID: 'r9-receipt',
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
  });
});

Then('the matching receipt does not block the phase transition', function (this: SafewordWorld) {
  const gate = states.get(this)?.gate;
  assert.ok(gate);
  assert.equal(gate.status, 0, gate.stderr);
  assert.equal(gate.stdout.trim(), '', gate.stdout);
});

Then(
  /^the phase remains blocked with the mismatched (review kind|ticket) and re-review named$/,
  function (this: SafewordWorld, mismatch: string) {
    const current = states.get(this);
    assert.ok(current?.gate);
    assert.equal(current.gate.status, 0, current.gate.stderr);
    const result = JSON.parse(current.gate.stdout);
    assert.equal(result.hookSpecificOutput.permissionDecision, 'deny');
    const message = result.hookSpecificOutput.permissionDecisionReason;
    for (const name of mismatch === 'ticket'
      ? [ticketFolder, 'XYZ789-feature']
      : ['plan-implementation', 'plan-execution'])
      assert.ok(message.includes(name), message);
    assert.match(result.hookSpecificOutput.additionalContext, /review run plan-execution/u);
    assert.match(
      readFileSync(
        path.join(current.root, '.project', 'tickets', ticketFolder, 'ticket.md'),
        'utf8',
      ),
      /phase: plan-execution/u,
    );
  },
);

After(function (this: SafewordWorld) {
  const current = states.get(this);
  if (current) {
    rmSync(current.root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
  states.delete(this);
});
