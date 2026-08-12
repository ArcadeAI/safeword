import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("real Terra recorder wiring", () => {
  test(
    "puts every real runner HTTP request downstream of durable canary intent",
    () => {
      expect(() =>
        execFileSync(
          "bun",
          [join(import.meta.dirname, "terra-real-recorder-wiring.fixture.ts")],
          {
            encoding: "utf8",
            env: process.env,
            stdio: "pipe",
          }
        )
      ).not.toThrow();
    },
    30_000
  );
});
