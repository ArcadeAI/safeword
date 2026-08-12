import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  ATTEMPT_JOURNAL,
  type CanaryInitializationBinding,
  type CanaryUpstream,
  COST_JOURNAL,
  CANARY_LOCK,
  createCanaryProviderRecorder,
  decideCanaryDispatch,
  EVIDENCE_DIRECTORY,
  initializeCanary,
  inspectCanaryAccounting,
  INITIALIZATION_MARKER,
  PICODOLLARS_PER_DOLLAR,
  runCanaryAttempt,
} from "./terra-development-canary";

const LIMITS = {
  attemptLimit: 10,
  costLimitPicodollars: 15n * PICODOLLARS_PER_DOLLAR,
};

const BINDING: CanaryInitializationBinding = {
  adapterCommit: "adapter-commit",
  adapterTag: "terra-adapter-v1",
  attemptLimit: 10,
  canonicalRepository: "ArcadeAI/safeword",
  corpusDigest: "a".repeat(64),
  costLimitPicodollars: (15n * PICODOLLARS_PER_DOLLAR).toString(),
  harnessCommit: "harness-commit",
  harnessTag: "terra-harness-v1",
  model: "gpt-5.6-terra",
  outputIdentity: "terra-canary-2026-08-11",
  receiptBudget: 21,
  serviceTier: "default",
  ticketId: "Y4ZAAY",
};

function outputDirectory(): string {
  return join(mkdtempSync(join(tmpdir(), "terra-canary-")), "live-output");
}

function validDispatchEvidence(
  attemptId = "attempt-1",
  intentId = "intent-1"
): {
  attemptCostPicodollars: bigint;
  nativeUsageBytes: string;
  rawResponseBytes: string;
} {
  const rawUsage = {
    input_tokens: 10,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens: 3,
  };
  const rawBody = JSON.stringify({
    id: "resp-terra-1",
    model: "gpt-5.6-terra",
    output: [],
    service_tier: "default",
    status: "completed",
    usage: rawUsage,
  });
  const inventory = {
    intent: { attemptId, intentId, sequence: 1 },
    requests: [
      {
        endpoint: "https://api.openai.com/v1/responses",
        intentId,
        model: "gpt-5.6-terra",
        sequence: 2,
        serviceTier: "default",
        stage: "repository-reading",
        turnIntentId: "turn-intent-1",
      },
    ],
    responses: [
      {
        errorMessage: null,
        errorName: null,
        httpStatus: 200,
        intentId,
        nativeUsage: rawUsage,
        outcome: "response",
        rawBody,
        requestId: "req-terra-1",
        responseId: "resp-terra-1",
        returnedModel: "gpt-5.6-terra",
        returnedServiceTier: "default",
        sequence: 3,
        stage: "repository-reading",
        turnIntentId: "turn-intent-1",
      },
    ],
  };
  return {
    attemptCostPicodollars: 52_400_000n,
    nativeUsageBytes: JSON.stringify({
      turns: [
        {
          rawUsage,
          requestId: "req-terra-1",
          responseId: "resp-terra-1",
          stage: "repository-reading",
        },
      ],
    }),
    rawResponseBytes: JSON.stringify(inventory),
  };
}

function fakeUpstream(
  initial: "ready" | "unavailable" | "unreadable" = "ready",
  beforeConsume?: () => void,
  hooks: {
    afterCompletionCommit?: () => void;
    afterStartCommit?: () => void;
    returnCompletionWithoutCommit?: boolean;
    returnStartWithoutCommit?: boolean;
    throwAfterCompletionCommit?: boolean;
    throwAfterStartCommit?: boolean;
  } = {}
): CanaryUpstream & {
  consumeCalls: number;
  events: string[];
  mutateReceipt(patch: Record<string, unknown>): void;
  setHead(head: { observedCostPicodollars: string; startedAttempts: number }): void;
  setReceipts(input: {
    completions: Array<Record<string, unknown>>;
    starts: Array<Record<string, unknown>>;
  }): void;
  postAttemptStart(input: {
    attemptId: string;
    bindingDigest: string;
    intentId: string;
    sequence: number;
  }): Promise<Record<string, unknown>>;
  postAttemptCompletion(input: {
    attemptCostPicodollars: string;
    attemptId: string;
    bindingDigest: string;
    nativeUsageDigest: string;
    observedCostPicodollars: string;
    responseDigest: string;
    sequence: number;
    startReceiptId: string;
  }): Promise<Record<string, unknown>>;
} {
  let state: "ready" | "consumed" | "unavailable" | "unreadable" = initial;
  let receipt:
    | {
        authorizationId: string;
        bindingDigest: string;
        observedCostPicodollars: "0";
        receiptId: string;
        startedAttempts: 0;
      }
    | undefined;
  let head = { observedCostPicodollars: "0", startedAttempts: 0 };
  let starts: Array<Record<string, unknown>> = [];
  let completions: Array<Record<string, unknown>> = [];
  const upstream: CanaryUpstream & {
    consumeCalls: number;
    events: string[];
    mutateReceipt(patch: Record<string, unknown>): void;
    setHead(head: { observedCostPicodollars: string; startedAttempts: number }): void;
    setReceipts(input: {
      completions: Array<Record<string, unknown>>;
      starts: Array<Record<string, unknown>>;
    }): void;
    postAttemptStart(input: {
      attemptId: string;
      bindingDigest: string;
      intentId: string;
      sequence: number;
    }): Promise<Record<string, unknown>>;
    postAttemptCompletion(input: {
      attemptCostPicodollars: string;
      attemptId: string;
      bindingDigest: string;
      nativeUsageDigest: string;
      observedCostPicodollars: string;
      responseDigest: string;
      sequence: number;
      startReceiptId: string;
    }): Promise<Record<string, unknown>>;
  } = {
    consumeCalls: 0,
    events: [],
    mutateReceipt: (patch) => {
      if (receipt === undefined) {
        throw new Error("no receipt to mutate");
      }
      receipt = { ...receipt, ...patch } as typeof receipt;
    },
    setHead: (next) => {
      head = next;
    },
    setReceipts: (next) => {
      starts = next.starts;
      completions = next.completions;
    },
    postAttemptStart: async (input) => {
      upstream.events.push("upstream-start");
      const next = {
        attemptId: input.attemptId,
        intentId: input.intentId,
        receiptId: `start-receipt-${input.sequence}`,
        sequence: input.sequence,
        startedAttempts: input.sequence,
      };
      if (!hooks.returnStartWithoutCommit) {
        starts.push(next);
        head = { ...head, startedAttempts: input.sequence };
        hooks.afterStartCommit?.();
        if (hooks.throwAfterStartCommit) {
          throw new Error("lost start response after commit");
        }
      }
      return next;
    },
    postAttemptCompletion: async (input) => {
      upstream.events.push("upstream-completion");
      const next = {
        attemptCostPicodollars: input.attemptCostPicodollars,
        attemptId: input.attemptId,
        nativeUsageDigest: input.nativeUsageDigest,
        observedCostPicodollars: input.observedCostPicodollars,
        receiptId: `completion-receipt-${input.sequence}`,
        responseDigest: input.responseDigest,
        sequence: input.sequence,
        startReceiptId: input.startReceiptId,
      };
      if (!hooks.returnCompletionWithoutCommit) {
        completions.push(next);
        head = { ...head, observedCostPicodollars: input.observedCostPicodollars };
        hooks.afterCompletionCommit?.();
        if (hooks.throwAfterCompletionCommit) {
          throw new Error("lost completion response after commit");
        }
      }
      return next;
    },
    inspect: async () => {
      if (state === "unavailable" || state === "unreadable") {
        return { kind: state };
      }
      return state === "ready"
        ? { authorizationId: "auth-1", kind: "ready" }
        : { completions, head, kind: "consumed", receipt: receipt!, starts };
    },
    consumeInitialization: async (input) => {
      upstream.consumeCalls += 1;
      beforeConsume?.();
      if (state !== "ready") {
        throw new Error("authorization is not consumable");
      }
      state = "consumed";
      receipt = {
        authorizationId: input.authorizationId,
        bindingDigest: input.bindingDigest,
        observedCostPicodollars: "0",
        receiptId: "receipt-1",
        startedAttempts: 0,
      };
      return receipt;
    },
  };
  return upstream;
}

function progressedRecords(count: number, costPerAttempt = 100n) {
  const starts = Array.from({ length: count }, (_, index) => ({
    attemptId: `attempt-${index + 1}`,
    intentId: `intent-${index + 1}`,
    receiptId: `start-receipt-${index + 1}`,
    sequence: index + 1,
    startedAttempts: index + 1,
  }));
  const completions = starts.map((start, index) => ({
    attemptCostPicodollars: costPerAttempt.toString(),
    attemptId: start.attemptId,
    nativeUsageDigest: createHash("sha256")
      .update(`{"input_tokens":${index + 1}}`)
      .digest("hex"),
    observedCostPicodollars: (BigInt(index + 1) * costPerAttempt).toString(),
    receiptId: `completion-receipt-${index + 1}`,
    responseDigest: createHash("sha256")
      .update(`{"id":"resp-${index + 1}"}`)
      .digest("hex"),
    sequence: index + 1,
    startReceiptId: start.receiptId,
  }));
  return { completions, starts };
}

function progressedRecordsForTotal(count: number, totalCost: bigint) {
  const records = progressedRecords(count, 0n);
  const baseCost = totalCost / BigInt(count);
  const remainder = totalCost % BigInt(count);
  let cumulativeCost = 0n;
  records.completions.forEach((completion, index) => {
    const attemptCost = baseCost + (BigInt(index) < remainder ? 1n : 0n);
    cumulativeCost += attemptCost;
    completion.attemptCostPicodollars = attemptCost.toString();
    completion.observedCostPicodollars = cumulativeCost.toString();
  });
  return records;
}

function writeProgressedRecords(
  directory: string,
  records: ReturnType<typeof progressedRecords>
): void {
  const attemptGenesis = JSON.parse(
    readFileSync(join(directory, ATTEMPT_JOURNAL), "utf8")
  ) as Record<string, unknown>;
  const costGenesis = JSON.parse(
    readFileSync(join(directory, COST_JOURNAL), "utf8")
  ) as Record<string, unknown>;
  writeFileSync(
    join(directory, ATTEMPT_JOURNAL),
    [
      attemptGenesis,
      ...records.starts.map((start) => ({ kind: "attempt-start", ...start })),
    ]
      .map((record) => JSON.stringify(record))
      .join("\n") + "\n"
  );
  writeFileSync(
    join(directory, COST_JOURNAL),
    [
      costGenesis,
      ...records.completions.map((completion) => ({
        kind: "attempt-completion",
        ...completion,
      })),
    ]
      .map((record) => JSON.stringify(record))
      .join("\n") + "\n"
  );
  mkdirSync(join(directory, EVIDENCE_DIRECTORY), { recursive: true });
  records.completions.forEach((completion, index) => {
    writeFileSync(
      join(directory, EVIDENCE_DIRECTORY, `${completion.attemptId}.json`),
      `{"id":"resp-${index + 1}"}`
    );
    writeFileSync(
      join(
        directory,
        EVIDENCE_DIRECTORY,
        `${completion.attemptId}.usage.json`
      ),
      `{"input_tokens":${index + 1}}`
    );
  });
}

function retainedBytes(directory: string): Map<string, string | null> {
  return new Map(
    [INITIALIZATION_MARKER, ATTEMPT_JOURNAL, COST_JOURNAL].map((name) => {
      const path = join(directory, name);
      return [name, existsSync(path) ? readFileSync(path, "utf8") : null];
    })
  );
}

function decision(
  overrides: Partial<Parameters<typeof decideCanaryDispatch>[0]> = {}
) {
  return decideCanaryDispatch({
    authorizationPresent: true,
    costAccountingComplete: true,
    observedCostPicodollars: 0n,
    startedAttempts: 0,
    attemptAccountingComplete: true,
    ...LIMITS,
    ...overrides,
  });
}

describe("Terra canary pre-dispatch decision", () => {
  test("permits attempt ten while both complete totals remain below their limits", () => {
    expect(
      decision({
        observedCostPicodollars: 14n * PICODOLLARS_PER_DOLLAR,
        startedAttempts: 9,
      })
    ).toEqual({ eligible: true, reasons: ["eligible"] });
  });

  test.each([
    [10, 0n, ["attempt-stop"]],
    [11, 0n, ["attempt-stop"]],
    [0, 15n * PICODOLLARS_PER_DOLLAR, ["cost-stop"]],
    [0, 16n * PICODOLLARS_PER_DOLLAR, ["cost-stop"]],
    [10, 15n * PICODOLLARS_PER_DOLLAR, ["attempt-stop", "cost-stop"]],
  ] as const)(
    "blocks attempts=%i cost=%s with the exact reached limits",
    (startedAttempts, observedCostPicodollars, reasons) => {
      expect(decision({ observedCostPicodollars, startedAttempts })).toEqual({
        eligible: false,
        reasons,
      });
    }
  );

  test.each([
    [15n * PICODOLLARS_PER_DOLLAR - 1n, true, ["eligible"]],
    [15n * PICODOLLARS_PER_DOLLAR, false, ["cost-stop"]],
    [15n * PICODOLLARS_PER_DOLLAR + 1n, false, ["cost-stop"]],
  ] as const)(
    "classifies adjacent picodollar cost=%s without rounding",
    (observedCostPicodollars, eligible, reasons) => {
      expect(decision({ observedCostPicodollars })).toEqual({
        eligible,
        reasons,
      });
    }
  );

  test("does not report a cost boundary when cost accounting is incomplete", () => {
    expect(
      decision({
        costAccountingComplete: false,
        observedCostPicodollars: 99n * PICODOLLARS_PER_DOLLAR,
      })
    ).toEqual({
      eligible: false,
      reasons: ["incomplete-cost-accounting"],
    });
  });

  test("does not report an attempt boundary when attempt accounting is incomplete", () => {
    expect(
      decision({ attemptAccountingComplete: false, startedAttempts: 99 })
    ).toEqual({
      eligible: false,
      reasons: ["incomplete-attempt-accounting"],
    });
  });

  test("reports every independently applicable failure reason deterministically", () => {
    expect(
      decision({
        attemptAccountingComplete: true,
        authorizationPresent: false,
        costAccountingComplete: false,
        startedAttempts: 10,
      })
    ).toEqual({
      eligible: false,
      reasons: [
        "attempt-stop",
        "incomplete-cost-accounting",
        "missing-authorization",
      ],
    });
  });

  test.each([
    [
      { attemptAccountingComplete: false, costAccountingComplete: false },
      ["incomplete-attempt-accounting", "incomplete-cost-accounting"],
    ],
    [
      {
        attemptAccountingComplete: false,
        observedCostPicodollars: 15n * PICODOLLARS_PER_DOLLAR,
      },
      ["cost-stop", "incomplete-attempt-accounting"],
    ],
    [{ authorizationPresent: false }, ["missing-authorization"]],
    [
      { authorizationPresent: false, startedAttempts: 10 },
      ["attempt-stop", "missing-authorization"],
    ],
    [
      {
        attemptAccountingComplete: false,
        authorizationPresent: false,
        costAccountingComplete: false,
      },
      [
        "incomplete-attempt-accounting",
        "incomplete-cost-accounting",
        "missing-authorization",
      ],
    ],
  ] as const)("returns the exhaustive reason set for %#", (overrides, reasons) => {
    expect(decision(overrides)).toEqual({ eligible: false, reasons });
  });

  test("a completed threshold-crossing attempt is retained and blocks only the next dispatch", () => {
    const beforeCompletion = decision({
      observedCostPicodollars: 14n * PICODOLLARS_PER_DOLLAR,
      startedAttempts: 9,
    });
    const afterCompletion = decision({
      observedCostPicodollars: 16n * PICODOLLARS_PER_DOLLAR,
      startedAttempts: 10,
    });

    expect(beforeCompletion).toEqual({ eligible: true, reasons: ["eligible"] });
    expect(afterCompletion).toEqual({
      eligible: false,
      reasons: ["attempt-stop", "cost-stop"],
    });
  });

  test.each([
    { attemptLimit: -1 },
    { attemptLimit: 1.5 },
    { costLimitPicodollars: -1n },
    { observedCostPicodollars: -1n },
    { startedAttempts: -1 },
    { startedAttempts: 1.5 },
    { startedAttempts: Number.MAX_SAFE_INTEGER + 1 },
    { attemptLimit: Number.MAX_SAFE_INTEGER + 1 },
    { attemptAccountingComplete: "yes" },
    { authorizationPresent: 1 },
    { costAccountingComplete: null },
    { costLimitPicodollars: "15000000000000" },
    { observedCostPicodollars: 0 },
  ])("rejects malformed durable decision input %#", (overrides) => {
    expect(() => decision(overrides as never)).toThrow();
  });
});

describe("Terra canary write-side attempt lifecycle", () => {
  test("durably brackets one dispatch between its upstream start and completion", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    upstream.events.length = 0;

    const result = await runCanaryAttempt({
      attemptId: "attempt-1",
      binding: BINDING,
      dispatch: async () => {
        upstream.events.push("dispatch");
        expect(readFileSync(join(directory, ATTEMPT_JOURNAL), "utf8")).toContain(
          '"kind":"attempt-start"'
        );
        return validDispatchEvidence();
      },
      intentId: "intent-1",
      outputDirectory: directory,
      upstream,
    });

    expect(upstream.events).toEqual([
      "upstream-start",
      "dispatch",
      "upstream-completion",
    ]);
    expect(result).toMatchObject({
      attemptId: "attempt-1",
      observedCostPicodollars: 52_400_000n,
      sequence: 1,
      startedAttempts: 1,
    });
    expect(readFileSync(join(directory, COST_JOURNAL), "utf8")).toContain(
      '"kind":"attempt-completion"'
    );
    expect(
      readFileSync(join(directory, EVIDENCE_DIRECTORY, "attempt-1.json"), "utf8")
    ).toBe(validDispatchEvidence().rawResponseBytes);
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: true,
      observedCostPicodollars: 52_400_000n,
      startedAttempts: 1,
    });
  });

  test("rejects dispatch evidence that bypasses native inventory validation", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => ({
          attemptCostPicodollars: 100n,
          nativeUsageBytes: '{"input_tokens":1}',
          rawResponseBytes: '{"id":"invented"}',
        }),
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("provider inventory");
    expect(upstream.events).not.toContain("upstream-completion");
  });

  test("persists the provider turn intent before the physical HTTP request", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const rawBody = JSON.stringify({
      id: "resp-terra-1",
      model: "gpt-5.6-terra",
      output: [],
      service_tier: "default",
      status: "completed",
      usage: {
        input_tokens: 10,
        input_tokens_details: { cached_tokens: 2 },
        output_tokens: 3,
      },
    });

    const result = await runCanaryAttempt({
      attemptId: "attempt-1",
      binding: BINDING,
      dispatch: async (context) => {
        const recorder = await createCanaryProviderRecorder(context);
        await recorder.recordIntent({
          endpoint: "https://api.openai.com/v1/responses",
          intentId: "turn-intent-1",
          requestBody: { model: "gpt-5.6-terra" },
          requestedModel: "gpt-5.6-terra",
          requestedServiceTier: "default",
          stage: "repository-reading",
        });

        const turnJournal = readFileSync(recorder.journalPath, "utf8");
        expect(readFileSync(join(directory, ATTEMPT_JOURNAL), "utf8")).toContain(
          '"kind":"attempt-start"'
        );
        expect(turnJournal).toContain('"kind":"provider-turn-intent"');
        expect(turnJournal).not.toContain('"kind":"provider-turn-response"');

        await recorder.recordResponse({
          errorMessage: null,
          errorName: null,
          httpStatus: 200,
          intentId: "turn-intent-1",
          nativeUsage: {
            input_tokens: 10,
            input_tokens_details: { cached_tokens: 2 },
            output_tokens: 3,
          },
          outcome: "response",
          rawBody,
          requestId: "req-terra-1",
          responseId: "resp-terra-1",
          returnedModel: "gpt-5.6-terra",
          returnedServiceTier: "default",
          stage: "repository-reading",
        });
        return recorder.complete();
      },
      intentId: "intent-1",
      outputDirectory: directory,
      upstream,
    });

    expect(result.observedCostPicodollars).toBe(52_400_000n);
    const retained = JSON.parse(
      readFileSync(join(directory, EVIDENCE_DIRECTORY, "attempt-1.json"), "utf8")
    );
    expect(retained.requests[0]).not.toHaveProperty("requestId");
    expect(retained.responses[0]).toMatchObject({
      rawBody,
      requestId: "req-terra-1",
      turnIntentId: "turn-intent-1",
    });
  });

  test("edited retained response evidence makes cost accounting incomplete", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    await runCanaryAttempt({
      attemptId: "attempt-1",
      binding: BINDING,
      dispatch: async () => validDispatchEvidence(),
      intentId: "intent-1",
      outputDirectory: directory,
      upstream,
    });
    const evidencePath = join(directory, EVIDENCE_DIRECTORY, "attempt-1.json");
    writeFileSync(evidencePath, '{"id":"edited"}');

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
      startedAttempts: 1,
    });
    expect(readFileSync(evidencePath, "utf8")).toBe('{"id":"edited"}');
  });

  test.each(["../escaped", "nested/attempt", "..", "attempt\\name"])(
    "rejects unsafe attempt ID %s before durable start",
    async (attemptId) => {
      const directory = outputDirectory();
      const upstream = fakeUpstream();
      await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
      upstream.events.length = 0;

      await expect(
        runCanaryAttempt({
          attemptId,
          binding: BINDING,
          dispatch: async () => {
            throw new Error("dispatch must not run");
          },
          intentId: "intent-1",
          outputDirectory: directory,
          upstream,
        })
      ).rejects.toThrow("safe identifier");
      expect(upstream.events).toEqual([]);
    }
  );

  test("does not dispatch when a returned start receipt is not durably visible upstream", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      returnStartWithoutCommit: true,
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    upstream.events.length = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          upstream.events.push("dispatch");
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("not durably visible");
    expect(upstream.events).toEqual(["upstream-start"]);
    expect(readFileSync(join(directory, ATTEMPT_JOURNAL), "utf8")).not.toContain(
      '"kind":"attempt-start"'
    );
  });

  test("does not admit cost when a returned completion is not durably visible upstream", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      returnCompletionWithoutCommit: true,
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => validDispatchEvidence(),
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("completion is not durably visible");
    expect(readFileSync(join(directory, COST_JOURNAL), "utf8")).not.toContain(
      '"kind":"attempt-completion"'
    );
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
      startedAttempts: 1,
    });
  });

  test("holds exclusive ownership across dispatch and completion", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    let releaseDispatch!: () => void;
    let signalDispatch!: () => void;
    const dispatchStarted = new Promise<void>((resolve) => {
      signalDispatch = resolve;
    });
    const dispatchReleased = new Promise<void>((resolve) => {
      releaseDispatch = resolve;
    });
    const first = runCanaryAttempt({
      attemptId: "attempt-1",
      binding: BINDING,
      dispatch: async () => {
        signalDispatch();
        await dispatchReleased;
        return validDispatchEvidence();
      },
      intentId: "intent-1",
      outputDirectory: directory,
      upstream,
    });
    await dispatchStarted;

    expect(existsSync(join(directory, CANARY_LOCK))).toBe(true);
    await expect(
      runCanaryAttempt({
        attemptId: "attempt-2",
        binding: BINDING,
        dispatch: async () => {
          throw new Error("second dispatch must not run");
        },
        intentId: "intent-2",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("already running");
    releaseDispatch();
    await first;
    expect(existsSync(join(directory, CANARY_LOCK))).toBe(false);
    expect(upstream.events.filter((event) => event === "upstream-start")).toHaveLength(
      1
    );
  });

  test("blocks before durable start when the receipt budget cannot fund a complete attempt", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    const binding = {
      ...BINDING,
      outputIdentity: "terra-canary-insufficient-receipt-budget",
      receiptBudget: 2,
    };
    await initializeCanary({ binding, outputDirectory: directory, upstream });
    upstream.events.length = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding,
        dispatch: async () => {
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("receipt budget cannot fund");
    expect(upstream.events).toEqual([]);
  });

  test("a lost response after upstream start blocks dispatch and fails closed on resume", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      throwAfterStartCommit: true,
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    let dispatches = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          dispatches += 1;
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("lost start response");
    expect(dispatches).toBe(0);
    expect(readFileSync(join(directory, ATTEMPT_JOURNAL), "utf8")).not.toContain(
      '"kind":"attempt-start"'
    );
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
  });

  test("a provider failure after durable intent is never retried and blocks resume", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    let dispatches = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          dispatches += 1;
          throw new Error("provider transport failed");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("provider transport failed");
    expect(dispatches).toBe(1);
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
      startedAttempts: 1,
    });
    await expect(
      runCanaryAttempt({
        attemptId: "attempt-2",
        binding: BINDING,
        dispatch: async () => {
          dispatches += 1;
          throw new Error("retry must not run");
        },
        intentId: "intent-2",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("incomplete-cost-accounting");
    expect(dispatches).toBe(1);
  });

  test("a lost response after upstream completion leaves retained evidence but blocks resume", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      throwAfterCompletionCommit: true,
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => validDispatchEvidence(),
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("lost completion response");
    expect(
      readFileSync(join(directory, EVIDENCE_DIRECTORY, "attempt-1.json"), "utf8")
    ).toBe(validDispatchEvidence().rawResponseBytes);
    expect(readFileSync(join(directory, COST_JOURNAL), "utf8")).not.toContain(
      '"kind":"attempt-completion"'
    );
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
      startedAttempts: 1,
    });
  });

  test("local attempt-ledger loss after upstream start prevents dispatch", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      afterStartCommit: () => rmSync(join(directory, ATTEMPT_JOURNAL)),
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    let dispatches = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          dispatches += 1;
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("not durably visible");
    expect(dispatches).toBe(0);
    expect(existsSync(join(directory, ATTEMPT_JOURNAL))).toBe(false);
  });

  test("local cost-ledger loss after upstream completion prevents success", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", undefined, {
      afterCompletionCommit: () => rmSync(join(directory, COST_JOURNAL)),
    });
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => validDispatchEvidence(),
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("completion is not durably visible");
    expect(existsSync(join(directory, COST_JOURNAL))).toBe(false);
  });

  test("pre-existing evidence bytes are preserved and prevent completion", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    mkdirSync(join(directory, EVIDENCE_DIRECTORY));
    const evidencePath = join(directory, EVIDENCE_DIRECTORY, "attempt-1.json");
    writeFileSync(evidencePath, "planted evidence");

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => validDispatchEvidence(),
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(readFileSync(evidencePath, "utf8")).toBe("planted evidence");
    expect(upstream.events).not.toContain("upstream-completion");
  });

  test("a stale ownership lock is preserved and blocks execution", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const lockPath = join(directory, CANARY_LOCK);
    writeFileSync(lockPath, "stale owner\n");

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("already running");
    expect(readFileSync(lockPath, "utf8")).toBe("stale owner\n");
  });

  test("a symlinked evidence directory blocks before durable start", async () => {
    const directory = outputDirectory();
    const outsideDirectory = mkdtempSync(join(tmpdir(), "terra-canary-outside-"));
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    symlinkSync(outsideDirectory, join(directory, EVIDENCE_DIRECTORY));
    upstream.events.length = 0;

    await expect(
      runCanaryAttempt({
        attemptId: "attempt-1",
        binding: BINDING,
        dispatch: async () => {
          throw new Error("dispatch must not run");
        },
        intentId: "intent-1",
        outputDirectory: directory,
        upstream,
      })
    ).rejects.toThrow("real directory");
    expect(upstream.events).toEqual([]);
    expect(existsSync(join(outsideDirectory, "attempt-1.json"))).toBe(false);
  });
});

describe("Terra canary initialization and reload", () => {
  test("consumes upstream authorization before exclusively creating zero state", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream("ready", () => {
      expect(existsSync(directory)).toBe(false);
    });

    const initialized = await initializeCanary({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });

    expect(initialized).toMatchObject({
      observedCostPicodollars: 0n,
      receiptId: "receipt-1",
      startedAttempts: 0,
    });
    expect(upstream.consumeCalls).toBe(1);
    expect(retainedBytes(directory)).toEqual(
      new Map([
        [INITIALIZATION_MARKER, expect.stringContaining('"receiptId":"receipt-1"')],
        [ATTEMPT_JOURNAL, expect.stringContaining('"startedAttempts":0')],
        [COST_JOURNAL, expect.stringContaining('"observedCostPicodollars":"0"')],
      ])
    );
    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: true,
      observedCostPicodollars: 0n,
      startedAttempts: 0,
    });
  });

  test.each(["unavailable", "unreadable"] as const)(
    "refuses initialization when upstream state is %s without touching arbitrary local bytes",
    async (state) => {
      const directory = outputDirectory();
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, INITIALIZATION_MARKER), "arbitrary marker\n");
      writeFileSync(join(directory, ATTEMPT_JOURNAL), "arbitrary attempts\n");
      writeFileSync(join(directory, COST_JOURNAL), "arbitrary cost\n");
      const before = retainedBytes(directory);

      await expect(
        initializeCanary({
          binding: BINDING,
          outputDirectory: directory,
          upstream: fakeUpstream(state),
        })
      ).rejects.toThrow(state);
      expect(retainedBytes(directory)).toEqual(before);
    }
  );

  test("refuses re-initialization after consumption without changing local bytes", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const before = retainedBytes(directory);

    await expect(
      initializeCanary({ binding: BINDING, outputDirectory: directory, upstream })
    ).rejects.toThrow("already consumed");
    expect(retainedBytes(directory)).toEqual(before);
    expect(upstream.consumeCalls).toBe(1);
  });

  test.each([
    "non-zero-ledgers",
    "all-local-state-absent",
    "planted-ledgers-without-marker",
    "forged-marker-and-planted-ledgers",
    "attempt-ledger-absent",
    "cost-ledger-absent",
  ] as const)(
    "refuses consumed re-initialization with %s and preserves the exact state",
    async (variant) => {
      const directory = outputDirectory();
      const upstream = fakeUpstream();
      await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
      if (variant === "non-zero-ledgers") {
        upstream.setHead({
          observedCostPicodollars: "100",
          startedAttempts: 1,
        });
        writeFileSync(
          join(directory, ATTEMPT_JOURNAL),
          [
            JSON.stringify({
              initializationReceiptId: "receipt-1",
              kind: "attempt-genesis",
              startedAttempts: 0,
            }),
            JSON.stringify({
              attemptId: "attempt-1",
              kind: "attempt-start",
              sequence: 1,
              startedAttempts: 1,
              upstreamReceiptId: "start-receipt-1",
            }),
            "",
          ].join("\n")
        );
        writeFileSync(
          join(directory, COST_JOURNAL),
          [
            JSON.stringify({
              accountingComplete: true,
              initializationReceiptId: "receipt-1",
              kind: "cost-genesis",
              observedCostPicodollars: "0",
            }),
            JSON.stringify({
              attemptCostPicodollars: "100",
              attemptId: "attempt-1",
              kind: "attempt-completion",
              observedCostPicodollars: "100",
              sequence: 1,
              upstreamReceiptId: "completion-receipt-1",
            }),
            "",
          ].join("\n")
        );
      } else if (variant === "all-local-state-absent") {
        rmSync(directory, { recursive: true });
      } else if (variant === "planted-ledgers-without-marker") {
        rmSync(join(directory, INITIALIZATION_MARKER));
        writeFileSync(join(directory, ATTEMPT_JOURNAL), "planted attempts\n");
        writeFileSync(join(directory, COST_JOURNAL), "planted cost\n");
      } else if (variant === "forged-marker-and-planted-ledgers") {
        writeFileSync(join(directory, INITIALIZATION_MARKER), "forged marker\n");
        writeFileSync(join(directory, ATTEMPT_JOURNAL), "planted attempts\n");
        writeFileSync(join(directory, COST_JOURNAL), "planted cost\n");
      } else if (variant === "attempt-ledger-absent") {
        rmSync(join(directory, ATTEMPT_JOURNAL));
      } else {
        rmSync(join(directory, COST_JOURNAL));
      }
      const before = retainedBytes(directory);

      await expect(
        initializeCanary({ binding: BINDING, outputDirectory: directory, upstream })
      ).rejects.toThrow("already consumed");
      expect(retainedBytes(directory)).toEqual(before);
      expect(upstream.consumeCalls).toBe(1);
    }
  );

  test("exclusive creation preserves a marker planted after preflight", async () => {
    const directory = outputDirectory();
    const planted = '{"planted":true}\n';
    const upstream = fakeUpstream("ready", () => {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, INITIALIZATION_MARKER), planted);
    });

    await expect(
      initializeCanary({ binding: BINDING, outputDirectory: directory, upstream })
    ).rejects.toThrow();
    expect(readFileSync(join(directory, INITIALIZATION_MARKER), "utf8")).toBe(planted);
    expect(existsSync(join(directory, ATTEMPT_JOURNAL))).toBe(false);
    expect(existsSync(join(directory, COST_JOURNAL))).toBe(false);
    expect(upstream.consumeCalls).toBe(1);
  });

  test("an uninitialized directory stays absent and reports both accounting channels incomplete", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });
    expect(inspected).toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
    expect(
      decision({
        ...inspected,
        // Fixture scenarios cannot dispatch, so live authorization is inapplicable.
        authorizationPresent: true,
      })
    ).toEqual({
      eligible: false,
      reasons: [
        "incomplete-attempt-accounting",
        "incomplete-cost-accounting",
      ],
    });
    expect(existsSync(directory)).toBe(false);
  });

  test("deleted journals cannot turn a consumed initialization back into zero", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    rmSync(join(directory, ATTEMPT_JOURNAL));
    rmSync(join(directory, COST_JOURNAL));

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });
    expect(inspected).toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
    expect(
      decision({ ...inspected, authorizationPresent: true })
    ).toEqual({
      eligible: false,
      reasons: [
        "incomplete-attempt-accounting",
        "incomplete-cost-accounting",
      ],
    });
    expect(existsSync(join(directory, ATTEMPT_JOURNAL))).toBe(false);
    expect(existsSync(join(directory, COST_JOURNAL))).toBe(false);
  });

  test("planted ledgers without a trusted marker remain byte-identical and incomplete", async () => {
    const directory = outputDirectory();
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, ATTEMPT_JOURNAL), "planted attempts\n");
    writeFileSync(join(directory, COST_JOURNAL), "planted cost\n");
    const before = retainedBytes(directory);

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream: fakeUpstream(),
    });
    expect(inspected).toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
    expect(
      decision({ ...inspected, authorizationPresent: true })
    ).toEqual({
      eligible: false,
      reasons: [
        "incomplete-attempt-accounting",
        "incomplete-cost-accounting",
      ],
    });
    expect(retainedBytes(directory)).toEqual(before);
  });

  test("a forged marker cannot authorize planted ledgers", async () => {
    const directory = outputDirectory();
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, INITIALIZATION_MARKER), '{"forged":true}\n');
    writeFileSync(join(directory, ATTEMPT_JOURNAL), "planted attempts\n");
    writeFileSync(join(directory, COST_JOURNAL), "planted cost\n");
    const before = retainedBytes(directory);

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream: fakeUpstream(),
    });
    expect(inspected).toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
    expect(
      decision({ ...inspected, authorizationPresent: true })
    ).toEqual({
      eligible: false,
      reasons: [
        "incomplete-attempt-accounting",
        "incomplete-cost-accounting",
      ],
    });
    expect(retainedBytes(directory)).toEqual(before);
  });

  test("forged non-zero genesis records cannot reconcile a non-zero upstream head", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    upstream.setHead({ observedCostPicodollars: "100", startedAttempts: 1 });
    writeFileSync(
      join(directory, ATTEMPT_JOURNAL),
      `${JSON.stringify({
        initializationReceiptId: "receipt-1",
        kind: "attempt-genesis",
        startedAttempts: 1,
      })}\n`
    );
    writeFileSync(
      join(directory, COST_JOURNAL),
      `${JSON.stringify({
        accountingComplete: true,
        initializationReceiptId: "receipt-1",
        kind: "cost-genesis",
        observedCostPicodollars: "100",
      })}\n`
    );

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
  });

  test.each([
    { observedCostPicodollars: "0", startedAttempts: 1 },
    { observedCostPicodollars: "100", startedAttempts: 0 },
  ])("an asymmetric non-zero upstream head fails both channels closed %#", async (head) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    upstream.setHead(head);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
  });

  test.each([
    [INITIALIZATION_MARKER, "unknown-field"],
    [ATTEMPT_JOURNAL, "unknown-field"],
    [COST_JOURNAL, "unknown-field"],
    [INITIALIZATION_MARKER, "blank-line"],
    [ATTEMPT_JOURNAL, "blank-line"],
    [COST_JOURNAL, "blank-line"],
  ] as const)(
    "edited %s mutation %s remains unchanged and fails closed",
    async (file, mutation) => {
      const directory = outputDirectory();
      const upstream = fakeUpstream();
      await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
      const path = join(directory, file);
      const original = readFileSync(path, "utf8");
      const edited =
        mutation === "blank-line"
          ? `${original}\n`
          : `${original.trimEnd().replace(/}$/, ',"unknown":true}')}\n`;
      writeFileSync(path, edited);

      const inspected = await inspectCanaryAccounting({
        binding: BINDING,
        outputDirectory: directory,
        upstream,
      });
      expect(
        inspected.attemptAccountingComplete && inspected.costAccountingComplete
      ).toBe(false);
      expect(readFileSync(path, "utf8")).toBe(edited);
    }
  );

  test.each([
    { authorizationId: "auth-edited" },
    { unknown: true },
  ])("edited upstream receipt %# fails closed", async (patch) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const before = retainedBytes(directory);
    upstream.mutateReceipt(patch);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
    });
    expect(retainedBytes(directory)).toEqual(before);
  });

  test.each([1, 9, 10])(
    "reconciles %i matching non-zero attempts across a fresh resume",
    async (count) => {
      const directory = outputDirectory();
      const upstream = fakeUpstream();
      await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
      const totalCost =
        count === 9
          ? 14n * PICODOLLARS_PER_DOLLAR
          : BigInt(count) * 100n;
      const records = progressedRecordsForTotal(count, totalCost);
      upstream.setReceipts(records);
      upstream.setHead({
        observedCostPicodollars: totalCost.toString(),
        startedAttempts: count,
      });
      writeProgressedRecords(directory, records);

      const inspected = await inspectCanaryAccounting({
        binding: BINDING,
        outputDirectory: directory,
        upstream,
      });
      expect(inspected).toEqual({
        attemptAccountingComplete: true,
        authorizationPresent: true,
        costAccountingComplete: true,
        observedCostPicodollars: totalCost,
        startedAttempts: count,
      });
      expect(decision(inspected)).toMatchObject({
        eligible: count < 10,
        reasons: count < 10 ? ["eligible"] : ["attempt-stop"],
      });
    }
  );

  test("an unfinished tenth start consumes the cap and leaves cost incomplete", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const records = progressedRecords(10);
    records.completions.pop();
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: "900", startedAttempts: 10 });
    writeProgressedRecords(directory, records);

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });
    expect(inspected).toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
      startedAttempts: 10,
    });
    expect(decision(inspected)).toEqual({
      eligible: false,
      reasons: ["attempt-stop", "incomplete-cost-accounting"],
    });
  });

  test.each([
    "duplicate-start-sequence",
    "out-of-order-start-sequence",
    "different-local-attempt-id",
    "missing-local-start",
  ] as const)("rejects attempt-chain defect %s without editing bytes", async (defect) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const upstreamRecords = progressedRecords(2);
    const localRecords = structuredClone(upstreamRecords);
    if (defect === "duplicate-start-sequence") {
      upstreamRecords.starts[1]!.sequence = 1;
    } else if (defect === "out-of-order-start-sequence") {
      upstreamRecords.starts.reverse();
    } else if (defect === "different-local-attempt-id") {
      localRecords.starts[1]!.attemptId = "attempt-local-other";
    } else {
      localRecords.starts.pop();
    }
    upstream.setReceipts(upstreamRecords);
    upstream.setHead({ observedCostPicodollars: "200", startedAttempts: 2 });
    writeProgressedRecords(directory, localRecords);
    const before = retainedBytes(directory);

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });
    expect(inspected.attemptAccountingComplete).toBe(false);
    expect(inspected.costAccountingComplete).toBe(true);
    expect(retainedBytes(directory)).toEqual(before);
  });

  test.each([
    "duplicate-attempt-id",
    "duplicate-intent-id",
    "duplicate-start-receipt-id",
    "initialization-receipt-collision",
  ] as const)("rejects upstream attempt identity defect %s", async (defect) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const records = progressedRecords(2);
    if (defect === "duplicate-attempt-id") {
      records.starts[1]!.attemptId = records.starts[0]!.attemptId;
    } else if (defect === "duplicate-intent-id") {
      records.starts[1]!.intentId = records.starts[0]!.intentId;
    } else if (defect === "duplicate-start-receipt-id") {
      records.starts[1]!.receiptId = records.starts[0]!.receiptId;
    } else {
      records.starts[1]!.receiptId = "receipt-1";
    }
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: "200", startedAttempts: 2 });
    writeProgressedRecords(directory, records);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: true,
    });
  });

  test("rejects an upstream head whose count disagrees with both chains", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const records = progressedRecords(2);
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: "200", startedAttempts: 3 });
    writeProgressedRecords(directory, records);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      costAccountingComplete: false,
    });
  });

  test("rejects an internally consistent chain above the authorized attempt cap", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const records = progressedRecords(11);
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: "1100", startedAttempts: 11 });
    writeProgressedRecords(directory, records);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
    });
  });

  test("rejects an internally consistent chain above its authorized receipt budget", async () => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    const binding = {
      ...BINDING,
      outputIdentity: "terra-canary-receipt-budget-test",
      receiptBudget: 20,
    };
    await initializeCanary({ binding, outputDirectory: directory, upstream });
    const records = progressedRecords(10);
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: "1000", startedAttempts: 10 });
    writeProgressedRecords(directory, records);

    await expect(
      inspectCanaryAccounting({ binding, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
    });
  });

  test.each([
    "different-response-digest",
    "different-native-usage-digest",
    "different-cost",
    "missing-local-completion",
  ] as const)("rejects cost-chain defect %s without editing bytes", async (defect) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const upstreamRecords = progressedRecords(2);
    const localRecords = structuredClone(upstreamRecords);
    if (defect === "different-response-digest") {
      localRecords.completions[1]!.responseDigest = "response-local-other";
    } else if (defect === "different-native-usage-digest") {
      localRecords.completions[1]!.nativeUsageDigest = "usage-local-other";
    } else if (defect === "different-cost") {
      localRecords.completions[1]!.observedCostPicodollars = "201";
    } else {
      localRecords.completions.pop();
    }
    upstream.setReceipts(upstreamRecords);
    upstream.setHead({ observedCostPicodollars: "200", startedAttempts: 2 });
    writeProgressedRecords(directory, localRecords);
    const before = retainedBytes(directory);

    const inspected = await inspectCanaryAccounting({
      binding: BINDING,
      outputDirectory: directory,
      upstream,
    });
    expect(inspected.costAccountingComplete).toBe(false);
    expect(retainedBytes(directory)).toEqual(before);
  });

  test.each([
    "duplicate-completion-sequence",
    "duplicate-attempt-id",
    "duplicate-completion-receipt-id",
    "initialization-receipt-collision",
    "start-receipt-collision",
    "duplicate-start-receipt-reference",
    "foreign-attempt-binding",
    "foreign-start-receipt-binding",
    "swapped-attempt-bindings",
    "swapped-start-receipt-bindings",
    "broken-cumulative-cost",
    "head-cost-mismatch",
  ] as const)("rejects upstream cost-chain defect %s", async (defect) => {
    const directory = outputDirectory();
    const upstream = fakeUpstream();
    await initializeCanary({ binding: BINDING, outputDirectory: directory, upstream });
    const records = progressedRecords(2);
    let headCost = "200";
    if (defect === "duplicate-completion-sequence") {
      records.completions[1]!.sequence = 1;
    } else if (defect === "duplicate-attempt-id") {
      records.completions[1]!.attemptId = records.completions[0]!.attemptId;
    } else if (defect === "duplicate-completion-receipt-id") {
      records.completions[1]!.receiptId = records.completions[0]!.receiptId;
    } else if (defect === "initialization-receipt-collision") {
      records.completions[1]!.receiptId = "receipt-1";
    } else if (defect === "start-receipt-collision") {
      records.completions[1]!.receiptId = records.starts[0]!.receiptId;
    } else if (defect === "duplicate-start-receipt-reference") {
      records.completions[1]!.startReceiptId =
        records.completions[0]!.startReceiptId;
    } else if (defect === "foreign-attempt-binding") {
      records.completions[1]!.attemptId = "foreign-attempt";
    } else if (defect === "foreign-start-receipt-binding") {
      records.completions[1]!.startReceiptId = "foreign-start-receipt";
    } else if (defect === "swapped-attempt-bindings") {
      const firstAttemptId = records.completions[0]!.attemptId;
      records.completions[0]!.attemptId = records.completions[1]!.attemptId;
      records.completions[1]!.attemptId = firstAttemptId;
    } else if (defect === "swapped-start-receipt-bindings") {
      const firstStartReceiptId = records.completions[0]!.startReceiptId;
      records.completions[0]!.startReceiptId =
        records.completions[1]!.startReceiptId;
      records.completions[1]!.startReceiptId = firstStartReceiptId;
    } else if (defect === "broken-cumulative-cost") {
      records.completions[1]!.observedCostPicodollars = "201";
      headCost = "201";
    } else {
      headCost = "201";
    }
    upstream.setReceipts(records);
    upstream.setHead({ observedCostPicodollars: headCost, startedAttempts: 2 });
    writeProgressedRecords(directory, records);

    await expect(
      inspectCanaryAccounting({ binding: BINDING, outputDirectory: directory, upstream })
    ).resolves.toMatchObject({
      attemptAccountingComplete: true,
      costAccountingComplete: false,
    });
  });
});
