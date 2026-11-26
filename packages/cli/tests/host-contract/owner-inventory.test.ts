/* eslint-disable unicorn/name-replacements, unicorn/no-top-level-assignment-in-function -- Accepted filename; isolated fixture lifecycle handles assigned by Vitest hooks. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readConformanceAttempts } from '../../src/host-contract/conformance-run.js';
import { CONFORMANCE_RUN_LAYOUT } from '../../src/schema.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';
import {
  intendedFacetOwner,
  intendedRegistrationIdentity,
  intendedRegistrationOwner,
  intendedRegistrations,
} from '../helpers/intended-contract-graph.js';

const adapter = 'packages/cli/src/commands/codex-hook.ts';
const cursor = 'packages/cli/src/cursor-wrappers.ts';
const catalogue = 'packages/cli/src/opencode/catalogue.ts';
function compareOracle(left: unknown, right: unknown): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
const expected = [
  'codex.intake.required-fields',
  'opencode.catalogue.codex-renderer-authority',
  'opencode.catalogue.cursor-command-authority',
  'cursor.rule.bdd.purpose',
  'cursor.rule.bdd.DISCOVERY.purpose',
  'cursor.rule.bdd.DONE.purpose',
  'cursor.rule.bdd.PLAN_EXECUTION.purpose',
  'cursor.rule.bdd.PLAN_IMPLEMENTATION.purpose',
  'cursor.rule.bdd.SCENARIOS.purpose',
  'cursor.rule.bdd.SPLITTING.purpose',
  'cursor.rule.bdd.TDD.purpose',
  'cursor.rule.bdd.VERIFY.purpose',
  'cursor.rule.brainstorm.purpose',
  'cursor.rule.debug.purpose',
  'cursor.rule.demand-research.purpose',
  'cursor.rule.elicit.purpose',
  'cursor.rule.figure-it-out.purpose',
  'cursor.rule.finish-review.purpose',
  'cursor.rule.pr-readiness.purpose',
  'cursor.rule.quality-review.purpose',
  'cursor.rule.refactor.purpose',
  'cursor.rule.retro-filer.purpose',
  'cursor.rule.tdd-review.purpose',
  'cursor.rule.testing.purpose',
  'cursor.rule.ticket-system.purpose',
  'codex.prompt.timestamp',
];
let directory: string,
  baseRepository: string,
  baseline: string,
  candidate: string,
  fixtureCandidate: string,
  retained: string,
  incomplete: string,
  binary: string,
  cursorRetained: string,
  unexpectedBaseline: string;
function git(...args: string[]): string {
  const result = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'fixture',
        GIT_AUTHOR_EMAIL: 'fixture@invalid',
        GIT_COMMITTER_NAME: 'fixture',
        GIT_COMMITTER_EMAIL: 'fixture@invalid',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function commit(): string {
  git('add', '-A', '--', '.', ':!node_modules', ':!packages/cli/node_modules');
  git('commit', '--allow-empty', '-qm', 'owned source fixture');
  return git('rev-parse', 'HEAD');
}
function currentGeneratedCandidate(revision: string): string {
  git('checkout', '--detach', '-q', revision);
  // Dependency paths change in each private clone. Use the same two normal
  // generators as the shared fixture; never nest the all-surfaces Vitest fixer.
  for (const script of ['generate-claude-plugin.ts', 'generate-codex-plugin.ts']) {
    const result = spawnSync('bun', [`scripts/${script}`], {
      cwd: nodePath.join(directory, 'packages/cli'),
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  }
  return commit();
}
function check(before = baseline, after = candidate, extra: string[] = []) {
  const result = spawnSync(
    'bun',
    [
      nodePath.resolve(import.meta.dirname, '../../scripts/check-host-contract.ts'),
      '--owner-delta',
      '--baseline',
      before,
      '--candidate',
      after,
      '--json',
      ...extra,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, XDG_STATE_HOME: nodePath.join(directory, 'private-state') },
    },
  );
  assert.equal(result.error, undefined);
  assert.ok(result.stdout.trim(), `Checker setup unavailable: ${result.status} ${result.stderr}`);
  return { status: result.status, report: JSON.parse(result.stdout) };
}
beforeAll(() => {
  directory = createContractRepoFixture();
  // The shared fixture's history link is for reads only. All commits below
  // require an independent private index/refs; never initialize through it.
  const history = nodePath.join(directory, '.git');
  assert.ok(lstatSync(history).isSymbolicLink());
  rmSync(history);
  const privateClone = `${directory}-history`;
  const clone = spawnSync(
    'git',
    [
      'clone',
      '--shared',
      '--no-checkout',
      '-q',
      nodePath.resolve(import.meta.dirname, '../../../..'),
      privateClone,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(clone.status, 0, clone.stderr);
  renameSync(nodePath.join(privateClone, '.git'), history);
  rmSync(privateClone, { recursive: true, force: true });
  git('init', '-q');
  git('read-tree', 'HEAD');
  const original = readFileSync(nodePath.join(directory, adapter), 'utf8');
  const originalCursor = readFileSync(nodePath.join(directory, cursor), 'utf8');
  const baselineCursor = readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/owners/cursor-rule-purposes-baseline.txt',
    ),
  );
  const originalCatalogue = readFileSync(nodePath.join(directory, catalogue), 'utf8');
  const retired = readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/owners/codex-intake-predicate.txt',
    ),
    'utf8',
  );
  const timestamp = readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/owners/codex-timestamp-authority-baseline.txt',
    ),
    'utf8',
  );
  writeFileSync(nodePath.join(directory, adapter), `${original}\n${retired}\n${timestamp}`);
  writeFileSync(
    nodePath.join(directory, catalogue),
    `${
      originalCatalogue
    }\nimport { generateCodexPluginAssets } from "../codex-plugin/catalogue.js";\nimport { CURSOR_COMMAND_WRAPPERS } from "../cursor-wrappers.js";\n`,
  );
  writeFileSync(nodePath.join(directory, cursor), baselineCursor);
  baseline = commit();
  writeFileSync(nodePath.join(directory, cursor), originalCursor);
  writeFileSync(nodePath.join(directory, adapter), original);
  writeFileSync(nodePath.join(directory, catalogue), originalCatalogue);
  candidate = commit();
  writeFileSync(nodePath.join(directory, adapter), `${original}\n${retired}`);
  retained = commit();
  writeFileSync(nodePath.join(directory, adapter), original);
  incomplete = commit();
  writeFileSync(
    nodePath.join(directory, adapter),
    Buffer.concat([Buffer.from(`${original}\n/*`), Buffer.from([255]), Buffer.from('*/\n')]),
  );
  binary = commit();
  writeFileSync(nodePath.join(directory, adapter), original);
  writeFileSync(
    nodePath.join(directory, cursor),
    `${originalCursor}
const retainedPurpose = { description: 'Independently maintained debugging purpose', referencePath: '.safeword/skills/debug/SKILL.md' };`,
  );
  cursorRetained = commit();
  writeFileSync(
    nodePath.join(directory, adapter),
    `${original}
${retired}
${timestamp}`,
  );
  writeFileSync(
    nodePath.join(directory, catalogue),
    `${originalCatalogue}
import { generateCodexPluginAssets } from "../codex-plugin/catalogue.js";
import { CURSOR_COMMAND_WRAPPERS } from "../cursor-wrappers.js";`,
  );
  writeFileSync(
    nodePath.join(directory, cursor),
    Buffer.concat([
      baselineCursor,
      Buffer.from(
        "\nconst unexpectedPurpose = { description: 'Additional independent purpose', referencePath: '.safeword/skills/unexpected-workflow/SKILL.md' };\n",
      ),
    ]),
  );
  unexpectedBaseline = commit();
  fixtureCandidate = candidate;
  baseRepository = directory;
}, 60_000);
beforeEach(() => {
  const parent = mkdtempSync(nodePath.join(nodePath.dirname(baseRepository), 'capture-case-'));
  directory = nodePath.join(parent, 'repository');
  const clone = spawnSync('git', ['clone', '--no-local', '-q', baseRepository, directory], {
    encoding: 'utf8',
  });
  assert.equal(clone.status, 0, clone.stderr);
  const checkout = spawnSync('git', ['checkout', '--detach', '-q', fixtureCandidate], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(checkout.status, 0, checkout.stderr);
  cpSync(
    nodePath.join(baseRepository, 'packages/cli/scripts'),
    nodePath.join(directory, 'packages/cli/scripts'),
    { recursive: true },
  );
  for (const relative of ['package.json', 'packages/cli/package.json'])
    cpSync(nodePath.join(baseRepository, relative), nodePath.join(directory, relative));
  for (const relative of ['node_modules', 'packages/cli/node_modules'])
    symlinkSync(nodePath.join(baseRepository, relative), nodePath.join(directory, relative), 'dir');
  candidate = currentGeneratedCandidate(fixtureCandidate);
});
afterEach(() => {
  rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});
afterAll(() => {
  rmSync(nodePath.dirname(baseRepository), { recursive: true, force: true });
});
function store() {
  const root = nodePath.join(directory, CONFORMANCE_RUN_LAYOUT.directory);
  const [bucket] = readdirSync(root);
  assert.ok(bucket);
  const profile = nodePath.join(directory, 'private-state');
  return {
    directory: nodePath.join(root, bucket),
    keyFile: nodePath.join(profile, CONFORMANCE_RUN_LAYOUT.key),
    headFile: nodePath.join(profile, CONFORMANCE_RUN_LAYOUT.heads, `${bucket}.json`),
  };
}

describe('committed owner capture through required repository checker', () => {
  it('reports exact independently expected retirements from committed trees', () => {
    const current = spawnSync('bun', ['packages/cli/scripts/check-host-contract.ts', '--json'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(current.error, 'OWNER_CURRENT_FIXTURE_UNAVAILABLE').toBeUndefined();
    expect(
      current.status,
      `OWNER_CURRENT_FIXTURE_INVALID: ${current.stdout}${current.stderr}`,
    ).toBe(0);
    const currentGraph = JSON.parse(current.stdout).data.ownership_graph;
    const { status, report } = check();
    expect(report.errors, 'OWNER_CURRENT_SETUP_UNAVAILABLE').toEqual([]);
    expect(report.data?.inventory_complete, 'COMMITTED_OWNER_CURRENT_INCOMPLETE').toBe(true);
    expect(report.data.admission_eligible).toBe(false);
    expect(
      report.data?.owner_delta?.retired_owners,
      `COMMITTED_OWNER_DELTA_MISSING: ${JSON.stringify(report.errors)}`,
    ).toEqual(expected);
    expect(status).toBe(0);
    expect(report.data.owner_delta.baseline.commit).toBe(baseline);
    expect(report.data.owner_delta.candidate.commit).toBe(candidate);
    for (const [field, commitId] of [
      ['baseline', baseline],
      ['candidate', candidate],
    ] as const) {
      const tree = spawnSync('git', ['rev-parse', commitId.concat('^{tree}')], {
        cwd: directory,
        encoding: 'utf8',
      });
      expect(tree.status).toBe(0);
      expect(report.data.owner_delta[field].tree).toBe(tree.stdout.trim());
    }
    expect(report.data.owner_delta.candidate.graph_scope).toBe(
      'independent-source-and-registration-graph',
    );
    const graph = report.data.owner_delta.candidate.ownership_graph;
    expect(graph, 'SEALED_GRAPH_DIFFERS_FROM_ACTUAL_PUBLIC_CHECK').toEqual(currentGraph);
    const sources = JSON.parse(
      readFileSync(
        nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/intended-sources.json'),
        'utf8',
      ),
    ) as { paths: string[]; additions: string[] };
    expect(
      graph.facets
        .map((row: { path: string; owner: string }) => [row.path, row.owner])
        .toSorted(compareOracle),
    ).toEqual(
      [...sources.paths, ...sources.additions]
        .map(path => [path, intendedFacetOwner(path)])
        .toSorted(compareOracle),
    );
    expect(
      graph.registrations
        .map((row: { identity: string; owner: string }) => [row.identity, row.owner])
        .toSorted(compareOracle),
    ).toEqual(
      intendedRegistrations()
        .map(row => [intendedRegistrationIdentity(row), intendedRegistrationOwner(row)])
        .toSorted(compareOracle),
    );
    expect(graph.lanes.map((row: { id: string }) => row.id).toSorted(compareOracle)).toEqual(
      [
        'claude:2.1.319:CLI:native',
        'codex:0.167.0:CLI:native',
        'cursor:2026.11.05-86047df:CLI:native',
        'cursor:3.29.9:IDE:native',
        'cursor:3.29.9:IDE:project-hooks',
        'opencode:2.4.1:CLI:native',
        'opencode:2.4.1:TUI:native',
      ].toSorted(compareOracle),
    );
    expect(new Set(graph.registrations.map((row: { identity: string }) => row.identity)).size).toBe(
      graph.registrations.length,
    );
    const requiredBlobs = new Set([
      ...sources.paths,
      ...sources.additions,
      ...intendedRegistrations().map(intendedRegistrationOwner),
    ]);
    const captured = report.data.owner_delta.candidate.sources as {
      path: string;
      sha256: string;
    }[];
    expect(new Set(captured.map(row => row.path)).size).toBe(captured.length);
    for (const path of requiredBlobs) {
      const source = captured.find(row => row.path === path);
      expect(source, `CURRENT_OWNER_BLOB_OMITTED: ${path}`).toBeDefined();
      const blob = spawnSync('git', ['cat-file', 'blob', `${candidate}:${path}`], {
        cwd: directory,
      });
      expect(blob.status).toBe(0);
      expect(source?.sha256).toBe(createHash('sha256').update(blob.stdout).digest('hex'));
    }
    const translations = [...sources.paths, ...sources.additions].filter(
      path => intendedFacetOwner(path) !== path,
    );
    for (const path of [...translations, 'packages/cli/templates/hooks/codex/pre-tool-quality.ts'])
      expect(report.data.owner_delta.retained_mechanical_translations).toContain(path);
    const bytes = spawnSync('git', ['cat-file', 'blob', `${candidate}:${adapter}`], {
      cwd: directory,
    }).stdout;
    expect(
      report.data.owner_delta.candidate.sources.find(
        (row: { path: string }) => row.path === adapter,
      ).sha256,
      'COMMITTED_SOURCE_BYTE_IDENTITY_MISMATCH',
    ).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(report.data.owner_delta.retirement_basis).toBe(
      'committed-source-graph-and-known-retirement-shapes',
    );
    expect(report.data.owner_delta.replay_advances_history).toBe(false);
    expect(report.data.inventory_complete, 'COMMITTED_OWNER_CURRENT_INCOMPLETE').toBe(true);
    expect(report.data.admission_eligible).toBe(false);
  });
  it('rejects an additional baseline owner absent from the independent intended set', () => {
    const result = check(unexpectedBaseline);
    expect(result.status, 'UNACCOUNTED_BASELINE_OWNER_ACCEPTED').toBe(2);
    const unaccounted = result.report.findings.filter(
      (finding: { code: string }) => finding.code === 'OWNER_CAPTURE_BASELINE_UNACCOUNTED',
    );
    expect(
      unaccounted.map((finding: { metadata: { owner_id: string } }) => finding.metadata.owner_id),
    ).toEqual(['cursor.rule.unexpected-workflow.purpose']);
    expect(result.report.data.owner_delta.unadjudicated_baseline_owners).toEqual([
      'cursor.rule.unexpected-workflow.purpose',
    ]);
  });
  it('rejects a retained Cursor purpose and restores the complete known set', () => {
    const failed = check(baseline, cursorRetained);
    expect(failed.status).toBe(2);
    const competing = failed.report.findings.filter(
      (finding: { code: string }) => finding.code === 'COMPETING_HOST_CONTRACT_OWNER',
    );
    expect(
      competing.map((finding: { metadata: { owner_id: string } }) => finding.metadata.owner_id),
    ).toEqual(['cursor.rule.debug.purpose']);
    const repaired = check();
    expect(repaired.status).toBe(0);
    expect(repaired.report.data.owner_delta.retired_owners).toEqual(expected);
    expect(repaired.report.data.owner_delta.unadjudicated_baseline_owners).toEqual([]);
  });
  it('hashes raw committed blobs without losing non-UTF8 comment bytes', () => {
    const currentBinary = currentGeneratedCandidate(binary);
    const bytes = spawnSync('git', ['cat-file', 'blob', `${currentBinary}:${adapter}`], {
      cwd: directory,
    }).stdout;
    // Full current capture also binds the actual current inputs to that commit.
    writeFileSync(nodePath.join(directory, adapter), bytes);
    const result = check(baseline, currentBinary);
    expect(result.status).toBe(0);
    const source = result.report.data.owner_delta.candidate.sources.find(
      (row: { path: string }) => row.path === adapter,
    );
    expect(source.sha256, 'COMMITTED_BINARY_BYTE_IDENTITY_MISMATCH').toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  });
  it('rejects a retained independent owner and repairs through the same committed boundary', () => {
    const failed = check(baseline, retained);
    expect(failed.status).toBe(2);
    const competing = failed.report.findings
      .filter((finding: { code: string }) => finding.code === 'COMPETING_HOST_CONTRACT_OWNER')
      .map((finding: { metadata: { owner_id: string } }) => finding.metadata.owner_id);
    expect(competing).toEqual(['codex.intake.required-fields']);
    expect(readConformanceAttempts(store())?.at(-1)?.payload.outcome).toBe('failed');
    const repaired = check();
    expect(repaired.status).toBe(0);
    expect(repaired.report.data.owner_delta.retired_owners).toEqual(expected);
  });
  it('reads committed sources despite a dirty working copy', () => {
    writeFileSync(
      nodePath.join(directory, adapter),
      'throw new Error("never execute caller tree");',
    );
    expect(check().report.data.owner_delta.retired_owners).toEqual(expected);
    const retainedResult = check(baseline, retained);
    expect(retainedResult.status).toBe(2);
    expect(retainedResult.report.data.owner_delta.candidate.commit).toBe(retained);
  });
  it('rejects a baseline that cannot substantiate all expected retirements', () => {
    const result = check(incomplete);
    expect(result.status).toBe(2);
    expect(
      result.report.findings
        .filter((finding: { code: string }) => finding.code === 'OWNER_CAPTURE_BASELINE_INCOMPLETE')
        .map((finding: { metadata: { owner_id: string } }) => finding.metadata.owner_id),
    ).toEqual(expected);
  });
  it.each([
    ['--savings', '3'],
    ['--owner', 'codex.intake.required-fields'],
    ['--candidate', 'HEAD'],
  ])('rejects caller claims or duplicate revision options %j', (...extra) => {
    const result = check(baseline, candidate, extra);
    expect(result.status).toBe(2);
    expect(result.report.errors[0].code).toBe('OWNER_CAPTURE_INPUT_INVALID');
    expect(existsSync(nodePath.join(directory, CONFORMANCE_RUN_LAYOUT.directory))).toBe(false);
  });
  it('reports an unknown revision as unavailable, never a retirement', () => {
    const result = check('missing-owned-fixture-revision');
    expect(result.status).toBe(3);
    expect(result.report.errors[0].code).toBe('OWNER_CAPTURE_UNAVAILABLE');
    expect(result.report.data?.owner_delta).toBeUndefined();
  });
  it('seals the originating comparison and rejects tampering without regenerating a missing key', () => {
    const result = check();
    const location = store();
    const records = readConformanceAttempts(location);
    expect(records?.[0]?.payload).toEqual(result.report.data.owner_delta);
    const recordName = readdirSync(location.directory).find(name => name.endsWith('.json'));
    assert.ok(recordName);
    const file = nodePath.join(location.directory, recordName);
    const original = readFileSync(file, 'utf8');
    const forged = JSON.parse(original);
    forged.payload.retired_owners = ['forged-owner'];
    writeFileSync(file, JSON.stringify(forged));
    expect(readConformanceAttempts(location)).toBeUndefined();
    writeFileSync(file, original);
    rmSync(location.keyFile);
    expect(readConformanceAttempts(location)).toBeUndefined();
    expect(check().status).toBe(3);
    expect(existsSync(location.keyFile)).toBe(false);
  });
});
