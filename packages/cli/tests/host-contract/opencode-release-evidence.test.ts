import { createHash } from 'node:crypto';

import { expect, it } from 'vitest';

import { verifyOpenCodeReleaseEvidence } from '../../scripts/lib/opencode-release-evidence.js';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fixture(overrides: Record<string, unknown> = {}) {
  const report = Buffer.from('fixture report');
  const sourceRevision = 'a'.repeat(40);
  const packageDigest = 'b'.repeat(64);
  const requiredCases = ['opencode-cli', 'opencode-tui'];
  const bundle = Buffer.from(
    JSON.stringify({
      purpose: 'release-qualification',
      admission_eligible: true,
      source_head: sourceRevision,
      candidate_payload_sha256: packageDigest,
      case_ids: requiredCases,
      report_sha256: { 'opencode-cases.json': digest(report) },
      ...overrides,
    }),
  );
  return {
    bundle,
    reports: new Map([['opencode-cases.json', report]]),
    sourceRevision,
    packageDigest,
    requiredCases,
    approval: { sourceRevision, bundleDigest: digest(bundle) },
  };
}

it('accepts matching exact evidence under the supplied authenticated approval', () => {
  expect(() => {
    verifyOpenCodeReleaseEvidence(fixture());
  }).not.toThrow();
});

it('rejects incomplete evidence even with a matching approval', () => {
  expect(() => {
    verifyOpenCodeReleaseEvidence(fixture({ admission_eligible: false }));
  }).toThrow('Qualification evidence is incomplete');
});

it('rejects a missing approval and a stale approval', () => {
  const input = fixture();
  expect(() => {
    verifyOpenCodeReleaseEvidence({ ...input, approval: undefined });
  }).toThrow('Missing current maintainer approval');
  expect(() => {
    verifyOpenCodeReleaseEvidence({
      ...input,
      approval: { ...input.approval, bundleDigest: 'stale' },
    });
  }).toThrow('Approval covers a different bundle');
});

it('rejects altered report bytes and a different package', () => {
  const input = fixture();
  expect(() => {
    verifyOpenCodeReleaseEvidence({
      ...input,
      reports: new Map([['opencode-cases.json', Buffer.from('altered')]]),
    });
  }).toThrow('Changed qualification report');
  expect(() => {
    verifyOpenCodeReleaseEvidence({ ...input, packageDigest: 'different' });
  }).toThrow('Evidence covers a different OpenCode payload');
});

it('rejects duplicate case IDs even if the total count matches', () => {
  expect(() => {
    verifyOpenCodeReleaseEvidence(fixture({ case_ids: ['opencode-cli', 'opencode-cli'] }));
  }).toThrow('Wrong qualified case set');
});

it('rejects reviewed evidence for a different source revision', () => {
  expect(() => {
    verifyOpenCodeReleaseEvidence(fixture({ source_head: 'c'.repeat(40) }));
  }).toThrow('Evidence covers a different source revision');
});

it('rejects a missing, extra, or renamed report', () => {
  const input = fixture();
  const original = input.reports.get('opencode-cases.json');
  if (original === undefined) throw new Error('Fixture must contain the OpenCode cases report');
  for (const reports of [
    new Map(),
    new Map([...input.reports, ['extra.json', original]]),
    new Map([['renamed.json', original]]),
  ]) {
    expect(() => {
      verifyOpenCodeReleaseEvidence({ ...input, reports });
    }).toThrow('Wrong qualification report set');
  }
});

it('rejects diagnostic evidence even when explicitly approved', () => {
  expect(() => {
    verifyOpenCodeReleaseEvidence(fixture({ purpose: 'diagnostic-only' }));
  }).toThrow('Expected release qualification evidence');
});

it('rejects approval for another source revision', () => {
  const input = fixture();
  expect(() => {
    verifyOpenCodeReleaseEvidence({
      ...input,
      approval: { ...input.approval, sourceRevision: 'c'.repeat(40) },
    });
  }).toThrow('Approval covers a different source revision');
});

it.each([[], ['opencode-cli'], ['opencode-cli', 'opencode-tui', 'other']])(
  'rejects an incomplete or expanded case set %j',
  (...cases) => {
    expect(() => {
      verifyOpenCodeReleaseEvidence(fixture({ case_ids: cases }));
    }).toThrow('Wrong qualified case set');
  },
);

it('rejects invalid case inventories and malformed approved bundles', () => {
  const input = fixture();
  for (const requiredCases of [[], ['opencode-cli', 'opencode-cli']]) {
    expect(() => {
      verifyOpenCodeReleaseEvidence({
        ...fixture({ case_ids: requiredCases }),
        requiredCases,
      });
    }).toThrow('Invalid required case inventory');
  }
  const bundle = Buffer.from('invalid JSON');
  expect(() => {
    verifyOpenCodeReleaseEvidence({
      ...input,
      bundle,
      approval: { ...input.approval, bundleDigest: digest(bundle) },
    });
  }).toThrow(SyntaxError);
});
