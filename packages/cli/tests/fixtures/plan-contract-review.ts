import { deepStrictEqual } from 'node:assert';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { prepareReviewPacket } from '../../src/review/packet.ts';
import { runHeadlessReviewer } from '../../src/review/runtime.ts';
import { writePlanningInventories } from '../planning-fixtures.ts';

interface Input {
  contractState: string;
}

const input = JSON.parse(readFileSync(0, 'utf8')) as Input;
const project = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-plan-contract-project-'));
const trustedBin = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-plan-contract-bin-'));
const priorNodeEnvironment = process.env.NODE_ENV;
const priorPath = process.env.PATH;

try {
  writePlanningInventories(project);
  writeFileSync(nodePath.join(project, 'impl-plan.md'), '# Implementation Plan\n');
  const baseline = prepareReviewPacket(project, 'plan-implementation', ['impl-plan.md']);
  const author = baseline.packet.plan_contract?.author;
  baseline.cleanup();
  if (author === undefined) throw new Error('the packaged plan contract is missing');

  const matching = input.contractState === 'the same current decision-quality obligations';
  const reviewer = matching
    ? author
    : {
        sha256: 'contradictory-reviewer-contract',
        obligations: [
          ...author.obligations.filter(obligation => obligation !== 'Proof quality'),
          'Require execution sequencing',
        ],
      };
  const prepared = prepareReviewPacket(project, 'plan-implementation', ['impl-plan.md'], [], {
    planContract: { author, reviewer },
  });
  try {
    const executable = nodePath.join(trustedBin, 'claude');
    const reviewerOutput = {
      schema_version: 1,
      dispatch_id: prepared.packet.dispatch_id,
      reviewer_agent: 'claude',
      verdict: 'approve',
      summary: 'The supplied plan is otherwise reviewable.',
      findings: [],
      evidence_records: { schema_version: 1, records: [] },
    };
    const outputPath = nodePath.join(trustedBin, 'review-output.json');
    const inputPath = nodePath.join(trustedBin, 'received-prompt.txt');
    writeFileSync(outputPath, JSON.stringify({ structured_output: reviewerOutput }));
    writeFileSync(
      executable,
      `#!/bin/sh\nif [ "\${1:-}" = "--help" ]; then\n  echo '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools'\n  exit 0\nfi\n/bin/cat > '${inputPath}'\n/bin/cat '${outputPath}'\n`,
    );
    chmodSync(executable, 0o755);
    process.env.NODE_ENV = 'test';
    process.env.PATH = trustedBin;
    const result = await runHeadlessReviewer('claude', prepared.packet, project, process.cwd());
    const receivedPacket = JSON.parse(
      readFileSync(inputPath, 'utf8').trim().split('\n').pop() ?? '',
    ) as typeof prepared.packet;
    deepStrictEqual(
      receivedPacket.plan_contract,
      prepared.packet.plan_contract,
      'the reviewer did not receive the prepared plan contract',
    );
    process.stdout.write(
      JSON.stringify({
        verdict: result.verdict,
        findings: result.findings,
        authorObligations: receivedPacket.plan_contract?.author.obligations,
        reviewerObligations: receivedPacket.plan_contract?.reviewer.obligations,
      }),
    );
  } finally {
    prepared.cleanup();
  }
} finally {
  process.env.NODE_ENV = priorNodeEnvironment;
  process.env.PATH = priorPath;
  rmSync(project, { recursive: true, force: true });
  rmSync(trustedBin, { recursive: true, force: true });
}
