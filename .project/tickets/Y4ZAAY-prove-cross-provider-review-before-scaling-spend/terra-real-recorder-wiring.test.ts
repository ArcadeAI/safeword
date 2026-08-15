import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

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
      adapterTag: string;
      harnessCommit: string;
      harnessTag: string;
      result: string;
      sha256: Record<string, string>;
      verificationCommand: string;
    };
    expect(qualification).toMatchObject({
      adapterCommit: "e1d54b2d12e4a97fba84e8302de31bfe8b60ba17",
      adapterTag: "terra-adapter-v1",
      harnessCommit: "b007caf8a65713eee1ae4110a802851aaccdc15a",
      harnessTag: "terra-harness-v8",
      result: "passed",
      verificationCommand:
        "Y4ZAAY_ADAPTER_ROOT=<pinned-adapter> bun terra-real-recorder-wiring.fixture.ts",
    });
    expect(Object.keys(qualification.sha256).sort()).toEqual(
      readdirSync(import.meta.dirname)
        .filter((filename) => filename.startsWith("terra-") && filename.endsWith(".ts"))
        .filter((filename) => !filename.endsWith(".test.ts"))
        .sort()
    );
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
    "puts every real runner HTTP request downstream of durable canary intent using the explicitly pinned adapter",
    () => {
      const bunExecutable =
        process.versions.bun === undefined
          ? join(process.env.BUN_INSTALL ?? "", "bin/bun")
          : process.execPath;
      expect(isAbsolute(bunExecutable)).toBe(true);
      const result = spawnSync(
        bunExecutable,
        [join(import.meta.dirname, "terra-real-recorder-wiring.fixture.ts")],
        {
          encoding: "utf8",
          env: {
            BUN_INSTALL: process.env.BUN_INSTALL,
            PATH: process.env.PATH,
            Y4ZAAY_ADAPTER_ROOT: process.env.Y4ZAAY_ADAPTER_ROOT,
          },
        }
      );
      expect(result.status, result.stderr).toBe(0);
    },
    30_000
  );
});
