import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
const folder = 'CPY123-canonical-planning';
const plan =
  '# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve accepted behavior through one implementation.\n\n## Decisions\n\nKeep the existing authority boundary.\n\n## Design alignment\n\nskip: no configured project principles\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: fixture has no customer documentation change\n\n## Assessment triggers\n\nRevisit if the authority boundary changes.\n';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

function fixture() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-installed-copy-'));
  roots.push(root);
  const distribution = nodePath.join(root, 'package');
  mkdirSync(distribution);
  for (const part of ['dist', 'templates', 'package.json']) {
    cpSync(nodePath.join(packageRoot, part), nodePath.join(distribution, part), {
      recursive: true,
    });
  }
  symlinkSync(
    nodePath.join(packageRoot, 'node_modules'),
    nodePath.join(distribution, 'node_modules'),
  );
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  const cli = nodePath.join(distribution, 'dist/cli.js');
  mkdirSync(nodePath.join(distribution, 'runtime'));
  symlinkSync('../dist/cli.js', nodePath.join(distribution, 'runtime/cli.js'));
  const reviewer = createTrustedReviewerDirectory('safeword-installed-copy-reviewer-');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.slice(input.lastIndexOf('{"schema_version":1')));
  console.log(JSON.stringify({ structured_output: {
    schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    verdict: 'approve', summary: 'Fixture approval.', findings: []
  }}));
});
`,
    { mode: 0o755 },
  );
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    PATH: `${reviewer}:${process.env.PATH ?? ''}`,
    SAFEWORD_AGENT_RUNTIME: 'cursor',
    SAFEWORD_PLUGIN_CLI: cli,
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, 'keys'),
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
    SAFEWORD_SKIP_SKILLS: '1',
    CLAUDE_PROJECT_DIR: project,
    CLAUDE_PLUGIN_ROOT: distribution,
  };
  const run = (args: string[]) =>
    spawnSync('bun', [cli, ...args, '--cwd', project, '--json', '--no-input'], {
      cwd: project,
      encoding: 'utf8',
      timeout: 30_000,
      env: args[0] === 'review' ? { ...environment, SAFEWORD_AGENT_RUNTIME: 'codex' } : environment,
    });
  const installed = run(['install', '--agents=cursor', '--no-modify', '--offline']);
  expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(0);
  const configPath = nodePath.join(project, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(
    configPath,
    JSON.stringify({ ...config, reviewGate: true, designApprovalGate: false }),
  );
  const ticket = nodePath.join(project, '.project/tickets', folder);
  mkdirSync(ticket, { recursive: true });
  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    '---\nid: CPY123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nscope:\n  - Preserve canonical planning\nout_of_scope:\n  - Unrelated work\ndone_when:\n  - Execution planning begins safely\n---\n\n# Ticket\n',
  );
  writeFileSync(nodePath.join(ticket, 'spec.md'), '# Product Plan\n');
  writeFileSync(nodePath.join(ticket, 'impl-plan.md'), plan);
  const target = `.project/tickets/${folder}/impl-plan.md`;
  const review = run([
    'review',
    'run',
    'plan-implementation',
    target,
    '--context',
    `.project/tickets/${folder}/spec.md`,
  ]);
  expect(review.status, `${review.stdout}\n${review.stderr}`).toBe(0);
  const reviewed = JSON.parse(review.stdout);
  expect(reviewed).toMatchObject({ data: { status: 'approved', actual_reviewer: 'claude' } });
  const id = reviewed.data.review_id as string;
  for (const artifact of [['impl-plan'], ['--phase', 'plan-implementation']]) {
    const stamped = spawnSync(
      'bun',
      [
        nodePath.join(project, '.safeword/hooks/write-review-stamp.ts'),
        '--ticket',
        folder,
        '--author-agent',
        'codex',
        '--reviewer-agent',
        'claude',
        '--independence',
        'cross-agent',
        '--review-id',
        id,
        ...artifact,
      ],
      {
        cwd: project,
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...environment,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          CODEX_THREAD_ID: 'installed-copy-fixture',
        },
      },
    );
    expect(stamped.status, `${stamped.stdout}\n${stamped.stderr}`).toBe(0);
    expect(stamped.stdout).toContain('stamped');
  }
  const advance = () =>
    spawnSync('bun', [nodePath.join(project, '.safeword/hooks/pre-tool-quality.ts')], {
      cwd: project,
      encoding: 'utf8',
      timeout: 15_000,
      env: environment,
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketPath,
          old_string: 'phase: plan-implementation',
          new_string: 'phase: plan-execution',
        },
      }),
    });
  return { project, ticketPath, run, advance };
}

describe('Cursor installed planning copy admission', () => {
  it.each(['public approval', 'installed hook'] as const)(
    'refuses project-copy drift at %s after an authenticated review',
    { timeout: 90_000 },
    boundary => {
      const project = fixture();
      const canonical =
        boundary === 'public approval'
          ? project.run(['ticket', 'approve-plan', 'CPY123'])
          : project.advance();
      expect(canonical.status, `${canonical.stdout}\n${canonical.stderr}`).toBe(0);
      if (boundary === 'public approval') {
        expect(JSON.parse(canonical.stdout)).toMatchObject({ ok: true });
        expect(readFileSync(project.ticketPath, 'utf8')).toContain('phase: plan-execution');
      } else {
        expect(canonical.stdout.trim(), 'canonical installed hook must allow the transition').toBe(
          '',
        );
        expect(`${canonical.stdout}\n${canonical.stderr}`).not.toContain(
          'canonical_contract_copy_mismatch',
        );
      }
      const driftProject = fixture();
      const asset = nodePath.join(
        driftProject.project,
        '.safeword/skills/bdd/PLAN_IMPLEMENTATION.md',
      );
      writeFileSync(
        asset,
        `<!-- installed-copy drift outside reviewer block -->\n${readFileSync(asset, 'utf8')}`,
      );
      const drifted =
        boundary === 'public approval'
          ? driftProject.run(['ticket', 'approve-plan', 'CPY123'])
          : driftProject.advance();
      const refused =
        boundary === 'public approval'
          ? drifted.status !== 0
          : drifted.stdout.trim() !== '' &&
            JSON.parse(drifted.stdout).hookSpecificOutput?.permissionDecision === 'deny';
      expect(
        refused,
        'installed lifecycle must refuse project author-copy drift after authenticated approval',
      ).toBe(true);
      expect(`${drifted.stdout}\n${drifted.stderr}`).toContain('canonical_contract_copy_mismatch');
      expect(`${drifted.stdout}\n${drifted.stderr}`).toContain(
        '.safeword/skills/bdd/PLAN_IMPLEMENTATION.md',
      );
      expect(readFileSync(driftProject.ticketPath, 'utf8')).toContain('phase: plan-implementation');
    },
  );
});
