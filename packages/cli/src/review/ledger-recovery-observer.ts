import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { ledgerRecoveryObservationTag } from './job.js';
import {
  RECOVERY_MANIFEST_PATH,
  RECOVERY_SUMMARY_PATH,
  recoveryEvidenceSummary,
  type RecoveryInput,
} from './ledger-recovery-completion.js';
import {
  LEDGER_RECOVERY_PROFILE,
  ledgerRecoveryProfileIdentity,
} from './ledger-recovery-profile.js';
import { assessRecoveryReport } from './ledger-recovery-report.js';
import {
  assertRecoverySource,
  RECOVERY_AUDIT_PATHS,
  recoveryDigest,
  recoveryGit,
  recoveryProductTree,
} from './ledger-recovery-source.js';
import { proofExecutable, readProofInput } from './retrospective-proof.js';

// Passive public Cucumber plugin: records resolved paths before support loading.
const INPUT_PLUGIN = `import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export default {type:'plugin',coordinator:({on,environment})=>{
 on('paths:resolve',paths=>{
  const inputs=[...paths.sourcePaths,...paths.requirePaths,...paths.importPaths].map(file=>({
   path:path.relative(environment.cwd,file),
   sha256:createHash('sha256').update(readFileSync(file)).digest('hex')
  }));
  writeFileSync(environment.env.SAFEWORD_RECOVERY_INPUT_CAPTURE,JSON.stringify(inputs),{flag:'wx',mode:0o600});
 });
}};`;

export function observeLedgerRecovery(cwd: string, ticket: string): CliResult {
  if (ticket !== LEDGER_RECOVERY_PROFILE.ticket) {
    return blocked(
      'LEDGER_RECOVERY_SCOPE_MISMATCH',
      'Completion recovery is limited to the approved 5F5ZZA scope.',
    );
  }
  let git: string;
  try {
    git = proofExecutable(cwd, 'git', 'Git');
  } catch {
    return blocked(
      'LEDGER_RECOVERY_BASELINE_REQUIRED',
      'An external Git executable is required to inspect the approved baseline.',
    );
  }
  const ancestry = spawnSync(
    git,
    [
      '--no-replace-objects',
      '-C',
      cwd,
      'merge-base',
      '--is-ancestor',
      LEDGER_RECOVERY_PROFILE.baseline,
      'HEAD',
    ],
    {
      encoding: 'utf8',
      timeout: 30_000,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
      ),
    },
  );
  if (ancestry.error !== undefined || ancestry.status !== 0) {
    return blocked(
      'LEDGER_RECOVERY_BASELINE_REQUIRED',
      'Observation requires a committed candidate descended from the approved baseline.',
    );
  }
  try {
    assertRecoverySource(cwd);
    assertLoaderEnvironment();
    return runObservation(realpathSync(cwd));
  } catch (error: unknown) {
    return blocked(
      'LEDGER_RECOVERY_OBSERVATION_REJECTED',
      error instanceof Error ? error.message : 'Observation failed.',
    );
  }
}

function assertLoaderEnvironment(): void {
  const overrides = ['NODE_OPTIONS', 'NODE_PATH', 'BUN_OPTIONS', 'BUN_PRELOAD'];
  if (overrides.some(name => process.env[name]?.trim())) {
    throw new Error('Recovery observation refuses inherited code-loading overrides.');
  }
}

function runObservation(root: string): CliResult {
  const revision = recoveryGit(root, ['rev-parse', 'HEAD']).toString().trim();
  const productTree = recoveryProductTree(root);
  const directory = nodePath.join(
    root,
    '.safeword/state/reviews',
    `ledger-recovery-${randomUUID()}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPrefix = nodePath.join(tmpdir(), 'safeword-recovery-');
  const temporary = realpathSync(mkdtempSync(temporaryPrefix));
  const copy = nodePath.join(temporary, 'candidate');
  let attached = false;
  try {
    recoveryGit(root, [
      '-c',
      'core.hooksPath=/dev/null',
      'worktree',
      'add',
      '--detach',
      copy,
      revision,
    ]);
    attached = true;
    const environment = observationEnvironment(copy);
    runPreparation(copy, environment, directory);
    const capture = nodePath.join(temporary, 'inputs.json');
    const plugin = nodePath.join(temporary, 'capture.mjs');
    writeFileSync(plugin, INPUT_PLUGIN, { flag: 'wx', mode: 0o600 });
    const report = nodePath.join(directory, 'report.json');
    const result = spawnSync(
      nodePath.join(copy, 'scripts/dev'),
      [
        'node',
        'node_modules/.bin/cucumber-js',
        LEDGER_RECOVERY_PROFILE.feature,
        '--tags',
        'not @wip and not @proof.vitest and not @manual and not @live',
        '--retry',
        '0',
        '--parallel',
        '0',
        '--plugin',
        plugin,
        '--format',
        `json:${report}`,
      ],
      {
        cwd: copy,
        env: {
          ...environment,
          NODE_OPTIONS: '--import tsx',
          SAFEWORD_RECOVERY_INPUT_CAPTURE: capture,
        },
        encoding: 'utf8',
        timeout: 7_100_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    writeDurableFileExclusive(
      nodePath.join(directory, 'execution.log'),
      result.stdout + result.stderr,
      { mode: 0o600 },
    );
    const reportBytes = readFileSync(report);
    const parsedReport: unknown = JSON.parse(reportBytes.toString());
    const summary = assessRecoveryReport(parsedReport, result.status ?? 1);
    if (result.error !== undefined || summary === undefined) {
      throw new Error(
        `Current acceptance did not pass the exact active scope. Retained evidence: ${directory}`,
      );
    }
    const inputs = observedInputs(root, copy, capture).map(input => {
      if (input.path !== 'bun.lock') return input;
      const bytes = readProofInput(copy, input.path);
      const split = bytes.indexOf('\n', Math.floor(bytes.length / 2)) + 1;
      if (split <= 0) throw new Error('The observed lockfile cannot be split at a line boundary.');
      const reviewParts = [bytes.subarray(0, split), bytes.subarray(split)].map((part, index) => {
        const absolute = nodePath.join(directory, `bun.lock-part-${index + 1}.txt`);
        writeDurableFileExclusive(absolute, part, { mode: 0o600 });
        return { path: nodePath.relative(root, absolute), sha256: recoveryDigest(part) };
      });
      return { ...input, reviewParts };
    });
    assertRecoverySource(root);
    if (
      recoveryProductTree(root) !== productTree ||
      recoveryGit(root, ['rev-parse', 'HEAD']).toString().trim() !== revision
    ) {
      throw new Error('Recovery candidate changed during observation.');
    }
    const observation = nodePath.join(directory, 'observation.json');
    const record = {
      kind: 'ledger-recovery-observation:v1',
      ticket: LEDGER_RECOVERY_PROFILE.ticket,
      profile: ledgerRecoveryProfileIdentity(),
      revision,
      productTree,
      observerContractSha256: recoveryDigest(INPUT_PLUGIN),
      report,
      reportSha256: recoveryDigest(reportBytes),
      exitCode: result.status ?? 1,
      inputs,
      summary,
    };
    const content = JSON.stringify(record);
    const tag = nodePath.join(directory, 'observation.tag');
    writeDurableFileExclusive(observation, content, { mode: 0o600 });
    writeDurableFileExclusive(tag, ledgerRecoveryObservationTag(root, content), { mode: 0o600 });
    const relative = nodePath.relative(root, observation);
    writeDurableFile(
      nodePath.join(root, RECOVERY_MANIFEST_PATH),
      JSON.stringify({
        kind: 'ledger-recovery-manifest:v1',
        ticket: LEDGER_RECOVERY_PROFILE.ticket,
        profile: ledgerRecoveryProfileIdentity(),
        observation: relative,
      }),
      { mode: 0o600 },
    );
    writeDurableFile(
      nodePath.join(root, RECOVERY_SUMMARY_PATH),
      JSON.stringify(recoveryEvidenceSummary(record, relative, parsedReport)),
      { mode: 0o600 },
    );
    return createResult({
      state: 'healthy',
      changed: true,
      data: {
        command: 'review observe ledger-recovery',
        status: 'observed',
        observation,
        tag,
        summary,
      },
    });
  } finally {
    if (attached) recoveryGit(root, ['worktree', 'remove', '--force', copy]);
    rmSync(temporary, { recursive: true, force: true });
  }
}

function observationEnvironment(copy: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) =>
          !name.startsWith('GIT_') &&
          !name.startsWith('SAFEWORD_REVIEW_') &&
          !name.startsWith('CUCUMBER_') &&
          name !== 'NODE_ENV',
      ),
    ),
    MISE_TRUSTED_CONFIG_PATHS: copy,
  };
}

function runPreparation(copy: string, environment: NodeJS.ProcessEnv, directory: string): void {
  for (const [index, args] of [
    ['bun', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ['bun', 'run', 'build'],
  ].entries()) {
    const result = spawnSync(nodePath.join(copy, 'scripts/dev'), args, {
      cwd: copy,
      env: environment,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    writeDurableFileExclusive(
      nodePath.join(directory, `preparation-${index}.log`),
      result.stdout + result.stderr,
      { mode: 0o600 },
    );
    if (result.error !== undefined || result.status !== 0)
      throw new Error(`Recovery preparation failed. Retained evidence: ${directory}`);
  }
}

function observedInputs(root: string, copy: string, capture: string): RecoveryInput[] {
  const captured: { path: string; sha256: string }[] = JSON.parse(readFileSync(capture, 'utf8'));
  if (!Array.isArray(captured) || captured.length === 0)
    throw new Error('No resolved execution inputs were captured.');
  const tracked = recoveryGit(root, ['ls-files', '-z']).toString().split('\0').filter(Boolean);
  const paths = new Set([
    ...captured.map(input => input.path),
    'cucumber.mjs',
    'scripts/dev',
    'mise.toml',
    'bun.lock',
    '.safeword/config.json',
    ...tracked.filter(
      path =>
        path === 'package.json' ||
        path.endsWith('/package.json') ||
        path.endsWith('/tsup.config.ts'),
    ),
  ]);
  return [...paths]
    .toSorted((left, right) => left.localeCompare(right))
    .map(path => {
      if (!tracked.includes(path) || RECOVERY_AUDIT_PATHS.includes(path)) {
        throw new Error(`Resolved execution input cannot be excluded or untracked: ${path}`);
      }
      const sha256 = recoveryDigest(readProofInput(copy, path));
      if (
        sha256 !== recoveryDigest(readProofInput(root, path)) ||
        captured.some(input => input.path === path && input.sha256 !== sha256)
      ) {
        throw new Error(`Execution input changed during observation: ${path}`);
      }
      return { path, sha256 };
    });
}

function blocked(code: string, message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'warning' }],
    data: { command: 'review observe ledger-recovery', status: 'blocked' },
  });
}
