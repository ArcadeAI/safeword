import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  formatCanaryAuthorization,
  type CanaryAuthorization,
} from "./terra-github-authorization";
import {
  canaryBindingDigest,
  INITIALIZATION_MARKER,
  initializeCanary,
  runCanaryAttempt,
  type CanaryInitializationBinding,
} from "./terra-development-canary";
import {
  createAuthenticatedGitHubHttp,
  createGitHubCanaryUpstream,
  formatCorpusRegistrationAnchor,
  type GitHubHttp,
} from "./terra-github-upstream";

const binding: CanaryInitializationBinding = {
  adapterCommit: "a".repeat(40),
  adapterTag: "terra-adapter-v1",
  attemptLimit: 10,
  canonicalRepository: "ArcadeAI/safeword",
  corpusDigest: "4bf3fd10c20222088ccf11bd2b187561021608cb07a646bc4b9294babfc33c75",
  costLimitPicodollars: "15000000000000",
  harnessCommit: "c".repeat(40),
  harnessTag: "terra-harness-v1",
  model: "gpt-5.6-terra",
  outputIdentity: "terra-development-canary-2026-08-11",
  receiptBudget: 21,
  serviceTier: "default",
  ticketId: "Y4ZAAY",
};

const authorization: CanaryAuthorization = {
  ...binding,
  authorizationId: "auth-4f6fcd2d",
  diagnosticOnly: true,
  evidenceRole: "development",
  registrationCommentId: 5254523549,
  registrationCommit: "eca10ca59c40e108695c484fd19260e1c1bd0784",
};

function issueComment(input: {
  body: string;
  id: number;
}): Record<string, unknown> {
  return {
    author_association: "MEMBER",
    body: input.body,
    created_at: "2026-08-11T18:00:00Z",
    id: input.id,
    updated_at: "2026-08-11T18:00:00Z",
    user: { login: "TheMostlyGreat" },
  };
}

function baseComments(): Record<string, unknown>[] {
  return [
    issueComment({
      body: formatCorpusRegistrationAnchor(authorization),
      id: authorization.registrationCommentId,
    }),
    issueComment({
      body: formatCanaryAuthorization(authorization),
      id: 6000000001,
    }),
  ];
}

function memoryGitHub(input: { retainPosts?: boolean } = {}): {
  comments: Record<string, unknown>[];
  http: GitHubHttp;
} {
  const comments = baseComments();
  let nextCommentId = 7000000001;
  return {
    comments,
    http: async (request) => {
      if (request.method === "POST") {
        const posted = JSON.parse(request.body ?? "{}") as { body?: unknown };
        if (input.retainPosts !== false && typeof posted.body === "string") {
          comments.push(
            issueComment({ body: posted.body, id: nextCommentId++ })
          );
        }
        return { body: "{}", status: 201 };
      }
      const page = Number(new URL(request.url).searchParams.get("page"));
      const start = (page - 1) * 100;
      return {
        body: JSON.stringify(comments.slice(start, start + 100)),
        status: 200,
      };
    },
  };
}

function receiptIds(): () => string {
  let sequence = 0;
  return () => `receipt-${++sequence}`;
}

describe("GitHub canary upstream", () => {
  test("rejects traversal in the canonical repository before HTTP access", () => {
    expect(() =>
      createGitHubCanaryUpstream({
        allowlistedMaintainers: ["TheMostlyGreat"],
        authorization: {
          ...authorization,
          canonicalRepository: "ArcadeAI/../other",
        },
        http: async () => {
          throw new Error("HTTP must not run");
        },
        issueNumber: 1910,
        nextReceiptId: () => "receipt-1",
      })
    ).toThrow("canonical repository identity is invalid");
  });

  test("sends authenticated GitHub API requests through one HTTP boundary", async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetch: typeof globalThis.fetch = Object.assign(
      (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ input: String(input), init });
        return Promise.resolve(new Response("[]", { status: 200 }));
      },
      { preconnect: () => undefined }
    );
    const http = createAuthenticatedGitHubHttp({
      fetch,
      token: "github-token",
    });

    await expect(
      http({
        body: JSON.stringify({ body: "receipt" }),
        method: "POST",
        url: "https://api.github.com/repos/ArcadeAI/safeword/issues/1910/comments",
      })
    ).resolves.toEqual({ body: "[]", status: 200 });
    expect(requests).toEqual([
      {
        input:
          "https://api.github.com/repos/ArcadeAI/safeword/issues/1910/comments",
        init: {
          body: JSON.stringify({ body: "receipt" }),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: "Bearer github-token",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          method: "POST",
        },
      },
    ]);
  });

  test("never sends the GitHub token to a foreign origin", async () => {
    let requests = 0;
    const fetch: typeof globalThis.fetch = Object.assign(
      () => {
        requests += 1;
        return Promise.resolve(new Response("[]", { status: 200 }));
      },
      { preconnect: () => undefined }
    );
    const http = createAuthenticatedGitHubHttp({
      fetch,
      token: "github-token",
    });

    await expect(
      http({ method: "GET", url: "https://example.com/comments" })
    ).rejects.toThrow("canonical HTTPS API");
    expect(requests).toBe(0);
  });

  test("finds the trusted registration and authorization after a full page", async () => {
    const filler = Array.from({ length: 100 }, (_, index) =>
      issueComment({ body: `ordinary comment ${index}`, id: index + 1 })
    );
    const http: GitHubHttp = async ({ url }) => ({
      body: JSON.stringify(
        url.endsWith("page=1")
          ? filler
          : [
              issueComment({
                body: formatCorpusRegistrationAnchor(authorization),
                id: authorization.registrationCommentId,
              }),
              issueComment({
                body: formatCanaryAuthorization(authorization),
                id: 6000000001,
              }),
            ]
      ),
      status: 200,
    });
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http,
      issueNumber: 1910,
      nextReceiptId: () => "unused",
    });

    await expect(upstream.inspect(canaryBindingDigest(binding))).resolves.toEqual(
      {
        authorizationId: authorization.authorizationId,
        kind: "ready",
      }
    );
  });

  test("initialization returns only after its receipt is durably visible", async () => {
    const github = memoryGitHub();
    const outputDirectory = await mkdtemp(join(tmpdir(), "terra-github-upstream-"));
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: github.http,
      issueNumber: 1910,
      nextReceiptId: () => "initialization-receipt-1",
    });

    await expect(
      initializeCanary({ binding, outputDirectory, upstream })
    ).resolves.toEqual({
      observedCostPicodollars: 0n,
      receiptId: "initialization-receipt-1",
      startedAttempts: 0,
    });
    await expect(
      readFile(join(outputDirectory, INITIALIZATION_MARKER), "utf8")
    ).resolves.toContain('"receiptId":"initialization-receipt-1"');
  });

  test("rejects reads and writes for a binding not named by the authorization", async () => {
    const github = memoryGitHub();
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: github.http,
      issueNumber: 1910,
      nextReceiptId: receiptIds(),
    });

    await expect(upstream.inspect("0".repeat(64))).resolves.toEqual({
      kind: "unreadable",
    });
    await expect(
      upstream.consumeInitialization({
        authorizationId: authorization.authorizationId,
        bindingDigest: "0".repeat(64),
      })
    ).rejects.toThrow("binding does not match");
    await expect(
      upstream.consumeInitialization({
        authorizationId: "another-authorization",
        bindingDigest: canaryBindingDigest(binding),
      })
    ).rejects.toThrow("authorization identity does not match");
    expect(github.comments).toHaveLength(2);
  });

  test("initialization creates no local state when GitHub loses the receipt", async () => {
    const github = memoryGitHub({ retainPosts: false });
    const outputDirectory = await mkdtemp(join(tmpdir(), "terra-github-upstream-"));
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: github.http,
      issueNumber: 1910,
      nextReceiptId: () => "lost-initialization-receipt",
    });

    await expect(
      initializeCanary({ binding, outputDirectory, upstream })
    ).rejects.toThrow("not durably visible");
    await expect(
      readFile(join(outputDirectory, INITIALIZATION_MARKER), "utf8")
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("retains a complete attempt as immutable GitHub receipts", async () => {
    const github = memoryGitHub();
    const outputDirectory = await mkdtemp(join(tmpdir(), "terra-github-upstream-"));
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: github.http,
      issueNumber: 1910,
      nextReceiptId: receiptIds(),
    });
    await initializeCanary({ binding, outputDirectory, upstream });

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding,
        dispatch: async () => {
          const rawUsage = {
            input_tokens: 10,
            input_tokens_details: { cached_tokens: 2 },
            output_tokens: 3,
          };
          const verificationUsage = {
            input_tokens: 0,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 0,
          };
          return {
            attemptCostPicodollars: 65_500_000n,
            nativeUsageBytes: JSON.stringify({
              turns: [
                {
                  rawUsage,
                  requestId: "req-terra-1",
                  responseId: "resp-terra-1",
                  stage: "repository-reading",
                },
                {
                  rawUsage: verificationUsage,
                  requestId: "req-terra-2",
                  responseId: "resp-terra-2",
                  stage: "finding-verification",
                },
              ],
            }),
            rawResponseBytes: JSON.stringify({
              intent: { attemptId: "attempt-1", intentId: "intent-1", sequence: 1 },
              requests: [{
                endpoint: "https://api.openai.com/v1/responses",
                intentId: "intent-1",
                model: "gpt-5.6-terra",
                sequence: 2,
                serviceTier: "default",
                stage: "repository-reading",
                turnIntentId: "turn-intent-1",
              }, {
                endpoint: "https://api.openai.com/v1/responses",
                intentId: "intent-1",
                model: "gpt-5.6-terra",
                sequence: 4,
                serviceTier: "default",
                stage: "finding-verification",
                turnIntentId: "turn-intent-2",
              }],
              responses: [{
                errorMessage: null,
                errorName: null,
                httpStatus: 200,
                intentId: "intent-1",
                nativeUsage: rawUsage,
                outcome: "response",
                rawBody: JSON.stringify({
                  id: "resp-terra-1",
                  model: "gpt-5.6-terra",
                  output: [],
                  service_tier: "default",
                  status: "completed",
                  usage: rawUsage,
                }),
                requestId: "req-terra-1",
                responseId: "resp-terra-1",
                returnedModel: "gpt-5.6-terra",
                returnedServiceTier: "default",
                sequence: 3,
                stage: "repository-reading",
                turnIntentId: "turn-intent-1",
              }, {
                errorMessage: null,
                errorName: null,
                httpStatus: 200,
                intentId: "intent-1",
                nativeUsage: verificationUsage,
                outcome: "response",
                rawBody: JSON.stringify({
                  id: "resp-terra-2",
                  model: "gpt-5.6-terra",
                  output: [],
                  service_tier: "default",
                  status: "completed",
                  usage: verificationUsage,
                }),
                requestId: "req-terra-2",
                responseId: "resp-terra-2",
                returnedModel: "gpt-5.6-terra",
                returnedServiceTier: "default",
                sequence: 5,
                stage: "finding-verification",
                turnIntentId: "turn-intent-2",
              }],
            }),
          };
        },
        intentId: "intent-1",
        outputDirectory,
        upstream,
      })
    ).resolves.toEqual({
      attemptId: "attempt-1",
      observedCostPicodollars: 65_500_000n,
      sequence: 1,
      startedAttempts: 1,
    });
    await expect(upstream.inspect(canaryBindingDigest(binding))).resolves.toMatchObject(
      {
        completions: [
          {
            attemptCostPicodollars: "65500000",
            attemptId: "attempt-1",
            observedCostPicodollars: "65500000",
            receiptId: "receipt-3",
            sequence: 1,
            startReceiptId: "receipt-2",
          },
        ],
        head: { observedCostPicodollars: "65500000", startedAttempts: 1 },
        kind: "consumed",
        starts: [
          {
            attemptId: "attempt-1",
            intentId: "intent-1",
            receiptId: "receipt-2",
            sequence: 1,
            startedAttempts: 1,
          },
        ],
      }
    );
  });

  test("treats an edited receipt as unreadable upstream state", async () => {
    const github = memoryGitHub();
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: github.http,
      issueNumber: 1910,
      nextReceiptId: receiptIds(),
    });
    const outputDirectory = await mkdtemp(join(tmpdir(), "terra-github-upstream-"));
    await initializeCanary({ binding, outputDirectory, upstream });
    github.comments.at(-1)!.updated_at = "2026-08-11T18:01:00Z";

    await expect(upstream.inspect(canaryBindingDigest(binding))).resolves.toEqual(
      { kind: "unreadable" }
    );
  });

  test("treats GitHub read failure as unavailable upstream state", async () => {
    const upstream = createGitHubCanaryUpstream({
      allowlistedMaintainers: ["TheMostlyGreat"],
      authorization,
      http: async () => ({ body: "service unavailable", status: 503 }),
      issueNumber: 1910,
      nextReceiptId: receiptIds(),
    });

    await expect(upstream.inspect(canaryBindingDigest(binding))).resolves.toEqual(
      { kind: "unavailable" }
    );
  });
});
