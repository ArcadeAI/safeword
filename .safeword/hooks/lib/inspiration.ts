// Inspiration contract v1 structural validation.
//
// Pure helpers only: deployed hooks run this module directly from
// .safeword/hooks/ without importing the built CLI.

export interface InspirationActivationInput {
  ticketContent: string;
  specContent: string;
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
const IMPLEMENTATION_HEADER =
  '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |';
const IMPLEMENTATION_DELIMITER = '| --- | --- | --- | --- | --- | --- | --- |';
const IMPLEMENTATION_SEARCH_HEADER =
  '| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |';
const IMPLEMENTATION_SEARCH_DELIMITER =
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';

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
  return [...content.matchAll(/<!--[\s\S]*?-->/g)]
    .map(match => match[0])
    .filter(comment => {
      const normalized = comment.toLowerCase().replaceAll(/[\s_:\-<>!]/g, '');
      const safeword = normalized.indexOf('safeword');
      const contract = normalized.indexOf('inspirationcontract');
      return safeword !== -1 && contract > safeword;
    });
}

function isSpecMarkerInPreamble(content: string): boolean {
  const marker = content.indexOf(SPEC_MARKER);
  if (marker === -1) return false;
  const firstLevelTwo = content.search(/^##\s/m);
  return firstLevelTwo === -1 || marker < firstLevelTwo;
}

export function evaluateInspirationActivation(
  input: InspirationActivationInput,
): InspirationActivationVerdict {
  const ticketCandidates = ticketSignalCandidates(input.ticketContent);
  const specCandidates = specSignalCandidates(input.specContent);

  if (ticketCandidates.length === 0 && specCandidates.length === 0) {
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

function stripHtmlComments(content: string): string {
  return content.replaceAll(/<!--[\s\S]*?-->/g, '');
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
    if (!line.endsWith('|') || line.includes('<!--') || line.includes('-->')) return undefined;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map(cell => cell.trim());
    if (cells.length !== expectedCells || cells.some(cell => cell === '')) return undefined;
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
  return Number.isNaN(new Date(created).valueOf()) ? undefined : created.slice(0, 10);
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
  const headerIndex = lines.indexOf(header);
  if (headerIndex === -1) return [];

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
    const cells = line
      .slice(1, -1)
      .split('|')
      .map(cell => cell.trim());
    if (cells.length !== 4 || cells.some(cell => cell === '')) return [];
    rows.push(cells);
  }
  return rows;
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

  if (hasReference) {
    const table = parseExactTable(section, PRODUCT_HEADER, PRODUCT_DELIMITER, 7);
    if (!table) return evidenceFailure('The product inspiration table does not match v1 grammar.');
    for (const row of table.rows) {
      const [reference, checkedOn, sourceVersion, , , , impact] = row;
      if (!isHttpsUrl(reference!))
        return evidenceFailure('Product references must be absolute HTTPS URLs.');
      if (!dateInRange(checkedOn!, baseline, input.evaluationDate)) {
        return evidenceFailure(
          'Product evidence dates must fall between ticket creation and evaluation.',
        );
      }
      if (sourceVersion === '')
        return evidenceFailure('Product source version must use a value or n/a.');
      if (!hasDecisionPrefix(impact!, ['changed:', 'retained:'])) {
        return evidenceFailure('Product decision impact must begin changed: or retained:.');
      }
    }
    return { ok: true, path: 'reference' };
  }

  const table = parseExactTable(searchSection!, PRODUCT_SEARCH_HEADER, PRODUCT_SEARCH_DELIMITER, 9);
  if (!table || table.rows.length !== 1) {
    return evidenceFailure('The product unsuccessful-search table does not match v1 grammar.');
  }
  const row = table.rows[0]!;
  if (!dateInRange(row[5]!, baseline, input.evaluationDate)) {
    return evidenceFailure('Product search date must fall between ticket creation and evaluation.');
  }
  if (!hasDecisionPrefix(row[8]!, ['retained:'])) {
    return evidenceFailure('Product unsuccessful search must retain a decision with rationale.');
  }
  return { ok: true, path: 'unsuccessful-search' };
}

function withoutFencedCode(content: string): string {
  const lines = stripHtmlComments(content).split(/\r?\n/);
  let fence: '`' | '~' | undefined;
  return lines
    .map(line => {
      const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (match) {
        const kind = match[1]![0] as '`' | '~';
        if (fence === undefined) fence = kind;
        else if (fence === kind) fence = undefined;
        return '';
      }
      return fence === undefined ? line : '';
    })
    .join('\n');
}

function plannedOnBaseline(planContent: string): string | undefined {
  const lines = withoutFencedCode(planContent).split(/\r?\n/);
  const firstH1 = lines.findIndex(line => /^#\s/.test(line));
  const firstH2 = lines.findIndex(line => /^##\s/.test(line));
  const candidates = lines.flatMap((line, index) => {
    const normalized = line.toLowerCase().replaceAll(/[^a-z]/g, '');
    return normalized.startsWith('plannedon') ? [{ index, line }] : [];
  });
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0]!;
  if (candidate.index <= firstH1 || firstH2 === -1 || candidate.index >= firstH2) return undefined;
  const match = /^\*\*Planned on:\*\* (\d{4}-\d{2}-\d{2})$/.exec(candidate.line);
  return match && isUtcDate(match[1]!) ? match[1] : undefined;
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
  const section = decisions && extractSection(decisions, '### Implementation Inspiration', 3);
  if (section === undefined) {
    return evidenceFailure(
      'Implementation Inspiration must appear once directly inside Decisions.',
    );
  }

  const hasReference = section.includes(IMPLEMENTATION_HEADER);
  const searchSection = extractSection(section, '#### Implementation Unsuccessful Search', 4);
  const hasSearch = searchSection !== undefined;
  if (hasReference === hasSearch) {
    return evidenceFailure('Implementation Inspiration must contain exactly one resolution path.');
  }

  if (hasSearch) {
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
    if (!dateInRange(row[7]!, baseline, input.evaluationDate)) {
      return evidenceFailure(
        'Implementation search date must fall between planning and evaluation.',
      );
    }
    if (!hasDecisionPrefix(row[10]!, ['retained:'])) {
      return evidenceFailure(
        'Implementation unsuccessful search must retain a decision with rationale.',
      );
    }
    return { ok: true, path: 'unsuccessful-search' };
  }

  const table = parseExactTable(section, IMPLEMENTATION_HEADER, IMPLEMENTATION_DELIMITER, 7);
  if (!table)
    return evidenceFailure('The implementation inspiration table does not match v1 grammar.');
  for (const row of table.rows) {
    const [reference, checkedOn, sourceVersion, targetVersion] = row;
    if (!isHttpsUrl(reference!)) {
      return evidenceFailure('Implementation references must be absolute HTTPS URLs.');
    }
    if (!dateInRange(checkedOn!, baseline, input.evaluationDate)) {
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
  const nextLine = lines
    .slice(table.endLine)
    .find(line => line.trim() !== '')
    ?.trim();
  const impact = /^\*\*Decision impact:\*\* ((?:changed:|retained:).+)$/.exec(nextLine ?? '');
  if (!impact || !hasDecisionPrefix(impact[1]!, ['changed:', 'retained:'])) {
    return evidenceFailure(
      'Implementation evidence requires one decision impact immediately after its table.',
    );
  }

  const references = table.rows.map(row => row[0]!);
  const cited = decisionRows(decisions).some(row =>
    references.some(reference => row.some(cell => cell.includes(reference))),
  );
  if (!cited) {
    return evidenceFailure(
      'At least one affected Decisions row must cite an Implementation Inspiration reference.',
    );
  }

  return { ok: true, path: 'reference' };
}
