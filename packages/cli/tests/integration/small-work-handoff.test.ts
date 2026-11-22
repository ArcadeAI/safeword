import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { consequentialDecisions } from '../../templates/hooks/lib/small-work-classification.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  ticketFolderBySlug,
  ticketIdBySlug,
} from '../helpers.js';

it('hands off a small patch with current proof and a named human dependency', async () => {
  const fixture = createTemporaryDirectory();
  try {
    const project = nodePath.join(fixture, 'project');
    mkdirSync(project);
    const env = { SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(fixture, 'keys') };
    const run = (args: string[]) => runCli([...args, '--json'], { cwd: project, env });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q');
    const facts = {
      schemaVersion: 1,
      scope: 'Correct wording in the guide',
      outcome: 'The guide heading reads Setup',
      decisions: Object.fromEntries(consequentialDecisions.map(decision => [decision, 'settled'])),
      introducesUserFlow: false,
      multipleUserFlows: false,
      newPersistentState: false,
      changesSharedContract: false,
      changesBehavior: false,
      verification: 'targeted',
    };
    const slug = 'correct-guide-heading';
    const created = await run(['ticket', 'new', slug, '--small-work-facts', JSON.stringify(facts)]);
    expect(created.exitCode, created.stderr || created.stdout).toBe(0);
    const id = ticketIdBySlug(project, slug);
    const folder = ticketFolderBySlug(project, slug);
    const ticket = nodePath.join(folder, 'ticket.md');
    const text = readFileSync(ticket, 'utf8');
    expect(text).toContain('## Delivery Checklist');

    writeFileSync(nodePath.join(project, 'guide.md'), '# Setup\n');
    writeFileSync(
      nodePath.join(project, 'check-guide.ts'),
      String.raw`import { readFileSync } from 'node:fs';
if (!readFileSync('guide.md', 'utf8').startsWith('# Setup\n')) process.exitCode = 1;
`,
    );
    const invocation = JSON.stringify({
      type: 'command',
      cwd: '.',
      argv: ['bun', 'check-guide.ts'],
    });
    const specs = [
      '## Proof specifications',
      '',
      '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| targeted-verification | command | integration | Read the delivered guide | real_boundary | current_required | ${invocation} |`,
      '',
      '',
    ].join('\n');
    const dependency =
      '| rollout | rollout and rollback | Approve distribution | human | | pending_human | missing | | Release owner approves distribution. |';
    const withChecklist = text.replace(
      '## Delivery Checklist',
      () => `${specs}## Delivery Checklist`,
    );
    writeFileSync(ticket, `${withChecklist.trimEnd()}\n${dependency}\n`);
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'patch candidate',
    );
    const open = await run(['ticket', 'delivery-checklist', id]);
    expect(open.exitCode).toBe(2);
    const proof = await run([
      'ticket',
      'record-delivery-proof',
      id,
      'verification',
      'targeted-verification',
    ]);
    expect(proof.exitCode, proof.stderr || proof.stdout).toBe(0);

    const handoff = await run(['ticket', 'delivery-checklist', id]);
    expect(handoff.exitCode, handoff.stderr || handoff.stdout).toBe(0);
    expect(JSON.parse(handoff.stdout)).toMatchObject({
      data: {
        readiness_state: 'ready_for_human_review',
        open_contributor_items: [],
        pending_human_items: ['rollout'],
        grants_merge_authority: false,
      },
    });
    writeFileSync(nodePath.join(project, 'guide.md'), '# Different heading\n');
    const stale = await run(['ticket', 'delivery-checklist', id]);
    expect(stale.exitCode).toBe(2);
    expect(JSON.parse(stale.stdout)).toMatchObject({
      data: { open_contributor_items: ['verification'] },
    });
  } finally {
    removeTemporaryDirectory(fixture);
  }
}, 60_000);
