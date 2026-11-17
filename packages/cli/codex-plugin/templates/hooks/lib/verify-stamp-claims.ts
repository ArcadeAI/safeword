// Safeword: holding a written stamp to its claim at gate time (ticket PB1GMZ).
//
// write-review-stamp.ts refuses to write an independence claim the coordinator
// does not witness. That is not enough on its own: the ledger is a plain text
// file, so a line appended directly never passed through that hook. Requiring
// the line to carry a `review-id` only raises the bar to "any token" —
// `review-id:not-real` parses.
//
// So the gate re-checks the claim against the coordinator before honouring it,
// through the same pure decision core the write path uses. A stamp whose claim
// cannot be witnessed is dropped, and the gate then sees what it should have
// seen all along: no satisfying stamp.
//
// This costs one `review status` call per claimed stamp at a gate boundary, and
// only for stamps that claim a coordinator verdict — self-review stamps and
// skips never reach the coordinator at all.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { createReviewReceiptReader } from './read-receipt.js';
import {
  claimFromScope,
  claimsCoordinatorVerdict,
  receiptGateVerdict,
  type StampClaim,
} from './review-receipt.js';
import type { ReviewStamp } from './review-ledger.js';
import { resolveNamespaceRoot } from './namespace-root.js';
import { closestDefaultMergeBase } from './closest-base-ref.js';

function runGit(projectDirectory: string, args: string[]): string | undefined {
  const result = spawnSync('git', ['-C', projectDirectory, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}

function addPaths(paths: Set<string>, output: string | undefined): boolean {
  if (output === undefined) return false;
  for (const path of output.split('\0')) if (path !== '') paths.add(path);
  return true;
}

const EXEMPT_ATTRIBUTES = ['linguist-generated', 'linguist-vendored'] as const;

/**
 * The work files the merge base marks generated or vendored (issue #5870).
 *
 * Attributes come from the base commit's own `.gitattributes`, read through an
 * empty scratch repository so neither system, global, nor the project's
 * `info/attributes` can apply: a branch cannot exempt its own files. Any Git
 * failure exempts nothing, which keeps the coverage requirement fail-closed.
 */
function baseExemptFiles(projectDirectory: string, base: string, files: string[]): Set<string> {
  const exempt = new Set<string>();
  if (files.length === 0) return exempt;
  const prefix = runGit(projectDirectory, ['rev-parse', '--show-prefix'])?.trim();
  const objects = runGit(projectDirectory, [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'objects',
  ])?.trim();
  if (prefix === undefined || !objects) return exempt;

  const scratch = mkdtempSync(nodePath.join(tmpdir(), 'safeword-stamp-attr-'));
  try {
    const nullFile = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const env = {
      PATH: process.env.PATH,
      ...(process.platform === 'win32' && { SystemRoot: process.env.SystemRoot }),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_ATTR_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: nullFile,
    };
    const bare = nodePath.join(scratch, 'bare');
    const template = nodePath.join(scratch, 'template');
    mkdirSync(template);
    if (
      spawnSync('git', ['init', '--bare', '-q', `--template=${template}`, bare], { env }).status !==
      0
    )
      return exempt;
    const repoPaths = files.map(file => `${prefix}${file}`);
    const result = spawnSync(
      'git',
      [
        '--git-dir',
        bare,
        '-c',
        `core.attributesFile=${nullFile}`,
        'check-attr',
        `--source=${base}`,
        '-z',
        '--stdin',
        ...EXEMPT_ATTRIBUTES,
      ],
      {
        env: { ...env, GIT_ALTERNATE_OBJECT_DIRECTORIES: objects },
        input: `${repoPaths.join('\0')}\0`,
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (result.status !== 0 || typeof result.stdout !== 'string') return exempt;
    const fields = result.stdout.split('\0');
    if (fields.pop() !== '' || fields.length % 3 !== 0) return exempt;
    const byRepoPath = new Map(repoPaths.map((repoPath, index) => [repoPath, files[index]]));
    for (let offset = 0; offset < fields.length; offset += 3) {
      const file = byRepoPath.get(fields[offset] ?? '');
      if (file !== undefined && fields[offset + 2] === 'true') exempt.add(file);
    }
    return exempt;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Current branch plus staged, unstaged, and untracked work, relative to the
 * project directory, less what the merge base marks generated or vendored.
 */
function currentWorkFiles(projectDirectory: string): string[] {
  const base = closestDefaultMergeBase(projectDirectory);
  if (base.state !== 'found') return [];

  const paths = new Set<string>();
  if (
    !addPaths(
      paths,
      runGit(projectDirectory, ['diff', '--relative', '--name-only', '-z', `${base.sha}...HEAD`]),
    ) ||
    !addPaths(
      paths,
      runGit(projectDirectory, ['diff', '--relative', '--name-only', '-z', 'HEAD']),
    ) ||
    !addPaths(paths, runGit(projectDirectory, ['ls-files', '--others', '--exclude-standard', '-z']))
  )
    return [];
  const files = [...paths];
  const exempt = baseExemptFiles(projectDirectory, base.sha, files);
  return files.filter(file => !exempt.has(file));
}

/** Dynamic project facts needed to bind a receipt to the phase's real work. */
export function reviewClaimContext(
  projectDirectory: string,
  ticketDirectory: string,
): Pick<StampClaim, 'intakeArtifact' | 'implementationFiles' | 'scenarioArtifact'> {
  const ledgerPath = nodePath.join(ticketDirectory, 'test-definitions.md');
  const scenarioArtifact = (() => {
    if (!existsSync(ledgerPath)) return undefined;
    try {
      const match = readFileSync(ledgerPath, 'utf8').match(
        /^\s*(?:\*\*)?Feature source:(?:\*\*)?\s*`([^`]+)`/imu,
      );
      const declared = match?.[1]?.trim();
      if (!declared) return undefined;
      const resolved = nodePath.resolve(projectDirectory, declared);
      const relative = nodePath.relative(projectDirectory, resolved);
      return relative === '' || relative === '..' || relative.startsWith(`..${nodePath.sep}`)
        ? undefined
        : resolved;
    } catch {
      return undefined;
    }
  })();
  return {
    intakeArtifact: existsSync(nodePath.join(ticketDirectory, 'spec.md')) ? 'spec.md' : 'ticket.md',
    implementationFiles: currentWorkFiles(projectDirectory),
    ...(scenarioArtifact !== undefined && { scenarioArtifact }),
  };
}

/**
 * The stamps that may be trusted, dropping any whose coordinator claim the
 * cited review does not actually witness. Stamps claiming no coordinator
 * verdict pass through untouched — they assert nothing needing a witness.
 */
export function verifiedStamps(
  stamps: readonly ReviewStamp[],
  projectDirectory: string,
  scope: string,
): ReviewStamp[] {
  const readReceipt = createReviewReceiptReader(projectDirectory);
  let claimContext: ReturnType<typeof reviewClaimContext> | undefined;
  return stamps
    .filter(stamp => stamp.scope === scope)
    .filter(stamp => {
      if (stamp.skipReason !== undefined || !claimsCoordinatorVerdict(stamp.independence))
        return true;
      if (stamp.reviewId === undefined) return false;

      const ticketDirectory = nodePath.join(
        resolveNamespaceRoot(projectDirectory),
        'tickets',
        stamp.scope.slice(0, stamp.scope.indexOf(':')),
      );
      const claim = claimFromScope(stamp.scope, {
        projectDirectory,
        ticketDirectory,
        ...(claimContext ??= reviewClaimContext(projectDirectory, ticketDirectory)),
        independence: stamp.independence,
        authorAgent: stamp.author,
        reviewerAgent: stamp.reviewer,
      });
      if (claim === undefined) return false;

      return receiptGateVerdict(claim, readReceipt(stamp.reviewId)).ok;
    });
}
