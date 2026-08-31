// Inspiration contract v1 structural validation.
//
// Pure helpers only: deployed hooks run this module directly from
// .safeword/hooks/ without importing the built CLI.

import { stripHtmlComments, withoutFencedCode } from './markdown-structure.js';

export interface InspirationActivationInput {
  ticketContent: string;
  specContent: string;
  activationProvenance?: 'activated' | 'absent' | 'unavailable';
}

export type InspirationActivationVerdict =
  { ok: true; activated: boolean } | { ok: false; reason: string; remediation: string };

export type InspirationEvidencePath = 'legacy' | 'reference' | 'unsuccessful-search';

export type InspirationEvidenceVerdict =
  { ok: true; path: InspirationEvidencePath } | { ok: false; reason: string; remediation: string };

export interface ProductInspirationInput extends InspirationActivationInput {
  evaluationDate: string;
}

export interface ImplementationInspirationInput extends ProductInspirationInput {
  planContent: string;
}

const TICKET_MARKER = 'inspiration_contract: v1';
const SCAFFOLD_SENTINEL = 'inspiration_contract_scaffold: v1';
const SPEC_MARKER = '<!-- safeword:inspiration-contract:v1 -->';
const PRODUCT_HEADER =
  '| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |';
const PRODUCT_DELIMITER = '| --- | --- | --- | --- | --- | --- | --- |';
const PRODUCT_SEARCH_HEADER =
  '| Customer job | Framed question | Products attempted | Source categories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |';
const PRODUCT_SEARCH_DELIMITER = '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
export const IMPLEMENTATION_INSPIRATION_GRAMMAR = {
  referenceHeading: '### Implementation Inspiration',
  referenceHeader:
    '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |',
  referenceDelimiter: '| --- | --- | --- | --- | --- | --- | --- |',
  decisionImpact: '**Decision impact:** <changed: or retained: plus a non-empty rationale>',
  decisionInformed: '**Decision informed:** <exact Decision cell from Recorded Decisions>',
  searchHeading: '#### Implementation Unsuccessful Search',
  searchHeader:
    '| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
  searchDelimiter: '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  recordedDecisionsHeading: '### Recorded Decisions',
} as const;

const {
  referenceHeader: IMPLEMENTATION_HEADER,
  referenceDelimiter: IMPLEMENTATION_DELIMITER,
  searchHeader: IMPLEMENTATION_SEARCH_HEADER,
  searchDelimiter: IMPLEMENTATION_SEARCH_DELIMITER,
} = IMPLEMENTATION_INSPIRATION_GRAMMAR;

const EVIDENCE_REMEDIATION =
  'Complete one exact inspiration reference table or the exact unsuccessful-search table with current dates and non-empty fields.';

function frontmatterLines(content: string): string[] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match?.[1]?.split(/\r?\n/) ?? [];
}

function normalizedTicketKey(line: string): string | undefined {
  const colon = line.indexOf(':');
  if (colon === -1 || /^\s/.test(line)) return undefined;
  return line.slice(0, colon).trim().toLowerCase().replaceAll('_', '').replaceAll('-', '');
}

function ticketSignalCandidates(content: string): string[] {
  return frontmatterLines(content).filter(line => {
    const key = normalizedTicketKey(line);
    return key === 'inspirationcontract' || key === 'inspirationcontractscaffold';
  });
}

function specSignalCandidates(content: string): string[] {
  return [...withoutFencedCode(content, true).matchAll(/<!--[\s\S]*?(?:-->|$)/g)]
    .map(match => match[0])
    .filter(comment => {
      const normalized = comment.toLowerCase().replaceAll(/[\s_:\-<>!]/g, '');
      const safeword = normalized.indexOf('safeword');
      const contract = normalized.indexOf('inspirationcontract');
      return safeword !== -1 && contract > safeword;
    });
}

export function hasInspirationActivationCandidate(input: InspirationActivationInput): boolean {
  return (
    ticketSignalCandidates(input.ticketContent).length > 0 ||
    specSignalCandidates(input.specContent).length > 0
  );
}

function isSpecMarkerInPreamble(content: string): boolean {
  const markdown = withoutFencedCode(content, true);
  const marker = markdown.indexOf(SPEC_MARKER);
  if (marker === -1) return false;
  const markerLine = markdown.slice(0, marker).split(/\r?\n/).length - 1;
  const firstLevelTwoLine = stripHtmlComments(markdown)
    .split(/\r?\n/)
    .findIndex(line => /^##\s/.test(line));
  return firstLevelTwoLine === -1 || markerLine < firstLevelTwoLine;
}

export function evaluateInspirationActivation(
  input: InspirationActivationInput,
): InspirationActivationVerdict {
  const ticketCandidates = ticketSignalCandidates(input.ticketContent);
  const specCandidates = specSignalCandidates(input.specContent);

  if (ticketCandidates.length === 0 && specCandidates.length === 0) {
    if (input.activationProvenance === 'unavailable') {
      return {
        ok: false,
        reason: 'Inspiration activation provenance could not be verified from repository history.',
        remediation:
          'Restore repository history access or restore all three current v1 signals before retrying the transition.',
      };
    }
    if (input.activationProvenance === 'activated') {
      return {
        ok: false,
        reason: 'A previously activated inspiration contract is missing all current v1 signals.',
        remediation:
          'Restore the ticket marker, scaffold sentinel, and spec preamble marker; contract removal is not a legacy migration path.',
      };
    }
    return { ok: true, activated: false };
  }

  const ticketMarkers = ticketCandidates.filter(line => line === TICKET_MARKER);
  const sentinels = ticketCandidates.filter(line => line === SCAFFOLD_SENTINEL);
  const specMarkers = specCandidates.filter(comment => comment === SPEC_MARKER);

  const exact =
    ticketCandidates.length === 2 &&
    ticketMarkers.length === 1 &&
    sentinels.length === 1 &&
    specCandidates.length === 1 &&
    specMarkers.length === 1 &&
    isSpecMarkerInPreamble(input.specContent);

  if (!exact) {
    return {
      ok: false,
      reason:
        'Inspiration contract activation requires all three exact v1 signals: the ticket marker, scaffold sentinel, and spec preamble marker.',
      remediation:
        'Keep exactly one inspiration_contract: v1, one inspiration_contract_scaffold: v1, and one safeword:inspiration-contract:v1 spec marker before the first level-two heading.',
    };
  }

  return { ok: true, activated: true };
}

function evidenceFailure(
  reason: string,
  remediation = EVIDENCE_REMEDIATION,
): InspirationEvidenceVerdict {
  return { ok: false, reason, remediation };
}

function isUtcDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function dateInRange(value: string, baseline: string, evaluationDate: string): boolean {
  return (
    isUtcDate(value) &&
    isUtcDate(baseline) &&
    isUtcDate(evaluationDate) &&
    value >= baseline &&
    value <= evaluationDate
  );
}

function extractSection(content: string, heading: string, level: number): string | undefined {
  const lines = withoutFencedCode(content).split(/\r?\n/);
  const matches = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (matches.length !== 1) return undefined;

  const start = matches[0] as number;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    const match = /^(#{1,6})\s/.exec(lines[index] ?? '');
    if (match && match[1]!.length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

interface ParsedTable {
  endLine: number;
  rows: string[][];
}

function parseNonEmptyPipeRow(line: string, expectedCells: number): string[] | undefined {
  if (!line.startsWith('|') || !line.endsWith('|')) return undefined;
  const cells = line
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
  return cells.length === expectedCells && cells.every(cell => cell !== '') ? cells : undefined;
}

function parseExactTable(
  section: string,
  header: string,
  delimiter: string,
  expectedCells: number,
): ParsedTable | undefined {
  const lines = section.split(/\r?\n/);
  const headerIndexes = lines.flatMap((line, index) => (line === header ? [index] : []));
  if (headerIndexes.length !== 1) return undefined;

  const headerIndex = headerIndexes[0] as number;
  if (lines[headerIndex + 1] !== delimiter) return undefined;

  const rows: string[][] = [];
  let index = headerIndex + 2;
  while (index < lines.length && lines[index]?.startsWith('|')) {
    const line = lines[index] ?? '';
    if (line.includes('<!--') || line.includes('-->')) return undefined;
    const cells = parseNonEmptyPipeRow(line, expectedCells);
    if (cells === undefined) return undefined;
    rows.push(cells);
    index++;
  }
  return rows.length > 0 ? { rows, endLine: index } : undefined;
}

function exactFrontmatterValue(content: string, key: string): string | undefined {
  const candidates = frontmatterLines(content).filter(line => line.startsWith(`${key}:`));
  if (candidates.length !== 1) return undefined;
  const match = new RegExp(`^${key}: (\\S+)$`).exec(candidates[0] ?? '');
  return match?.[1];
}

function productBaseline(ticketContent: string): string | undefined {
  const created = exactFrontmatterValue(ticketContent, 'created');
  if (!created || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(created)) {
    return undefined;
  }
  const parsed = new Date(created);
  const expected = created.includes('.') ? created : created.replace('Z', '.000Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === expected
    ? created.slice(0, 10)
    : undefined;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    );
  } catch {
    return false;
  }
}

function hasDecisionPrefix(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    prefix => value.startsWith(prefix) && value.slice(prefix.length).trim() !== '',
  );
}

function decisionRows(content: string): string[][] {
  const lines = withoutFencedCode(content).split(/\r?\n/);
  const header = '| Decision | Choice | Alternatives considered | Rejected because |';
  const headerIndexes = lines.flatMap((line, index) => (line === header ? [index] : []));
  if (headerIndexes.length !== 1) return [];
  const headerIndex = headerIndexes[0]!;

  const delimiter = lines[headerIndex + 1] ?? '';
  const delimiterCells =
    delimiter.startsWith('|') && delimiter.endsWith('|')
      ? delimiter
          .slice(1, -1)
          .split('|')
          .map(cell => cell.trim())
      : [];
  if (delimiterCells.length !== 4 || delimiterCells.some(cell => !/^:?-+:?$/.test(cell))) {
    return [];
  }

  const rows: string[][] = [];
  for (let index = headerIndex + 2; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line.startsWith('|') || !line.endsWith('|')) break;
    const cells = parseNonEmptyPipeRow(line, 4);
    if (cells === undefined) return [];
    rows.push(cells);
  }
  const identifiers = rows.map(row => row[0]);
  return new Set(identifiers).size === identifiers.length ? rows : [];
}

function validateProductReferences(
  section: string,
  baseline: string,
  evaluationDate: string,
): InspirationEvidenceVerdict {
  const table = parseExactTable(section, PRODUCT_HEADER, PRODUCT_DELIMITER, 7);
  if (!table) return evidenceFailure('The product inspiration table does not match v1 grammar.');
  for (const row of table.rows) {
    const [reference, checkedOn, , , , , impact] = row;
    if (!isHttpsUrl(reference!))
      return evidenceFailure('Product references must be absolute HTTPS URLs.');
    if (!dateInRange(checkedOn!, baseline, evaluationDate)) {
      return evidenceFailure(
        'Product evidence dates must fall between ticket creation and evaluation.',
      );
    }
    if (!hasDecisionPrefix(impact!, ['changed:', 'retained:'])) {
      return evidenceFailure('Product decision impact must begin changed: or retained:.');
    }
  }
  return { ok: true, path: 'reference' };
}

function validateProductSearch(
  searchSection: string,
  baseline: string,
  evaluationDate: string,
): InspirationEvidenceVerdict {
  const table = parseExactTable(searchSection, PRODUCT_SEARCH_HEADER, PRODUCT_SEARCH_DELIMITER, 9);
  if (!table || table.rows.length !== 1) {
    return evidenceFailure('The product unsuccessful-search table does not match v1 grammar.');
  }
  const row = table.rows[0]!;
  if (!dateInRange(row[5]!, baseline, evaluationDate)) {
    return evidenceFailure('Product search date must fall between ticket creation and evaluation.');
  }
  if (!hasDecisionPrefix(row[8]!, ['retained:'])) {
    return evidenceFailure('Product unsuccessful search must retain a decision with rationale.');
  }
  return { ok: true, path: 'unsuccessful-search' };
}

export function evaluateProductInspiration(
  input: ProductInspirationInput,
): InspirationEvidenceVerdict {
  const activation = evaluateInspirationActivation(input);
  if (!activation.ok) return activation;
  if (!activation.activated) return { ok: true, path: 'legacy' };

  const baseline = productBaseline(input.ticketContent);
  if (!baseline || !isUtcDate(input.evaluationDate)) {
    return evidenceFailure(
      'Product inspiration requires a valid ticket creation baseline and evaluation date.',
    );
  }

  const section = extractSection(input.specContent, '## Product Inspiration', 2);
  if (section === undefined)
    return evidenceFailure('Product Inspiration is missing or duplicated.');

  const hasReference = section.includes(PRODUCT_HEADER);
  const searchSection = extractSection(section, '### Product Unsuccessful Search', 3);
  const hasSearch = searchSection !== undefined;
  if (hasReference === hasSearch) {
    return evidenceFailure('Product Inspiration must contain exactly one resolution path.');
  }
  return hasReference
    ? validateProductReferences(section, baseline, input.evaluationDate)
    : validateProductSearch(searchSection!, baseline, input.evaluationDate);
}

function containsExactReference(cell: string, reference: string): boolean {
  const escaped = reference.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s([])${escaped}(?=$|[\\s)\\]}>.,;:!?])`).test(cell);
}

function plannedOnBaseline(planContent: string): string | undefined {
  const lines = withoutFencedCode(planContent).split(/\r?\n/);
  const levelOneHeadings = lines.flatMap((line, index) => (/^#\s+\S/.test(line) ? [index] : []));
  if (levelOneHeadings.length !== 1) return undefined;
  const firstH1 = levelOneHeadings[0]!;
  const firstH2 = lines.findIndex(line => /^##\s/.test(line));
  const candidates = lines.flatMap((line, index) => {
    const colon = line.indexOf(':');
    if (colon === -1) return [];
    const label = line
      .slice(0, colon)
      .toLowerCase()
      .replaceAll(/[\s*_-]/g, '');
    return label === 'plannedon' ? [{ index, line }] : [];
  });
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0]!;
  if (candidate.index <= firstH1 || firstH2 === -1 || candidate.index >= firstH2) return undefined;
  const match = /^\*\*Planned on:\*\* (\d{4}-\d{2}-\d{2})$/.exec(candidate.line);
  return match && isUtcDate(match[1]!) ? match[1] : undefined;
}

function validateImplementationSearch(
  searchSection: string,
  recordedRows: string[][],
  baseline: string,
  evaluationDate: string,
): InspirationEvidenceVerdict {
  const searchTable = parseExactTable(
    searchSection,
    IMPLEMENTATION_SEARCH_HEADER,
    IMPLEMENTATION_SEARCH_DELIMITER,
    11,
  );
  if (!searchTable || searchTable.rows.length !== 1) {
    return evidenceFailure(
      'The implementation unsuccessful-search table does not match v1 grammar.',
    );
  }
  const row = searchTable.rows[0]!;
  if (!dateInRange(row[7]!, baseline, evaluationDate)) {
    return evidenceFailure('Implementation search date must fall between planning and evaluation.');
  }
  if (!hasDecisionPrefix(row[10]!, ['retained:'])) {
    return evidenceFailure(
      'Implementation unsuccessful search must retain a decision with rationale.',
    );
  }
  if (recordedRows.length === 0) {
    return evidenceFailure(
      'Implementation unsuccessful search requires at least one valid Recorded Decisions row.',
    );
  }
  if (!recordedRows.some(recordedRow => recordedRow[0] === row[1])) {
    return evidenceFailure(
      'Implementation unsuccessful search Decision informed must exactly match a Recorded Decisions Decision cell.',
    );
  }
  return { ok: true, path: 'unsuccessful-search' };
}

function validateImplementationReferences(
  section: string,
  recordedRows: string[][],
  baseline: string,
  evaluationDate: string,
): InspirationEvidenceVerdict {
  const table = parseExactTable(section, IMPLEMENTATION_HEADER, IMPLEMENTATION_DELIMITER, 7);
  if (!table)
    return evidenceFailure('The implementation inspiration table does not match v1 grammar.');
  for (const row of table.rows) {
    const [reference, checkedOn, sourceVersion, targetVersion] = row;
    if (!isHttpsUrl(reference!)) {
      return evidenceFailure('Implementation references must be absolute HTTPS URLs.');
    }
    if (!dateInRange(checkedOn!, baseline, evaluationDate)) {
      return evidenceFailure(
        'Implementation evidence dates must fall between planning and evaluation.',
      );
    }
    const versionsMatch =
      (sourceVersion === 'n/a' && targetVersion === 'n/a') ||
      (sourceVersion !== 'n/a' && sourceVersion === targetVersion);
    if (!versionsMatch)
      return evidenceFailure('Implementation source and target versions must match.');
  }

  const lines = section.split(/\r?\n/);
  const impactLines = lines.filter(line => /^\*\*Decision impact:\*\*/.test(line.trim()));
  if (impactLines.length !== 1) {
    return evidenceFailure('Implementation evidence requires exactly one decision impact line.');
  }
  const trailingLines = lines
    .slice(table.endLine)
    .map(line => line.trim())
    .filter(line => line !== '');
  const impact = /^\*\*Decision impact:\*\* ((?:changed:|retained:).+)$/.exec(
    trailingLines[0] ?? '',
  );
  if (!impact || !hasDecisionPrefix(impact[1]!, ['changed:', 'retained:'])) {
    return evidenceFailure(
      'Implementation evidence requires one decision impact immediately after its table.',
    );
  }

  const decisionLines = lines.filter(line => /^\*\*Decision informed:\*\*/.test(line.trim()));
  if (decisionLines.length !== 1) {
    return evidenceFailure('Implementation evidence requires exactly one Decision informed line.');
  }
  const decisionLine = trailingLines[1];
  const decision = /^\*\*Decision informed:\*\* (.+)$/.exec(decisionLine ?? '')?.[1]?.trim();
  if (!decision) {
    return evidenceFailure(
      'Implementation evidence requires one Decision informed line immediately after its decision impact.',
    );
  }
  const matchingRow = recordedRows.find(row => row[0] === decision);
  if (!matchingRow) {
    return evidenceFailure(
      'Implementation Decision informed must uniquely match a Recorded Decisions Decision cell.',
    );
  }

  const references = table.rows.map(row => row[0]!);
  const cited = references.some(reference =>
    matchingRow.some(cell => containsExactReference(cell, reference)),
  );
  if (!cited) {
    return evidenceFailure(
      'The affected Recorded Decisions row must cite an Implementation Inspiration reference.',
    );
  }
  return { ok: true, path: 'reference' };
}

export function evaluateImplementationInspiration(
  input: ImplementationInspirationInput,
): InspirationEvidenceVerdict {
  const activation = evaluateInspirationActivation(input);
  if (!activation.ok) return activation;
  if (!activation.activated) return { ok: true, path: 'legacy' };

  const baseline = plannedOnBaseline(input.planContent);
  if (!baseline || !isUtcDate(input.evaluationDate)) {
    return evidenceFailure(
      'Implementation inspiration requires one valid Planned on baseline and evaluation date.',
    );
  }

  const decisions = extractSection(input.planContent, '## Decisions', 2);
  if (decisions === undefined) {
    return evidenceFailure(
      'Implementation Inspiration must appear once directly inside Decisions.',
    );
  }
  const section = extractSection(decisions, '### Implementation Inspiration', 3);
  if (section === undefined) {
    return evidenceFailure(
      'Implementation Inspiration must appear once directly inside Decisions.',
    );
  }
  const recordedDecisions = extractSection(decisions, '### Recorded Decisions', 3);
  const recordedRows = recordedDecisions === undefined ? [] : decisionRows(recordedDecisions);

  const hasReference = section.includes(IMPLEMENTATION_HEADER);
  const searchSection = extractSection(section, '#### Implementation Unsuccessful Search', 4);
  const hasSearch = searchSection !== undefined;
  if (hasReference === hasSearch) {
    return evidenceFailure('Implementation Inspiration must contain exactly one resolution path.');
  }
  return hasSearch
    ? validateImplementationSearch(searchSection, recordedRows, baseline, input.evaluationDate)
    : validateImplementationReferences(section, recordedRows, baseline, input.evaluationDate);
}
