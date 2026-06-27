export const SYNCTICKETS_QUIET_COMMAND = '`safeword sync-tickets --quiet`';

export function buildIndexConflictSummary(count: number): string {
  return (
    `Detected merge-conflict markers in ${count} ticket index file(s). ` +
    `Run ${SYNCTICKETS_QUIET_COMMAND} to regenerate cleanly.`
  );
}

export function buildIndexConflictListMessage(paths: string[]): string {
  return (
    `Ticket index file(s) contained merge-conflict markers: ${paths.join(', ')}. ` +
    `Run ${SYNCTICKETS_QUIET_COMMAND} after resolving the merge conflict.`
  );
}
