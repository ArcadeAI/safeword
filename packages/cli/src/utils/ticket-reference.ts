/**
 * Slug-first ticket-reference rendering (ticket ZRXM6Q).
 *
 * Every surface that names a ticket should lead with the human slug and trail
 * the Crockford ID as a locator — `embed-figure-it-out (ZBVGPF)`, never bare
 * `ZBVGPF`. The slug lets a human or agent *recognize* the ticket (NN/g
 * recognition-over-recall); the ID stays for collision-free lookup across
 * parallel sessions and git branches.
 */

/**
 * Format a ticket reference slug-first: `slug (ID)`, or the bare ID when no
 * slug is known.
 * @param id   the ticket's Crockford Base32 ID
 * @param slug the ticket's human-readable slug, if available
 */
export function formatTicketReference(id: string, slug?: string): string {
  return slug ? `${slug} (${id})` : id;
}
