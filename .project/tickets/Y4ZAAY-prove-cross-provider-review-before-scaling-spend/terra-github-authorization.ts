import type { CanaryInitializationBinding } from "./terra-development-canary";

const AUTHORIZATION_MARKER = "SAFEWORD_TERRA_CANARY_AUTHORIZATION_V1";
const AUTHORIZED_ATTEMPTS = 10;
const AUTHORIZED_COST_PICODOLLARS = "15000000000000";
const AUTHORIZED_RECEIPTS = 21;

export type CanaryAuthorization = CanaryInitializationBinding & {
  authorizationId: string;
  diagnosticOnly: true;
  evidenceRole: "development";
  registrationCommentId: number;
  registrationCommit: string;
};

export type GitHubIssueComment = {
  author_association: string;
  body: string;
  created_at: string;
  id: number;
  updated_at: string;
  user: { login: string } | null;
};

export function formatCanaryAuthorization(
  authorization: CanaryAuthorization
): string {
  const ordered: CanaryAuthorization = {
    adapterCommit: authorization.adapterCommit,
    adapterTag: authorization.adapterTag,
    attemptLimit: authorization.attemptLimit,
    authorizationId: authorization.authorizationId,
    canonicalRepository: authorization.canonicalRepository,
    corpusDigest: authorization.corpusDigest,
    costLimitPicodollars: authorization.costLimitPicodollars,
    diagnosticOnly: authorization.diagnosticOnly,
    evidenceRole: authorization.evidenceRole,
    harnessCommit: authorization.harnessCommit,
    harnessTag: authorization.harnessTag,
    model: authorization.model,
    outputIdentity: authorization.outputIdentity,
    receiptBudget: authorization.receiptBudget,
    registrationCommentId: authorization.registrationCommentId,
    registrationCommit: authorization.registrationCommit,
    serviceTier: authorization.serviceTier,
    ticketId: authorization.ticketId,
  };
  return `${AUTHORIZATION_MARKER}\n${JSON.stringify(ordered)}`;
}

function requireFixedCanaryPolicy(expected: CanaryAuthorization): void {
  if (
    expected.model !== "gpt-5.6-terra" ||
    expected.serviceTier !== "default" ||
    expected.diagnosticOnly !== true ||
    expected.evidenceRole !== "development" ||
    expected.attemptLimit !== AUTHORIZED_ATTEMPTS ||
    expected.costLimitPicodollars !== AUTHORIZED_COST_PICODOLLARS ||
    expected.receiptBudget !== AUTHORIZED_RECEIPTS
  ) {
    throw new Error("expected run does not match the fixed canary policy");
  }
}

export function validateCanaryAuthorization(input: {
  allowlistedMaintainers: readonly string[];
  comments: readonly GitHubIssueComment[];
  expected: CanaryAuthorization;
}): { authorization: CanaryAuthorization; commentId: number } {
  requireFixedCanaryPolicy(input.expected);
  const candidates = input.comments.filter((comment) =>
    comment.body.startsWith(`${AUTHORIZATION_MARKER}\n`)
  );
  if (candidates.length !== 1) {
    throw new Error("exactly one canary authorization comment is required");
  }

  const comment = candidates[0]!;
  if (comment.created_at !== comment.updated_at) {
    throw new Error("canary authorization comment must be unedited");
  }
  if (
    comment.user === null ||
    !input.allowlistedMaintainers.includes(comment.user.login)
  ) {
    throw new Error("canary authorization author is not allowlisted");
  }
  if (
    comment.author_association !== "MEMBER" &&
    comment.author_association !== "OWNER"
  ) {
    throw new Error("canary authorization author must be a member or owner");
  }
  if (comment.body !== formatCanaryAuthorization(input.expected)) {
    throw new Error("canary authorization does not match the expected run");
  }
  if (!Number.isSafeInteger(comment.id) || comment.id <= 0) {
    throw new Error("canary authorization comment id must be positive");
  }

  return { authorization: input.expected, commentId: comment.id };
}
