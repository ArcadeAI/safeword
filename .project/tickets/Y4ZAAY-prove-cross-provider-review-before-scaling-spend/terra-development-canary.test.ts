import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
  decideCanaryDispatch,
  initializeCanary,
  inspectCanaryAccounting,
  INITIALIZATION_MARKER,
  PICODOLLARS_PER_DOLLAR,
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

function fakeUpstream(
  initial: "ready" | "unavailable" | "unreadable" = "ready",
  beforeConsume?: () => void
): CanaryUpstream & {
  consumeCalls: number;
  mutateReceipt(patch: Record<string, unknown>): void;
  setHead(head: { observedCostPicodollars: string; startedAttempts: number }): void;
  setReceipts(input: {
    completions: Array<Record<string, unknown>>;
    starts: Array<Record<string, unknown>>;
  }): void;
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
    mutateReceipt(patch: Record<string, unknown>): void;
    setHead(head: { observedCostPicodollars: string; startedAttempts: number }): void;
    setReceipts(input: {
      completions: Array<Record<string, unknown>>;
      starts: Array<Record<string, unknown>>;
    }): void;
  } = {
    consumeCalls: 0,
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
    nativeUsageDigest: `usage-${index + 1}`,
    observedCostPicodollars: (BigInt(index + 1) * costPerAttempt).toString(),
    receiptId: `completion-receipt-${index + 1}`,
    responseDigest: `response-${index + 1}`,
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
