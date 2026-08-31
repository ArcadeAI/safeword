import { readFileSync, statSync } from 'node:fs';

import { readConfiguredPathValue, resolveConfiguredPath } from './namespace-root.js';

export type ReviewKnowledgeKey = 'principles' | 'personas' | 'surfaces';

export interface ReviewKnowledgeSource {
  key: ReviewKnowledgeKey;
  configured: boolean;
  path: string;
  exists: boolean;
  content: string | null;
}

const REVIEW_KNOWLEDGE_KEYS: ReviewKnowledgeKey[] = ['principles', 'personas', 'surfaces'];

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Resolve project knowledge immediately before an independent review. */
export function resolveReviewKnowledgeSources(projectDirectory: string): ReviewKnowledgeSource[] {
  return REVIEW_KNOWLEDGE_KEYS.map(key => {
    const configuredPath = readConfiguredPathValue(projectDirectory, key);
    const path = resolveConfiguredPath(projectDirectory, key);
    const exists = isRegularFile(path);
    return {
      key,
      configured: configuredPath !== undefined,
      path,
      exists,
      content: exists ? readFileSync(path, 'utf8') : null,
    };
  });
}
