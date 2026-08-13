import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

import {
  createTerraPaidChildCommand,
  parseTerraPaidChildResult,
  preflightPinnedCheckout,
  spawnPaidChild,
  verifyAuthorizedPaidChildInput,
  type PaidChildRequest,
  type PinnedCheckout,
} from "./terra-live-launcher";

const execFileAsync = promisify(execFile);
const CORPUS_DIGEST = "4bf3fd10c20222088ccf11bd2b187561021608cb07a646bc4b9294babfc33c75";

async function pinnedCheckout(name: string): Promise<PinnedCheckout> {
  const directory = await mkdtemp(join(tmpdir(), `${name}-`));
  const remote = await mkdtemp(join(tmpdir(), `${name}-remote-`));
  const canonicalRepository = "ArcadeAI/safeword";
  const canonicalUrl = `https://github.com/${canonicalRepository}.git`;
  await execFileAsync("git", ["init", "--quiet", "--bare", remote]);
  await execFileAsync("git", ["init", "--quiet", directory]);
  await execFileAsync("git", ["config", "user.email", "canary@example.com"], {
    cwd: directory,
  });
  await execFileAsync("git", ["config", "user.name", "Canary Test"], {
    cwd: directory,
  });
  await writeFile(join(directory, "fixture.txt"), `${name}\n`, "utf8");
  const registrationDirectory = join(
    directory,
    ".project/tickets/CWGYH0-pr-review-eval"
  );
  await mkdir(registrationDirectory, { recursive: true });
  const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
  await Promise.all([
    "corpus-registration-development-2026-08-11.json",
    "scored-cases-frozen-2026-08-01.json",
    "reserve-cases-frozen-2026-08-01.json",
  ].map(async (filename) =>
    writeFile(
      join(registrationDirectory, filename),
      await readFile(join(corpusDirectory, filename)),
    )
  ));
  await writeFile(
    join(registrationDirectory, "corpus-registration-development-2026-08-11.sha256"),
    `${CORPUS_DIGEST}\n`,
    "utf8"
  );
  await execFileAsync("git", ["add", "."], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "fixture"], {
    cwd: directory,
  });
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
  });
  const commit = stdout.trim();
  const tag = `${name}-canary-v1`;
  await execFileAsync("git", ["tag", "-a", tag, "-m", `${name} canary`], {
    cwd: directory,
  });
  await execFileAsync("git", ["config", `url.${remote}.insteadOf`, canonicalUrl], {
    cwd: directory,
  });
  await execFileAsync("git", ["remote", "add", "origin", canonicalUrl], {
    cwd: directory,
  });
  await execFileAsync("git", ["push", "--quiet", "origin", "HEAD:main", tag], {
    cwd: directory,
  });
  return { canonicalRepository, commit, directory, tag };
}

describe("credential-separated live launcher", () => {

  test("binds the paid child review to an exact frozen corpus case", async () => {
    const harness = await pinnedCheckout("harness-corpus-input");
    const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
    const registration = JSON.parse(
      await readFile(join(corpusDirectory, "corpus-registration-development-2026-08-11.json"), "utf8")
    );
    const manifest = JSON.parse(
      await readFile(join(corpusDirectory, "scored-cases-frozen-2026-08-01.json"), "utf8")
    ) as { cases: Array<Record<string, unknown>>; modelCutoff: string; runnerRef: string };
    const corpusCase = manifest.cases[0]!;
    const inputPath = join(await mkdtemp(join(tmpdir(), "terra-input-")), "input.json");
    const review = {
      caseId: corpusCase.id,
      causalPaths: corpusCase.causalPaths,
      failureDescription: corpusCase.failureDescription,
      modelCutoff: manifest.modelCutoff,
      reviewBaseSha: corpusCase.reviewBaseSha,
      runnerRef: manifest.runnerRef,
      sourceSha: corpusCase.baseSha,
      variant: "buggy",
    };
    const request = {
      context: {
        attemptId: "attempt-1",
        intentId: "intent-1",
        outputDirectory: join(tmpdir(), "terra-output"),
        sequence: 1,
      },
      expertsDirectory: join(tmpdir(), "terra-experts"),
      policy: {
        maxVerifications: 2,
        toolCallsPerExpert: 3,
        wallClockMsPerExpert: 4_000,
      },
      review,
      target: { baseRef: "eval-base", root: join(tmpdir(), "terra-target") },
    };
    await writeFile(inputPath, JSON.stringify(request), "utf8");

    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).resolves.toBeUndefined();

    await writeFile(inputPath, JSON.stringify({
      ...request,
      review: { ...review, sourceSha: "0".repeat(40) },
    }), "utf8");
    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).rejects.toThrow("does not match its frozen corpus case");

    await writeFile(inputPath, JSON.stringify({ ...request, extra: true }), "utf8");
    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).rejects.toThrow("unexpected or missing fields");
  });
  test("builds the pinned harness child command with absolute paths", () => {
    expect(
      createTerraPaidChildCommand({
        harnessDirectory: "/tmp/pinned-harness",
        inputPath: "/tmp/attempt-input.json",
      })
    ).toEqual({
      args: [
        "/tmp/pinned-harness/.project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/terra-paid-child.ts",
        "/tmp/attempt-input.json",
      ],
      command: "bun",
    });
  });

  test("runs the paid child without a shell and captures its result", async () => {
    const result = await spawnPaidChild({
      args: [
        "-e",
        "process.stdout.write(process.env.CANARY_MARKER ?? ''); process.stderr.write('diagnostic')",
      ],
      command: process.execPath,
      cwd: process.cwd(),
      env: { CANARY_MARKER: "complete" },
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "diagnostic",
      stdout: "complete",
    });
  });

  test("returns a paid child's non-zero exit and diagnostics", async () => {
    await expect(
      spawnPaidChild({
        args: [
          "-e",
          "process.stdout.write('partial'); process.stderr.write('failed'); process.exit(7)",
        ],
        command: process.execPath,
        cwd: process.cwd(),
        env: {},
      })
    ).resolves.toEqual({
      exitCode: 7,
      stderr: "failed",
      stdout: "partial",
    });
  });

  test("the physical child refuses execution unless retries are disabled", async () => {
    const result = await spawnPaidChild({
      args: [
        join(import.meta.dirname, "terra-paid-child.ts"),
        join(tmpdir(), "unused-terra-child-input.json"),
      ],
      command: "bun",
      cwd: process.cwd(),
      env: {
        OPENAI_API_KEY: "fake-key",
        PATH: process.env.PATH ?? "",
        SAFEWORD_PAID_CANARY_RETRIES: "1",
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("paid canary retries must be disabled");
  });

  test("strictly converts one successful child result for the controller", () => {
    expect(
      parseTerraPaidChildResult({
        exitCode: 0,
        stderr: "",
        stdout:
          '{"attemptCostPicodollars":"123","nativeUsageBytes":"usage","rawResponseBytes":"response"}\n',
      })
    ).toEqual({
      attemptCostPicodollars: 123n,
      nativeUsageBytes: "usage",
      rawResponseBytes: "response",
    });
    expect(() =>
      parseTerraPaidChildResult({ exitCode: 7, stderr: "failed", stdout: "" })
    ).toThrow("paid child exited 7: failed");
    expect(() =>
      parseTerraPaidChildResult({
        exitCode: 0,
        stderr: "",
        stdout: "{}\nextra\n",
      })
    ).toThrow("one JSON line");
  });




  test("rejects a lightweight tag even when it points to the expected commit", async () => {
    const checkout = await pinnedCheckout("lightweight");
    await execFileAsync("git", ["tag", "-d", checkout.tag], {
      cwd: checkout.directory,
    });
    await execFileAsync("git", ["tag", checkout.tag], {
      cwd: checkout.directory,
    });

    await expect(preflightPinnedCheckout(checkout)).rejects.toThrow(
      "must be annotated"
    );
  });

  test("rejects a checkout whose HEAD moved beyond the authorized commit", async () => {
    const checkout = await pinnedCheckout("moved-head");
    await writeFile(join(checkout.directory, "fixture.txt"), "changed\n", "utf8");
    await execFileAsync("git", ["add", "fixture.txt"], {
      cwd: checkout.directory,
    });
    await execFileAsync("git", ["commit", "--quiet", "-m", "later"], {
      cwd: checkout.directory,
    });

    await expect(preflightPinnedCheckout(checkout)).rejects.toThrow(
      "HEAD does not match"
    );
  });

});
