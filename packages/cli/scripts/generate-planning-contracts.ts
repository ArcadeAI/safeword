import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { PLANNING_SHARED_CLAUSES } from '../src/planning/shared-contract.js';
import { extractProductPlanReviewRubric } from '../src/review/product-plan-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
  reconcileGeneratedFile,
} from './lib/reconcile-generated-file.js';

const sharedStart = '<!-- SAFEWORD:PLANNING_SHARED_START -->';
const sharedEnd = '<!-- SAFEWORD:PLANNING_SHARED_END -->';
const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const authors = [
  { file: 'PLAN_IMPLEMENTATION.md', anchor: '<!-- SAFEWORD:PLAN_RUBRIC_START -->' },
  { file: 'PLAN_EXECUTION.md', anchor: '<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_START -->' },
  { file: 'DISCOVERY.md', anchor: '## Scope and gates' },
] as const;

const generateProductReviewer = defineGeneratedRubric({
  digestExportName: 'PRODUCT_PLAN_REVIEW_RUBRIC_SHA256',
  exportName: 'PRODUCT_PLAN_REVIEW_RUBRIC',
  extract: extractProductPlanReviewRubric,
  generateCommand: 'generate:planning-contracts',
  generatorEntrypoint: import.meta.filename,
  label: 'product-plan-review',
  output: 'src/review/product-plan-rubric.generated.ts',
  source: 'templates/skills/bdd/DISCOVERY.md',
});

function sharedBlock(): string {
  return [
    sharedStart,
    '',
    '### Shared planning authority',
    '',
    ...Object.entries(PLANNING_SHARED_CLAUSES).flatMap(([id, text]) => [
      `<!-- SAFEWORD:PLANNING_SHARED_CLAUSE:${id} -->`,
      '',
      text,
      '',
    ]),
    sharedEnd,
  ].join('\n');
}

function withSharedBlock(source: string, anchor: string): string {
  const starts = source.split(sharedStart).length - 1;
  const ends = source.split(sharedEnd).length - 1;
  if (starts !== ends || starts > 1) throw new Error('Shared planning markers must form one pair.');
  if (starts === 1) {
    const start = source.indexOf(sharedStart);
    const end = source.indexOf(sharedEnd);
    if (end <= start) throw new Error('Shared planning markers are out of order.');
    return source.slice(0, start) + sharedBlock() + source.slice(end + sharedEnd.length);
  }
  if (source.split(anchor).length !== 2) throw new Error(`Expected one planning anchor: ${anchor}`);
  return source.replace(anchor, () => `${anchor}\n\n${sharedBlock()}`);
}

/** Prepare author blocks before extracting any reviewer copy; check mode never writes. */
export function generatePlanningContracts(check = false): void {
  for (const author of authors) {
    const outputPath = nodePath.join(packageRoot, 'templates/skills/bdd', author.file);
    const source = readFileSync(outputPath, 'utf8');
    const result = reconcileGeneratedFile({
      check,
      content: withSharedBlock(source, author.anchor),
      outputPath,
    });
    if (result === 'stale') {
      throw new Error(
        `${author.file} shared planning clauses are stale; run generate:planning-contracts`,
      );
    }
  }
  if (generateProductReviewer(check) === 'stale') {
    throw new Error('Product reviewer contract is stale; run generate:planning-contracts');
  }
}

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generatePlanningContracts(process.argv.includes('--check'));
}
