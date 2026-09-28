import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const roots: string[] = [];
const ticketId = 'DIS123';
const folder = `.project/tickets/${ticketId}-review-disposition`;
const target = `${folder}/spec.md`;
const suggestion = 'Consider adding an optional approval audit export.';
const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function reviewedProject() {
  const root = createTemporaryDirectory();
  roots.push(root);
  await createConfiguredProject(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  const ticketPath = nodePath.join(root, folder, 'ticket.md');
  writeFileSync(
    ticketPath,
    `---\nid: ${ticketId}\ntype: feature\nproduct_plan_contract: v1\nscope:\n  - preserve current approval\nout_of_scope:\n  - optional audit export\n---\n`,
  );
  writeFileSync(
    nodePath.join(root, target),
    `# Product Plan

## Product Bet

- **Expected outcome:** Builder can trust current approval.
- **Persona outcome inventory:** Builder receives current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review remains available.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No optional audit export.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

## Shape

### M1 — Current approval

- **Outcome:** Review is current.
- **Non-goals:** Optional audit export.

## Surfaces

Affected:
- Safeword CLI
`,
  );
  const reviewer = createTrustedReviewerDirectory('safeword-disposition-');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    String.raw`#!${process.execPath}
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  console.log(JSON.stringify({ structured_output: {
    schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    verdict: 'approve',
    summary: packet.review_disposition_context?.records[0]
      ? 'The user decline for ' + packet.review_disposition_context.records[0].message + ' is ' + packet.review_disposition_context.records[0].boundary_status + ' in ticket context.'
      : 'The accepted boundary remains intact.',
    findings: [{ severity: 'warning', message: ${JSON.stringify(suggestion)} }],
  } }));
});
`,
    { mode: 0o755 },
  );
  const run = (args: string[]) =>
    runCli([...args, '--cwd', root, '--json', '--no-input'], {
      cwd: root,
      env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' },
    });
  const reviewed = await run(['review', 'run', 'quality-review', target]);
  expect(reviewed.exitCode, `${reviewed.stdout}\n${reviewed.stderr}`).toBe(0);
  const data = JSON.parse(reviewed.stdout).data as { status: string; review_id: string };
  expect(data.status).toBe('approved');
  const terminal = (answer: string, reviewId: string) =>
    spawnSync(
      'python3',
      [
        '-c',
        String.raw`import os, pty, select, subprocess, sys
master, slave = pty.openpty()
child = subprocess.Popen(sys.argv[2:], stdin=slave, stdout=slave, stderr=slave)
os.close(slave)
os.write(master, (sys.argv[1] + '\n').encode())
output = bytearray()
while True:
    ready, _, _ = select.select([master], [], [], 0.1)
    if ready:
        try:
            part = os.read(master, 65536)
        except OSError:
            break
        if not part:
            break
        output.extend(part)
    if child.poll() is not None and not ready:
        break
os.close(master)
sys.stdout.buffer.write(output)
sys.exit(child.wait())`,
        answer,
        process.execPath,
        cli,
        'ticket',
        'record-review-disposition',
        ticketId,
        reviewId,
        '1',
        '--reason',
        'Outside the accepted scope.',
        '--cwd',
        root,
        '--json',
      ],
      {
        cwd: root,
        input: `${answer}\n`,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: `${reviewer}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
        },
      },
    );
  return { run, terminal, ticketPath, reviewId: data.review_id };
}

describe('user-owned planning review disposition', () => {
  it('leaves an authenticated optional finding pending in noninteractive mode', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = await project.run([
      'ticket',
      'record-review-disposition',
      ticketId,
      project.reviewId,
      '1',
      '--reason',
      'Outside the accepted scope.',
    ]);
    const output = JSON.parse(result.stdout);
    expect(output.state).toBe('action_required');
    expect(output.data).toMatchObject({ status: 'pending', review_id: project.reviewId });
    expect(JSON.stringify(output)).toContain(suggestion);
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('records an explicit local decline and stales the matching review', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const refused = project.terminal('n', project.reviewId);
    expect(refused.stdout, refused.stderr).toContain('"status":"pending"');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
    const confirmed = project.terminal('y', project.reviewId);
    expect(confirmed.status, `${confirmed.stdout}\n${confirmed.stderr}`).toBe(0);
    expect(readFileSync(project.ticketPath, 'utf8')).toContain('review_dispositions:');
    const status = await project.run(['review', 'status', project.reviewId]);
    expect(JSON.parse(status.stdout).data.status).toBe('stale');
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, `${fresh.stdout}\n${fresh.stderr}`).toBe(0);
    expect(fresh.stdout).toContain(
      `The user decline for ${suggestion} is current in ticket context.`,
    );
    expect(fresh.stdout).toContain(suggestion);
    writeFileSync(
      project.ticketPath,
      readFileSync(project.ticketPath, 'utf8').replace(
        'preserve current approval',
        'expand approval',
      ),
    );
    const changedBoundary = await project.run(['review', 'run', 'quality-review', target]);
    expect(changedBoundary.exitCode, `${changedBoundary.stdout}\n${changedBoundary.stderr}`).toBe(
      0,
    );
    expect(changedBoundary.stdout).toContain(
      `The user decline for ${suggestion} is superseded in ticket context.`,
    );
  });
  it('leaves the ticket untouched when another disposition writer owns its lock', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    writeFileSync(`${project.ticketPath}.review-disposition.lock`, String(process.pid));
    const result = project.terminal('y', project.reviewId);
    expect(result.stdout).toContain('REVIEW_DISPOSITION_WRITE_UNAVAILABLE');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
});
