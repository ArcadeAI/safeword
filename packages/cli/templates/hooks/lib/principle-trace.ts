import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { sectionBody } from './impl-plan.ts';
import { resolveReviewKnowledgeSources } from './project-knowledge.ts';

interface PrincipleTrace {
  principle: string;
  consequence: string;
  proof: string;
  conflict: string;
}

function parseTraceRows(implPlan: string): PrincipleTrace[] {
  return sectionBody(implPlan, 'Design alignment')
    .split('\n')
    .filter(line => line.trim().startsWith('|'))
    .map(line =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => cell.trim()),
    )
    .filter(cells => {
      const first = cells[0]?.toLowerCase() ?? '';
      return first !== 'principle' && !/^:?-{3,}:?$/u.test(first);
    })
    .map(cells => ({
      principle: cells[0] ?? '',
      consequence: cells[1] ?? '',
      proof: cells[2] ?? '',
      conflict: cells[3] ?? '',
    }))
    .filter(trace => trace.principle !== '');
}

function principleNames(source: string | null): Set<string> {
  return new Set(
    (source ?? '')
      .split('\n')
      .map(line =>
        line
          .match(/^#{2,6}\s+(.+?)\s*$/u)?.[1]
          ?.trim()
          .toLowerCase(),
      )
      .filter((name): name is string => name !== undefined),
  );
}

function proofTarget(proof: string): string {
  const markdownTarget = proof.match(/\[[^\]]+\]\(([^)]+)\)/u)?.[1];
  return (markdownTarget ?? proof).replaceAll('`', '').split('#')[0]?.replace(/:\d+$/u, '') ?? '';
}

function proofResolves(projectDirectory: string, proof: string): boolean {
  const target = proofTarget(proof).trim();
  if (target === '') return false;
  const resolved = nodePath.isAbsolute(target) ? target : nodePath.join(projectDirectory, target);
  return existsSync(resolved);
}

function finding(detail: string, principle: string): string {
  return `[E010] Broken principle trace: ${detail}: ${principle}`;
}

/** Check only objective trace facts; applicability and wisdom remain review judgments. */
export function checkPrincipleTrace(projectDirectory: string, implPlan: string): string[] {
  const traces = parseTraceRows(implPlan);
  if (traces.length === 0) return [];

  const principles = resolveReviewKnowledgeSources(projectDirectory).find(
    source => source.key === 'principles',
  );
  const names = principleNames(principles?.content ?? null);
  const deviations = sectionBody(implPlan, 'Known deviations').toLowerCase();
  const findings: string[] = [];

  for (const trace of traces) {
    if (!names.has(trace.principle.toLowerCase())) {
      findings.push(finding('missing source principle', trace.principle));
    }
    if (trace.consequence === '' || trace.proof === '') {
      findings.push(finding('incomplete principle mapping', trace.principle));
    } else if (!proofResolves(projectDirectory, trace.proof)) {
      findings.push(finding('dead evidence reference', trace.principle));
    }
    if (
      trace.conflict.toLowerCase() === 'explicit-conflict' &&
      !deviations.includes(trace.principle.toLowerCase())
    ) {
      findings.push(finding('unrecorded conflict', trace.principle));
    }
  }

  return findings;
}
