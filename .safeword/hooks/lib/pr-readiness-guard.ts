/** Classification for local pull-request readiness mutations. */
export type PrReadinessCommand = 'ready' | 'draft' | 'other';

export function classifyPrReadinessCommand(_command: string): PrReadinessCommand {
  return 'other';
}
