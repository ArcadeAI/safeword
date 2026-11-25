import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readFrontmatterScalar } from '../utils/frontmatter.js';

export interface WorkerContract {
  readonly name: string;
  readonly tools?: readonly string[];
}

/** A guidance invocation identifies the canonical procedure without creating a native role. */
export function workerInvocationHeader(name: string): string {
  return `Safeword worker: ${name}`;
}

/** Canonical agent definitions own authority; host projections only translate tool names. */
export function readWorkerContracts(templates: string): WorkerContract[] {
  const directory = nodePath.join(templates, 'agents');
  return readdirSync(directory)
    .filter(filename => filename.endsWith('.md'))
    .toSorted((left, right) => left.localeCompare(right))
    .map(filename => {
      const content = readFileSync(nodePath.join(directory, filename), 'utf8');
      const name = readFrontmatterScalar(content, 'name');
      if (name !== nodePath.basename(filename, '.md'))
        throw new Error(`Invalid canonical worker identity: ${filename}`);
      const tools = readFrontmatterScalar(content, 'tools');
      return { name, ...(tools !== undefined && { tools: tools.split(/[\s,]+/u) }) };
    });
}
