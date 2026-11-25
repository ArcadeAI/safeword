import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { writeClaudePluginCatalogue } from '../../src/claude-plugin/catalogue.js';
import { writePortableCoreCatalogue } from '../../src/host-contract/portable-core.js';
import { reconcile } from '../../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { detectProjectType } from '../../src/utils/project-detector.js';
import { VERSION } from '../../src/version.js';
import { type NativeTurn, resourceLoad } from '../helpers/codex-workflow-observation.js';
import { runWorkflowGenerator } from '../helpers/codex-workflow-runtime.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const canonicalPath = 'packages/cli/templates/skills/testing/SKILL.md';
const fixture = { source: '', target: '', body: '' };
const marker = `PAYLOAD_ONLY_${randomUUID()}`;

beforeAll(() => {
  const source = realpathSync(createContractRepoFixture());
  fixture.source = source;
  const canonical = path.join(source, canonicalPath);
  writeFileSync(
    canonical,
    readFileSync(canonical, 'utf8').replace(
      '# Writing Good Tests',
      () => `# Writing Good Tests\n<!-- ${marker} -->`,
    ),
  );
  const generated = runWorkflowGenerator(source, path.join(source, 'owned-unused-profile'), false);
  expect(generated.status, generated.output).toBe(0);
  fixture.target = path.join(source, 'packages/cli/codex-plugin/internal/testing/SKILL.md');
  fixture.body = readFileSync(fixture.target, 'utf8');
}, 90_000);

afterAll(() => {
  if (fixture.source) rmSync(path.dirname(fixture.source), { recursive: true, force: true });
});

// NONRECEIPT: only the host transcript boundary is synthetic; production
// generation, installed bytes and the full-current-body observer are real.
function transcript(
  output: string,
  file = fixture.target,
  id = 'read',
  exit = 0,
): Pick<NativeTurn, 'entries' | 'events'> {
  const command = `sed -n 1,260p ${file}`;
  const entries: NativeTurn['entries'] = [
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'read',
        input: `await tools.exec_command(${JSON.stringify({ cmd: command })})`,
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: id,
        output: JSON.stringify({ chunk_id: 'unit', wall_time_seconds: 0, exit_code: exit, output }),
      },
    },
  ];
  return {
    entries,
    events: [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `/bin/zsh -lc ${JSON.stringify(command)}`,
          exit_code: exit,
          aggregated_output: output,
        },
      },
    ],
  };
}

it('delivers the complete current generated procedure in the retained first-range read', () => {
  const { body, target } = fixture;
  expect(body, 'SHARED_PARTITION_RULE_MISSING').toContain(
    'Before writing or reviewing tests, identify the distinct behavior partitions and choose a representative for each, including validation failures for individual inputs or input combinations. For bounded inputs, include a value strictly inside the valid range when one exists, boundary values, and out-of-range values, whether accepted or rejected. Check that the resulting tests cover those choices before reporting completion.',
  );
  expect(body).not.toContain('Cover distinct behavior partitions.');
  const entries = transcript(body.split('\n').slice(0, 260).join('\n'));
  expect(resourceLoad(entries, target, marker)).toMatchObject({
    completeBody: true,
    callIds: ['read'],
  });
});

it.each([
  [canonicalPath, 210, 10_240],
  ['packages/cli/codex-plugin/internal/testing/SKILL.md', 245, 12_288],
  ['packages/cli/templates/guides/testing-guide.md', 850, 36_864],
] as const)('bounds the actual %s payload', (file, lines, bytes) => {
  const text = readFileSync(
    path.join(file === canonicalPath ? repo : fixture.source, file),
    'utf8',
  );
  expect(text.trimEnd().split('\n').length, 'TESTING_PROCEDURE_LINE_BUDGET').toBeLessThanOrEqual(
    lines,
  );
  expect(Buffer.byteLength(text), 'TESTING_PROCEDURE_BYTE_BUDGET').toBeLessThanOrEqual(bytes);
});

it.each(['incomplete', 'stale', 'foreign', 'mismatched', 'failed'] as const)(
  'rejects %s current-body evidence at its actual boundary',
  fault => {
    const { body, target } = fixture;
    const cases = {
      incomplete: transcript(body.slice(0, -20)),
      stale: transcript(body.replace('Tests prove', 'Old tests proved')),
      foreign: transcript(body, `${target}.other`),
      mismatched: transcript(body, target, 'other'),
      failed: transcript(body, target, 'read', 1),
    };
    expect(() => resourceLoad(cases[fault], target, marker)).toThrow(
      fault === 'mismatched'
        ? 'HOST_CONTRACT_PROOF_UNAVAILABLE: missing/ambiguous correlated tool output'
        : `INTERNAL_WORKFLOW_UNMET: current resource was not loaded: ${target}`,
    );
  },
);

function guideAt(text: string, asset: string, project?: string, plugin?: string): string {
  const line = text.split('\n').find(value => value.startsWith('Optional worked examples:')) ?? '';
  const match = /`([^`]+)`|\[Testing guide\]\(([^)]+)\)/u.exec(line);
  expect(match, 'OPTIONAL_TESTING_GUIDE_REFERENCE_MISSING').not.toBeNull();
  const reference = (match?.[1] ?? match?.[2] ?? '').split(/[?#]/u, 1)[0] ?? '';
  const root = Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, reference) ? project : path.dirname(asset);
  return path.resolve(
    root ?? path.dirname(asset),
    reference.replace('"${CLAUDE_PLUGIN_ROOT}"', () => plugin ?? ''),
  );
}

it('keeps optional examples reachable through the actual installed guide reference', () => {
  const guide = guideAt(fixture.body, fixture.target);
  expect(readFileSync(guide, 'utf8')).toBe(
    readFileSync(path.join(repo, 'packages/cli/templates/guides/testing-guide.md'), 'utf8'),
  );
});

it('resolves optional examples from actual raw Claude and Cursor project copies', async () => {
  const cwd = path.join(fixture.source, 'owned-project');
  mkdirSync(cwd);
  const manifest = { name: 'guide-resolution-control', private: true, type: 'module' };
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(manifest));
  await reconcile(SAFEWORD_SCHEMA, 'install', {
    cwd,
    projectType: detectProjectType(manifest, cwd),
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: false,
    languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
  });
  for (const relative of ['.claude/skills/testing/SKILL.md', '.safeword/skills/testing/SKILL.md']) {
    const asset = path.join(cwd, relative);
    const text = readFileSync(asset, 'utf8');
    const guide = guideAt(text, asset, cwd);
    expect(existsSync(guide), `OPTIONAL_GUIDE_UNREACHABLE: ${guide}`).toBe(true);
    expect(readFileSync(guide, 'utf8')).toContain('## Optional worked examples');
  }
});

it.each(['claude', 'portable'])('resolves optional examples within the actual %s package', host => {
  const bundle = path.join(fixture.source, `owned-${host}-package`);
  const templatesRoot = path.join(fixture.source, 'packages/cli/templates');
  if (host === 'claude')
    writeClaudePluginCatalogue(
      {
        templatesRoot,
        sourceRoot: path.join(fixture.source, 'packages/cli/src'),
        version: VERSION,
        cliBundle: '/* Resource-only fixture: external runtime is not executed. */',
      },
      bundle,
    );
  else writePortableCoreCatalogue(templatesRoot, bundle, VERSION);
  const asset = path.join(bundle, 'skills/testing/SKILL.md');
  const guide = guideAt(readFileSync(asset, 'utf8'), asset, undefined, bundle);
  expect(existsSync(guide), `OPTIONAL_GUIDE_UNREACHABLE: ${guide}`).toBe(true);
  expect(readFileSync(guide, 'utf8')).toContain('## Optional worked examples');
});
