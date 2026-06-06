/**
 * Slug-first ticket-reference rendering (ticket ZRXM6Q).
 *
 * Every surface that names a ticket should lead with a human label — the slug
 * or the title, whichever the call site has — and trail the Crockford ID as a
 * locator: `embed-figure-it-out (ZBVGPF)`, never bare `ZBVGPF`. The label lets
 * a human or agent *recognize* the ticket (NN/g recognition-over-recall); the
 * ID stays for collision-free lookup across parallel sessions and git branches.
 */

/**
 * Format a ticket reference human-first: `label (ID)`, or the bare ID when no
 * label is known.
 * @param id    the ticket's Crockford Base32 ID
 * @param label the ticket's human-readable slug or title, if available
 */
export function formatTicketReference(id: string, label?: string): string {
  return label ? `${label} (${id})` : id;
}
