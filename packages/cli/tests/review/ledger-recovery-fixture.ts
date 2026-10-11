// Simulated-host gate controls. Never current acceptance or historical TDD proof.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { vi } from 'vitest';

import {
  approvedLedgerRecoveryReview,
  ledgerRecoveryObservationTag,
  startReviewJob,
} from '../../src/review/job.js';
import cases from '../../src/review/ledger-recovery-cases.json' with { type: 'json' };
import { RECOVERY_CONFIRMATIONS } from '../../src/review/ledger-recovery-certification.js';
import {
  LEDGER_RECOVERY_PROFILE,
  ledgerRecoveryProfileIdentity,
} from '../../src/review/ledger-recovery-profile.js';
import { assessRecoveryReport } from '../../src/review/ledger-recovery-report.js';
import { recoveryDigest, recoveryProductTree } from '../../src/review/ledger-recovery-source.js';
import { LEDGER_RECOVERY_CONTRACT_PATH } from '../../src/schema.js';
import { SIGNED_REVIEW_COMPLETION_WORKER } from '../review-fixtures.js';

const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const audit = '.project/tickets/V2ZPV1-recover-accurate-completion-evidence';
export const RECOVERY_MANIFEST = `${audit}/recovery-manifest.json`;
export const RECOVERY_SUMMARY = `${audit}/evidence-summary.json`;

export function fixtureGit(root: string, args: readonly string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

export async function simulatedRecoveryFixture(prepare?: (root: string) => void) {
  const prefix = nodePath.join(tmpdir(), 'safeword-recovery-gate-test-');
  const temporary = realpathSync(mkdtempSync(prefix));
  const root = nodePath.join(temporary, 'candidate');
  fixtureGit(repo, ['worktree', 'add', '--detach', root, 'HEAD']);
  const cleanup = () => {
    fixtureGit(repo, ['worktree', 'remove', '--force', root]);
    rmSync(temporary, { recursive: true, force: true });
  };
  try {
    prepare?.(root);
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', nodePath.join(temporary, 'keys'));
    const report = parserReport();
    const feature = report[0];
    if (feature === undefined) throw new Error('Simulated feature is missing.');
    const summary = assessRecoveryReport(report, 0);
    if (summary === undefined) throw new Error('Simulated active report is invalid.');
    const inputPaths = [
      ...new Set([
        'cucumber.mjs',
        'scripts/dev',
        'mise.toml',
        'bun.lock',
        '.safeword/config.json',
        'package.json',
        LEDGER_RECOVERY_PROFILE.feature,
        'steps/world.ts',
        ...feature.elements.flatMap(item =>
          item.steps.map(step => step.match.location.replace(/:\d+$/, '')),
        ),
      ]),
    ].toSorted((left, right) => left.localeCompare(right));
    const directory = nodePath.join(
      root,
      '.safeword/state/reviews/ledger-recovery-00000000-0000-0000-0000-000000000001',
    );
    mkdirSync(directory, { recursive: true });
    const inputs = inputPaths.map(path => {
      const bytes = readFileSync(nodePath.join(root, path));
      if (path !== 'bun.lock') return { path, sha256: recoveryDigest(bytes) };
      const split = bytes.indexOf('\n', Math.floor(bytes.length / 2)) + 1;
      const reviewParts = [bytes.subarray(0, split), bytes.subarray(split)].map((part, index) => {
        const absolute = nodePath.join(directory, `bun.lock-part-${index + 1}.txt`);
        writeFileSync(absolute, part);
        return { path: nodePath.relative(root, absolute), sha256: recoveryDigest(part) };
      });
      return { path, sha256: recoveryDigest(bytes), reviewParts };
    });
    const reportPath = nodePath.join(directory, 'report.json');
    writeFileSync(reportPath, JSON.stringify(report));
    const observation = {
      kind: 'ledger-recovery-observation:v1',
      ticket: '5F5ZZA',
      profile: ledgerRecoveryProfileIdentity(),
      revision: fixtureGit(root, ['rev-parse', 'HEAD']),
      productTree: recoveryProductTree(root),
      report: reportPath,
      reportSha256: recoveryDigest(readFileSync(reportPath)),
      exitCode: 0,
      inputs,
      summary,
    };
    const observationPath = nodePath.join(directory, 'observation.json');
    const observationRelative = nodePath.relative(root, observationPath);
    writeObservation(root, observationPath, observation);
    writeFileSync(
      nodePath.join(root, RECOVERY_MANIFEST),
      JSON.stringify({
        kind: 'ledger-recovery-manifest:v1',
        ticket: '5F5ZZA',
        profile: ledgerRecoveryProfileIdentity(),
        observation: observationRelative,
      }),
    );
    // The gate must recompute this from authenticated report/source, not trust these counts.
    writeFileSync(
      nodePath.join(root, RECOVERY_SUMMARY),
      JSON.stringify({
        kind: 'ledger-recovery-summary:v1',
        ticket: '5F5ZZA',
        profile: ledgerRecoveryProfileIdentity(),
        observation: observationRelative,
        productTree: observation.productTree,
        reportSha256: observation.reportSha256,
        activeCases: summary.cases,
        activeCaseDetails: cases
          .filter(item => !item.deferred)
          .map(({ name, line, digest }) => ({ name, line, digest })),
        inputs,
        caseInputs: feature.elements.map(item => {
          const expected = cases.find(
            candidate => candidate.name === item.name && candidate.line === item.line,
          );
          if (expected === undefined) throw new Error('Simulated case identity is missing.');
          return {
            digest: expected.digest,
            paths: [...new Set(item.steps.map(step => step.match.location.replace(/:\d+$/, '')))],
          };
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
      }),
    );
    const certification = {
      profile: ledgerRecoveryProfileIdentity(),
      cases: summary.cases,
      confirmations: Object.fromEntries(RECOVERY_CONFIRMATIONS.map(name => [name, true])),
    };
    const worker = nodePath.join(temporary, 'complete.mjs');
    writeFileSync(
      worker,
      SIGNED_REVIEW_COMPLETION_WORKER.replace(
        'const canonicalProject',
        () =>
          `record.result.data.reviewer_output.recovery_certification=${JSON.stringify(certification)};\nconst canonicalProject`,
      ),
    );
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    const reviewed = await startReviewJob({
      cwd: root,
      kind: 'ledger-recovery',
      targets: [RECOVERY_MANIFEST, RECOVERY_SUMMARY, LEDGER_RECOVERY_CONTRACT_PATH],
      context: inputs.flatMap(input => input.reviewParts?.map(part => part.path) ?? [input.path]),
    });
    const id = (reviewed.data as { review_id: string }).review_id;
    if (approvedLedgerRecoveryReview(root, id) === undefined)
      throw new Error('Simulated current independent receipt is invalid.');
    return {
      root,
      observation,
      observationPath,
      report,
      reportPath,
      id,
      cleanup,
    };
  } catch (error: unknown) {
    cleanup();
    throw error;
  }
}

export function writeObservation(root: string, path: string, observation: unknown): void {
  const content = JSON.stringify(observation);
  writeFileSync(path, content);
  writeFileSync(path.replace(/\.json$/, '.tag'), ledgerRecoveryObservationTag(root, content));
}

function parserReport() {
  const census = JSON.parse(
    readFileSync(nodePath.join(repo, audit, 'case-census.json'), 'utf8'),
  ) as {
    cases: {
      name: string;
      sourceLines: number[];
      status: string;
      proofMapping?: { definitions: { text: string; definition: string }[] };
    }[];
  };
  return [
    {
      uri: LEDGER_RECOVERY_PROFILE.feature,
      elements: census.cases
        .filter(item => item.status === 'active-proof-unmapped')
        .map(item => {
          if (item.proofMapping === undefined)
            throw new Error('Simulated case lacks its assertion mapping.');
          return {
            name: item.name,
            line: item.sourceLines.at(-1),
            steps: item.proofMapping.definitions.map(step => ({
              name: step.text,
              match: { location: step.definition },
              result: { status: 'passed' },
            })),
          };
        }),
    },
  ];
}
