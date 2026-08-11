import { describe, expect, test } from "vitest";

import {
  decideCanaryDispatch,
  PICODOLLARS_PER_DOLLAR,
} from "./terra-development-canary";

const LIMITS = {
  attemptLimit: 10,
  costLimitPicodollars: 15n * PICODOLLARS_PER_DOLLAR,
};

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
