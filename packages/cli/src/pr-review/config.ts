// `.safeword/config.json` → `prReview` (ticket 36EEMY, Rule SM1.R2).
//
// The kill switch is config, not deletion: a maintainer turns the reviewer off
// without removing the workflow, which is the Tricorder precedent — trust is a
// metric with a switch, and an analyzer with a high not-useful rate gets
// disabled rather than argued with.
//
// Everything here fails CLOSED. A missing, unreadable, or malformed config
// leaves the reviewer disabled. The failure mode of guessing wrong in the other
// direction is a bot commenting on a customer's pull requests without anyone
// having asked it to.

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { ReviewPoster } from './poster.js';
import type { Vendor } from './vendor.js';
import { postVerdict, type Review } from './verdict.js';

/**
 * Whose tracker credentials the reviewer reads with.
 *
 * `shared` — one configured arcade identity for every review. Simple, and the
 * interim posture, but it reads with permissions the PR author may not have,
 * so `shouldReadTracker` gates it off on forks.
 *
 * `per-author` — brokered as the PR author, reading exactly what they could.
 * The target state (R6), and the only mode where a fork read is safe.
 */
export type IdentityMode = 'shared' | 'per-author';

export interface PrReviewConfig {
  /** Whether the reviewer runs at all. Default-off. */
  enabled: boolean;
  /** Whether it may POST. Off separately, so a maintainer can watch it run quiet first. */
  post: boolean;
  /** Fixed arcade user id, when one identity serves every review. */
  arcadeUserId?: string;
  /** The arcade.dev MCP gateway endpoint the reviewer reads the tracker through (R6). */
  arcadeGatewayUrl?: string;
  /** Derived: a fixed identity means shared, its absence means per-author. */
  identityMode: IdentityMode;
  /** Override for the required-check set when rulesets are unavailable. */
  requiredChecks: string[];
  /**
   * Pin the reviewing vendor. Normally unset — R11 picks whichever one did not
   * write the code, and pinning defeats that.
   */
  vendor?: Vendor;
  /** Model override for the headless child. */
  model?: string;
  /**
   * Raw `-c mcp_servers=<value>` for the tracker broker.
   *
   * MUST NOT contain a credential. This string is passed as ARGV, where it is
   * visible in process listings and CI logs — the bearer belongs in the child's
   * environment. Kept as an opaque string rather than assembled here so safeword
   * does not have to model a broker's config schema.
   */
  arcadeMcpServers?: string;
}

function readVendor(value: unknown): Vendor | undefined {
  return value === 'claude' || value === 'codex' ? value : undefined;
}

const DISABLED: PrReviewConfig = {
  enabled: false,
  post: false,
  identityMode: 'shared',
  requiredChecks: [],
};

interface RawPrReview {
  enabled?: unknown;
  post?: unknown;
  arcade?: { userId?: unknown; mcpServers?: unknown; gatewayUrl?: unknown };
  identityMode?: unknown;
  requiredChecks?: unknown;
  vendor?: unknown;
  model?: unknown;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Read `prReview` config for a project. Never throws — a broken config must not
 * take down a CI job, and must not silently enable the reviewer either.
 */
export function resolvePrReviewConfig(projectDirectory: string): PrReviewConfig {
  let raw: RawPrReview;
  try {
    const contents = readFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      'utf8',
    );
    raw = (JSON.parse(contents) as { prReview?: RawPrReview }).prReview ?? {};
  } catch {
    return DISABLED;
  }

  return {
    enabled: raw.enabled === true,
    post: raw.post === true,
    ...readArcade(raw.arcade),
    // `shared` unless per-author is EXPLICITLY opted into. Absence must not
    // resolve to the more permissive mode: `per-author` is what re-enables
    // tracker reads on forks, and per-author brokering is not implemented yet —
    // the runtime identity is a shared service account regardless of this field.
    // Deriving it from `arcade.userId` being unset (as an earlier version did)
    // meant a project that configured a bearer but omitted the id got exactly
    // the confused-deputy disclosure the containment exists to prevent.
    identityMode: raw.identityMode === 'per-author' ? 'per-author' : 'shared',
    requiredChecks: Array.isArray(raw.requiredChecks)
      ? raw.requiredChecks.filter(entry => nonEmptyString(entry))
      : [],
    vendor: readVendor(raw.vendor),
    model: nonEmptyString(raw.model) ? raw.model : undefined,
  };
}

/** The tracker-broker fields, pulled out to keep the resolver under the complexity cap. */
function readArcade(
  arcade: RawPrReview['arcade'],
): Pick<PrReviewConfig, 'arcadeUserId' | 'arcadeGatewayUrl' | 'arcadeMcpServers'> {
  return {
    arcadeUserId: nonEmptyString(arcade?.userId) ? arcade.userId : undefined,
    arcadeGatewayUrl: nonEmptyString(arcade?.gatewayUrl) ? arcade.gatewayUrl : undefined,
    arcadeMcpServers: nonEmptyString(arcade?.mcpServers) ? arcade.mcpServers : undefined,
  };
}

export interface DeliveryResult {
  posted: boolean;
  /** Why — a reviewer that was switched off must not read as one that broke. */
  reason: string;
}

/**
 * The last gate before anything reaches the pull request (SM1.R2).
 *
 * Deliberately at DELIVERY rather than at the start of the run. What the switch
 * governs is speech, not thought: a disabled reviewer that still computes its
 * review can be measured in shadow before it ever fires on someone else's repo,
 * which is precisely the evidence SM1.R1 asks for.
 *
 * Two gates, not one. `enabled` off means the project never opted in at all, so
 * nothing runs. `post` off means it runs and stays quiet — the posture a
 * maintainer uses to watch it for a week before spending any trust. Neither
 * writes so much as a receipt: a receipt is still the reviewer speaking on a
 * pull request nobody invited it to.
 */
export async function deliverReview(
  review: Review,
  poster: ReviewPoster,
  config: PrReviewConfig,
): Promise<DeliveryResult> {
  if (!config.enabled) {
    return {
      posted: false,
      reason: 'disabled for this project (.safeword/config.json → prReview.enabled)',
    };
  }

  if (!config.post) {
    return {
      posted: false,
      reason: `shadow mode — computed ${review.verdict}, posting is off (prReview.post)`,
    };
  }

  await postVerdict(review, poster);
  return { posted: true, reason: `posted ${review.verdict}` };
}
