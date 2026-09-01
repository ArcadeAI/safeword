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
  return content
    .split(/\r?\n/)
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

export function canonicalizeParentContractValue(value: string): string {
  return value
    .replaceAll(/`|\*\*|__|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function parentContractDigest(values: ParentContractValues): string {
  const canonical = Object.entries(values).map(([key, value]) => [
    key,
    canonicalizeParentContractValue(value),
  ]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function ticketDirectory(projectDirectory: string, id: string): string | undefined {
  const root = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  if (!existsSync(root)) return undefined;
  const matches = readdirSync(root, { withFileTypes: true }).filter(
    entry => entry.isDirectory() && (entry.name === id || entry.name.startsWith(`${id}-`)),
  );
  return matches.length === 1 ? nodePath.join(root, matches[0]!.name) : undefined;
}

function resolveDigest(
  projectDirectory: string,
  parent: string,
  parentJob: string,
  milestoneId: string,
): string {
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
  return parentContractDigest(values);
}

export function evaluateParentContract(
  projectDirectory: string,
  ticketContent: string,
): ParentContractVerdict {
  const meta = metadata(ticketContent);
  const marker = scalar(meta, 'product_plan_contract');
  const parentJob = scalar(meta, 'parent_job');
  const milestone = scalar(meta, 'milestone');
  const persisted = scalar(meta, 'parent_contract_digest');
  const activated =
    marker === 'v1' ||
    parentJob !== undefined ||
    milestone !== undefined ||
    persisted !== undefined;
  if (!activated) return { ok: true };

  const parent = scalar(meta, 'parent');
  const references = [parent, parentJob, milestone];
  if (references.every(value => value === undefined)) return { ok: true };
  if (references.some(value => value === undefined)) {
    return { ok: false, reason: 'parent, parent_job, and milestone must be declared together' };
  }

  try {
    const current = resolveDigest(projectDirectory, parent!, parentJob!, milestone!);
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
