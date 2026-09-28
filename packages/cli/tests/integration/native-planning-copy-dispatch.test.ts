import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PLANNING_CONTRACT_TEMPLATE_PATHS } from '../../src/schema.js';
import { VERSION } from '../../src/version.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

function approvingReviewer(): { bin: string; calls: string } {
  const bin = createTrustedReviewerDirectory('safeword-native-copy-reviewer-');
  const calls = nodePath.join(bin, 'calls.log');
  writeFileSync(
    nodePath.join(bin, 'claude'),
    `#!${process.execPath}
const capabilities = ${JSON.stringify(REVIEWER_CAPABILITIES.claude)};
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(capabilities); process.exit(0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.slice(input.lastIndexOf('{"schema_version":1')));
  require('node:fs').appendFileSync(${JSON.stringify(calls)}, 'review' + String.fromCharCode(10));
  process.stdout.write(JSON.stringify({ structured_output: {
    schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    verdict: 'approve', summary: 'Native copy fixture approval.', findings: []
  }}));
});
`,
    { mode: 0o755 },
  );
  return { bin, calls };
}

describe('Complete native planning author-copy dispatch', () => {
  it.each(['claude', 'codex'] as const)(
    'uses final generated %s assets and blocks outside-rubric drift before reviewer launch',
    { timeout: 60_000 },
    host => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-copy-'));
      roots.push(root);
      const generated = nodePath.join(root, 'generated');
      if (host === 'claude') mkdirSync(generated);
      const project = nodePath.join(root, 'project');
      const ticket = nodePath.join(project, '.project/tickets/NAT123-native-copy');
      mkdirSync(ticket, { recursive: true });
      writePlanningInventories(project);
      writeFileSync(
        nodePath.join(ticket, 'ticket.md'),
        '---\nid: NAT123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\n---\n',
      );
      writeFileSync(
        nodePath.join(ticket, 'impl-plan.md'),
        '# Implementation Plan\n\nPreserve the accepted scope and implement its reviewed approach.\n',
      );
      const generation = spawnSync(
        'bun',
        [
          nodePath.join(packageRoot, 'scripts', `generate-${host}-plugin.ts`),
          ...(host === 'codex' ? ['--version', VERSION, '--output', generated] : []),
        ],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            ...(host === 'claude' && { SAFEWORD_CLAUDE_GENERATED_PLUGIN_ROOT: generated }),
          },
        },
      );
      expect(generation.status, `${generation.stdout}\n${generation.stderr}`).toBe(0);
      // Copy only the native distribution; source templates cannot satisfy its lookup.
      const distribution = nodePath.join(root, 'installed-package');
      mkdirSync(distribution);
      for (const part of ['runtime', 'skills', 'package.json']) {
        cpSync(nodePath.join(generated, part), nodePath.join(distribution, part), {
          recursive: true,
        });
      }
      const reviewer = approvingReviewer();
      const run = () =>
        spawnSync(
          'bun',
          [
            nodePath.join(distribution, 'runtime/cli.js'),
            'review',
            'run',
            'plan-implementation',
            '.project/tickets/NAT123-native-copy/impl-plan.md',
            '--context',
            '.project/tickets/NAT123-native-copy/ticket.md',
            '--json',
            '--no-input',
            '--cwd',
            project,
          ],
          {
            cwd: project,
            encoding: 'utf8',
            timeout: 20_000,
            env: {
              ...process.env,
              PATH: `${reviewer.bin}:${process.env.PATH ?? ''}`,
              SAFEWORD_AGENT_RUNTIME: 'codex',
              SAFEWORD_NO_UPDATE_CHECK: '1',
              SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, 'review-keys'),
              NODE_ENV: 'test',
            },
          },
        );
      const canonical = run();
      expect(canonical.status, `${canonical.stdout}\n${canonical.stderr}`).toBe(0);
      expect(JSON.parse(canonical.stdout)).toMatchObject({
        data: { status: 'approved', review_kind: 'plan-implementation', actual_reviewer: 'claude' },
      });
      expect(readFileSync(reviewer.calls, 'utf8')).toBe('review\n');
      const template = PLANNING_CONTRACT_TEMPLATE_PATHS.implementation;
      const contractPath =
        host === 'claude'
          ? template
          : nodePath.join(nodePath.dirname(template), 'references', nodePath.basename(template));
      const asset = nodePath.join(distribution, contractPath);
      writeFileSync(
        asset,
        `<!-- Native copy drift outside the rubric -->\n${readFileSync(asset, 'utf8')}`,
      );
      const edited = run();
      expect(edited.status, `${edited.stdout}\n${edited.stderr}`).not.toBe(0);
      expect(JSON.parse(edited.stdout)).toMatchObject({
        data: { status: 'blocked' },
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: 'canonical_contract_copy_mismatch',
            metadata: { planning_phase: 'plan-implementation', contract_path: contractPath },
          }),
        ]),
      });
      expect(
        readFileSync(reviewer.calls, 'utf8'),
        'copy refusal must not launch the reviewer',
      ).toBe('review\n');
    },
  );
});
