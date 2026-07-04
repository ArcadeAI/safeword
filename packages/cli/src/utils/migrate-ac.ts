/**
 * `.AC<n>` -> `.R<n>` codemod core (ticket 1SVCB9, TB1). Pure string transforms
 * behind `safeword migrate-ac`, which converts a project's legacy Acceptance-
 * Criteria spelling to the single Rule tier.
 *
 * Two entry points, by what the file carries:
 *   - migrateSpecAc — rewrites `#### <id>.AC<n>` *declaration* headings in a
 *     spec.md, collision-aware: if converting an AC would clash with a Rule
 *     number already declared under the same JTBD, the whole file is refused
 *     (per-file atomicity — never a silent renumber).
 *   - migrateReferencesAc — rewrites `.AC<n>` *references* (`@<id>.AC<n>` feature tags
 *     and `### Scenario: <id>.AC<n>` ledger titles). References carry no
 *     declaration, so there is nothing to collide with.
 *
 * Same number in, same number out. Idempotent: migrated content has no `.AC<n>`
 * left, so a second pass is a no-op. No I/O — the command owns file discovery.
 */

import { parseCriteriaIdsByJtbd } from './scenario-coverage.js';

export interface AcMigration {
  /** The rewritten content, or the original when unchanged or refused. */
  content: string;
  changed: boolean;
  /** JTBD ids refused for an AC<n>/R<n> collision (spec declarations only). */
  collisions: string[];
}

/** A lineage `.AC<digits>` segment. The leading dot anchors it to an id token
 * (`<id>.AC<n>`), so bare prose "AC" is never touched. */
const AC_SEGMENT = /\.AC(\d+)/g;

/** Rewrite `.AC<n>` references to `.R<n>`, but only where a lineage reference
 * actually lives — a Gherkin tag line (`@…`) or a `### Scenario:` ledger title.
 * `.AC` inside Given/When/Then step text or Examples-table data is left verbatim
 * (it is fixture prose, not a reference to migrate). */
export function migrateReferencesAc(content: string): AcMigration {
  const migrated = content
    .split('\n')
    .map(line => (isReferenceLine(line) ? line.replaceAll(AC_SEGMENT, '.R$1') : line))
    .join('\n');
  return { content: migrated, changed: migrated !== content, collisions: [] };
}

/** A line that carries a lineage reference: a Gherkin tag line or a scenario
 * title. Step text, prose, and Examples rows are not references. */
function isReferenceLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('@') || /^#{3,}\s+Scenario:/.test(trimmed);
}

/** Rewrite `#### <id>.AC<n>` declaration headings to `.R<n>`, refusing the whole
 * file if any JTBD would collide an AC number onto an existing Rule number. */
export function migrateSpecAc(content: string): AcMigration {
  const collisions = findCollisions(content);
  if (collisions.length > 0) return { content, changed: false, collisions };

  const migrated = content
    .split('\n')
    .map(line => (isCriterionHeading(line) ? line.replaceAll(AC_SEGMENT, '.R$1') : line))
    .join('\n');
  return { content: migrated, changed: migrated !== content, collisions: [] };
}

/** A `####`-or-deeper heading line (criterion headings sit at level 4). */
function isCriterionHeading(line: string): boolean {
  return /^#{4,6}\s/.test(line.trimStart());
}

/** JTBD ids where an AC number equals a Rule number already declared under it. */
function findCollisions(content: string): string[] {
  const collisions: string[] = [];
  for (const [jtbd, criteria] of parseCriteriaIdsByJtbd(content)) {
    const ruleNumbers = new Set(criteria.ruleIds.map(id => trailingNumber(id)));
    if (criteria.acIds.map(id => trailingNumber(id)).some(number => ruleNumbers.has(number))) {
      collisions.push(jtbd);
    }
  }
  return collisions;
}

/** The trailing `AC<n>`/`R<n>` number of a criterion id (`demo.SM1.AC3` -> `3`). */
function trailingNumber(id: string): string {
  return id.replace(/^.*\.(?:AC|R)(\d+)$/, '$1');
}
