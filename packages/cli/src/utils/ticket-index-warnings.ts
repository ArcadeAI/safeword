const SYNCTICKETS_QUIET_COMMAND = '`safeword sync-tickets --quiet`';

export function buildIndexConflictListMessage(paths: string[]): string {
  return (
    `Ticket index file(s) contained merge-conflict markers: ${paths.join(', ')}. ` +
    `Run ${SYNCTICKETS_QUIET_COMMAND} after resolving the merge conflict.`
  );
}
