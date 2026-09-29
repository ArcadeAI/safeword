import { createHash } from 'node:crypto';
import nodePath from 'node:path';

import { parsers } from 'prettier/plugins/markdown';

import { PLANNING_CONTRACTS } from '../planning/contracts.generated.js';
import type { UpstreamImplementationInvalidation } from '../planning/phase-contract.js';
import {
  parseFeature,
  parseFeatureLineageReferences,
  parseFeatureScenarios,
} from '../utils/gherkin-feature.js';
import { parsePersonas, resolvePersonaCodes } from '../utils/personas.js';
import { parseAffectedSurfaceReferences, surfaceSlug } from '../utils/scenario-coverage.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';
import type { ReviewPacket } from './contract.js';
import { isPlanEvidenceRecord, type PlanEvidenceRecordV1 } from './evidence-record.js';
import { PlanningContextError } from './planning-context-error.js';
import type { PlanningReviewIdentity } from './planning-role-context.js';
import { scenarioReviewRubric } from './review-rubric.js';

interface MarkdownNode {
  readonly type: string;
  readonly value?: string;
  readonly depth?: number;
  readonly children?: readonly MarkdownNode[];
  readonly [key: string]: unknown;
}

const nodeTypes = new Set([
  'root',
  'blockquote',
  'break',
  'code',
  'definition',
  'emphasis',
  'heading',
  'html',
  'image',
  'imageReference',
  'inlineCode',
  'link',
  'linkReference',
  'list',
  'listItem',
  'paragraph',
  'strong',
  'text',
  'thematicBreak',
  'delete',
  'table',
  'tableRow',
  'tableCell',
]);

function parseMarkdown(content: string): readonly MarkdownNode[] {
  // The public built-in parser consumes source only; its shared TypeScript
  // signature also describes formatters' resolved options. Validate the actual
  // parser result rather than fabricating that formatter configuration.
  const ast: unknown = Reflect.apply(parsers.markdown.parse, undefined, [content, {}]);
  if (
    ast === null ||
    typeof ast !== 'object' ||
    !('type' in ast) ||
    ast.type !== 'root' ||
    !('children' in ast) ||
    !Array.isArray(ast.children)
  ) {
    throw new Error('The planning Markdown parser did not return a synchronous document.');
  }
  return ast.children as MarkdownNode[];
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => stableValue(child));
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .toSorted((a, b) => {
        if (a === b) return 0;
        return a < b ? -1 : 1;
      })
      .map(key => [key, stableValue(record[key])]),
  );
}

function identity(value: unknown): string {
  const canonical = stableValue(value);
  return JSON.stringify(canonical);
}

function onlyComments(value: string): boolean {
  let remaining = value.trim();
  if (remaining === '') return false;
  while (remaining.startsWith('<!--')) {
    const end = remaining.indexOf('-->', 4);
    if (end === -1) return false;
    remaining = remaining.slice(end + 3).trim();
  }
  return remaining === '';
}

function normalizeChildren(node: MarkdownNode): MarkdownNode[] {
  const children = normalizeNodes(node.children ?? []);
  if (!['heading', 'paragraph', 'tableCell'].includes(node.type)) return children;
  return children.flatMap((child, index) => {
    if (child.type !== 'text') return [child];
    let value = child.value ?? '';
    if (index === 0) value = value.replace(/^ /u, '');
    if (index === children.length - 1) value = value.replace(/ $/u, '');
    return value === '' ? [] : [{ ...child, value }];
  });
}

function normalizeNode(node: MarkdownNode): MarkdownNode | undefined {
  if (!nodeTypes.has(node.type))
    throw new Error(`Unsupported planning Markdown node: ${node.type}`);
  if (node.type === 'html' && onlyComments(node.value ?? '')) return undefined;
  const layoutFields = new Set(['position', 'children']);
  if (node.type === 'list' || node.type === 'listItem') layoutFields.add('spread');
  const properties = Object.fromEntries(
    Object.entries(node).filter(([key]) => !layoutFields.has(key)),
  );
  if (node.type === 'text') properties.value = (node.value ?? '').replaceAll(/[\t\r\n ]+/gu, ' ');
  return {
    ...properties,
    ...(node.children !== undefined && { children: normalizeChildren(node) }),
  } as MarkdownNode;
}

function normalizeNodes(nodes: readonly MarkdownNode[]): MarkdownNode[] {
  const normalized: MarkdownNode[] = [];
  for (const node of nodes) {
    const current = normalizeNode(node);
    if (current === undefined) continue;
    const previous = normalized.at(-1);
    if (previous?.type === 'text' && current.type === 'text') {
      normalized[normalized.length - 1] = {
        ...previous,
        value: `${previous.value}${current.value}`.replaceAll(/[\t\r\n ]+/gu, ' '),
      };
    } else normalized.push(current);
  }
  return normalized;
}

export function semanticMarkdownIdentity(content: string): string {
  const nodes = parseMarkdown(content);
  return identity(normalizeNodes(nodes));
}

export function semanticTicketIdentity(content: string, reviewKind?: string): string {
  const { metadata, body } = parseTicketMetadata(content);
  const retained = Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !['phase', 'status', 'last_modified', 'review_dispositions'].includes(key),
    ),
  );
  if (reviewKind !== undefined && Array.isArray(metadata.review_dispositions)) {
    const matching = metadata.review_dispositions.filter(
      value =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>).review_kind === reviewKind,
    );
    if (matching.length > 0) retained.review_dispositions = matching;
  }
  const nodes = parseMarkdown(body);
  return identity({ version: 1, metadata: retained, body: normalizeNodes(nodes) });
}

function headingText(node: MarkdownNode): string {
  return node.value ?? node.children?.map(child => headingText(child)).join('') ?? '';
}

function requiredSection(
  nodes: readonly MarkdownNode[],
  depth: number,
  key: string,
  identifier = false,
): readonly MarkdownNode[] {
  const matches = nodes.flatMap((node, index) => {
    if (node.type !== 'heading' || node.depth !== depth) return [];
    const children = normalizeChildren(node);
    const text = children.map(child => headingText(child)).join('');
    const label = identifier ? text.split(/\s+/u, 1)[0] : text;
    return label === key ? [index] : [];
  });
  const [start] = matches;
  if (matches.length !== 1 || start === undefined)
    throw new Error(`Planning parent context must contain one ${key} section.`);
  const end = nodes.findIndex(
    (node, index) => index > start && node.type === 'heading' && (node.depth ?? 0) <= depth,
  );
  return nodes.slice(start, end === -1 ? undefined : end);
}

interface ChildRelationship {
  readonly parent: string;
  readonly job: string;
  readonly milestone: string;
}

type ContextFile = ReviewPacket['logical_files'][number];
interface CapturedParentContext {
  readonly ticket: ContextFile;
  readonly parentTicket: ContextFile;
  readonly parent: ContextFile;
  readonly relationship: ChildRelationship;
}

function childRelationship(metadata: Record<string, unknown>): ChildRelationship | undefined {
  if (!Object.hasOwn(metadata, 'parent')) return undefined;
  if (
    typeof metadata.parent !== 'string' ||
    typeof metadata.parent_job !== 'string' ||
    typeof metadata.milestone !== 'string'
  ) {
    throw new TypeError('Planning child context must declare parent, parent_job and milestone.');
  }
  return { parent: metadata.parent, job: metadata.parent_job, milestone: metadata.milestone };
}

function capturedParent(
  packet: ReviewPacket,
  target: ContextFile,
): CapturedParentContext | undefined {
  const context = packet.context_files ?? [];
  const ticketPath = nodePath.join(nodePath.dirname(target.path), 'ticket.md');
  const ticket = context.find(file => file.path === ticketPath);
  if (ticket === undefined) return undefined;
  const { metadata } = parseTicketMetadata(ticket.content);
  const relationship = childRelationship(metadata);
  if (relationship === undefined) return undefined;
  const parentTickets = context.filter(
    file =>
      nodePath.basename(file.path) === 'ticket.md' &&
      file.path !== ticketPath &&
      parseTicketMetadata(file.content).metadata.id === relationship.parent,
  );
  const [parentTicket] = parentTickets;
  if (parentTickets.length !== 1 || parentTicket === undefined)
    throw new Error('Planning child context must have one captured parent ticket.');
  const parentPath = nodePath.join(nodePath.dirname(parentTicket.path), 'spec.md');
  const parent = context.find(file => file.path === parentPath);
  if (parent === undefined) throw new Error('Planning child context has no captured parent spec.');
  return { ticket, parentTicket, parent, relationship };
}

function referencedDefinitions(nodes: readonly MarkdownNode[], retained: readonly MarkdownNode[]) {
  const references = new Set<string>();
  const visit = (node: MarkdownNode): void => {
    if (
      (node.type === 'linkReference' || node.type === 'imageReference') &&
      typeof node.identifier === 'string'
    )
      references.add(node.identifier);
    const children = node.children ?? [];
    for (const child of children) visit(child);
  };
  for (const node of retained) visit(node);
  const definitions = nodes.filter(
    node =>
      node.type === 'definition' &&
      typeof node.identifier === 'string' &&
      references.has(node.identifier),
  );
  if (
    [...references].some(
      reference => definitions.filter(node => node.identifier === reference).length !== 1,
    )
  ) {
    throw new Error(
      'Planning parent context has missing or duplicate referenced link definitions.',
    );
  }
  return definitions;
}

function planningReviewKind(packet: ReviewPacket): PlanningReviewIdentity['review_kind'] {
  if (packet.kind === 'scenario-gate') return 'scenario-gate';
  if (packet.planning_phase === 'product-plan') return 'quality-review';
  if (packet.planning_phase === 'plan-execution') return 'plan-execution';
  return 'plan-implementation';
}

/** Owned ticket and Product selected-parent projection; other roles retain their existing bytes. */
export function productParentContextIdentity(packet: ReviewPacket): ReadonlyMap<string, string> {
  const identities = new Map<string, string>();
  const ticketPath = packet.planning_context?.dependencies.find(
    source => source.role === 'ticket',
  )?.path;
  if (ticketPath === undefined) return identities;
  const ticket = packet.context_files?.find(file => file.path === ticketPath);
  if (ticket === undefined) throw new PlanningContextError('ticket', ticketPath);
  identities.set(ticket.path, semanticTicketIdentity(ticket.content, planningReviewKind(packet)));
  const sources = capturedParent(packet, ticket);
  if (sources === undefined) return identities;
  const { parentTicket, parent, relationship } = sources;
  const nodes = parseMarkdown(parent.content);
  const jobs = requiredSection(nodes, 2, 'Jobs To Be Done');
  const milestones = requiredSection(nodes, 2, 'Shape');
  const retained = [
    ...requiredSection(nodes, 2, 'Product Bet'),
    ...requiredSection(jobs, 3, relationship.job, true),
    ...requiredSection(milestones, 3, relationship.milestone, true),
  ];
  // Reference definitions can live outside the selected sections; retain those
  // destinations when selected text relies on them.
  const selected = retained.filter(node => node.type !== 'definition');
  const definitions = referencedDefinitions(nodes, selected);
  identities.set(parentTicket.path, semanticTicketIdentity(parentTicket.content));
  identities.set(
    parent.path,
    identity({ version: 1, sections: normalizeNodes([...selected, ...definitions]) }),
  );
  return identities;
}

const productFrameFields = [
  'Expected outcome',
  'Persona outcome inventory',
  'Known facts',
  'Assumptions',
  'Unresolved product decisions',
  'Success threshold',
  'Project non-goals',
];

export function validatePlanningProductFrame(content: string): void {
  const frame = requiredSection(parseMarkdown(content), 2, 'Product Bet');
  const counts = new Map<string, number>();
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'paragraph') {
      const text = normalizeChildren(node)
        .map(child => headingText(child))
        .join('');
      const colon = text.indexOf(':');
      const label = text.slice(0, colon);
      if (productFrameFields.includes(label)) {
        if (text.slice(colon + 1).trim() === '') throw new Error(`Blank Product Bet ${label}.`);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    const children = node.children ?? [];
    for (const child of children) visit(child);
  };
  for (const node of frame) visit(node);
  if (productFrameFields.some(field => counts.get(field) !== 1))
    throw new Error('Incomplete or ambiguous Product Bet framing.');
}

function applicabilityBody(
  nodes: readonly MarkdownNode[],
  heading: string,
): { body: readonly MarkdownNode[]; hasHeading: boolean } {
  const matches = nodes.flatMap((node, index) =>
    node.type === 'heading' &&
    (node.depth === 2 || node.depth === 3) &&
    headingText(node) === heading
      ? [index]
      : [],
  );
  if (matches.length > 1) throw new Error(`Ambiguous ${heading} declaration.`);
  const [start] = matches;
  if (start !== undefined) {
    const depth = nodes[start]?.depth ?? 2;
    const end = nodes.findIndex(
      (node, index) => index > start && node.type === 'heading' && (node.depth ?? 0) <= depth,
    );
    return { body: nodes.slice(start + 1, end === -1 ? undefined : end), hasHeading: true };
  }
  if (heading !== 'Architecture applicability') throw new Error(`Missing ${heading} declaration.`);
  return { body: requiredSection(nodes, 2, 'Design alignment').slice(1), hasHeading: false };
}

export function planningSkipReason(content: string, heading: string): string | undefined {
  const section = applicabilityBody(parseMarkdown(content), heading);
  const paragraphs = normalizeNodes(section.body)
    .filter(node => node.type === 'paragraph')
    .map(node => headingText(node).trim());
  const label = `${heading}:`;
  const declarations = paragraphs.filter(text => text.startsWith(label));
  if (declarations.length > 1) throw new Error(`Ambiguous ${heading} declaration.`);
  const declaration = declarations[0];
  let statement: string | undefined;
  if (declaration !== undefined) statement = declaration.slice(label.length).trim();
  else if (section.hasHeading && paragraphs.length === 1) statement = paragraphs[0];
  if (statement === undefined || statement === '')
    throw new Error(`Missing ${heading} declaration.`);
  if (!statement.startsWith('skip:')) return undefined;
  const reason = statement.slice('skip:'.length).trim();
  if (reason === '') throw new Error(`Blank ${heading} skip reason.`);
  return reason;
}

export function planningEvidenceReferences(content: string): string[] {
  const nodes = parseMarkdown(content);
  const references: string[] = [];
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'link' && typeof node.url === 'string') references.push(node.url);
    const children = node.children ?? [];
    for (const child of children) visit(child);
  };
  for (const [index, node] of nodes.entries()) {
    if (node.type !== 'heading' || !headingText(node).startsWith('Implementation Inspiration'))
      continue;
    const end = nodes.findIndex(
      (next, position) =>
        position > index && next.type === 'heading' && (next.depth ?? 0) <= (node.depth ?? 0),
    );
    const section = nodes.slice(index + 1, end === -1 ? undefined : end);
    for (const child of section) visit(child);
  }
  return references;
}

function parsePlanEvidenceRecord(node: MarkdownNode | undefined): PlanEvidenceRecordV1 {
  if (node?.type !== 'code' || node.lang !== 'json')
    throw new Error('PlanEvidenceRecordV1 requires an immediately following JSON block.');
  let candidate: unknown;
  try {
    candidate = JSON.parse(node.value ?? '') as unknown;
  } catch {
    throw new Error('PlanEvidenceRecordV1 contains invalid JSON.');
  }
  if (!isPlanEvidenceRecord(candidate))
    throw new Error('PlanEvidenceRecordV1 is missing required evidence or reuse limits.');
  return candidate;
}

export function planningEvidenceRecords(content: string): PlanEvidenceRecordV1[] {
  const nodes = parseMarkdown(content);
  const records: PlanEvidenceRecordV1[] = [];
  let inDecisions = false;
  for (const [index, node] of nodes.entries()) {
    if (node.type !== 'heading') continue;
    if ((node.depth ?? 0) <= 2) inDecisions = node.depth === 2 && headingText(node) === 'Decisions';
    if (!inDecisions || headingText(node) !== 'PlanEvidenceRecordV1') continue;
    records.push(parsePlanEvidenceRecord(nodes[index + 1]));
  }
  return records;
}

function gherkinIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => gherkinIdentity(child));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['location', 'id', 'comments'].includes(key))
      .map(([key, child]) => [key, gherkinIdentity(child)]),
  );
}

function artifactIdentity(content: string): string {
  if (!content.startsWith('---')) return semanticMarkdownIdentity(content);
  const { metadata, body } = parseTicketMetadata(content);
  return identity({ metadata, body: normalizeNodes(parseMarkdown(body)) });
}

function planningRoleContent(
  packet: ReviewPacket,
  role: 'project' | 'rules' | 'scenarios',
): string {
  const path = packet.planning_context?.dependencies.find(source => source.role === role)?.path;
  return (
    [...packet.logical_files, ...(packet.context_files ?? [])].find(file => file.path === path)
      ?.content ?? ''
  );
}

function productPersonaInventory(content: string): string {
  const frame = requiredSection(parseMarkdown(content), 2, 'Product Bet');
  const inventories: string[] = [];
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'listItem') {
      const first = node.children?.find(child => child.type === 'paragraph');
      if (first !== undefined && headingText(first).startsWith('Persona outcome inventory:'))
        inventories.push(headingText(node));
    }
    const children = node.children ?? [];
    for (const child of children) visit(child);
  };
  for (const node of frame) visit(node);
  return inventories.length === 1 ? (inventories[0] ?? '') : '';
}

// eslint-disable-next-line complexity -- References and inventory are independent semantic selectors.
function planningPersonaIdentity(packet: ReviewPacket, content: string): string {
  const spec = planningRoleContent(packet, 'rules');
  const feature = planningRoleContent(packet, 'scenarios');
  const project = planningRoleContent(packet, 'project');
  const lineage = feature === '' ? { ac: [], rule: [] } : parseFeatureLineageReferences(feature);
  const references = new Set(
    [
      ...parseMarkdown(spec)
        .filter(node => node.type === 'heading' && (node.depth === 3 || node.depth === 4))
        .map(node => headingText(node).split(/\s+/u, 1)[0] ?? ''),
      ...lineage.ac,
      ...lineage.rule,
    ].flatMap(reference => {
      const jtbd = reference.replace(/\.(?:AC|R)\d+$/u, '');
      for (const part of jtbd.split('.')) {
        const match = /^([A-Z]{2,4})\d+$/u.exec(part);
        if (match?.[1] !== undefined) return [match[1]];
      }
      return [];
    }),
  );
  const personas = resolvePersonaCodes(parsePersonas(content));
  let inventory = '';
  if (project !== '') {
    try {
      inventory = productPersonaInventory(project);
    } catch {
      const path = packet.planning_context?.dependencies.find(
        source => source.role === 'project',
      )?.path;
      throw new PlanningContextError('project', path ?? 'spec.md');
    }
  }
  let inventoryMatched = false;
  for (const persona of personas) {
    const named = inventory.toLocaleLowerCase().includes(persona.name.toLocaleLowerCase());
    if (!named && !inventory.includes(`(${persona.code})`)) continue;
    references.add(persona.code);
    inventoryMatched = true;
  }
  if (references.size === 0 || (inventory !== '' && !inventoryMatched))
    return artifactIdentity(content);
  const lines = content.split('\n');
  const selected = personas.flatMap((persona, index) => {
    if (!references.has(persona.code)) return [];
    const next = personas[index + 1];
    const end = next === undefined ? lines.length : next.lineNumber - 1;
    return [
      {
        code: persona.code,
        content: semanticMarkdownIdentity(lines.slice(persona.lineNumber - 1, end).join('\n')),
      },
    ];
  });
  // Legacy inventories may use a display-only code shape. Keep the complete
  // inventory in currency when references cannot be resolved unambiguously.
  if (selected.length !== references.size) return artifactIdentity(content);
  return identity({ version: 1, selected });
}

function planningSurfaceIdentity(packet: ReviewPacket, content: string): string {
  const spec = planningRoleContent(packet, 'rules');
  const feature = planningRoleContent(packet, 'scenarios');
  const references = new Set([
    ...parseAffectedSurfaceReferences(spec)
      .filter(surface => !surface.skipped)
      .map(surface => surface.slug),
    ...parseFeatureScenarios(feature).flatMap(scenario =>
      scenario.tags.flatMap(tag => (tag.startsWith('@surface.') ? [tag.slice(9)] : [])),
    ),
  ]);
  if (references.size === 0) return artifactIdentity(content);
  const nodes = parseMarkdown(content);
  const headings = nodes.flatMap((node, index) =>
    node.type === 'heading' && node.depth === 2
      ? [{ index, slug: surfaceSlug(headingText(node)) }]
      : [],
  );
  const selected = headings.flatMap((heading, index) => {
    if (!references.has(heading.slug)) return [];
    const end = headings[index + 1]?.index ?? nodes.length;
    return [
      { slug: heading.slug, content: identity(normalizeNodes(nodes.slice(heading.index, end))) },
    ];
  });
  if (selected.length !== references.size)
    throw new Error('Scenario references missing or ambiguous surface inventory entries.');
  return identity({ version: 1, selected });
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function semanticRoleIdentity(
  packet: ReviewPacket,
  role: PlanningReviewIdentity['dependencies'][number]['role'],
  content: string,
): string {
  if (role === 'ticket') return semanticTicketIdentity(content);
  if (role === 'scenarios') return identity(gherkinIdentity(parseFeature(content)));
  if (role === 'personas') return planningPersonaIdentity(packet, content);
  if (role === 'surfaces') return planningSurfaceIdentity(packet, content);
  return artifactIdentity(content);
}

/** Derived only from the neutral packet; persisted by the existing authenticated job owner. */
// eslint-disable-next-line complexity -- Each planning role and upstream policy has distinct currency semantics.
export function createPlanningReviewIdentity(
  packet: ReviewPacket,
): PlanningReviewIdentity | undefined {
  const context = packet.planning_context;
  if (context === undefined) return undefined;
  const files = [...packet.logical_files, ...(packet.context_files ?? [])];
  let selected: ReadonlyMap<string, string>;
  try {
    selected = productParentContextIdentity(packet);
  } catch (error) {
    if (error instanceof PlanningContextError) throw error;
    const parent = context.dependencies.find(
      dependency => dependency.role === 'parent' && dependency.path.endsWith('/spec.md'),
    );
    const project = context.dependencies.find(dependency => dependency.role === 'project');
    const owner = parent ?? project;
    throw new PlanningContextError(owner?.role ?? 'project', owner?.path ?? 'spec.md');
  }
  const snapshotOnlyUpstream =
    packet.planning_phase === 'plan-execution' &&
    (PLANNING_CONTRACTS['plan-execution']
      .upstreamImplementationInvalidation as UpstreamImplementationInvalidation) ===
      'implementation_review_only';
  const upstreamPath = context.dependencies.find(
    dependency => dependency.role === 'accepted-upstream-plan',
  )?.path;
  const dependencies = context.dependencies.map(dependency => {
    const file = files.find(value => value.path === dependency.path);
    if (file === undefined) throw new PlanningContextError(dependency.role, dependency.path);
    try {
      const semantic =
        (snapshotOnlyUpstream && dependency.path === upstreamPath && 'upstream-present') ||
        selected?.get(file.path) ||
        semanticRoleIdentity(packet, dependency.role, file.content);
      return { ...dependency, semantic_digest: sha256(semantic) };
    } catch (error) {
      if (error instanceof PlanningContextError) throw error;
      throw new PlanningContextError(dependency.role, dependency.path);
    }
  });
  const reviewKind = planningReviewKind(packet);
  let contractDigest: string;
  if (packet.kind === 'scenario-gate') contractDigest = sha256(scenarioReviewRubric());
  else {
    const phase = packet.planning_phase ?? 'plan-implementation';
    contractDigest = sha256(identity(PLANNING_CONTRACTS[phase]));
  }
  return {
    ...context,
    review_kind: reviewKind,
    dependencies,
    absences: context.absences.map(absence =>
      snapshotOnlyUpstream && absence.authority === upstreamPath
        ? { ...absence, reason: 'Declared in the accepted Implementation Plan.' }
        : absence,
    ),
    targets: packet.logical_files.map(file => ({
      path: file.path,
      digest:
        reviewKind === 'plan-execution'
          ? (packet.execution_plan_normalized_digest ?? sha256(file.content))
          : sha256(file.content),
    })),
    canonical_contract_digest: contractDigest,
  };
}
