import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';

const launcher = nodePath.resolve(import.meta.dirname, '../../../../scripts/dev');
export const RESTART_SEED_TEST_NAME = 'clamp upper boundary baseline';
export const essentialOwner = (source: string): string =>
  nodePath.join(source, 'packages/cli', TESTING_CORE_LAYOUT.owner);

/** Diagnostic comment changes the real canonical owner before normal generation. */
export function markEssentialCore(source: string, original: string, marker: string): string {
  const declaration = /export const TESTING_CORE_TEXT =\s*("(?:[^"\\]|\\.)*");/u;
  const literal = declaration.exec(original)?.[1];
  assert.ok(literal, 'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported canonical core declaration');
  const text: unknown = JSON.parse(literal);
  assert.equal(typeof text, 'string');
  const marked = JSON.stringify(`${text}\n\n<!-- ${marker} -->`);
  writeFileSync(
    essentialOwner(source),
    original.replace(declaration, () => `export const TESTING_CORE_TEXT = ${marked};`),
  );
  const result = spawnSync(
    launcher,
    [
      'bun',
      '--no-env-file',
      '-e',
      "import {testingCoreBlock} from './packages/cli/src/testing/shared-core.ts'; process.stdout.write(JSON.stringify(testingCoreBlock()));",
    ],
    { cwd: source, encoding: 'utf8', timeout: 30_000 },
  );
  assert.equal(
    result.status,
    0,
    `HOST_CONTRACT_PROOF_UNAVAILABLE: core owner evaluation: ${result.stderr}`,
  );
  const block: unknown = JSON.parse(result.stdout);
  assert.ok(typeof block === 'string' && block.includes(marker));
  return block;
}

const baselineFiles = ['clamp.js', 'clamp.test.js', 'package.json'] as const;
export interface NodeBaseline {
  project: string;
  artifacts: string;
  directory: string;
  hashes: Record<string, string>;
}
const fileHash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Trusted Given producer; once per own arm, before native B dispatch. */
export function captureNodeBaseline(project: string, artifacts: string): NodeBaseline {
  const baseline: NodeBaseline = {
    project: realpathSync(project),
    artifacts: realpathSync(artifacts),
    directory: nodePath.join(realpathSync(artifacts), 'node-baseline'),
    hashes: {},
  };
  assert.ok(
    !baseline.directory.startsWith(`${baseline.project}${nodePath.sep}`),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: baseline inside native project',
  );
  mkdirSync(baseline.directory); // EEXIST rejects recapture, including dangling links.
  for (const name of baselineFiles) {
    const file = nodePath.join(baseline.project, name);
    assert.ok(lstatSync(file).isFile(), 'HOST_CONTRACT_PROOF_UNAVAILABLE: baseline source');
    writeFileSync(nodePath.join(baseline.directory, name), readFileSync(file));
    baseline.hashes[name] = fileHash(file);
  }
  writeFileSync(nodePath.join(baseline.directory, 'capture.json'), JSON.stringify(baseline));
  return baseline;
}

function validatedBaseline(
  project: string,
  artifacts: string,
  baseline?: NodeBaseline,
): NodeBaseline {
  try {
    assert.ok(baseline);
    assert.equal(baseline.project, realpathSync(project));
    assert.equal(baseline.artifacts, realpathSync(artifacts));
    assert.equal(baseline.directory, nodePath.join(baseline.artifacts, 'node-baseline'));
    assert.equal(realpathSync(baseline.directory), baseline.directory);
    const receipt = readFileSync(nodePath.join(baseline.directory, 'capture.json'), 'utf8');
    assert.deepEqual(JSON.parse(receipt), baseline);
    for (const name of baselineFiles) {
      const file = nodePath.join(baseline.directory, name);
      assert.ok(lstatSync(file).isFile());
      assert.equal(fileHash(file), baseline.hashes[name]);
    }
    for (const name of ['clamp.js', 'package.json'])
      assert.equal(fileHash(nodePath.join(project, name)), baseline.hashes[name]);
    assert.notEqual(
      fileHash(nodePath.join(project, 'clamp.test.js')),
      baseline.hashes['clamp.test.js'],
    );
    return baseline;
  } catch (error) {
    throw new Error(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: missing, foreign, invalid or unchanged baseline',
      { cause: error },
    );
  }
}

/** Supporting local behavior check, never a native task/read receipt. */
export function discriminateNodeTests(
  project: string,
  artifacts: string,
  captured?: NodeBaseline,
): void {
  const baseline = validatedBaseline(project, artifacts, captured);
  let before: Record<string, unknown>;
  try {
    before = nodeDiscrimination(baseline.directory, baseline.directory);
  } catch (error) {
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: failing baseline', { cause: error });
  }
  const faults = ['lower', 'upper', 'interior', 'invalid-range'];
  const missed = faults.filter(label => !detected(before, label));
  assert.ok(missed.length > 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: already-complete baseline');
  const result = nodeDiscrimination(project, artifacts);
  result.evaluationRevision = 'whole-suite-increment-v1';
  result.baseline = { capture: baseline, results: before, missed };
  const diagnostic = nodePath.join(artifacts, 'non-seed-diagnostic');
  mkdirSync(diagnostic, { recursive: true });
  try {
    result.nonSeedDiagnostic = nodeDiscrimination(project, diagnostic, true);
  } catch (error) {
    result.nonSeedDiagnostic = { unavailable: String(error) };
  }
  assert.equal(
    fileHash(nodePath.join(project, 'clamp.js')),
    baseline.hashes['clamp.js'],
    'HOST_CONTRACT_PROOF_UNAVAILABLE: diagnostic restoration failed',
  );
  writeFileSync(
    nodePath.join(artifacts, 'node-discrimination.json'),
    `${JSON.stringify(result, undefined, 2)}\n`,
  );
  for (const label of faults)
    assert.ok(
      detected(result, label),
      `INTERNAL_WORKFLOW_UNMET: produced tests did not detect the ${label} fault`,
    );
  assert.ok(
    missed.some(label => detected(result, label)),
    'INTERNAL_WORKFLOW_UNMET: no gained fault detection',
  );
}

function detected(result: Record<string, unknown>, label: string): boolean {
  const run = result[label] as { status: number; cases: { failed: number } };
  return run.status === 1 && run.cases.failed > 0;
}

function nodeDiscrimination(
  project: string,
  artifacts: string,
  excludeSeed = false,
): Record<string, unknown> {
  const module = nodePath.join(project, 'clamp.js');
  const original = readFileSync(module, 'utf8');
  assert.match(
    original,
    /export\s+function\s+clamp\s*\(/u,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported owned clamp fixture',
  );
  const run = (label: string) => {
    const result = spawnSync(
      launcher,
      [
        'node',
        nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/codex-node-control.mjs'),
        ...(excludeSeed ? [`(?:^| )${RESTART_SEED_TEST_NAME}$`] : []),
      ],
      {
        cwd: project,
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    writeFileSync(
      nodePath.join(artifacts, `${label}-node-control.json`),
      JSON.stringify(
        {
          kind: 'supporting-node-control-not-native-receipt',
          status: result.status,
          signal: result.signal,
          error: result.error?.message,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        undefined,
        2,
      ),
    );
    assert.equal(result.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: Node control process');
    assert.equal(
      result.signal ?? undefined,
      undefined,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Node control signal',
    );
    let cases: { passed: number; failed: number; success: boolean };
    try {
      cases = JSON.parse(result.stdout);
    } catch {
      assert.fail('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported Node control events');
    }
    assert.ok(
      Number.isSafeInteger(cases?.passed) &&
        cases.passed >= 0 &&
        Number.isSafeInteger(cases.failed) &&
        cases.failed >= 0 &&
        typeof cases.success === 'boolean',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported Node control counts',
    );
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, cases };
  };
  const passing = (result: ReturnType<typeof run>) =>
    result.status === 0 &&
    result.cases.success &&
    result.cases.passed > 0 &&
    result.cases.failed === 0;
  const control: Record<string, unknown> = {
    kind: 'supporting-node-discrimination-not-native-receipt',
    excludedGivenSeed: excludeSeed ? RESTART_SEED_TEST_NAME : undefined,
  };
  let correctPassed = false;
  try {
    const correct = run('correct');
    control.correct = correct;
    assert.ok(
      correct.cases.passed > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no passing test can support discrimination',
    );
    correctPassed = passing(correct);
    assert.ok(
      correctPassed,
      'INTERNAL_WORKFLOW_UNMET: produced Node tests do not pass on the real module',
    );
    // Representative semantic faults, not a comprehensive mutation score.
    const faults = {
      lower: 'Math.min(max, value)',
      upper: 'Math.max(min, value)',
      interior: 'value > min && value < max ? min : Math.min(max, Math.max(min, value))',
      'invalid-range': 'Math.min(max, Math.max(min, value))',
    };
    for (const [label, expression] of Object.entries(faults)) {
      const guard =
        label === 'invalid-range' ? '' : 'if(min>max)return originalClamp(value,min,max);';
      writeFileSync(
        module,
        `${original}\n{ const originalClamp = clamp; clamp = (value,min,max) => {${guard}return ${expression};}; }\n`,
      );
      const broken = run(`broken-${label}`);
      control[label] = broken;
    }
  } finally {
    writeFileSync(module, original);
    control.restoredBytes = readFileSync(module, 'utf8') === original;
    const restored = run('restored');
    control.restored = restored;
    writeFileSync(
      nodePath.join(artifacts, 'node-discrimination.json'),
      `${JSON.stringify(control, undefined, 2)}\n`,
    );
    assert.ok(
      control.restoredBytes && (!correctPassed || passing(restored)),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Node control restoration failed',
    );
  }
  return control;
}
