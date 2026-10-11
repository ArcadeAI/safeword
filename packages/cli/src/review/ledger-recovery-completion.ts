import nodePath from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { LEDGER_RECOVERY_CONTRACT_PATH } from '../schema.js';
import { approvedLedgerRecoveryReviews, validLedgerRecoveryObservationTag } from './job.js';
import cases from './ledger-recovery-cases.json' with { type: 'json' };
import {
  LEDGER_RECOVERY_PROFILE,
  ledgerRecoveryProfileIdentity,
} from './ledger-recovery-profile.js';
import { assessRecoveryReport } from './ledger-recovery-report.js';
import { LEDGER_RECOVERY_REVIEW_RUBRIC_SHA256 } from './ledger-recovery-rubric.generated.js';
import {
  assertRecoverySource,
  RECOVERY_AUDIT_PATHS,
  recoveryDigest,
  recoveryGit,
  recoveryProductTree,
} from './ledger-recovery-source.js';
import { readProofInput } from './retrospective-proof.js';

const audit = '.project/tickets/V2ZPV1-recover-accurate-completion-evidence';
export const RECOVERY_MANIFEST_PATH = `${audit}/recovery-manifest.json`;
export const RECOVERY_SUMMARY_PATH = `${audit}/evidence-summary.json`;
export interface RecoveryInput {
  path: string;
  sha256: string;
  reviewParts?: { path: string; sha256: string }[];
}
interface ReportFeature {
  elements: {
    name: string;
    line: number;
    steps: { hidden?: boolean; match?: { location: string } }[];
  }[];
}
export interface RecoveryObservation {
  kind: string;
  ticket: string;
  profile: string;
  revision: string;
  productTree: string;
  report: string;
  reportSha256: string;
  exitCode: number;
  inputs: RecoveryInput[];
  summary: unknown;
}

/** Called only after the full report has passed the exact installed case contract. */
export function recoveryEvidenceSummary(
  observation: RecoveryObservation,
  relative: string,
  report: unknown,
) {
  const parsed = assessRecoveryReport(report, observation.exitCode);
  if (parsed === undefined)
    throw new Error('Recovery report does not pass the installed active scope.');
  const feature = (report as ReportFeature[])[0];
  if (feature === undefined) throw new Error('Recovery feature is missing.');
  return {
    kind: 'ledger-recovery-summary:v1',
    ticket: LEDGER_RECOVERY_PROFILE.ticket,
    profile: ledgerRecoveryProfileIdentity(),
    observation: relative,
    productTree: observation.productTree,
    reportSha256: observation.reportSha256,
    activeCases: parsed.cases,
    activeCaseDetails: cases
      .filter(item => !item.deferred)
      .map(({ name, line, digest }) => ({ name, line, digest })),
    inputs: observation.inputs,
    caseInputs: feature.elements.map(item => {
      const expected = cases.find(
        candidate => candidate.name === item.name && candidate.line === item.line,
      );
      if (expected === undefined) throw new Error('Recovery case identity is missing.');
      const paths = [
        ...new Set(
          item.steps
            .filter(step => step.hidden !== true)
            .map(step => {
              if (step.match === undefined)
                throw new Error('Recovery assertion location is missing.');
              return step.match.location.replace(/:\d+$/, '');
            }),
        ),
      ];
      return { digest: expected.digest, paths };
    }),
    deferredCases: cases
      .filter(item => item.deferred)
      .map(({ name, line, digest, owners }) => ({
        name,
        line,
        digest,
        owners,
        status: 'deferred-unverified',
      })),
  };
}

function requireCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function inputReviewPaths(root: string, input: RecoveryInput, directory: string): string[] {
  requireCondition(
    RECOVERY_AUDIT_PATHS.every(path => path !== input.path),
    'An execution input cannot be an audit exception.',
  );
  const bytes = readProofInput(root, input.path);
  requireCondition(
    recoveryDigest(bytes) === input.sha256,
    `Execution input changed: ${input.path}`,
  );
  if (input.reviewParts === undefined) return [input.path];
  requireCondition(
    input.path === 'bun.lock' && input.reviewParts.length === 2,
    'Only the exact lockfile may use two review parts.',
  );
  const parts = input.reviewParts.map((part, index) => {
    requireCondition(
      part.path === `${directory}/bun.lock-part-${index + 1}.txt`,
      'Unexpected lockfile part path.',
    );
    const content = readProofInput(root, part.path);
    requireCondition(recoveryDigest(content) === part.sha256, 'Lockfile review part changed.');
    return content;
  });
  requireCondition(
    Buffer.concat(parts).equals(bytes),
    'Review parts do not reproduce the observed lockfile.',
  );
  return input.reviewParts.map(part => part.path);
}

export function ledgerRecoveryCompletion(root: string): CliResult {
  try {
    assertRecoverySource(root);
    recoveryGit(root, ['merge-base', '--is-ancestor', LEDGER_RECOVERY_PROFILE.baseline, 'HEAD']);
    const manifest = JSON.parse(readProofInput(root, RECOVERY_MANIFEST_PATH).toString()) as {
      kind: string;
      ticket: string;
      profile: string;
      observation: string;
    };
    requireCondition(
      manifest.kind === 'ledger-recovery-manifest:v1' &&
        manifest.ticket === LEDGER_RECOVERY_PROFILE.ticket &&
        manifest.profile === ledgerRecoveryProfileIdentity(),
      'Recovery manifest is outside the installed profile.',
    );
    requireCondition(
      /^\.safeword\/state\/reviews\/ledger-recovery-[a-f\d-]{36}\/observation\.json$/u.test(
        manifest.observation,
      ),
      'Observation must be retained in its runtime-owned directory.',
    );
    const directory = nodePath.posix.dirname(manifest.observation);
    const content = readProofInput(root, manifest.observation).toString();
    const tag = readProofInput(root, `${directory}/observation.tag`).toString();
    requireCondition(
      validLedgerRecoveryObservationTag(root, content, tag),
      'Recovery observation authentication failed.',
    );
    const observation = JSON.parse(content) as RecoveryObservation;
    requireCondition(
      observation.productTree === recoveryProductTree(root),
      'Producing product tree is no longer current.',
    );
    recoveryGit(root, ['merge-base', '--is-ancestor', observation.revision, 'HEAD']);
    requireCondition(
      observation.report === nodePath.join(root, directory, 'report.json'),
      'Report is outside the observation directory.',
    );
    const bytes = readProofInput(root, `${directory}/report.json`);
    requireCondition(
      recoveryDigest(bytes) === observation.reportSha256,
      'Retained acceptance report changed.',
    );
    const report: unknown = JSON.parse(bytes.toString());
    const parsed = assessRecoveryReport(report, observation.exitCode);
    requireCondition(
      parsed !== undefined && isDeepStrictEqual(parsed, observation.summary),
      'Observation does not bind a passing exact active report.',
    );
    requireCondition(
      Array.isArray(observation.inputs) && observation.inputs.length > 0,
      'Resolved execution inputs are missing.',
    );
    const paths = observation.inputs.map(input => input.path);
    requireCondition(
      new Set(paths).size === paths.length,
      'Execution input identities are duplicated.',
    );
    for (const required of [
      'cucumber.mjs',
      'scripts/dev',
      'mise.toml',
      'bun.lock',
      '.safeword/config.json',
      'package.json',
      LEDGER_RECOVERY_PROFILE.feature,
    ]) {
      requireCondition(
        paths.includes(required),
        `Required execution input is missing: ${required}`,
      );
    }
    const reviewPaths = new Map(
      observation.inputs.map(input => [input.path, inputReviewPaths(root, input, directory)]),
    );
    const summary = recoveryEvidenceSummary(observation, manifest.observation, report);
    const reviewedSummary = JSON.parse(readProofInput(root, RECOVERY_SUMMARY_PATH).toString());
    requireCondition(
      isDeepStrictEqual(summary, reviewedSummary),
      'Reviewed summary differs from the authenticated evidence.',
    );
    requireCondition(
      recoveryDigest(readProofInput(root, LEDGER_RECOVERY_CONTRACT_PATH)) ===
        LEDGER_RECOVERY_REVIEW_RUBRIC_SHA256,
      'Installed recovery contract changed.',
    );
    const targets = [RECOVERY_MANIFEST_PATH, RECOVERY_SUMMARY_PATH, LEDGER_RECOVERY_CONTRACT_PATH];
    const receipts = approvedLedgerRecoveryReviews(root).filter(receipt =>
      targets.every(path => receipt.targets.includes(path)),
    );
    const coveredInputs = new Set(receipts.flatMap(receipt => receipt.context));
    for (const required of reviewPaths.values())
      requireCondition(
        required.every(path => coveredInputs.has(path)),
        'Independent certification does not cover every execution input.',
      );
    for (const item of summary.caseInputs) {
      requireCondition(
        item.paths.every(path => reviewPaths.has(path)),
        'A case references an unobserved execution input.',
      );
      requireCondition(
        receipts.some(
          receipt =>
            receipt.certification.cases.includes(item.digest) &&
            item.paths.every(path =>
              (reviewPaths.get(path) ?? []).every(part => receipt.context.includes(part)),
            ),
        ),
        'An active case lacks independent certification of its actual execution inputs.',
      );
    }
    return createResult({
      state: 'healthy',
      data: { command: 'review gate ledger-recovery', status: 'approved', summary },
    });
  } catch (error: unknown) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'LEDGER_RECOVERY_EVIDENCE_REJECTED',
          severity: 'warning',
          message: error instanceof Error ? error.message : 'Recovery evidence is invalid.',
        },
      ],
      data: { command: 'review gate ledger-recovery', status: 'blocked' },
    });
  }
}
