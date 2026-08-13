import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("real Terra recorder wiring", () => {
  test("retains a passing qualification bound to the pinned adapter and current harness bytes", () => {
    const qualification = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "terra-real-recorder-qualification.json"),
        "utf8"
      )
    ) as {
      adapterCommit: string;
      harnessCommit: string;
      result: string;
      sha256: Record<string, string>;
    };
    expect(qualification).toMatchObject({
      adapterCommit: "e1d54b2d12e4a97fba84e8302de31bfe8b60ba17",
      harnessCommit: "47712ea29a2bba873360d21b3d454f997a62e15e",
      result: "passed",
    });
    for (const [filename, expectedDigest] of Object.entries(
      qualification.sha256
    )) {
      expect(
        createHash("sha256")
          .update(readFileSync(join(import.meta.dirname, filename)))
          .digest("hex")
      ).toBe(expectedDigest);
    }
  });

  test.skipIf(process.env.Y4ZAAY_ADAPTER_ROOT === undefined)(
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
