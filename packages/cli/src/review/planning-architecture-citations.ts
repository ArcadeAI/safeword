import nodePath from 'node:path';

import type { Heading, Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';

import type { ReviewPacketFile } from './contract.js';

function* descendants(node: Nodes): Generator<Nodes> {
  yield node;
  if ('children' in node) {
    for (const child of node.children) yield* descendants(child);
  }
}

interface Citation {
  path: string;
  inArchitectureSection: boolean;
}

/** Resolve Markdown destinations from the file that contains the link. */
function recordPath(source: string, url: string): string | undefined {
  const path = url.split(/[?#]/u, 1)[0];
  if (!path || /^(?:[a-z][a-z\d+.-]*:|\/)/iu.test(path)) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  if (nodePath.extname(decoded).toLowerCase() !== '.md') return undefined;
  return nodePath.normalize(nodePath.join(nodePath.dirname(source), decoded));
}

function architectureDepth(heading: Heading, current: number): number {
  const text = [...descendants(heading)]
    .map(node => (node.type === 'text' ? node.value : ''))
    .join('');
  if (/^architecture applicability$/iu.test(text.trim())) return heading.depth;
  return heading.depth <= current ? 0 : current;
}

function destination(node: Nodes, definitions: Map<string, string>): string | undefined {
  if (node.type === 'linkReference') return definitions.get(node.identifier);
  return node.type === 'link' ? node.url : undefined;
}

function citations(file: ReviewPacketFile): Citation[] {
  const tree = fromMarkdown(file.content);
  const definitions = new Map<string, string>();
  for (const node of descendants(tree)) {
    if (node.type === 'definition' && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
  }
  const result: Citation[] = [];
  let sectionDepth = 0;
  for (const block of tree.children) {
    if (block.type === 'heading') sectionDepth = architectureDepth(block, sectionDepth);
    for (const node of descendants(block)) {
      const url = destination(node, definitions);
      const path = url && recordPath(file.path, url);
      if (path) result.push({ path, inArchitectureSection: sectionDepth > 0 });
    }
  }
  return result;
}

/** An architecture section explicitly identifies records. Elsewhere a plan can
 * cite a record listed by the configured overview. Never crawl the whole index. */
export function citedArchitectureRecords(
  plans: readonly ReviewPacketFile[],
  overview?: ReviewPacketFile,
): string[] {
  const indexed = new Set(overview && citations(overview).map(citation => citation.path));
  return plans
    .flatMap(plan => citations(plan))
    .filter(citation => citation.inArchitectureSection || indexed.has(citation.path))
    .map(citation => citation.path);
}
