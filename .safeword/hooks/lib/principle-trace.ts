import { existsSync, readFileSync, statSync } from 'node:fs';
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
  const names = new Set<string>();

  for (const line of (source ?? '').split('\n')) {
    const name = line
      .match(/^##\s+(.+?)\s*$/u)?.[1]
      ?.trim()
      .toLowerCase();
    if (name === 'further reading') break;
    if (name !== undefined) names.add(name);
  }

  return names;
}

function proofTarget(proof: string): { path: string; fragment?: string } {
  const markdownTarget = proof.match(/\[[^\]]+\]\(([^)]+)\)/u)?.[1];
  const target = (markdownTarget ?? proof).replaceAll('`', '').trim();
  const [path = '', fragment] = target.split('#', 2);

  return { path: path.replace(/:\d+$/u, ''), fragment };
}

function markdownHeadingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/gu, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-');
}

function markdownFragmentResolves(path: string, fragment: string): boolean {
  let decodedFragment: string;
  try {
    decodedFragment = decodeURIComponent(fragment).toLowerCase();
  } catch {
    return false;
  }

  const content = readFileSync(path, 'utf8');
  const explicitIds = [...content.matchAll(/\bid=["']([^"']+)["']/giu)].map(match =>
    match[1]?.toLowerCase(),
  );
  if (explicitIds.includes(decodedFragment)) return true;

  return content
    .split('\n')
    .map(line => line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/u)?.[1])
    .filter((heading): heading is string => heading !== undefined)
    .some(heading => markdownHeadingSlug(heading) === decodedFragment);
}

function proofResolves(projectDirectory: string, proof: string): boolean {
  const target = proofTarget(proof);
  if (target.path === '') return false;
  const resolved = nodePath.isAbsolute(target.path)
    ? target.path
    : nodePath.join(projectDirectory, target.path);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return false;
  if (target.fragment === undefined || target.fragment === '') return true;
  if (!/\.mdx?$/iu.test(resolved)) return false;

  return markdownFragmentResolves(resolved, target.fragment);
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
    const conflict = trace.conflict.toLowerCase();
    if (conflict !== '' && conflict !== 'explicit-conflict') {
      findings.push(finding('unsupported conflict marker', trace.principle));
    } else if (
      conflict === 'explicit-conflict' &&
      !deviations.includes(trace.principle.toLowerCase())
    ) {
      findings.push(finding('unrecorded conflict', trace.principle));
    }
  }

  return findings;
}
