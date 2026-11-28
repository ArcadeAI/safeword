import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  calibrationInputs,
  calibrationView,
} from '../../scripts/check-codex-wiring-calibration.js';
import corpus from '../fixtures/host-contract/codex-wiring-calibration.json' with { type: 'json' };
import { isolatedBuildIdentity } from './codex-isolated-build.js';
import type { provisionIsolatedGrade } from './codex-isolated-project.js';
import { authenticatedWiringGrade } from './codex-wiring-grade.js';

/** Aggregate JSON locates attempts only. Reauthenticate every normal signed job,
 * exact fixed claim/reference, current source and equivalent bound runtime.
 */
export function requireWiringCalibration(
  file: string,
  owned: ReturnType<typeof provisionIsolatedGrade>,
) {
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: current authenticated 24/24 calibration';
  assert.equal(
    isolatedBuildIdentity(readFileSync(owned.binding.runtime, 'utf8'), owned.binding),
    owned.buildIdentity,
    unavailable,
  );
  const result = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(result.kind, 'AUTHOR-OWNED SYNTHETIC reference calibration', unavailable);
  assert.equal(result.inputs_identity, calibrationInputs(), unavailable);
  assert.equal(result.complete, true, unavailable);
  assert.equal(result.passed, true, unavailable);
  assert.equal(result.planned, 24, unavailable);
  assert.equal(result.attempts?.length, 24, unavailable);
  const directory = realpathSync(result.directory);
  const seen = new Set<string>();
  const controls = mkdtempSync(path.join(tmpdir(), 'wiring-calibration-validation-'));
  try {
    for (const [index, attempt] of result.attempts.entries()) {
      const sample = corpus.cases[Math.floor(index / corpus.repetitions)];
      assert.ok(sample, unavailable);
      assert.equal(attempt.case_id, sample.id, unavailable);
      assert.equal(attempt.repetition, index % corpus.repetitions, unavailable);
      assert.equal(attempt.expected, sample.expected, unavailable);
      const artifacts = realpathSync(attempt.artifacts);
      assert.equal(path.dirname(artifacts), directory, unavailable);
      assert.ok(!seen.has(artifacts), `${unavailable}: duplicate calibration artifacts`);
      seen.add(artifacts);
      const binding = {
        project: path.join(artifacts, 'project'),
        profile: path.join(artifacts, 'profile'),
        runtime: path.join(artifacts, 'package/runtime/cli.js'),
      };
      assert.deepEqual(attempt.binding, binding, unavailable);
      for (const target of Object.values(binding))
        assert.equal(realpathSync(target), target, unavailable);
      assert.equal(attempt.build_identity, owned.buildIdentity, unavailable);
      assert.equal(
        isolatedBuildIdentity(readFileSync(binding.runtime, 'utf8'), binding),
        owned.buildIdentity,
        unavailable,
      );
      const claim = readFileSync(path.join(binding.project, 'claim.json'), 'utf8');
      const actual = JSON.parse(claim);
      const expected = JSON.parse(
        calibrationView(controls, Math.floor(index / corpus.repetitions)),
      );
      assert.match(actual.projects?.[0]?.id ?? '', /^[\da-f-]{36}$/u, unavailable);
      expected.projects[0].id = actual.projects[0].id;
      assert.deepEqual(actual, expected, unavailable);
      const grade = authenticatedWiringGrade(
        {
          project: binding.project,
          profile: binding.profile,
          installed: path.dirname(path.dirname(binding.runtime)),
          artifacts,
          bun: owned.bun,
          environment: {
            ...owned.environment,
            CODEX_HOME: binding.profile,
            XDG_STATE_HOME: path.join(binding.profile, 'state'),
            SAFEWORD_REVIEW_KEY_ROOT: path.join(binding.profile, 'state'),
            SAFEWORD_CLI_ENTRYPOINT: binding.runtime,
          },
        },
        [],
        {
          id: attempt.review_id,
          claim,
          candidates: [
            { agent: 'claude', confirmed: { provider: 'anthropic', model: 'claude-opus-5' } },
          ],
        },
      );
      assert.equal(grade.accepted, sample.expected, unavailable);
    }
    assert.equal(calibrationInputs(), result.inputs_identity, unavailable);
    return {
      inputsIdentity: result.inputs_identity,
      buildIdentity: owned.buildIdentity,
      authenticatedGrades: seen.size,
    };
  } finally {
    rmSync(controls, { recursive: true, force: true });
  }
}
