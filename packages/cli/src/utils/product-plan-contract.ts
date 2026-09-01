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

const CONTRACT_KEYS: readonly (keyof ParentContractValues)[] = [
  'parentJob',
  'milestoneOutcome',
  'milestoneNonGoals',
  'projectNonGoals',
  'successThreshold',
];

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

function sectionContractValue(content: string, level: number, id: string): string | undefined {
  const prefix = `${'#'.repeat(level)} `;
  const heading = content.split(/\r?\n/).find(line => {
    if (!line.startsWith(`${prefix}${id}`)) return false;
    const suffix = line.slice(prefix.length + id.length);
    return suffix === '' || /^\s|^—/.test(suffix);
  });
  if (heading === undefined) return undefined;
  const body = sectionAfterHeading(content, level, id) ?? '';
  return [heading.slice(prefix.length).trim(), body].filter(Boolean).join('\n');
}

function fieldValue(content: string, label: string): string | undefined {
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

export function canonicalizeContractValue(value: string): string {
  return value
    .replaceAll(/`|\*\*|__|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function digestParentContract(values: ParentContractValues): string {
  const canonical = CONTRACT_KEYS.map(key => [key, canonicalizeContractValue(values[key])]);
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
  const jobs = requireSection(spec, 2, 'Jobs To Be Done', 'Jobs To Be Done');
  const shape = requireSection(spec, 2, 'Shape', 'Shape');
  const parentJob = requireContractSection(jobs, 3, parentJobId, `Parent job "${parentJobId}"`);
  const milestone = requireSection(shape, 3, milestoneId, `Milestone "${milestoneId}"`);
  const productBet = sectionAfterHeading(spec, 2, 'Product Bet') ?? '';
  const values = contractValues(parentJob, milestone, productBet);
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

function requireContractSection(spec: string, level: number, id: string, label: string): string {
  const section = sectionContractValue(spec, level, id);
  if (section === undefined)
    throw new Error(`${label} does not resolve in the parent Product Plan.`);
  return section;
}

function contractValues(
  parentJob: string,
  milestone: string,
  productBet: string,
): ParentContractValues {
  const values: ParentContractValues = {
    parentJob,
    milestoneOutcome: fieldValue(milestone, 'Outcome') ?? '',
    milestoneNonGoals: fieldValue(milestone, 'Non-goals') ?? '',
    projectNonGoals: fieldValue(productBet, 'Project non-goals') ?? '',
    successThreshold: fieldValue(productBet, 'Success threshold') ?? '',
  };
  const missing = Object.entries(values).find(([, value]) => value.trim() === '');
  if (missing) throw new Error(`Parent Product Plan is missing ${missing[0]}.`);
  return values;
}
