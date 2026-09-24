import { extractQualityReviewRubric } from '../src/review/quality-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateQualityRubric = defineGeneratedRubric({
  exportName: 'QUALITY_REVIEW_RUBRIC',
  extract: extractQualityReviewRubric,
  generateCommand: 'generate:quality-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'quality-review',
  output: 'src/review/quality-rubric.generated.ts',
  source: 'templates/skills/quality-review/SKILL.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateQualityRubric(process.argv.includes('--check'));
}
