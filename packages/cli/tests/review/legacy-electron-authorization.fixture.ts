import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { runElectronProof } from '../../src/review/retrospective-electron-proof.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { scenarioBodyDigest } from '../../src/review/retrospective-scenario-body.js';
import { createTrustedReviewerDirectory } from '../review-fixtures.js';
import { electronRequest, electronRunnerFixture } from './legacy-electron-runner.fixture.js';

/** Synthetic external tools/reviewer plus real Git, authenticated jobs and row orchestration.
 * Never use this fixture to create review records in a real project.
 */
export async function electronAuthorizationFixture(allScenarios = false) {
  const fixture = electronRunnerFixture();
  const reviewer = createTrustedReviewerDirectory('electron-authorization-');
  const eligibilityPath = '.project/tickets/SGWMBS-open-save-soul-electron/eligibility.json';
  const observationPath = '.project/tickets/SGWMBS-open-save-soul-electron/observation.json';
  const headings: readonly string[] = allScenarios ? policy.scenarios : [electronRequest.scenario];
  const featureScenarios = headings
    .map(
      heading =>
        `  Scenario: ${heading}\n    Given a historical behavior\n    Then the package metadata is retained\n`,
    )
    .join('');
  const feature = `Feature: Historical fixture\n${featureScenarios}`;
  const originalLedger = (heading: string) =>
    `### Scenario: ${heading}\n\n- [x] RED skip: original history unavailable\n- [ ] GREEN\n- [ ] REFACTOR\n`;
  const ledger = headings.map(originalLedger).join('');
  const ticketPath = path.posix.join(path.posix.dirname(policy.ledger), 'ticket.md');
  fixture.write(policy.feature, feature);
  fixture.write(policy.ledger, ledger);
  fixture.write(ticketPath, `---\nid: SGWMBS\nretrospective_claim: ${eligibilityPath}\n---\n`);
  fixture.write('.gitignore', '.safeword/state/\n');
  fixture.git('remote', 'add', 'origin', 'https://github.com/ArcadeAI/soulless-monorepo.git');
  fixture.git('add', '.');
  fixture.git('commit', '-qm', 'historical fixture');
  const baseline = fixture.git('rev-parse', 'HEAD');
  const blob = fixture.git('rev-parse', `${baseline}:${electronRequest.implementationPath}`);
  fixture.write(
    eligibilityPath,
    JSON.stringify({
      ticketId: policy.ticketId,
      ledgerPath: policy.ledger,
      featurePath: policy.feature,
      cutoff: policy.cutoff,
      baseline,
      rationale: 'Synthetic fixture: original failing history is unavailable.',
      scenarios: headings.map(heading => ({
        heading,
        bodySha256: scenarioBodyDigest(feature, heading),
      })),
      blobs: [
        {
          baselinePath: electronRequest.implementationPath,
          currentPath: electronRequest.implementationPath,
          blobSha: blob,
          currentBlobSha: blob,
          baselineExcerpts: ['behavior = true'],
        },
      ],
    }),
  );
  fixture.git('add', '.');
  fixture.git('commit', '-qm', 'declare eligibility fixture');
  const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const commitSuffix = '^{commit}';
  // Only the unavailable enrollment cutoff is mapped to this synthetic history.
  // All Git archive, status, actual baseline/blob and current-input operations remain real.
  writeFileSync(
    path.join(fixture.bin, 'git'),
    `#!${process.execPath}
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2);
const cutoff=${JSON.stringify(policy.cutoff)};
if(args.includes('rev-parse') && args.at(-1)===cutoff+${JSON.stringify(commitSuffix)}) {console.log(cutoff);process.exit(0);}
const actual=args.map(arg=>arg===cutoff || arg.startsWith(cutoff+':') ? arg.replace(cutoff,${JSON.stringify(baseline)}) : arg);
const result=spawnSync(${JSON.stringify(git)},actual,{stdio:'inherit'});
process.exit(result.status??1);
`,
    { mode: 0o755 },
  );
  for (const [name, value] of Object.entries(fixture.environment)) vi.stubEnv(name, value);
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(fixture.temporary, 'profile'));
  vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '5000');
  const source = path.resolve(import.meta.dirname, '../../src');
  const worker = path.join(reviewer, 'worker.cjs');
  const diagnostic = path.join(reviewer, 'worker.log');
  const complete = `
    import {completeReviewJob} from ${JSON.stringify(path.join(source, 'review/job.ts'))};
    import {createResult} from ${JSON.stringify(path.join(source, 'cli-protocol/result.ts'))};
    completeReviewJob(process.cwd(), process.env.SAFEWORD_REVIEW_JOB_ID, createResult({state:'healthy',data:{command:'review run',status:'approved',author_agent:'codex',actual_reviewer:'claude',independence:'cross-agent',reviewer_output:{dispatch_id:'synthetic-external-review',reviewer_agent:'claude',verdict:'approve',summary:'Synthetic external review fixture',findings:[]}}}));
  `;
  writeFileSync(
    worker,
    `const result=require('node:child_process').spawnSync('bun',['--eval',${JSON.stringify(complete)}],{cwd:process.cwd(),env:process.env,encoding:'utf8'});require('node:fs').writeFileSync(${JSON.stringify(diagnostic)},JSON.stringify(result));process.exit(result.status??1);`,
  );
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  const observe = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
  fixture.write(observationPath, JSON.stringify(observe));
  fixture.git('add', observationPath);
  fixture.git('commit', '-qm', 'retain synthetic execution observation');
  const review = async (
    kind: 'retrospective-eligibility' | 'retrospective-proof',
    mode: 'independent' | 'author' | 'declined' = 'independent',
    targets?: readonly string[],
  ) => {
    let response = complete;
    if (mode === 'author')
      response = response
        .replaceAll("reviewer_agent:'claude'", "reviewer_agent:'codex'")
        .replaceAll("actual_reviewer:'claude'", "actual_reviewer:'codex'")
        .replaceAll("independence:'cross-agent'", "independence:'degraded'");
    else if (mode === 'declined')
      response = response
        .replaceAll("state:'healthy'", "state:'action_required'")
        .replaceAll("status:'approved'", "status:'changes_requested'")
        .replaceAll("verdict:'approve'", "verdict:'request_changes'");
    writeFileSync(
      worker,
      `const result=require('node:child_process').spawnSync('bun',['--eval',${JSON.stringify(response)}],{cwd:process.cwd(),env:process.env,encoding:'utf8'});require('node:fs').writeFileSync(${JSON.stringify(diagnostic)},JSON.stringify(result));process.exit(result.status??1);`,
    );
    const result = await startReviewJob({
      cwd: fixture.root,
      kind,
      targets:
        targets ??
        (kind === 'retrospective-eligibility'
          ? [eligibilityPath]
          : [fixture.requestPath, observationPath]),
    });
    const data = result.data as { status: string; review_id: string };
    if (data.status !== (mode === 'declined' ? 'changes_requested' : 'approved'))
      throw new Error(
        `Synthetic review worker did not approve: ${JSON.stringify(result)}; ${readFileSync(diagnostic, 'utf8')}`,
      );
    return data.review_id;
  };
  const completeRows = async () => {
    if (!allScenarios)
      throw new Error('Complete-row fixture requires the full scenario inventory.');
    const entries = headings.map((scenario, index) => {
      const original = scenario === electronRequest.scenario;
      const requestPath = original
        ? fixture.requestPath
        : path.posix.join(path.posix.dirname(fixture.requestPath), `proof-${index}.request.json`);
      const observedPath = original
        ? observationPath
        : path.posix.join(path.posix.dirname(observationPath), `proof-${index}.observation.json`);
      const request = {
        ...electronRequest,
        scenario,
        testFullName: ` ${path.posix.basename(electronRequest.testFile)} ${scenario}`,
      };
      fixture.write(requestPath, JSON.stringify(request));
      return { scenario, requestPath, observationPath: observedPath, request, original };
    });
    fixture.git('add', ...entries.map(entry => entry.requestPath));
    fixture.git('commit', '-qm', 'declare all enrolled synthetic proof requests');
    for (const entry of entries) {
      if (entry.original) continue;
      const observation = await runElectronProof(fixture.root, entry.request, entry.requestPath);
      fixture.write(entry.observationPath, JSON.stringify(observation));
    }
    fixture.git('add', ...entries.map(entry => entry.observationPath));
    fixture.git('commit', '-qm', 'retain all enrolled synthetic observations');
    const eligibilityId = await review('retrospective-eligibility');
    const claims = [];
    for (const entry of entries) {
      const proofId = await review('retrospective-proof', 'independent', [
        entry.requestPath,
        entry.observationPath,
      ]);
      claims.push({
        ticketId: policy.ticketId,
        ledger: policy.ledger,
        scenario: entry.scenario,
        eligibilityId,
        proofId,
      });
    }
    fixture.write(
      policy.ledger,
      claims
        .map(
          claim =>
            `${originalLedger(claim.scenario)}- [x] VERIFIED eligibility=${claim.eligibilityId} proof=${claim.proofId}\n`,
        )
        .join(''),
    );
    fixture.git('add', policy.ledger);
    fixture.git('commit', '-qm', 'commit the complete structural verified fixture');
    return claims;
  };
  return {
    ...fixture,
    eligibilityPath,
    observationPath,
    baseline,
    ticketPath,
    ledger,
    review,
    completeRows,
    observation: () => JSON.parse(readFileSync(path.join(fixture.root, observationPath), 'utf8')),
    cleanup: () => {
      fixture.cleanup();
      rmSync(reviewer, { recursive: true, force: true });
      vi.unstubAllEnvs();
    },
  };
}
