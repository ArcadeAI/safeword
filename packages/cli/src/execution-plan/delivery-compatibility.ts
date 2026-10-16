import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { redactKnownSecrets, scrubSecrets } from '../retro/egress.js';
import type { ExecutionPlanDeliveryDefinition } from '../review/contract.js';

const MAX_COMPATIBILITY_DIFF_BYTES = 256 * 1024;

export type DeliveryCompatibilityRequestResult =
  | {
      readonly ok: true;
      readonly path: string;
      readonly relativePath: string;
      readonly requestDigest: string;
      readonly reasonDigest: string;
      readonly reviewedRevision: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | 'compatibility_diff_unavailable'
        | 'compatibility_sensitive_content'
        | 'compatibility_review_stale';
      readonly message: string;
    };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function relativePathspec(projectRoot: string, path: string): string | undefined {
  const relative = nodePath.relative(projectRoot, nodePath.resolve(path));
  if (
    relative === '' ||
    nodePath.isAbsolute(relative) ||
    relative === '..' ||
    relative.startsWith(`..${nodePath.sep}`)
  ) {
    return undefined;
  }
  return relative.split(nodePath.sep).join('/');
}

function git(projectRoot: string, args: readonly string[]) {
  return spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function containsDetectedSecret(value: string): Promise<boolean> {
  const providerRedacted = await redactKnownSecrets(value);
  return providerRedacted !== value || scrubSecrets(providerRedacted) !== providerRedacted;
}

function diffExclusions(
  projectRoot: string,
  executionPlanPath: string,
  reviewLedgerPath: string,
): string[] | undefined {
  const paths = [
    executionPlanPath,
    reviewLedgerPath,
    `${reviewLedgerPath}.approval-lock`,
    `${reviewLedgerPath}.approval-fence`,
  ];
  const exclusions: string[] = [];
  for (const path of paths) {
    const relative = relativePathspec(projectRoot, path);
    if (relative === undefined) return undefined;
    exclusions.push(`:(top,exclude)${relative}`);
  }
  return exclusions;
}

function renderRequest(input: {
  readonly ticket: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly definitionDigest: string;
  readonly deliveryReceiptId: string;
  readonly reason: string;
  readonly reasonDigest: string;
  readonly producingRevision: string;
  readonly reviewedRevision: string;
  readonly diff: string;
}): string {
  return [
    '# Delivery compatibility request',
    '',
    `Ticket: \`${input.ticket}\``,
    `Checklist item: \`${input.itemId}\``,
    `Proof ID: \`${input.proofId}\``,
    `Retained definition digest: \`${input.definitionDigest}\``,
    `Delivery receipt: \`${input.deliveryReceiptId}\``,
    `Reason digest: \`${input.reasonDigest}\``,
    `Producing revision: \`${input.producingRevision}\``,
    `Reviewed revision: \`${input.reviewedRevision}\``,
    '',
    '## Contributor reason',
    '',
    input.reason,
    '',
    '## Retained delivery definition',
    '',
    '```json',
    JSON.stringify(input.definition, undefined, 2),
    '```',
    '',
    '## Complete bounded diff',
    '',
    '```diff',
    input.diff,
    '```',
    '',
  ].join('\n');
}

/** Build the exact ignored packet that an independent compatibility review judges. */
export async function createDeliveryCompatibilityRequest(input: {
  readonly projectRoot: string;
  readonly executionPlanPath: string;
  readonly reviewLedgerPath: string;
  readonly ticket: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly definitionDigest: string;
  readonly deliveryReceiptId: string;
  readonly reason: string;
  readonly producingRevision: string;
  readonly reviewedRevision: string;
}): Promise<DeliveryCompatibilityRequestResult> {
  const exclusions = diffExclusions(
    input.projectRoot,
    input.executionPlanPath,
    input.reviewLedgerPath,
  );
  if (exclusions === undefined) {
    return {
      ok: false,
      code: 'compatibility_diff_unavailable',
      message: 'Safeword could not contain the compatibility diff to this project.',
    };
  }
  const ancestor = git(input.projectRoot, [
    'merge-base',
    '--is-ancestor',
    input.producingRevision,
    input.reviewedRevision,
  ]);
  if (ancestor.status !== 0) {
    return {
      ok: false,
      code: 'compatibility_review_stale',
      message: 'The producing revision is not an ancestor of the reviewed revision.',
    };
  }
  const range = [input.producingRevision, input.reviewedRevision] as const;
  const pathspec = ['--', '.', ...exclusions];
  const binary = git(input.projectRoot, ['diff', '--numstat', ...range, ...pathspec]);
  const rendered = git(input.projectRoot, [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--unified=3',
    ...range,
    ...pathspec,
  ]);
  if (
    binary.status !== 0 ||
    rendered.status !== 0 ||
    binary.stdout.split('\n').some(line => line.startsWith('-\t-\t')) ||
    rendered.stdout === '' ||
    Buffer.byteLength(rendered.stdout) > MAX_COMPATIBILITY_DIFF_BYTES
  ) {
    return {
      ok: false,
      code: 'compatibility_diff_unavailable',
      message: 'The complete compatibility diff is empty, binary, unavailable, or too large.',
    };
  }
  if (await containsDetectedSecret(`${input.reason}\n${rendered.stdout}`)) {
    return {
      ok: false,
      code: 'compatibility_sensitive_content',
      message: 'The compatibility request contains content that matches a secret detector.',
    };
  }
  const reasonDigest = sha256(input.reason);
  const request = renderRequest({ ...input, reasonDigest, diff: rendered.stdout });
  const requestDigest = sha256(request);
  const directory = nodePath.join(input.projectRoot, '.safeword', 'state', 'reviews', 'requests');
  const path = nodePath.join(directory, `delivery-compatibility-${requestDigest}.md`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path, request, { mode: 0o600 });
  return {
    ok: true,
    path,
    relativePath: nodePath.relative(input.projectRoot, path),
    requestDigest,
    reasonDigest,
    reviewedRevision: input.reviewedRevision,
  };
}
