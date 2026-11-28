// Controlled reviewer-process/status checks only; NOT actual model calibration.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { provisionIsolatedGrade } from '../../helpers/codex-isolated-project.ts';
import { requireWiringCalibration } from '../../helpers/codex-wiring-calibration.ts';

const [file, authProfile] = process.argv.slice(2);
const original = JSON.parse(readFileSync(file, 'utf8'));
const owned = provisionIsolatedGrade(original.directory, authProfile);
try {
  assert.equal(requireWiringCalibration(file, owned).authenticatedGrades, 24);
  const altered = path.join(original.directory, 'altered.json');
  const mutations = [
    r => {
      r.inputs_identity = 'stale';
    },
    r => {
      r.attempts.pop();
    },
    r => {
      r.attempts[1] = { ...r.attempts[0], repetition: 1 };
    },
    r => {
      r.attempts[0].expected = !r.attempts[0].expected;
    },
    r => {
      r.attempts[0].binding.profile = owned.profile;
    },
    r => {
      r.attempts[0].review_id = 'foreign';
    },
    r => {
      r.attempts[0].build_identity = 'foreign';
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const result = globalThis.structuredClone(original);
    mutate(result);
    writeFileSync(altered, JSON.stringify(result));
    assert.throws(
      () => requireWiringCalibration(altered, owned),
      index === 2 ? /duplicate calibration artifacts/u : undefined,
    );
  }
  const first = original.attempts[0];
  const project = first.binding.project;
  const job = readdirSync(project, { recursive: true, encoding: 'utf8' }).find(name =>
    name.endsWith(`/${first.review_id}.json`),
  );
  assert.ok(job);
  const jobPath = path.join(project, job);
  const signed = readFileSync(jobPath, 'utf8');
  const unsigned = JSON.parse(signed);
  delete unsigned.integrity;
  writeFileSync(jobPath, JSON.stringify(unsigned));
  try {
    assert.throws(() => requireWiringCalibration(file, owned));
  } finally {
    writeFileSync(jobPath, signed);
  }
  const claimPath = path.join(project, 'claim.json');
  const claim = readFileSync(claimPath, 'utf8');
  writeFileSync(claimPath, claim.replace('claim', 'forged'));
  try {
    assert.throws(() => requireWiringCalibration(file, owned));
  } finally {
    writeFileSync(claimPath, claim);
  }
  process.stdout.write(
    JSON.stringify({ authenticated: 24, rejected: mutations.length + 2, nonreceipt: true }),
  );
} finally {
  owned.cleanupCredentials();
}
