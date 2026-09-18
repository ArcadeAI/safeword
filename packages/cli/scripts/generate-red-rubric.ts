import { extractExecutableRedRubric } from '../src/review/red-rubric.js';
import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateRedRubric = defineGeneratedRubric({
  exportName: 'EXECUTABLE_RED_REVIEW_RUBRIC',
  extract: extractExecutableRedRubric,
  generateCommand: 'generate:red-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'executable RED',
  output: 'src/review/red-rubric.generated.ts',
  source: 'templates/skills/tdd-review/SKILL.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateRedRubric(process.argv.includes('--check'));
}
