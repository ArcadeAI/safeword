import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  type DeliveryChecklistItem,
  type DeliveryProofSpecification,
  parseDeliveryChecklist,
  parseDeliveryPlanContract,
  updateDeliveryChecklistFile,
} from '../execution-plan/delivery-checklist.js';
import {
  captureDeliveryProofSubject,
  currentDeliveryProofSubject,
  executeDeliveryCommandProof,
} from '../execution-plan/delivery-proof.js';
import { smallWorkObservationTag, validSmallWorkObservationTag } from '../review/job.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

interface InlineTicket {
  readonly root: string;
  readonly id: string;
  readonly path: string;
  readonly content: string;
}

export function readInlineTicket(root: string, id: string): InlineTicket | undefined {
  const directory = resolveTicketDirectory(root, id);
  if (directory === undefined) return undefined;
  const path = nodePath.join(directory, 'ticket.md');
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, 'utf8');
  const type = readFrontmatterScalar(content, 'type');
  if (
    (type !== 'task' && type !== 'patch') ||
    !content.split(/\r?\n/u).includes('## Safeword small-work facts')
  )
    return undefined;
  return { root, id, path, content };
}

function subjectOptions(ticket: InlineTicket) {
  return {
    projectRoot: ticket.root,
    executionPlanPath: ticket.path,
    reviewLedgerPath: nodePath.join(resolveNamespaceRoot(ticket.root), 'skill-invocations.log'),
  };
}

function proofIdentity(
  ticket: InlineTicket,
  item: DeliveryChecklistItem,
  proof: DeliveryProofSpecification,
  revision: string,
): string {
  const heading = '## Safeword small-work facts';
  const facts = ticket.content.split(heading, 2)[1]?.split('`'.repeat(3), 3)[1];
  const frontmatter = ticket.content.split(/^---\s*$/m, 3)[1];
  return JSON.stringify([
    'inline-delivery-v1',
    ticket.id,
    frontmatter,
    facts,
    item.id,
    item.category,
    item.obligation,
    item.owner,
    proof,
    revision,
  ]);
}

function pending(command: string, code: string, message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'warning' }],
    data: { command, grants_merge_authority: false },
  });
}

function completedCurrent(
  ticket: InlineTicket,
  item: DeliveryChecklistItem,
  proof: DeliveryProofSpecification | undefined,
): boolean {
  if (item.disposition !== 'complete' || proof?.method !== 'command') return false;
  const receipt = item.evidence;
  if (!receipt.startsWith('receipt:')) return false;
  if (
    !validSmallWorkObservationTag(
      ticket.root,
      proofIdentity(ticket, item, proof, item.revision),
      receipt.slice('receipt:'.length),
    )
  )
    return false;
  const current = currentDeliveryProofSubject({
    ...subjectOptions(ticket),
    producingRevision: item.revision,
  });
  return current.ok && current.current;
}

export function observeInlineDelivery(ticket: InlineTicket): CliResult {
  const command = 'ticket delivery-checklist';
  const parsed = parseDeliveryChecklist(ticket.content, { requireAllCategories: false });
  if (!parsed.ok) return pending(command, parsed.code, parsed.message);
  const contract = parseDeliveryPlanContract(ticket.content, { requireAllCategories: false });
  const specs = contract.ok ? contract.specifications : [];
  const open = parsed.items.filter(
    item =>
      item.owner === 'contributor' &&
      item.disposition !== 'not_applicable' &&
      !completedCurrent(
        ticket,
        item,
        specs.find(proof => proof.id === item.requiredProof),
      ),
  );
  const human = parsed.items.filter(
    item => item.owner === 'human' && item.disposition === 'pending_human',
  );
  const verification = parsed.items.find(item => item.id === 'verification');
  const hasVerification =
    verification?.owner === 'contributor' && verification.disposition === 'complete';
  const ready = hasVerification && open.length === 0 && contract.ok;
  return createResult({
    state: ready ? 'healthy' : 'action_required',
    findings: ready
      ? []
      : [
          {
            code: 'small_work_delivery_evidence_pending',
            severity: 'warning',
            message: 'The inline checklist needs current contributor evidence before handoff.',
          },
        ],
    data: {
      command,
      readiness_state: ready ? 'ready_for_human_review' : 'contributor_work_incomplete',
      checklist_items: parsed.items,
      open_contributor_items: open.map(item => item.id),
      pending_human_items: human.map(item => item.id),
      human_dependencies: human.map(item => ({ id: item.id, dependency: item.evidence })),
      grants_merge_authority: false,
    },
  });
}

function selectInlineProof(ticket: InlineTicket, itemId: string, proofId: string) {
  const command = 'ticket record-delivery-proof';
  const contract = parseDeliveryPlanContract(ticket.content, { requireAllCategories: false });
  if (!contract.ok) return pending(command, contract.code, contract.message);
  const item = contract.items.find(candidate => candidate.id === itemId);
  const proof = contract.specifications.find(candidate => candidate.id === proofId);
  if (
    item?.owner !== 'contributor' ||
    item.requiredProof !== proofId ||
    item.disposition === 'not_applicable' ||
    proof?.method !== 'command' ||
    proof.invocation.type !== 'command' ||
    proof.qualifiesAs !== 'real_boundary'
  ) {
    return pending(
      command,
      'small_work_proof_not_applicable',
      'Choose a contributor item and its declared real-boundary command.',
    );
  }
  return { item, proof, invocation: proof.invocation };
}

export async function recordInlineDelivery(
  ticket: InlineTicket,
  itemId: string,
  proofId: string,
): Promise<CliResult> {
  const selected = selectInlineProof(ticket, itemId, proofId);
  if ('schemaVersion' in selected) return selected;
  const command = 'ticket record-delivery-proof';
  const { item, proof, invocation } = selected;
  const options = subjectOptions(ticket);
  const before = captureDeliveryProofSubject(options);
  if (!before.ok) return pending(command, before.code, before.message);
  const result = await executeDeliveryCommandProof({
    projectRoot: ticket.root,
    specification: { ...proof, method: 'command', invocation },
  });
  if (
    result.termination.exitCode !== 0 ||
    result.termination.timedOut ||
    result.termination.signal !== null
  ) {
    return pending(command, 'small_work_proof_failed', 'The declared verification did not pass.');
  }
  const after = captureDeliveryProofSubject(options);
  if (!after.ok || before.revision !== after.revision) {
    return pending(
      command,
      'small_work_proof_subject_changed',
      'The contribution changed during verification.',
    );
  }

  const receipt = smallWorkObservationTag(
    ticket.root,
    proofIdentity(ticket, item, proof, before.revision),
  );
  const update = updateDeliveryChecklistFile(
    {
      path: ticket.path,
      expectedContent: ticket.content,
      itemId,
      proofId,
      receiptId: receipt,
      revision: before.revision,
      evidenceClass: 'current_revision_real_boundary',
    },
    { inline: true },
  );
  if (!update.ok) return pending(command, update.code, update.message);

  return createResult({
    state: 'changed',
    changed: true,
    effects: {
      files: [
        { kind: 'update', target: nodePath.relative(ticket.root, ticket.path), operation: 'write' },
      ],
    },
    data: { command, receipt, revision: before.revision, grants_merge_authority: false },
  });
}
