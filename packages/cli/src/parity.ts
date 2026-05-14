import { existsSync, readFileSync } from 'node:fs';
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

function checkPair(
  destinationPath: string,
  template: string,
  rootDirectory: string,
  templatesDirectory: string,
): ParityFailure | undefined {
  const templateFile = nodePath.join(templatesDirectory, template);
  const dogfoodFile = nodePath.join(rootDirectory, destinationPath);
  const templateExists = existsSync(templateFile);
  const dogfoodExists = existsSync(dogfoodFile);

  if (!templateExists || !dogfoodExists) {
    const missing: string[] = [];
    if (!templateExists) missing.push(template);
    if (!dogfoodExists) missing.push(destinationPath);
    return { kind: 'pair', message: `[PAIR] Missing file(s): ${missing.join(', ')}` };
  }

  if (readFileSync(templateFile, 'utf8') === readFileSync(dogfoodFile, 'utf8')) {
    return undefined;
  }
  return { kind: 'pair', message: `[PAIR] Drift: ${destinationPath} ≠ ${template}` };
}

function checkContract(
  path: string,
  contract: ContractDefinition,
  rootDirectory: string,
): ParityFailure | undefined {
  const filePath = nodePath.join(rootDirectory, path);
  if (!existsSync(filePath)) {
    return { kind: 'contract', message: `[CONTRACT] Target file missing: ${path}` };
  }
  const content = readFileSync(filePath, 'utf8');
  const missing = contract.requires.filter(s => !content.includes(s));
  if (missing.length === 0) return undefined;
  return {
    kind: 'contract',
    message: `[CONTRACT] Missing in ${path}: ${missing.join(', ')}`,
  };
}

export function runParity(input: ParityInput): ParityResult {
  const failures: ParityFailure[] = [];
  let passedCount = 0;

  if (input.mode === 'all') {
    for (const [destinationPath, definition] of Object.entries(input.schema.ownedFiles)) {
      if (!definition.template) continue;
      const failure = checkPair(
        destinationPath,
        definition.template,
        input.rootDirectory,
        input.templatesDirectory,
      );
      if (failure) failures.push(failure);
      else passedCount += 1;
    }
  }

  for (const [path, contract] of Object.entries(input.schema.contracts)) {
    const failure = checkContract(path, contract, input.rootDirectory);
    if (failure) failures.push(failure);
    else passedCount += 1;
  }

  return { failures, passedCount };
}
