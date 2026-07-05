/**
 * Narrative-drift helpers (ticket BY7RNR, GitHub #848): compare the generated
 * root index's `## Packages` against the human architecture narrative and
 * format a non-blocking advisory for packages the narrative never mentions.
 *
 * Deterministic-by-reading: both inputs are documents already on disk — the
 * machine-owned root index and the human narrative. Nothing here analyzes
 * source, and the advisory never blocks (the narrative is human-owned; the
 * AXRC4D ruling stands). Scope guard: monorepo `## Packages` only — single-repo
 * `## Modules` names (`utils`, `commands`, …) collide with ordinary prose and
 * stay `/audit`'s judgment call.
 */

import { listArchitectureRecords } from './architecture-records.js';
import {
  resolveArchitectureNarrative,
  resolveGeneratedArchitecturePath,
} from './configured-paths.js';
import { readFileSafe } from './fs.js';

/** Most packages named before the advisory truncates to an "and N more" tail. */
const ADVISORY_PACKAGE_CAP = 6;

/**
 * The drift advisory for `projectDirectory`, or `undefined` when there is nothing
 * to say: no narrative at the resolved location (an explicitly configured
 * target that is missing means NO narrative — no root fallback), an empty
 * decision-record directory, no generated root index, or no missing packages.
 * IO seam over the pure helpers below; called by `safeword architecture` in
 * every mode.
 */
export function architectureNarrativeDriftAdvisoryForProject(
  projectDirectory: string,
): string | undefined {
  const narrative = resolveArchitectureNarrative(projectDirectory);
  const records = listArchitectureRecords(narrative.absolutePath).records;
  if (records.length === 0) return undefined;

  const generatedDocument = readFileSafe(resolveGeneratedArchitecturePath(projectDirectory));
  if (generatedDocument === undefined) return undefined;

  const narrativeText = records.map(record => readFileSafe(record) ?? '').join('\n');
  return narrativeDriftAdvisory(
    extractRootIndexPackages(generatedDocument),
    narrativeText,
    narrative.displayPath,
  );
}

/**
 * The `### <name>` package names under the root index's `## Packages` section.
 * Empty for a single-repo `## Modules` doc, empty content, or any doc without
 * that section.
 */
export function extractRootIndexPackages(generatedDocument: string): string[] {
  const packages: string[] = [];
  let isInPackagesSection = false;
  for (const line of generatedDocument.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      isInPackagesSection = line.slice(3).trim() === 'Packages';
      continue;
    }
    if (isInPackagesSection && line.startsWith('### ')) {
      const name = line.slice(4).trim();
      if (name.length > 0) packages.push(name);
    }
  }
  return packages;
}

/**
 * The spec's "mentioned" rule: the full package name — or its unscoped tail
 * (`@scope/pkg` → `pkg`) — appears case-insensitively at a word boundary in
 * the narrative text. Boundaries treat name characters (`-`, `_`, `@`, `/`,
 * `.`) as part of a name, so `cli` never matches inside `click` and `web`
 * never matches `web-app`. Deliberately generous (tail counts): the advisory
 * prefers under-reporting to nagging.
 */
export function isMentioned(packageName: string, narrativeText: string): boolean {
  const tail = packageName.includes('/') ? packageName.split('/').at(-1) : undefined;
  const candidates = tail !== undefined && tail !== '' ? [packageName, tail] : [packageName];
  return candidates.some(candidate => nameBoundaryPattern(candidate).test(narrativeText));
}

/**
 * Case-insensitive pattern matching `name` only at name-character boundaries.
 * Boundary generosity is asymmetric on purpose, and each side errs toward
 * counting a mention: a trailing `.`/`-` blocks only when it CONTINUES a name
 * (`web-app`), never as sentence punctuation ("…and billing."), and a trailing
 * `/` counts (`web/src` mentions `web` — a path reference) while a leading
 * `@`/`/` does not (`@acme/web` is a different package than bare `web`).
 */
function nameBoundaryPattern(name: string): RegExp {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  // eslint-disable-next-line security/detect-non-literal-regexp -- name comes from safeword's own generated doc and is metacharacter-escaped above
  return new RegExp(String.raw`(?<![\w@/.-])${escaped}(?!\w|[.-]\w)`, 'i');
}

/**
 * The one-line drift advisory naming generated packages the narrative never
 * mentions, or `undefined` when nothing is missing (including the no-packages
 * single-repo case). The list is capped at {@link ADVISORY_PACKAGE_CAP} names
 * with an "and N more" tail; the pointer at `/audit` is the actionable half —
 * only a human (via the audit reconciliation) can fix narrative drift.
 */
export function narrativeDriftAdvisory(
  packageNames: string[],
  narrativeText: string,
  narrativeDisplayPath: string,
): string | undefined {
  const missing = packageNames.filter(name => !isMentioned(name, narrativeText));
  if (missing.length === 0) return undefined;

  const named = missing.slice(0, ADVISORY_PACKAGE_CAP);
  const remainder = missing.length - named.length;
  const listing = remainder > 0 ? `${named.join(', ')} and ${remainder} more` : named.join(', ');
  return (
    `Architecture narrative (${narrativeDisplayPath}) does not mention ` +
    `${missing.length} generated package(s): ${listing} — run /audit to reconcile ` +
    `against architecture.generated.md. (Advisory; nothing is blocked.)`
  );
}
