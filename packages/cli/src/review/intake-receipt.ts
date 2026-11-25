import { lstatSync } from 'node:fs';
import nodePath from 'node:path';

import type { ReviewStamp } from '../../templates/hooks/lib/review-ledger.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';

type Independence = 'cross-agent' | 'reduced' | 'degraded';
type Agent = NonNullable<ReviewStamp['author']>;

interface Provenance {
  readonly author: Agent;
  readonly reviewer: Agent;
  readonly independence: Independence;
}

export interface IntakeReceipt extends Provenance {
  readonly id: string;
  readonly ticketPath: string;
  readonly ticketFolder: string;
  readonly model?: string;
}

const AGENTS: readonly Agent[] = ['claude', 'codex', 'cursor', 'opencode'];
const INDEPENDENCE: readonly Independence[] = ['cross-agent', 'reduced', 'degraded'];

function provenance(data: Record<string, unknown>): Provenance | undefined {
  const author = AGENTS.find(agent => agent === data.author_agent);
  const reviewer = AGENTS.find(agent => agent === data.actual_reviewer);
  const independence = INDEPENDENCE.find(level => level === data.independence);
  const output = data.reviewer_output as { reviewer_agent?: unknown } | undefined;
  if (!author || !reviewer || !independence || output?.reviewer_agent !== reviewer)
    return undefined;
  if (independence === 'cross-agent' && author === reviewer) return undefined;
  return { author, reviewer, independence };
}

function reviewedTicket(
  cwd: string,
  targets: unknown,
): Pick<IntakeReceipt, 'ticketPath' | 'ticketFolder'> | undefined {
  if (!Array.isArray(targets) || targets.length !== 1 || typeof targets[0] !== 'string')
    return undefined;
  const tickets = resolveTicketsDirectory(cwd);
  const relative = nodePath.relative(tickets, nodePath.resolve(cwd, targets[0]));
  const folder = nodePath.dirname(relative);
  if (
    nodePath.basename(relative) !== 'spec.md' ||
    folder.includes(nodePath.sep) ||
    ['.', '..'].includes(folder)
  )
    return undefined;
  const directory = nodePath.join(tickets, folder);
  const ticketPath = nodePath.join(directory, 'ticket.md');
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return undefined;
  const files = [ticketPath, nodePath.join(directory, 'spec.md')];
  if (files.some(file => !lstatSync(file, { throwIfNoEntry: false })?.isFile())) return undefined;
  return { ticketPath, ticketFolder: folder };
}

/** Select a ticket only from a current coordinator result for its exact spec. */
export function intakeReceipt(cwd: string, input: unknown): IntakeReceipt | undefined {
  const data = (input ?? {}) as Record<string, unknown>;
  const id = data.review_id;
  if (typeof id !== 'string' || data.status !== 'approved' || data.review_kind !== 'quality-review')
    return undefined;
  const ticket = reviewedTicket(cwd, data.review_targets);
  const source = provenance(data);
  if (ticket === undefined || source === undefined) return undefined;
  const model = (data.confirmed_reviewer_model as { model?: unknown } | undefined)?.model;
  return {
    id,
    ...ticket,
    ...source,
    ...(typeof model === 'string' && /^\S+$/u.test(model) && { model }),
  };
}
