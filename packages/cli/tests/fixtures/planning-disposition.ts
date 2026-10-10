import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

export const ticketId = 'DIS123';
const folder = `.project/tickets/${ticketId}-review-disposition`;
export const target = `${folder}/spec.md`;
export const suggestion = 'Consider adding an optional approval audit export.';
const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

export async function createReviewedDispositionProject(
  roots: string[],
  findingMessage = suggestion,
) {
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
    findings: [{ severity: 'warning', message: ${JSON.stringify(findingMessage)} }],
    evidence_records: { schema_version: 1, records: [] },
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
  assert.equal(reviewed.exitCode, 0, `${reviewed.stdout}\n${reviewed.stderr}`);
  const data = JSON.parse(reviewed.stdout).data as { status: string; review_id: string };
  assert.equal(data.status, 'approved');
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
  return { root, run, terminal, ticketPath, reviewId: data.review_id };
}
