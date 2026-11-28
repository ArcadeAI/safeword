import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

interface ReleaseEvidence {
  purpose: 'release-qualification';
  admission_eligible: true;
  source_head: string;
  candidate_payload_sha256: string;
  case_ids: string[];
  report_sha256: Record<string, string>;
}

interface ReleaseEvidenceInputs {
  bundle: Uint8Array;
  reports: ReadonlyMap<string, Uint8Array>;
  sourceRevision: string;
  packageDigest: string;
  requiredCases: readonly string[];
  /** Must come from the release controller's authenticated maintainer review. */
  approval?: { sourceRevision: string; bundleDigest: string };
}

/** Verify the approved bytes and scope. The caller owns authentication of the review. */
export function verifyOpenCodeReleaseEvidence(input: ReleaseEvidenceInputs): void {
  const { bundle, reports, sourceRevision, packageDigest, requiredCases, approval } = input;
  assert.ok(approval, 'Missing current maintainer approval');
  assert.equal(
    approval.sourceRevision,
    sourceRevision,
    'Approval covers a different source revision',
  );
  assert.equal(approval.bundleDigest, digest(bundle), 'Approval covers a different bundle');

  const evidence = JSON.parse(Buffer.from(bundle).toString('utf8')) as ReleaseEvidence;
  assert.equal(
    evidence.purpose,
    'release-qualification',
    'Expected release qualification evidence',
  );
  assert.equal(evidence.admission_eligible, true, 'Qualification evidence is incomplete');
  assert.equal(evidence.source_head, sourceRevision, 'Evidence covers a different source revision');
  assert.equal(
    evidence.candidate_payload_sha256,
    packageDigest,
    'Evidence covers a different OpenCode payload',
  );
  assert.ok(
    requiredCases.length > 0 && new Set(requiredCases).size === requiredCases.length,
    'Invalid required case inventory',
  );
  assert.deepEqual(
    evidence.case_ids.toSorted((left, right) => left.localeCompare(right)),
    requiredCases.toSorted((left, right) => left.localeCompare(right)),
    'Wrong qualified case set',
  );

  const names = Object.keys(evidence.report_sha256).toSorted((left, right) =>
    left.localeCompare(right),
  );
  assert.ok(names.length > 0, 'Missing qualification reports');
  assert.deepEqual(
    reports
      .keys()
      .toArray()
      .toSorted((left, right) => left.localeCompare(right)),
    names,
    'Wrong qualification report set',
  );
  for (const [name, bytes] of reports)
    assert.equal(
      digest(bytes),
      evidence.report_sha256[name],
      `Changed qualification report: ${name}`,
    );
}
