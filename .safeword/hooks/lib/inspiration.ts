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

const TICKET_MARKER = 'inspiration_contract: v1';
const SCAFFOLD_SENTINEL = 'inspiration_contract_scaffold: v1';
const SPEC_MARKER = '<!-- safeword:inspiration-contract:v1 -->';

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
