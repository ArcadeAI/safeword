import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];
afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

const cases = ['product', 'implementation'].flatMap(phase =>
  ['principles', 'personas', 'surfaces'].flatMap(role =>
    ['', ' \n\t', undefined].map(content => ({ phase, role, content })),
  ),
);

describe('blank required context through public planning review', () => {
  it.each(cases)(
    'checks $phase review with default $role content ($content)',
    async ({ phase, role, content }) => {
      const project = createTemporaryDirectory();
      projects.push(project);
      await createConfiguredProject(project);
      const configPath = nodePath.join(project, '.safeword/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
        paths?: Record<string, unknown>;
      };
      const paths = Object.fromEntries(
        Object.entries(config.paths ?? {}).filter(([key]) => key !== role),
      );
      expect(Object.hasOwn(paths, role)).toBe(false);
      writeFileSync(configPath, JSON.stringify({ ...config, paths }));
      const ticket = '.project/tickets/BLK123-blank-context';
      mkdirSync(nodePath.join(project, ticket), { recursive: true });
      writeFileSync(
        nodePath.join(project, ticket, 'ticket.md'),
        '---\nid: BLK123\ntype: feature\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\n---\n',
      );
      const target = `${ticket}/${phase === 'product' ? 'spec' : 'impl-plan'}.md`;
      writeFileSync(
        nodePath.join(project, target),
        phase === 'product'
          ? PLANNING_ROLE_PRODUCT
          : '# Planning work\n\nPreserve authenticated approval.\n',
      );
      if (phase === 'implementation') {
        writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
        writeImplementationRoleInputs(project, target, 'blank-context.feature');
      }
      const contextPath = `.project/${role}.md`;
      const currentInventory = readFileSync(nodePath.join(project, contextPath), 'utf8');
      expect(currentInventory.trim()).not.toBe('');
      if (content !== undefined) writeFileSync(nodePath.join(project, contextPath), content);
      const bin = createTrustedReviewerDirectory('safeword-blank-context-');
      const capture = nodePath.join(bin, 'received-prompt.txt');
      writeFileSync(
        nodePath.join(bin, 'claude'),
        String.raw`#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  writeFileSync(${JSON.stringify(capture)}, input);
  const packet = JSON.parse(input.trim().split('\n').pop());
  console.log(JSON.stringify({ structured_output: { schema_version: 1,
    dispatch_id: packet.dispatch_id, reviewer_agent: 'claude', verdict: 'approve',
    summary: 'The supplied plan is otherwise reviewable.', findings: [], evidence_records: { schema_version: 1, records: [] } } }));
});
`,
        { mode: 0o755 },
      );
      const result = await runCli(
        [
          'review',
          'run',
          phase === 'product' ? 'quality-review' : 'plan-implementation',
          target,
          '--cwd',
          project,
          '--json',
          '--no-input',
        ],
        { cwd: project, env: { PATH: `${bin}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
      );
      if (content === undefined) {
        expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
        expect(existsSync(capture), 'current default context must reach the reviewer').toBe(true);
        const output = JSON.parse(result.stdout);
        expect(output.data.status).toBe('approved');
        expect(
          output.findings.some(
            (finding: { code: string }) => finding.code === 'missing_planning_context',
          ),
        ).toBe(false);
        const packet = JSON.parse(readFileSync(capture, 'utf8').trim().split('\n').pop() ?? '');
        const expectedInventory = expect.objectContaining({
          path: contextPath,
          content: currentInventory,
        });
        expect(packet.context_files).toEqual(expect.arrayContaining([expectedInventory]));
        return;
      }
      expect(result.exitCode, 'blank required planning context must block dispatch').not.toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'missing_planning_context',
            metadata: { context_role: role, context_path: contextPath },
          }),
        ]),
      );
      expect(existsSync(capture), 'blank context must refuse before reviewer execution').toBe(
        false,
      );
      expect(output.data?.status).not.toBe('approved');
    },
  );
});
