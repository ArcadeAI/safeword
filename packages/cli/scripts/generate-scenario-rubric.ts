import { extractScenarioReviewRubric } from '../src/review/scenario-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateScenarioRubric = defineGeneratedRubric({
  exportName: 'SCENARIO_REVIEW_RUBRIC',
  extract: extractScenarioReviewRubric,
  generateCommand: 'generate:scenario-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'scenario-review',
  output: 'src/review/scenario-rubric.generated.ts',
  source: 'templates/skills/review-spec/SKILL.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateScenarioRubric(process.argv.includes('--check'));
}
