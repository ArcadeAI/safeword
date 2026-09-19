import { extractExecutionPlanReviewRubric } from '../src/review/execution-plan-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateExecutionPlanRubric = defineGeneratedRubric({
  digestExportName: 'EXECUTION_PLAN_REVIEW_RUBRIC_SHA256',
  exportName: 'EXECUTION_PLAN_REVIEW_RUBRIC',
  extract: extractExecutionPlanReviewRubric,
  generateCommand: 'generate:execution-plan-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'Execution Plan review',
  output: 'src/review/execution-plan-rubric.generated.ts',
  source: 'templates/skills/bdd/PLAN_EXECUTION.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateExecutionPlanRubric(process.argv.includes('--check'));
}
