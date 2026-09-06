import { existsSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { activeLines, sectionBody } from './impl-plan.js';
import { resolveReviewKnowledgeSources } from './project-knowledge.js';

interface PrincipleTrace {
  principle: string;
  consequence: string;
  proof: string;
  conflict: string;
}

/** Split one table row on its unescaped delimiters, restoring `\|` inside cells. */
function rowCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/(?<!\\)\|$/u, '')
    .split(/(?<!\\)\|/u)
    .map(cell => cell.replaceAll(String.raw`\|`, '|').trim());
}

const SEPARATOR_CELL = /^:?-{3,}:?$/u;

/** A delimiter row is the one structure GFM actually requires of a table. */
function isDelimiterRow(line: string): boolean {
  const cells = rowCells(line);

  return line.includes('|') && cells.length > 0 && cells.every(cell => SEPARATOR_CELL.test(cell));
}

/**
 * Collect the data lines of every trace table in the section.
 *
 * `sectionBody` strips blank lines, so tables cannot be separated by the gap
 * between them — the delimiter row is the only surviving structure. From each
 * delimiter, read downward while the lines still look like table rows: stop at
 * the first line without a pipe (prose after the table) and at the header of a
 * following table, recognised because a delimiter sits directly beneath it.
 *
 * Every narrower rule tried here was a silent skip: dropping rows whose first
 * cell read `principle` hid a principle actually named `Principle`, requiring a
 * leading `|` hid whole tables since GFM makes the outer pipes optional, and
 * reading only the first delimiter hid a second table. A skipped row is worse
 * than a wrong verdict — the gate reports nothing at all. The converse also
 * bites: with no delimiter anywhere there is no table, and judging the section's
 * prose as rows reported findings against an ordinary sentence.
 */
function tableDataLines(lines: string[]): string[] {
  const rows: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!isDelimiterRow(line)) continue;
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next] ?? '';
      if (!candidate.includes('|') || isDelimiterRow(candidate)) break;
      if (isDelimiterRow(lines[next + 1] ?? '')) break;
      rows.push(candidate);
    }
  }

  return rows;
}

function parseTraceRows(implPlan: string): PrincipleTrace[] {
  return (
    tableDataLines(sectionBody(implPlan, 'Design alignment').split('\n'))
      .map(line => rowCells(line))
      .map(cells => ({
        principle: cells[0] ?? '',
        consequence: cells[1] ?? '',
        proof: cells[2] ?? '',
        conflict: cells[3] ?? '',
      }))
      // Only a wholly blank row is noise. A row missing just its principle name
      // still carries claims, so it is judged rather than dropped unexamined.
      .filter(trace => Object.values(trace).some(cell => cell !== ''))
  );
}

/**
 * Every `##` heading names a principle. Recognition stays permissive because the
 * cost is asymmetric: an unused extra name is inert, while failing to see an
 * authored principle reports the plan's correct citation as a fabrication.
 * `## Further reading` terminates the list so supporting sections have a home.
 */
function principleNames(source: string | null): Set<string> {
  const names = new Set<string>();

  for (const line of activeLines(source ?? '')) {
    const name = line.match(/^##\s+(.+?)\s*$/u)?.[1]?.trim();
    if (name === undefined) continue;
    if (name.toLowerCase() === 'further reading') break;
    names.add(name.toLowerCase());
  }

  return names;
}

function proofTarget(proof: string): { path: string; fragment?: string } {
  const markdownTarget = proof.match(/\[[^\]]+\]\(([^)]+)\)/u)?.[1];
  const target = (markdownTarget ?? proof).replaceAll('`', '').trim();
  const [path = '', fragment] = target.split('#', 2);

  return { path: path.replace(/:\d+$/u, ''), fragment };
}

function proofResolves(projectDirectory: string, proof: string): boolean {
  const target = proofTarget(proof);
  if (target.path === '' || nodePath.isAbsolute(target.path)) return false;
  const resolved = nodePath.resolve(projectDirectory, target.path);
  const relative = nodePath.relative(projectDirectory, resolved);
  if (
    relative.startsWith(`..${nodePath.sep}`) ||
    relative === '..' ||
    nodePath.isAbsolute(relative)
  ) {
    return false;
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return false;
  const realProjectDirectory = realpathSync(projectDirectory);
  const realTarget = realpathSync(resolved);
  const realRelative = nodePath.relative(realProjectDirectory, realTarget);
  if (
    realRelative.startsWith(`..${nodePath.sep}`) ||
    realRelative === '..' ||
    nodePath.isAbsolute(realRelative)
  ) {
    return false;
  }
  // A `#fragment` is not validated. Deciding whether an anchor exists means
  // reproducing GitHub's slugger — an 8 KB generated Unicode table plus its
  // stateful duplicate-heading suffixes (`#evidence-1`) — which a
  // zero-dependency hook cannot carry. Six review passes over approximations of
  // it produced both dead links accepted and live links rejected; on a blocking
  // gate the false rejection is the worse failure. The reference resolves to a
  // real in-repo file, and the fragment remains a reader's pointer to a section.
  return true;
}

function finding(detail: string, principle: string): string {
  return `[E010] Broken principle trace: ${detail}: ${principle}`;
}

/** Whether `text` names `phrase` as itself, not as part of a longer word. */
function namesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

  return new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped}(?![\p{L}\p{N}])`, 'u').test(text);
}

/**
 * A deviation records the conflict only when it cites that principle itself.
 *
 * Two ways a looser test lets an unrecorded conflict through, and both happen:
 * a longer principle whose name contains this one (`Ship reversible changes
 * safely` for `Ship reversible changes`), so longer names are removed first;
 * and an ordinary word that contains it (`Latest` for `Test`), so what remains
 * must name the principle at a word boundary.
 */
function conflictRecorded(
  deviations: string,
  principle: string,
  names: Set<string> | undefined,
): boolean {
  const target = principle.toLowerCase();
  let remaining = deviations;
  for (const other of names ?? []) {
    if (other !== target && other.includes(target)) remaining = remaining.replaceAll(other, '');
  }

  return namesPhrase(remaining, target);
}

/** Check only objective trace facts; applicability and wisdom remain review judgments. */
export function checkPrincipleTrace(projectDirectory: string, implPlan: string): string[] {
  const traces = parseTraceRows(implPlan);
  if (traces.length === 0) return [];

  const principles = resolveReviewKnowledgeSources(projectDirectory).find(
    source => source.key === 'principles',
  );
  // No source file means nothing to match against, so attribution goes unjudged
  // rather than condemning every row. A misconfigured `paths.principles` is
  // `safeword doctor`'s finding, not a reason to block every plan in the project.
  const names = principles?.exists === true ? principleNames(principles.content) : undefined;
  const deviations = sectionBody(implPlan, 'Known deviations').toLowerCase();
  const findings: string[] = [];

  for (const trace of traces) {
    if (trace.principle === '') {
      findings.push('[E010] Broken principle trace: row has no principle name');
      continue;
    }
    if (names?.has(trace.principle.toLowerCase()) === false) {
      findings.push(finding('missing source principle', trace.principle));
    }
    if (trace.consequence === '' || trace.proof === '') {
      findings.push(finding('incomplete principle mapping', trace.principle));
    } else if (!proofResolves(projectDirectory, trace.proof)) {
      findings.push(finding('dead evidence reference', trace.principle));
    }
    const conflict = trace.conflict.toLowerCase();
    if (conflict !== '' && conflict !== 'explicit-conflict') {
      findings.push(finding('unsupported conflict marker', trace.principle));
    } else if (
      conflict === 'explicit-conflict' &&
      !conflictRecorded(deviations, trace.principle, names)
    ) {
      findings.push(finding('unrecorded conflict', trace.principle));
    }
  }

  return findings;
}
