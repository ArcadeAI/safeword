import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { atomicWriteFile } from '../../templates/hooks/lib/jsonl-spool.js';
import {
  classifySmallWork,
  readSmallWorkFacts,
  replaceSmallWorkFacts,
  smallWorkAdmissionPath,
  smallWorkContractDigest,
} from '../../templates/hooks/lib/small-work-classification.js';
import { smallWorkObservationTag, validSmallWorkObservationTag } from '../review/job.js';
import { executeNoShellCommand } from '../review/red-execution.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';
import {
  isSmallWorkProofRequest,
  smallWorkGreenFingerprint,
  type SmallWorkProofRequest,
  verifySmallWorkProof,
} from './proof-observation.js';

interface SavedRed {
  readonly request?: unknown;
  readonly observation?: { tag?: unknown };
  readonly relevance?: { observationTag?: unknown; relevant?: unknown; explanation?: unknown };
  readonly green?: GreenReceipt;
}

interface GreenReceipt {
  readonly redTag: string;
  readonly fingerprint: string;
  readonly startedAt: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly tag: string;
}

function readGreenContext(cwd: string, id: string) {
  const directory = resolveTicketDirectory(cwd, id);
  if (!directory) throw new Error(`Ticket "${id}" does not resolve.`);
  const path = nodePath.join(directory, 'ticket.md');
  const ticket = readFileSync(path, 'utf8');
  const facts = readSmallWorkFacts(ticket) as
    { proof?: SavedRed; changesBehavior?: boolean } | undefined;
  const classification = classifySmallWork(facts);
  if (
    classification.status !== 'classified' ||
    classification.route !== 'task' ||
    readFrontmatterScalar(ticket, 'type') !== 'task' ||
    readFrontmatterScalar(ticket, 'id') !== id ||
    facts?.changesBehavior !== true
  ) {
    throw new Error('GREEN requires a classified behavior-correction task.');
  }
  return { path, ticket, facts };
}

function requireRelevantRed(proof: SavedRed): string {
  const redTag = proof.observation?.tag;
  const { relevance } = proof;
  if (
    typeof redTag !== 'string' ||
    relevance?.observationTag !== redTag ||
    relevance.relevant !== true ||
    typeof relevance.explanation !== 'string' ||
    relevance.explanation.trim() === ''
  ) {
    throw new Error('Record and link a relevant RED observation before observing GREEN.');
  }
  return redTag;
}

function receiptIsCurrent(
  cwd: string,
  receipt: GreenReceipt | undefined,
  redTag: string,
  fingerprint: string,
): boolean {
  if (typeof receipt?.tag !== 'string') return false;
  const { tag, ...unsigned } = receipt;
  return (
    unsigned.redTag === redTag &&
    unsigned.fingerprint === fingerprint &&
    validSmallWorkObservationTag(cwd, `green:${JSON.stringify(unsigned)}`, tag)
  );
}

function requireAdmittedRed(
  cwd: string,
  id: string,
  request: SmallWorkProofRequest,
  observation: unknown,
  redTag: string,
): void {
  let admission: string;
  try {
    admission = readFileSync(smallWorkAdmissionPath(cwd, id), 'utf8').trim();
  } catch {
    throw new Error(
      'The ticket has no retained RED admission. Record RED and complete the gated source edit.',
    );
  }
  if (
    !validSmallWorkObservationTag(cwd, `admitted:${redTag}`, admission) ||
    !verifySmallWorkProof(cwd, request, observation, admission)
  ) {
    throw new Error('The admitted RED no longer matches the declared test or its inputs.');
  }
}

function requireRedRequest(value: unknown, id: string, digest: string): SmallWorkProofRequest {
  const request = value;
  if (
    !isSmallWorkProofRequest(request) ||
    request.ticket !== id ||
    request.expectation === 'pass' ||
    request.contractDigest !== digest
  ) {
    throw new Error('Record RED for the current ticket contract before observing GREEN.');
  }
  return request;
}

export async function observeSmallWorkGreen(cwd: string, id: string, check: boolean) {
  const { path, ticket, facts } = readGreenContext(cwd, id);
  const proof = facts.proof ?? {};
  const request = requireRedRequest(proof.request, id, smallWorkContractDigest(facts));
  const redTag = requireRelevantRed(proof);
  const fingerprint = smallWorkGreenFingerprint(cwd, request);
  if (check) {
    return { current: receiptIsCurrent(cwd, proof.green, redTag, fingerprint) };
  }
  requireAdmittedRed(cwd, id, request, proof.observation, redTag);
  const run = await executeNoShellCommand({
    projectRoot: cwd,
    cwd: request.cwd,
    argv: request.argv,
    timeoutMs: 30_000,
  });
  if (run.termination.exitCode !== 0 || run.termination.signal || run.termination.timedOut) {
    throw new Error('The declared RED test did not pass. No GREEN receipt was saved.');
  }
  if (
    ticket !== readFileSync(path, 'utf8') ||
    fingerprint !== smallWorkGreenFingerprint(cwd, request)
  ) {
    throw new Error('The ticket or proof inputs changed during the run. Rerun GREEN.');
  }
  const unsigned = {
    redTag,
    fingerprint,
    startedAt: run.startedAt,
    stdout: run.stdout.sha256,
    stderr: run.stderr.sha256,
  };
  const receipt = {
    ...unsigned,
    tag: smallWorkObservationTag(cwd, `green:${JSON.stringify(unsigned)}`),
  };
  atomicWriteFile(
    path,
    replaceSmallWorkFacts(ticket, { ...facts, proof: { ...proof, green: receipt } }),
  );
  return { current: true, path, receipt };
}
