/**
 * Narrative-drift helpers (ticket BY7RNR, GitHub #848): compare the generated
 * root index's `## Packages` against the human architecture narrative and
 * format a non-blocking advisory for packages the narrative never mentions.
 */

export function extractRootIndexPackages(_generatedDocument: string): string[] {
  throw new Error('not implemented');
}

export function isMentioned(_packageName: string, _narrativeText: string): boolean {
  throw new Error('not implemented');
}

export function narrativeDriftAdvisory(
  _missingCandidates: string[],
  _narrativeText: string,
  _narrativeDisplayPath: string,
): string | null {
  throw new Error('not implemented');
}
