import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';
import { extractScenarioReviewRubric } from './lib/scenario-rubric.js';

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
