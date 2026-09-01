import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseFrontmatter } from './hierarchy.ts';
import { resolveNamespaceRoot } from './namespace-root.ts';

interface ParentContractValues {
  parentJob: string;
  milestoneOutcome: string;
  milestoneNonGoals: string;
  projectNonGoals: string;
  successThreshold: string;
}

export interface ResolvedHookParentContract {
  values: ParentContractValues;
  digest: string;
}

const CONTRACT_KEYS: readonly (keyof ParentContractValues)[] = [
  'parentJob',
  'milestoneOutcome',
  'milestoneNonGoals',
  'projectNonGoals',
  'successThreshold',
];

export interface ParentContractVerdict {
  ok: boolean;
  reason?: string;
}

function metadata(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? parseFrontmatter(match[1] ?? '') : {};
}

function scalar(meta: Record<string, string | string[]>, key: string): string | undefined {
  const value = meta[key];
  return Array.isArray(value) ? undefined : value;
}

function section(content: string, level: number, id: string): string | undefined {
  const prefix = '#'.repeat(level);
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => {
    if (!line.startsWith(`${prefix} ${id}`)) return false;
    const suffix = line.slice(prefix.length + id.length + 1);
    return suffix === '' || /^\s|^—/.test(suffix);
  });
  if (start === -1) return undefined;
  const relativeEnd = lines.slice(start + 1).findIndex(line => {
    const nextLevel = /^(#+)\s/.exec(line)?.[1]?.length;
    return nextLevel !== undefined && nextLevel <= level;
  });
  const end = relativeEnd === -1 ? lines.length : start + relativeEnd + 1;
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

function field(content: string, label: string): string | undefined {
  const prefix = `- **${label}:**`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex(line => line.trimStart().startsWith(prefix));
  if (index === -1) return undefined;
  const matchedLine = lines[index];
  if (matchedLine === undefined) return undefined;
  const first = matchedLine.trimStart().slice(prefix.length).trim();
  const continuation: string[] = [];
  const remainingLines = lines.slice(index + 1);
  for (const line of remainingLines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('- ')) break;
    if (!/^\s/.test(line)) break;
    continuation.push(trimmed);
  }
  return [first, ...continuation].join(' ').trim();
}

export function canonicalizeParentContractValue(value: string): string {
  return value
    .replaceAll(/`|\*\*|__|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function parentContractDigest(values: ParentContractValues): string {
  const canonical = CONTRACT_KEYS.map(key => [key, canonicalizeParentContractValue(values[key])]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function ticketDirectory(projectDirectory: string, id: string): string | undefined {
  const root = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  if (!existsSync(root)) return undefined;
  const names = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const match = names.find(name => name === id) ?? names.find(name => name.startsWith(`${id}-`));
  return match ? nodePath.join(root, match) : undefined;
}

export function resolveHookParentContract(
  projectDirectory: string,
  parent: string,
  parentJob: string,
  milestoneId: string,
): ResolvedHookParentContract {
  const directory = ticketDirectory(projectDirectory, parent);
  if (!directory) throw new Error(`parent ticket "${parent}" does not resolve`);
  const ticket = readFileSync(nodePath.join(directory, 'ticket.md'), 'utf8');
  if (scalar(metadata(ticket), 'type') !== 'epic') throw new Error('parent is not an epic');
  const specPath = nodePath.join(directory, 'spec.md');
  if (!existsSync(specPath)) throw new Error('parent Product Plan is missing');
  const spec = readFileSync(specPath, 'utf8');
  if (section(spec, 3, parentJob) === undefined) throw new Error('parent job does not resolve');
  const milestone = section(spec, 3, milestoneId);
  if (milestone === undefined) throw new Error('milestone does not resolve');
  const productBet = section(spec, 2, 'Product Bet') ?? '';
  const values: ParentContractValues = {
    parentJob,
    milestoneOutcome: field(milestone, 'Outcome') ?? '',
    milestoneNonGoals: field(milestone, 'Non-goals') ?? '',
    projectNonGoals: field(productBet, 'Project non-goals') ?? '',
    successThreshold: field(productBet, 'Success threshold') ?? '',
  };
  const missing = Object.entries(values).filter(([, value]) => value.trim() === '');
  if (missing.length > 0)
    throw new Error(`parent contract is missing ${missing.map(([key]) => key).join(', ')}`);
  return { values, digest: parentContractDigest(values) };
}

export function evaluateParentContract(
  projectDirectory: string,
  ticketContent: string,
  priorTicketContent?: string,
): ParentContractVerdict {
  const meta = metadata(ticketContent);
  const marker = scalar(meta, 'product_plan_contract');
  const parentJob = scalar(meta, 'parent_job');
  const milestone = scalar(meta, 'milestone');
  const persisted = scalar(meta, 'parent_contract_digest');
  const priorMeta = priorTicketContent === undefined ? {} : metadata(priorTicketContent);
  const activated =
    marker === 'v1' ||
    parentJob !== undefined ||
    persisted !== undefined ||
    scalar(priorMeta, 'product_plan_contract') === 'v1' ||
    scalar(priorMeta, 'parent_job') !== undefined ||
    scalar(priorMeta, 'parent_contract_digest') !== undefined;
  if (!activated) return { ok: true };

  const parent = scalar(meta, 'parent');
  const references = [parent, parentJob, milestone];
  if (references.every(value => value === undefined)) {
    return persisted === undefined
      ? { ok: true }
      : { ok: false, reason: 'parent references were removed without clearing reconciliation' };
  }
  if (references.some(value => value === undefined)) {
    return { ok: false, reason: 'parent, parent_job, and milestone must be declared together' };
  }

  try {
    const current = resolveHookParentContract(
      projectDirectory,
      parent!,
      parentJob!,
      milestone!,
    ).digest;
    if (persisted === current) return { ok: true };
    return {
      ok: false,
      reason: persisted
        ? 'the referenced parent Product Plan changed'
        : 'the parent Product Plan has not been reconciled',
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
