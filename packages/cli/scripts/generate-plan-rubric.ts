import { extractPlanReviewRubric } from '../src/review/plan-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generatePlanRubric = defineGeneratedRubric({
  exportName: 'PLAN_REVIEW_RUBRIC',
  extract: extractPlanReviewRubric,
  generateCommand: 'generate:plan-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'plan-review',
  output: 'src/review/plan-rubric.generated.ts',
  source: 'templates/skills/bdd/PLAN_IMPLEMENTATION.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generatePlanRubric(process.argv.includes('--check'));
}
