import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { validatedResourceRevision } from '../../src/codex-plugin/resource-revision.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import {
  bundleInventory,
  codexWorkflowTemporaryBase,
} from '../helpers/codex-internal-workflows.js';
import { workflowReviewGroups } from '../helpers/codex-reviewed-workflow.js';
import { installedIndex } from '../helpers/codex-workflow-observation.js';
import {
  CodexWorkflowRuntimeActor,
  runWorkflowGenerator,
} from '../helpers/codex-workflow-runtime.js';

// OS-owned scratch fixture; no real profile/auth/vendor is accessed.
// The real actor, canonical source, marker owner and normal generator run. The
// external native binary is a sentinel that fails if preparation invokes it.
const scratchPrefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-staging-');
const root = realpathSync(mkdtempSync(scratchPrefix));
const repo = path.resolve(import.meta.dirname, '../../../..');
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const state: {
  actor?: CodexWorkflowRuntimeActor;
  staged?: ReturnType<CodexWorkflowRuntimeActor['stageRevisions']>;
  packageBefore?: Record<string, string>[];
  original?: Record<string, string>;
} = {};
function prepared() {
  const { actor, staged, packageBefore, original } = state;
  assert.ok(actor && staged && packageBefore && original);
  return { actor, staged, packageBefore, original };
}

beforeAll(() => {
  const profile = path.join(root, 'profile');
  const project = path.join(root, 'project');
  const installedPath = path.join(profile, 'plugins/cache/original');
  mkdirSync(project);
  mkdirSync(profile);
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installedPath, { recursive: true });
  writeFileSync(path.join(profile, 'config.toml'), '[hooks.state]\nsentinel="DO_NOT_TRANSFER"\n');
  // Deliberately no auth.json. Staging has no reason to open credentials.
  const binary = path.join(root, 'native-forbidden');
  writeFileSync(binary, '#!/bin/sh\necho NATIVE_MUST_NOT_RUN >&2\nexit 93\n', { mode: 0o755 });
  const hookManifestSha256 = digest(path.join(installedPath, 'hooks.json'));
  const fixture = path.join(root, 'fixture.json');
  const identity = path.join(root, 'identity.json');
  const packageManifestSha256 = digest(path.join(installedPath, '.codex-plugin/plugin.json'));
  const runtimeSha256 = digest(path.join(installedPath, 'runtime/cli.js'));
  writeFileSync(
    fixture,
    JSON.stringify({
      root,
      profile,
      project,
      installedPath,
      binary,
      hookManifestSha256,
      packageManifestSha256,
    }),
  );
  writeFileSync(identity, JSON.stringify({ originalManifest: hookManifestSha256, runtimeSha256 }));
  state.original = bundleInventory(profile);
  const actor = new CodexWorkflowRuntimeActor(fixture, identity);
  const row = codexInternalCases()[0];
  assert.ok(row);
  const arm = row.preservationArms[0];
  assert.ok(arm);
  const staged = actor.stageRevisions({ caseId: row.id, arm });
  Object.assign(state, {
    actor,
    staged,
    packageBefore: staged.stages.map(stage => bundleInventory(stage.packageRoot)),
  });
}, 180_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

it('uses the canonical OS temporary directory for non-Mac source fixtures', () => {
  const directory = realpathSync(tmpdir());
  expect(codexWorkflowTemporaryBase('linux', directory)).toBe(directory);
  // Mac ownership remains independent of TMPDIR, exactly as before.
  expect(codexWorkflowTemporaryBase('darwin', directory)).toBe('/private/tmp');
});

it.each(['outside-base', 'wrong-basename'])('refuses a fixture root with %s ownership', kind => {
  const parent = kind === 'outside-base' ? repo : codexWorkflowTemporaryBase();
  const prefix = kind === 'outside-base' ? 'codex-guard-portability-' : 'foreign-staging-';
  const foreign = mkdtempSync(path.join(parent, prefix));
  try {
    const fixture = JSON.parse(readFileSync(path.join(root, 'fixture.json'), 'utf8'));
    // Keep every downstream profile/tree check valid, so only root ownership
    // can reject this fixture.
    const profile = path.join(foreign, 'profile');
    cpSync(path.join(root, 'profile'), profile, { recursive: true });
    const file = path.join(root, `refused-${kind}.json`);
    writeFileSync(
      file,
      JSON.stringify({
        ...fixture,
        root: foreign,
        profile,
        project: path.join(foreign, 'project'),
        installedPath: path.join(profile, 'plugins/cache/original'),
      }),
    );
    expect(() => new CodexWorkflowRuntimeActor(file, path.join(root, 'identity.json'))).toThrow(
      assert.AssertionError,
    );
  } finally {
    rmSync(foreign, { recursive: true, force: true });
  }
});

it('prepares both distinct real revisions without native installation or credentials', () => {
  const { actor, staged, original } = prepared();
  expect(staged.mode).toBe('unsigned-preparation-only');
  expect(staged.admissionEligible).toBe(false);
  const row = codexInternalCases()[0];
  assert.ok(row);
  expect(staged.ownership).toEqual({ caseId: row.id, arm: row.preservationArms[0] });
  const manifest = JSON.parse(
    readFileSync(path.join(staged.project, 'staged-inputs.json'), 'utf8'),
  );
  expect(manifest.ownership).toEqual(staged.ownership);
  expect(staged.stages.map(stage => stage.label)).toEqual(['A', 'B']);
  const revisions = staged.stages.map(stage =>
    validatedResourceRevision(stage.packageRoot, installedIndex(stage.packageRoot)),
  );
  expect(revisions[0]).not.toBe(revisions[1]);
  for (const stage of staged.stages) {
    expect(JSON.parse(readFileSync(stage.inventory, 'utf8'))).toEqual(
      bundleInventory(stage.packageRoot),
    );
    expect(
      readFileSync(path.join(stage.packageRoot, 'internal/testing/SKILL.md'), 'utf8'),
    ).toContain(stage.revision.markers.testing);
    expect(
      readFileSync(path.join(stage.packageRoot, 'templates/guides/testing-guide.md'), 'utf8'),
    ).toContain(stage.revision.markers.guide);
    expect(stage.revision.essential.block).toContain(stage.revision.essential.marker);
    expect(digest(path.join(stage.source, 'packages/cli/src/testing/shared-core.ts'))).toBe(
      stage.revision.essential.ownerSha256,
    );
  }
  expect(bundleInventory(path.join(root, 'profile'))).toEqual(original);
  expect(existsSync(path.join(actor.artifacts, 'profile/auth.json'))).toBe(false);
  expect(existsSync(path.join(actor.artifacts, 'profile/plugins'))).toBe(false);
});

it('provides current matching coordinator bytes outside the input-review project', () => {
  const { staged } = prepared();
  const a = staged.stages[0];
  assert.ok(a);
  expect(readFileSync(staged.coordinator)).toEqual(
    readFileSync(path.join(a.packageRoot, 'runtime/cli.js')),
  );
  expect(digest(staged.coordinator)).toBe(staged.coordinatorSha256);
  const coordinatorRoot = path.dirname(path.dirname(staged.coordinator));
  expect(bundleInventory(coordinatorRoot)).toEqual(bundleInventory(a.packageRoot));
  expect(staged.coordinator.startsWith(`${staged.project}${path.sep}`)).toBe(false);
  for (const stage of staged.stages)
    for (const relative of [
      'src/review/packet.ts',
      'src/review/job.ts',
      'src/review/planning-context-identity.ts',
    ])
      expect(readFileSync(path.join(stage.source, 'packages/cli', relative))).toEqual(
        readFileSync(path.join(repo, 'packages/cli', relative)),
      );
});

it('makes the exact full input delta and inventories normally capturable', () => {
  const { staged } = prepared();
  for (const group of workflowReviewGroups(staged)) {
    const captured = prepareReviewPacket(
      staged.project,
      'quality-review',
      group.targets,
      group.context,
    );
    try {
      expect(captured.excludedTargets).toEqual([]);
      expect(
        captured.packet.context_files
          ?.map(file => file.path)
          .toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(
        group.context
          .map(file => path.relative(staged.project, file))
          .toSorted((a, b) => a.localeCompare(b)),
      );
      expect(captured.sourceChanged()).toBe(false);
      expect(captured.snapshotChanged()).toBe(false);
    } finally {
      captured.cleanup();
    }
  }
});

it('does not regenerate or permit native action after the pair is frozen', () => {
  const { actor, staged, packageBefore } = prepared();
  expect(() => actor.stageRevisions()).toThrow('stages already frozen');
  expect(() => actor.run('ordinary task')).toThrow(
    'staging-only actor cannot execute native actions',
  );
  expect(staged.stages.map(stage => bundleInventory(stage.packageRoot))).toEqual(packageBefore);
});

it('retains reproducible normal generator inputs for each package', () => {
  const { actor, staged } = prepared();
  for (const stage of staged.stages) {
    const checked = runWorkflowGenerator(stage.source, path.join(actor.artifacts, 'profile'), true);
    expect(checked.status, checked.output).toBe(0);
    expect(bundleInventory(stage.packageRoot)).toEqual(
      JSON.parse(readFileSync(stage.inventory, 'utf8')),
    );
  }
}, 120_000);

it.each(['case', 'arm'])(
  'refuses a foreign %s before creating stages',
  fault => {
    const row = codexInternalCases()[0];
    assert.ok(row);
    const arm = row.preservationArms[0];
    assert.ok(arm);
    const fresh = new CodexWorkflowRuntimeActor(
      path.join(root, 'fixture.json'),
      path.join(root, 'identity.json'),
    );
    const ownership = { caseId: row.id, arm };
    if (fault === 'case') ownership.caseId = 'foreign-case';
    else ownership.arm = 'foreign-arm';
    expect(() => fresh.stageRevisions(ownership)).toThrow('foreign staging case/arm');
    expect(existsSync(path.join(fresh.artifacts, 'staged'))).toBe(false);
  },
  120_000,
);

it('reuses prepared bytes for the normal trust check and refuses drift before native execution', () => {
  const selection = {
    caseId: 'a-restarted-session-receives-current-essential-workflow-instructions',
    arm: 'single',
  };
  const originalFixture = path.join(root, 'fixture.json');
  const identity = path.join(root, 'identity.json');
  const pair = new CodexWorkflowRuntimeActor(originalFixture, identity).stageRevisions(selection);
  const file = path.join(root, 'normal-stages.json');
  const fixture = JSON.parse(readFileSync(originalFixture, 'utf8'));
  writeFileSync(
    file,
    JSON.stringify({
      ...fixture,
      mode: 'normal',
      normalTrustQualification: true,
      normalTrustStages: path.join(pair.project, 'staged-inputs.json'),
    }),
  );
  class NormalStageActor extends CodexWorkflowRuntimeActor {
    installCandidate(candidate: string) {
      expect(this.bypassesPersistedTrust()).toBe(false);
      this.generateCandidate('must-not-regenerate', candidate, 'must-not-regenerate');
    }
  }
  const actor = new NormalStageActor(file, identity, selection);
  const [a, b] = pair.stages;
  assert.ok(a && b);
  const candidate = path.join(actor.artifacts, 'candidate');
  actor.installCandidate(candidate);
  expect(bundleInventory(candidate)).toEqual(bundleInventory(a.packageRoot));
  writeFileSync(path.join(b.packageRoot, 'runtime/cli.js'), 'drift');
  expect(() => {
    actor.installCandidate(candidate);
  }).toThrow(assert.AssertionError);
  expect(existsSync(path.join(actor.artifacts, 'version.stdout'))).toBe(false);
}, 120_000);
