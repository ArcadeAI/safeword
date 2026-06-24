/**
 * Shared types for `safeword sync-tracker` — the one-way projection of local
 * tickets into a customer tracker (Linear / GitHub Issues). The whole pipe
 * funnels through one provider-neutral payload and one call site so the eventual
 * third provider is a refactor of one place, not a scatter of `if (provider===)`.
 */

/** The two providers shipped in v1. `none` is the unconfigured base case. */
export type Provider = 'linear' | 'github';

/** Provider-neutral issue shape — what every writer consumes (JS5K5G v1). */
export interface IssuePayload {
  title: string;
  /** v1: markdown. Jira (v3) widens this to ADF — the one non-neutral field. */
  body: string;
  /** Includes `epic:<slug>` and `type:<type>` so the board groups/filters. */
  labels: string[];
  // No assignee — field ownership (AC7) cedes it to the tracker; a v2 concern.
  state: 'open' | 'closed';
}

/**
 * The neutral input the payload builder maps from — a ticket reduced to just the
 * fields projection needs. The orchestrator populates it from the corpus walk so
 * the builder stays a pure function (no fs, no frontmatter parsing).
 */
export interface TicketInput {
  id: string;
  title: string;
  status: string;
  type: string;
  epic: string | undefined;
  /** Canonical back-link target — the repo URL/path of this ticket. */
  ticketUrl: string;
  /** Full body markdown, included only when egress is `full`. */
  bodyMarkdown?: string;
}

/** Egress posture for the projected issue body. */
export type BodyMode = 'minimal' | 'full';

/** A recorded reference to a created issue, kept in the sidecar tracker-map. */
export interface TrackerReference {
  provider: Provider;
  /** The tracker's own id (Linear issue id / GitHub issue number as string). */
  id: string;
  /** Recorded once the create succeeded and the ref was persisted. */
  url?: string;
}
