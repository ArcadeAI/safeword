import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { ContractDefinition, FileDefinition } from './schema.js';

export interface ParitySchema {
  ownedFiles: Record<string, FileDefinition>;
  contracts: Record<string, ContractDefinition>;
}

export type ParityMode = 'all' | 'contracts-only';

export interface ParityFailure {
  kind: 'pair' | 'contract';
  message: string;
}

export interface ParityResult {
  failures: ParityFailure[];
  passedCount: number;
}

export interface ParityInput {
  schema: ParitySchema;
  mode: ParityMode;
  rootDirectory: string;
  templatesDirectory: string;
}

export function runParity(input: ParityInput): ParityResult {
  const failures: ParityFailure[] = [];
  let passedCount = 0;

  for (const [path, contract] of Object.entries(input.schema.contracts)) {
    const filePath = nodePath.join(input.rootDirectory, path);
    const content = readFileSync(filePath, 'utf8');
    const missing = contract.requires.filter(s => !content.includes(s));
    if (missing.length === 0) {
      passedCount += 1;
    } else {
      failures.push({
        kind: 'contract',
        message: `[CONTRACT] Missing in ${path}: ${missing.join(', ')}`,
      });
    }
  }

  return { failures, passedCount };
}
