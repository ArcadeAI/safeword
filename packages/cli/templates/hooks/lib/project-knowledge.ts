export type ReviewKnowledgeKey = 'principles' | 'personas' | 'surfaces';

export interface ReviewKnowledgeSource {
  key: ReviewKnowledgeKey;
  configured: boolean;
  path: string;
  exists: boolean;
  content: string | null;
}

const REVIEW_KNOWLEDGE_KEYS: ReviewKnowledgeKey[] = ['principles', 'personas', 'surfaces'];

/** Resolve project knowledge immediately before an independent review. */
export function resolveReviewKnowledgeSources(projectDirectory: string): ReviewKnowledgeSource[] {
  const namespaceRoot = resolveNamespaceRoot(projectDirectory);
  return REVIEW_KNOWLEDGE_KEYS.map(key => {
    const configuredPath = readConfiguredPathValue(projectDirectory, key);
    const path =
      configuredPath === undefined
        ? nodePath.join(namespaceRoot, `${key}.md`)
        : nodePath.isAbsolute(configuredPath)
          ? configuredPath
          : nodePath.join(projectDirectory, configuredPath);
    const exists = existsSync(path);
    return {
      key,
      configured: configuredPath !== undefined,
      path,
      exists,
      content: exists ? readFileSync(path, 'utf8') : null,
    };
  });
}
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readConfiguredPathValue, resolveNamespaceRoot } from './namespace-root.ts';
