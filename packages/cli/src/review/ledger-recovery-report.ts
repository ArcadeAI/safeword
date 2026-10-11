export interface RecoveryReportSummary {
  readonly passed: number;
  readonly deferred: number;
  readonly cases: readonly string[];
}

/** Report validation alone never grants authenticated completion authority. */
export function assessRecoveryReport(
  _report: unknown,
  _exitCode: number,
): RecoveryReportSummary | undefined {
  return undefined;
}
