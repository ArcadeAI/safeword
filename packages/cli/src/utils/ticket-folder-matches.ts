export type TicketFolderMatches = {
  all: string[];
  exact: string[];
  slugged: string[];
};

/** Classify case-sensitive `{id}` and `{id}-{slug}` folder-name matches. */
export function findTicketFolderMatches(names: string[], ticketId: string): TicketFolderMatches {
  const all: string[] = [];
  const exact: string[] = [];
  const slugged: string[] = [];
  const slugPrefix = `${ticketId}-`;

  for (const name of names) {
    if (name === ticketId) {
      all.push(name);
      exact.push(name);
    } else if (name.startsWith(slugPrefix)) {
      all.push(name);
      slugged.push(name);
    }
  }

  return { all, exact, slugged };
}
