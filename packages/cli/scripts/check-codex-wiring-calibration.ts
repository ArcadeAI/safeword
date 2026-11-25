import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import corpus from '../tests/fixtures/host-contract/codex-wiring-calibration.json' with { type: 'json' };
import { isolatedBuildIdentity } from '../tests/helpers/codex-isolated-build.js';
import { provisionIsolatedGrade } from '../tests/helpers/codex-isolated-project.js';
import { seedWiringReview, type WiringArm } from '../tests/helpers/codex-review-wiring.js';
import { dispatchWiringClaim } from '../tests/helpers/codex-wiring-dispatch.js';
import { wiringReference } from '../tests/helpers/codex-wiring-grade.js';

const inputRoots = ['src', 'scripts', 'tests/helpers', 'tests/fixtures/host-contract'];

// Exact local producer/build/view inputs, not the architecture shape fingerprint.
export function calibrationInputs(): string {
  const root = path.resolve(import.meta.dirname, '..');
  const files = [
    '../../package.json',
    '../../bun.lock',
    '../../mise.toml',
    'package.json',
    'tsup.config.ts',
  ];
  for (const directory of inputRoots) {
    const entries = readdirSync(path.join(root, directory), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      assert.ok(!entry.isSymbolicLink(), 'Calibration source symlink is unsupported');
      if (entry.isFile()) files.push(path.relative(root, path.join(entry.parentPath, entry.name)));
    }
  }
  const hash = createHash('sha256');
  const sorted = files.toSorted((left, right) => left.localeCompare(right));
  for (const file of sorted) {
    const content = createHash('sha256')
      .update(readFileSync(path.join(root, file)))
      .digest('hex');
    hash.update(JSON.stringify([file, content]));
  }
  return hash.digest('hex');
}

/** Fixed AUTHOR-OWNED SYNTHETIC claims, not observed native candidate identities.
 * Expected labels, corpus IDs, arm and comparison baseline stay outside this view.
 */
export function calibrationView(directory: string, index: number): string {
  const sample = corpus.cases[index];
  assert.ok(sample);
  const files = seedWiringReview(directory, sample.fixture as WiringArm);
  return JSON.stringify({
    claim: 'Each candidate review satisfies reference.md for its supplied source and tests.',
    projects: [
      {
        id: randomUUID(),
        files,
        review: {
          verdict: sample.verdict,
          findings: sample.messages.map(message => ({ severity: sample.severity, message })),
        },
      },
    ],
  });
}

export function runCalibration(output: string, authProfile: string): number {
  const root = realpathSync(path.resolve(import.meta.dirname, '..'));
  const parent = path.relative(root, realpathSync(path.dirname(output)));
  assert.ok(
    inputRoots.every(
      directory => !(parent === directory || parent.startsWith(`${directory}${path.sep}`)),
    ),
    'Calibration output/artifacts must be outside hashed input roots',
  );
  assert.equal(corpus.cases.length, 12);
  assert.equal(new Set(corpus.cases.map(sample => sample.id)).size, 12);
  assert.equal(corpus.repetitions, 2);
  const directory = mkdtempSync(path.join(path.dirname(output), 'wiring-calibration-'));
  const attempts: Record<string, unknown>[] = [];
  const result = {
    kind: 'AUTHOR-OWNED SYNTHETIC reference calibration',
    planned: 24,
    declared_candidate_baseline: {
      agent: 'claude',
      provider: 'anthropic',
      model: 'claude-opus-5',
      observed: false,
    },
    directory,
    inputs_identity: calibrationInputs(),
    attempts,
    complete: false,
    passed: false,
  };
  writeFileSync(output, JSON.stringify(result), { flag: 'wx' });
  const corpusFile = path.resolve(
    import.meta.dirname,
    '../tests/fixtures/host-contract/codex-wiring-calibration.json',
  );
  const fixed = [corpusFile, wiringReference].map(file => readFileSync(file, 'utf8'));
  let code = 0;
  let expectedBuild: string | undefined;
  for (const [index, sample] of corpus.cases.entries()) {
    for (let repetition = 0; repetition < corpus.repetitions; repetition++) {
      const attempt: Record<string, unknown> = {
        case_id: sample.id,
        repetition,
        expected: sample.expected,
      };
      attempts.push(attempt);
      let owned: ReturnType<typeof provisionIsolatedGrade> | undefined;
      try {
        assert.equal(calibrationInputs(), result.inputs_identity, 'Calibration inputs changed');
        assert.deepEqual(
          [corpusFile, wiringReference].map(file => readFileSync(file, 'utf8')),
          fixed,
        );
        owned = provisionIsolatedGrade(directory, authProfile);
        attempt.artifacts = owned.artifacts;
        expectedBuild ??= owned.buildIdentity;
        assert.equal(owned.buildIdentity, expectedBuild, 'Bound grader code changed');
        attempt.build_identity = owned.buildIdentity;
        attempt.binding = owned.binding;
        const fixture = path.join(owned.artifacts, 'source-control');
        mkdirSync(fixture);
        const claim = calibrationView(fixture, index);
        writeFileSync(output, JSON.stringify(result, undefined, 2));
        const dispatch = dispatchWiringClaim(owned, claim, [
          { agent: 'claude', confirmed: { provider: 'anthropic', model: 'claude-opus-5' } },
        ]);
        attempt.review_id = dispatch.id;
        const grade = dispatch.read();
        assert.equal(calibrationInputs(), result.inputs_identity, 'Calibration inputs changed');
        assert.deepEqual(
          [corpusFile, wiringReference].map(file => readFileSync(file, 'utf8')),
          fixed,
        );
        assert.equal(
          isolatedBuildIdentity(readFileSync(owned.binding.runtime, 'utf8'), owned.binding),
          expectedBuild,
        );
        attempt.grade = grade;
        attempt.correct = grade.accepted === sample.expected;
        if (!attempt.correct) code = 2;
      } catch (error) {
        // No retry, fallback grade, or promotion of requested identity.
        attempt.unavailable = error instanceof Error ? error.message : 'Unknown grading failure';
        writeFileSync(output, JSON.stringify(result, undefined, 2));
        return 3;
      } finally {
        owned?.cleanupCredentials();
      }
      writeFileSync(output, JSON.stringify(result, undefined, 2));
    }
  }
  result.complete = attempts.length === 24;
  result.passed = result.complete && code === 0;
  writeFileSync(output, JSON.stringify(result, undefined, 2));
  return code;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      'require-targets': { type: 'boolean' },
      output: { type: 'string' },
      'auth-profile': { type: 'string' },
    },
  });
  const authProfile = values['auth-profile'] ?? process.env.CODEX_HOME;
  assert.ok(values['require-targets'] && values.output && authProfile);
  process.exitCode = runCalibration(path.resolve(values.output), path.resolve(authProfile));
}
