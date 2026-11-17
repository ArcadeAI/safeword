import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { hasCursorProjectAssets } from '../lifecycle/cursor.js';
import { ReviewPacketError } from '../review/packet-error.js';
import { cursorPlanningContractPath, SAFEWORD_SCHEMA } from '../schema.js';
import { PLANNING_AUTHOR_COPIES } from './contracts.generated.js';
import type { PlanningAuthorCopyIdentity, PlanningPhase } from './phase-contract.js';

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function packageRoot(): string {
  const directory = nodePath.basename(import.meta.dirname);
  return directory === 'dist' || directory === 'runtime'
    ? nodePath.dirname(import.meta.dirname)
    : nodePath.resolve(import.meta.dirname, '../..');
}

export class PlanningContractCopyError extends ReviewPacketError {
  constructor(
    readonly code: 'canonical_contract_copy_mismatch' | 'missing_generated_contract_copy',
    readonly phase: PlanningPhase,
    readonly contractPath: string,
  ) {
    const generator = {
      'product-plan': 'generate:planning-contracts',
      'plan-implementation': 'generate:plan-rubric',
      'plan-execution': 'generate:execution-plan-rubric',
    }[phase];
    super(
      `The ${phase} authoring contract copy at ${contractPath} ${code === 'missing_generated_contract_copy' ? 'is unavailable' : 'differs from the canonical contract-byte identity'}. Restore the packaged decision-quality contract by reinstalling or reconciling the intact Safeword distribution and retry. For source builds, restore the canonical authoring contract, run \`bun run ${generator}\` and \`bun run fix:generated-surfaces\`, then rebuild and reinstall.`,
    );
  }
}

declare const __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__:
  Readonly<Record<PlanningPhase, PlanningAuthorCopyIdentity>> | undefined;

function readPlanningAuthor(
  root: string,
  phase: PlanningPhase,
  identity: PlanningAuthorCopyIdentity,
  verifyWholeCopy = true,
): string {
  let bytes: Buffer;
  try {
    bytes = readFileSync(nodePath.join(root, identity.relativePath));
  } catch {
    throw new PlanningContractCopyError(
      'missing_generated_contract_copy',
      phase,
      identity.relativePath,
    );
  }
  if (verifyWholeCopy && digest(bytes) !== identity.sha256) {
    throw new PlanningContractCopyError(
      'canonical_contract_copy_mismatch',
      phase,
      identity.relativePath,
    );
  }
  return bytes.toString('utf8');
}

export function packagedPlanningAuthor(phase: PlanningPhase, verifyWholeCopy = true): string {
  const copies =
    typeof __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__ === 'object'
      ? __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__
      : PLANNING_AUTHOR_COPIES;
  return readPlanningAuthor(packageRoot(), phase, copies[phase], verifyWholeCopy);
}

/** Raw author-copy integrity is separate from the authenticated reviewer verdict. */
export function assertActivePlanningAuthorCopy(cwd: string, phase: PlanningPhase): void {
  packagedPlanningAuthor(phase);
  if (
    process.env.SAFEWORD_AGENT_RUNTIME !== 'cursor' &&
    !hasCursorProjectAssets(cwd, SAFEWORD_SCHEMA)
  ) {
    return;
  }
  const identity = PLANNING_AUTHOR_COPIES[phase];
  const template = identity.relativePath.replace(/^templates\//u, '');
  readPlanningAuthor(cwd, phase, {
    relativePath: cursorPlanningContractPath(template),
    sha256: identity.sha256,
  });
}
