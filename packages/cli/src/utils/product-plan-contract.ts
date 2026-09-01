import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveTicketsDirectory } from './configured-paths.js';
import { readFrontmatterScalar } from './frontmatter.js';
import { findTicketFolderMatch } from './ticket-folder-matches.js';

export interface ParentContractValues {
  parentJob: string;
  milestoneOutcome: string;
  milestoneNonGoals: string;
  projectNonGoals: string;
  successThreshold: string;
}

export interface ResolvedParentContract {
  values: ParentContractValues;
  digest: string;
}

function sectionAfterHeading(content: string, level: number, id: string): string | undefined {
  const prefix = '#'.repeat(level);
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => {
    if (!line.startsWith(`${prefix} ${id}`)) return false;
    const suffix = line.slice(prefix.length + id.length + 1);
    return suffix === '' || /^\s|^—/.test(suffix);
  });
  if (start === -1) return undefined;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const headingLevel = /^(#+)\s/.exec(lines[index] ?? '')?.[1]?.length;
    if (headingLevel !== undefined && headingLevel <= level) {
      end = index;
      break;
    }
  }
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

function fieldValue(content: string, label: string): string | undefined {
  const prefix = `- **${label}:**`;
  return content
    .split(/\r?\n/)
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

export function canonicalizeContractValue(value: string): string {
  return value
    .replaceAll(/`|\*\*|__|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function digestParentContract(values: ParentContractValues): string {
  const canonical = Object.entries(values).map(([key, value]) => [
    key,
    canonicalizeContractValue(value),
  ]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function resolveTicketDirectory(cwd: string, ticketId: string): string | undefined {
  const root = resolveTicketsDirectory(cwd);
  if (!existsSync(root)) return undefined;
  const names = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const match = findTicketFolderMatch(names, ticketId);
  return match ? nodePath.join(root, match) : undefined;
}

export function resolveParentContract(
  cwd: string,
  parentId: string,
  parentJobId: string,
  milestoneId: string,
): ResolvedParentContract {
  const directory = resolveTicketDirectory(cwd, parentId);
  if (!directory) throw new Error(`Parent ticket "${parentId}" does not resolve.`);
  const spec = readParentSpec(directory, parentId);
  requireSection(spec, 3, parentJobId, `Parent job "${parentJobId}"`);
  const milestone = requireSection(spec, 3, milestoneId, `Milestone "${milestoneId}"`);
  const productBet = sectionAfterHeading(spec, 2, 'Product Bet') ?? '';
  const values = contractValues(parentJobId, milestone, productBet);
  return { values, digest: digestParentContract(values) };
}

function readParentSpec(directory: string, parentId: string): string {
  const ticket = readFileSync(nodePath.join(directory, 'ticket.md'), 'utf8');
  if (readFrontmatterScalar(ticket, 'type') !== 'epic') {
    throw new Error(`Parent ticket "${parentId}" is not a feature epic.`);
  }
  const specPath = nodePath.join(directory, 'spec.md');
  if (!existsSync(specPath)) throw new Error(`Parent epic "${parentId}" has no Product Plan.`);
  return readFileSync(specPath, 'utf8');
}

function requireSection(spec: string, level: number, id: string, label: string): string {
  const section = sectionAfterHeading(spec, level, id);
  if (section === undefined)
    throw new Error(`${label} does not resolve in the parent Product Plan.`);
  return section;
}

function contractValues(
  parentJobId: string,
  milestone: string,
  productBet: string,
): ParentContractValues {
  const values: ParentContractValues = {
    parentJob: parentJobId,
    milestoneOutcome: fieldValue(milestone, 'Outcome') ?? '',
    milestoneNonGoals: fieldValue(milestone, 'Non-goals') ?? '',
    projectNonGoals: fieldValue(productBet, 'Project non-goals') ?? '',
    successThreshold: fieldValue(productBet, 'Success threshold') ?? '',
  };
  const missing = Object.entries(values).find(([, value]) => value.trim() === '');
  if (missing) throw new Error(`Parent Product Plan is missing ${missing[0]}.`);
  return values;
}
