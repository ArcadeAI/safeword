/** Resolve a case-sensitive `{id}` or `{id}-{slug}` candidate, preferring the exact id. */
export function findTicketFolderMatch(names: string[], ticketId: string): string | undefined {
  let sluggedMatch: string | undefined;
  const slugPrefix = `${ticketId}-`;

  for (const name of names) {
    if (name === ticketId) {
      return name;
    }
    if (sluggedMatch === undefined && name.startsWith(slugPrefix)) {
      sluggedMatch = name;
    }
  }

  return sluggedMatch;
}
