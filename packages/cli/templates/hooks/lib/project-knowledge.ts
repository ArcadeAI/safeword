import { existsSync, readFileSync } from 'node:fs';

import { readConfiguredPathValue, resolveConfiguredPath } from './namespace-root.ts';

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
  return REVIEW_KNOWLEDGE_KEYS.map(key => {
    const configuredPath = readConfiguredPathValue(projectDirectory, key);
    const path = resolveConfiguredPath(projectDirectory, key);
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
