import {
  defineGeneratedRubric,
  isDirectGeneratorInvocation,
} from './lib/reconcile-generated-file.js';

export const generateLedgerRecoveryRubric = defineGeneratedRubric({
  exportName: 'LEDGER_RECOVERY_REVIEW_RUBRIC',
  digestExportName: 'LEDGER_RECOVERY_REVIEW_RUBRIC_SHA256',
  extract: source => source,
  generateCommand: 'generate:ledger-recovery-rubric',
  generatorEntrypoint: import.meta.filename,
  label: 'bounded ledger recovery',
  output: 'src/review/ledger-recovery-rubric.generated.ts',
  source: 'templates/guides/ledger-recovery-contract.md',
});

if (isDirectGeneratorInvocation(import.meta.filename)) {
  generateLedgerRecoveryRubric(process.argv.includes('--check'));
}
