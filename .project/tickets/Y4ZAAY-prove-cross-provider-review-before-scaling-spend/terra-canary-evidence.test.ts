import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import {
  retainDiagnosticManifest,
  validateProviderInventory,
  validateTerraEnvelope,
} from "./terra-canary-evidence";

const TERRA_MODEL = "gpt-5.6-terra";
const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

function rawEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "resp_read",
    model: TERRA_MODEL,
    output: [],
    service_tier: "default",
    status: "completed",
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 20 },
      output_tokens: 10,
    },
    ...overrides,
  });
}

function completeInventory() {
  return {
    intent: {
      attemptId: "attempt-1",
      intentId: "intent-1",
      sequence: 1,
    },
    requests: [
      {
        endpoint: RESPONSES_ENDPOINT,
        intentId: "intent-1",
        model: TERRA_MODEL,
        requestId: "req-read",
        sequence: 2,
        serviceTier: "default",
        stage: "repository-reading",
        turnIntentId: "turn-read",
      },
      {
        endpoint: RESPONSES_ENDPOINT,
        intentId: "intent-1",
        model: TERRA_MODEL,
        requestId: "req-verify",
        sequence: 4,
        serviceTier: "default",
        stage: "finding-verification",
        turnIntentId: "turn-verify",
      },
    ],
    responses: [
      {
        intentId: "intent-1",
        rawBody: rawEnvelope({ id: "resp-read" }),
        requestId: "req-read",
        sequence: 3,
        turnIntentId: "turn-read",
      },
      {
        intentId: "intent-1",
        rawBody: rawEnvelope({ id: "resp-verify" }),
        requestId: "req-verify",
        sequence: 5,
        turnIntentId: "turn-verify",
      },
    ],
  };
}

describe("retained Terra provider evidence", () => {
  test("accepts a complete ordered reading and verification inventory", () => {
    const validated = validateProviderInventory(completeInventory());

    expect(validated.attemptId).toBe("attempt-1");
    expect(validated.turns.map((turn) => turn.stage)).toEqual([
      "repository-reading",
      "finding-verification",
    ]);
    expect(validated.totalCostPicodollars).toBe(568_000_000n);
  });

  test.each([
    ["zero turns", (value: ReturnType<typeof completeInventory>) => {
      value.requests = [];
      value.responses = [];
    }],
    ["a missing response", (value: ReturnType<typeof completeInventory>) => {
      value.responses.pop();
    }],
    ["a duplicate response", (value: ReturnType<typeof completeInventory>) => {
      value.responses.push({ ...value.responses[0]! });
    }],
    ["swapped response pairings", (value: ReturnType<typeof completeInventory>) => {
      const first = value.responses[0]!.requestId;
      value.responses[0]!.requestId = value.responses[1]!.requestId;
      value.responses[1]!.requestId = first;
    }],
    ["a foreign intent", (value: ReturnType<typeof completeInventory>) => {
      value.requests[0]!.intentId = "intent-foreign";
    }],
    ["request before intent", (value: ReturnType<typeof completeInventory>) => {
      value.requests[0]!.sequence = 1;
    }],
    ["response before request", (value: ReturnType<typeof completeInventory>) => {
      value.responses[0]!.sequence = 2;
    }],
    ["duplicate journal sequences", (value: ReturnType<typeof completeInventory>) => {
      value.requests[1]!.sequence = value.requests[0]!.sequence;
    }],
    ["duplicate turn intents", (value: ReturnType<typeof completeInventory>) => {
      value.requests[1]!.turnIntentId = value.requests[0]!.turnIntentId;
    }],
    ["a non-Responses endpoint", (value: ReturnType<typeof completeInventory>) => {
      value.requests[0]!.endpoint = "https://api.anthropic.com/v1/messages";
    }],
    ["a requested non-Terra model", (value: ReturnType<typeof completeInventory>) => {
      value.requests[0]!.model = "claude-opus-4-6";
    }],
    ["a non-default requested tier", (value: ReturnType<typeof completeInventory>) => {
      value.requests[0]!.serviceTier = "priority";
    }],
    ["a non-Terra response", (value: ReturnType<typeof completeInventory>) => {
      value.responses[0]!.rawBody = rawEnvelope({ model: "gpt-5.6" });
    }],
    ["a non-default returned tier", (value: ReturnType<typeof completeInventory>) => {
      value.responses[0]!.rawBody = rawEnvelope({ service_tier: "priority" });
    }],
    ["a truncated envelope", (value: ReturnType<typeof completeInventory>) => {
      value.responses[0]!.rawBody = '{"id":"resp';
    }],
  ])("rejects %s", (_label, mutate) => {
    const value = completeInventory();
    mutate(value);
    expect(() => validateProviderInventory(value)).toThrow();
  });
});

describe("frozen Terra pricing", () => {
  test.each([
    [272_000, 0, 0, 1, 544_000_000_000n + 12_000_000n],
    [272_001, 0, 0, 1, 1_088_004_000_000n + 18_000_000n],
    [100, 20, 10, 10, 289_000_000n],
  ])(
    "prices input=%i cached=%i write=%i output=%i exactly",
    (input, cached, cacheWrite, output, expected) => {
      const result = validateTerraEnvelope(
        rawEnvelope({
          usage: {
            input_tokens: input,
            input_tokens_details: {
              cached_tokens: cached,
              cache_write_tokens: cacheWrite,
              future_detail: 7,
            },
            output_tokens: output,
            output_tokens_details: { reasoning_tokens: output },
          },
        })
      );

      expect(result.costPicodollars).toBe(expected);
      expect(result.rawUsage.input_tokens_details.future_detail).toBe(7);
    }
  );

  test.each([
    [271_999, 414_010_000_000n],
    [272_000, 414_012_000_000n],
    [272_001, 828_022_000_000n],
  ])(
    "tiers mixed cached and cache-write input from total input=%i",
    (inputTokens, expected) => {
      const result = validateTerraEnvelope(
        rawEnvelope({
          usage: {
            input_tokens: inputTokens,
            input_tokens_details: {
              cached_tokens: 100_000,
              cache_write_tokens: 100_000,
            },
            output_tokens: 1,
          },
        })
      );
      expect(result.costPicodollars).toBe(expected);
    }
  );

  test("normalizes only absent cache-write and reasoning details to zero", () => {
    const result = validateTerraEnvelope(rawEnvelope());
    expect(result.usage).toMatchObject({
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    });
  });

  test.each([
    { input_tokens: -1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1 },
    { input_tokens: 10, input_tokens_details: { cached_tokens: 11 }, output_tokens: 1 },
    { input_tokens: 10, input_tokens_details: {}, output_tokens: 1 },
    {
      input_tokens: 10,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 1,
      output_tokens_details: { reasoning_tokens: 2 },
    },
  ])("rejects incomplete or impossible native usage %#", (usage) => {
    expect(() => validateTerraEnvelope(rawEnvelope({ usage }))).toThrow();
  });

  test.each([
    { cache_creation_input_tokens: 5 },
    { cache_read_input_tokens: 5 },
  ])("rejects Anthropic-shaped cache usage %#", (foreignDetail) => {
    expect(() =>
      validateTerraEnvelope(
        rawEnvelope({
          usage: {
            input_tokens: 10,
            input_tokens_details: {
              cached_tokens: 0,
              ...foreignDetail,
            },
            output_tokens: 1,
          },
        })
      )
    ).toThrow("foreign");
  });
});

describe("diagnostic provenance", () => {
  test.each(["legacy-source-a", "Legacy Source/B:Raw"])(
    "copies registered provenance exactly: %s",
    (provenance) => {
      const corpusBytes = "fixture corpus bytes";
      const corpusDigest = createHash("sha256")
        .update(corpusBytes)
        .digest("hex");
      const manifest = retainDiagnosticManifest({
        corpusBytes,
        inventory: completeInventory(),
        registration: {
          corpusAuthorProvenance: provenance,
          corpusDigest,
          evidenceRole: "development",
        },
      });

      expect(manifest).toMatchObject({
        corpus_author_provenance: provenance,
        diagnosticOnly: true,
        evidenceRole: "development",
      });
      expect(JSON.stringify(manifest).toLowerCase()).not.toContain("claude-authored");
    }
  );

  test("rejects registration for different corpus bytes", () => {
    expect(() =>
      retainDiagnosticManifest({
        corpusBytes: "actual bytes",
        inventory: completeInventory(),
        registration: {
          corpusAuthorProvenance: "legacy-source-a",
          corpusDigest: createHash("sha256").update("other bytes").digest("hex"),
          evidenceRole: "development",
        },
      })
    ).toThrow("digest");
  });
});
