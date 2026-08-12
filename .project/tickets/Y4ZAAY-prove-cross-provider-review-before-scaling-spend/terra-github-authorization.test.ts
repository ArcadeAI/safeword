import { describe, expect, test } from "vitest";

import {
  formatCanaryAuthorization,
  validateCanaryAuthorization,
  type CanaryAuthorization,
  type GitHubIssueComment,
} from "./terra-github-authorization";

const authorization: CanaryAuthorization = {
  adapterCommit: "a".repeat(40),
  adapterTag: "terra-adapter-v1",
  attemptLimit: 10,
  authorizationId: "auth-4f6fcd2d",
  canonicalRepository: "ArcadeAI/safeword",
  corpusDigest: "b".repeat(64),
  costLimitPicodollars: "15000000000000",
  diagnosticOnly: true,
  evidenceRole: "development",
  harnessCommit: "c".repeat(40),
  harnessTag: "terra-harness-v1",
  model: "gpt-5.6-terra",
  outputIdentity: "terra-development-canary-2026-08-11",
  receiptBudget: 21,
  registrationCommentId: 5254523549,
  registrationCommit: "eca10ca59c40e108695c484fd19260e1c1bd0784",
  serviceTier: "default",
  ticketId: "Y4ZAAY",
};

function comment(
  overrides: Partial<GitHubIssueComment> = {}
): GitHubIssueComment {
  return {
    author_association: "OWNER",
    body: formatCanaryAuthorization(authorization),
    created_at: "2026-08-11T18:00:00Z",
    id: 6000000001,
    updated_at: "2026-08-11T18:00:00Z",
    user: { login: "TheMostlyGreat" },
    ...overrides,
  };
}

describe("GitHub canary authorization", () => {
  test("accepts one exact unedited authorization from an allowlisted maintainer", () => {
    expect(
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [comment()],
        expected: authorization,
      })
    ).toEqual({ authorization, commentId: 6000000001 });
  });

  test("rejects an edited authorization comment", () => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [comment({ updated_at: "2026-08-11T18:01:00Z" })],
        expected: authorization,
      })
    ).toThrow("must be unedited");
  });

  test("rejects duplicate authorization comments", () => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [comment(), comment({ id: 6000000002 })],
        expected: authorization,
      })
    ).toThrow("exactly one");
  });

  test.each([
    ["an unallowlisted author", comment({ user: { login: "outsider" } })],
    [
      "a non-member author association",
      comment({ author_association: "CONTRIBUTOR" }),
    ],
  ])("rejects %s", (_label, candidate) => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [candidate],
        expected: authorization,
      })
    ).toThrow(/allowlisted|member or owner/);
  });

  test.each([
    ["foreign repository", { canonicalRepository: "fork/safeword" }],
    ["different output", { outputIdentity: "another-output" }],
    ["different corpus", { corpusDigest: "d".repeat(64) }],
    ["different adapter", { adapterCommit: "e".repeat(40) }],
    ["different harness", { harnessCommit: "f".repeat(40) }],
    ["different attempt cap", { attemptLimit: 11 }],
    ["different cost stop", { costLimitPicodollars: "15000000000001" }],
  ])("rejects an authorization bound to a %s", (_label, patch) => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [
          comment({
            body: formatCanaryAuthorization({ ...authorization, ...patch }),
          }),
        ],
        expected: authorization,
      })
    ).toThrow("does not match");
  });

  test("rejects trailing content after an otherwise exact authorization", () => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [
          comment({ body: `${formatCanaryAuthorization(authorization)}\nokay` }),
        ],
        expected: authorization,
      })
    ).toThrow("does not match");
  });

  test("does not let the launcher redefine the fixed canary limits", () => {
    expect(() =>
      validateCanaryAuthorization({
        allowlistedMaintainers: ["TheMostlyGreat"],
        comments: [comment()],
        expected: { ...authorization, attemptLimit: 20 },
      })
    ).toThrow("fixed canary policy");
  });
});
