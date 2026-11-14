import { extractDeliveryCompatibilityReviewRubric } from '../src/review/delivery-compatibility-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateDeliveryCompatibilityRubric = defineGeneratedRubric({
  exportName: 'DELIVERY_COMPATIBILITY_REVIEW_RUBRIC',
  extract: extractDeliveryCompatibilityReviewRubric,
  generateCommand: 'generate:delivery-compatibility-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'delivery compatibility review',
  output: 'src/review/delivery-compatibility-rubric.generated.ts',
  source: 'templates/skills/bdd/PLAN_EXECUTION.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateDeliveryCompatibilityRubric(process.argv.includes('--check'));
}
