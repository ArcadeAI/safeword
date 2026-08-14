import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("real Terra recorder wiring", () => {
  test("retains the exact bytes from the last manual pinned-adapter qualification", () => {
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
      harnessCommit: "e0eb2787b4ad99ff6c6d01f114b6cd69f8ff1e27",
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

  test(
    "puts every real runner HTTP request downstream of durable canary intent using the explicitly pinned adapter",
    () => {
      expect(process.env.Y4ZAAY_ADAPTER_ROOT).toBeTruthy();
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
