import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    expect(text).toMatch(/^type: patch$/m);
    expect(text).toContain('## Delivery Checklist');

    const guide = nodePath.join(project, 'guide.md');
    const originalGuide = '# Setpu\n\n[Go to setup](#setup)\n';
    writeFileSync(guide, originalGuide);
    writeFileSync(
      nodePath.join(project, 'check-guide.ts'),
      `import { readFileSync, writeFileSync } from 'node:fs';
const html = Bun.markdown.render(readFileSync('guide.md', 'utf8'), {
  heading: (text, { level }) => '<h' + level + ' id="' + text.toLowerCase() + '">' + text + '</h' + level + '>',
  paragraph: text => '<p>' + text + '</p>',
  link: (text, { href }) => '<a href="' + href + '">' + text + '</a>',
});
if (process.argv.includes('--render')) writeFileSync('guide.html', html);
if (html !== readFileSync('guide.html', 'utf8')) throw new Error('Rendered guide is stale');
const anchors = new Set();
const fragments = [];
new HTMLRewriter()
  .on('[id]', { element: element => anchors.add(element.getAttribute('id')) })
  .on('a[href^="#"]', { element: element => fragments.push(element.getAttribute('href').slice(1)) })
  .transform(html);
if (fragments.length !== 1 || fragments.some(id => !anchors.has(id))) {
  throw new Error('Broken link in rendered guide: ' + fragments.join(', '));
}
`,
    );
    const renderAndCheck = () =>
      spawnSync('bun', ['check-guide.ts', '--render'], { cwd: project, encoding: 'utf8' });
    const broken = renderAndCheck();
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain('Broken link in rendered guide: setup');
    writeFileSync(guide, originalGuide.replace('Setpu', 'Setup'));
    const fixed = renderAndCheck();
    expect(fixed.status, fixed.stderr).toBe(0);
    expect(readFileSync(nodePath.join(project, 'guide.html'), 'utf8')).toContain(
      '<h1 id="setup">Setup</h1>',
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
      `| targeted-verification | command | integration | Render Markdown and check the actual heading link | real_boundary | current_required | ${invocation} |`,
      '',
      '',
    ].join('\n');
    const dispositions = [
      '| tests | testing | Run executable behavior tests | contributor | | not_applicable | missing | | Executable behavior did not change. |',
      '| monitoring | monitoring and failure signals | Monitor the deployment | contributor | | not_applicable | missing | | No runtime changed. |',
      '| rollout | rollout and rollback | Approve distribution | human | | pending_human | missing | | Release owner approves distribution. |',
    ];
    const renderLink = nodePath.relative(folder, nodePath.join(project, 'guide.html'));
    const withChecklist = text
      .replace('## Delivery Checklist', () => `${specs}## Delivery Checklist`)
      .replace(
        '| verification | testing | Verify the agreed outcome at its existing boundary |',
        () =>
          `| verification | documentation | Verify the [corrected rendered guide](${renderLink}#setup) |`,
      );
    writeFileSync(ticket, `${withChecklist.trimEnd()}\n${dispositions.join('\n')}\n`);
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
    const handoffTicket = readFileSync(ticket, 'utf8');
    expect(handoffTicket).toContain(`[corrected rendered guide](${renderLink}#setup)`);
    expect(handoffTicket).toContain('Executable behavior did not change.');
    expect(handoffTicket).toContain('No runtime changed.');
    expect(readdirSync(folder)).toEqual(['ticket.md']);
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
