import { PlanningContextError } from './planning-context-error.js';

export function planningTicketOwner(
  ticket: Record<string, unknown>,
  folder: string,
  ticketPath: string,
): ticket is Record<string, unknown> & { id: string } {
  if (
    (ticket.type !== 'feature' && ticket.type !== 'epic') ||
    ticket.product_plan_contract !== 'v1'
  )
    return false;
  const id = ticket.id;
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    (folder !== id && !folder.startsWith(`${id}-`))
  ) {
    throw new PlanningContextError('ticket', ticketPath);
  }
  return true;
}
