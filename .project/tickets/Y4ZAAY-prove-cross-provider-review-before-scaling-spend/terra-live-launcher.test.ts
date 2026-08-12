import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

import {
  preflightPinnedCheckout,
  runCredentialSeparatedCanary,
  type PaidChildRequest,
  type PinnedCheckout,
} from "./terra-live-launcher";

const execFileAsync = promisify(execFile);

async function pinnedCheckout(name: string): Promise<PinnedCheckout> {
  const directory = await mkdtemp(join(tmpdir(), `${name}-`));
  await execFileAsync("git", ["init", "--quiet", directory]);
  await execFileAsync("git", ["config", "user.email", "canary@example.com"], {
    cwd: directory,
  });
  await execFileAsync("git", ["config", "user.name", "Canary Test"], {
    cwd: directory,
  });
  await writeFile(join(directory, "fixture.txt"), `${name}\n`, "utf8");
  await execFileAsync("git", ["add", "fixture.txt"], { cwd: directory });
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
  return { commit, directory, tag };
}

describe("credential-separated live launcher", () => {
  test("preflights both pins before loading secrets and isolates child credentials", async () => {
    const adapter = await pinnedCheckout("adapter");
    const harness = await pinnedCheckout("harness");
    const events: string[] = [];
    let child: PaidChildRequest | undefined;

    const result = await runCredentialSeparatedCanary({
      adapterDirectory: adapter.directory,
      authorization: {
        adapterCommit: adapter.commit,
        adapterTag: adapter.tag,
        harnessCommit: harness.commit,
        harnessTag: harness.tag,
      },
      child: { args: ["run-canary"], command: "node" },
      environment: {
        GH_TOKEN: "ambient-github-secret",
        HOME: "/ambient/home",
        OP_SERVICE_ACCOUNT_TOKEN: "ambient-op-secret",
        PATH: "/safe/bin",
        TMPDIR: "/safe/tmp",
      },
      harnessDirectory: harness.directory,
      loadGitHubToken: async () => {
        events.push("github-secret");
        return "github-token";
      },
      loadOpenAIKey: async () => {
        events.push("openai-secret");
        return "openai-key";
      },
      parent: async ({ dispatch, githubToken }) => {
        events.push(`parent:${githubToken}`);
        return dispatch();
      },
      spawnChild: async (request) => {
        events.push("child");
        child = request;
        return { exitCode: 0, stderr: "", stdout: "complete" };
      },
    });

    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "complete" });
    expect(events).toEqual([
      "github-secret",
      "openai-secret",
      "parent:github-token",
      "child",
    ]);
    expect(child).toEqual({
      args: ["run-canary"],
      command: "node",
      cwd: adapter.directory,
      env: {
        OPENAI_API_KEY: "openai-key",
        PATH: "/safe/bin",
        SAFEWORD_PAID_CANARY_RETRIES: "0",
        TMPDIR: "/safe/tmp",
      },
    });
  });

  test("rejects a dirty checkout before loading either secret", async () => {
    const adapter = await pinnedCheckout("adapter-dirty");
    const harness = await pinnedCheckout("harness-clean");
    await writeFile(join(adapter.directory, "untracked.txt"), "dirty\n", "utf8");
    const events: string[] = [];

    await expect(
      runCredentialSeparatedCanary({
        adapterDirectory: adapter.directory,
        authorization: {
          adapterCommit: adapter.commit,
          adapterTag: adapter.tag,
          harnessCommit: harness.commit,
          harnessTag: harness.tag,
        },
        child: { args: [], command: "node" },
        environment: { PATH: "/safe/bin" },
        harnessDirectory: harness.directory,
        loadGitHubToken: async () => {
          events.push("github-secret");
          return "github-token";
        },
        loadOpenAIKey: async () => {
          events.push("openai-secret");
          return "openai-key";
        },
        parent: async () => {
          events.push("parent");
        },
        spawnChild: async () => {
          events.push("child");
          return { exitCode: 0, stderr: "", stdout: "" };
        },
      })
    ).rejects.toThrow("must be clean");
    expect(events).toEqual([]);
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

  test("does not enter the parent when a secret is empty", async () => {
    const adapter = await pinnedCheckout("adapter-secret");
    const harness = await pinnedCheckout("harness-secret");
    let enteredParent = false;

    await expect(
      runCredentialSeparatedCanary({
        adapterDirectory: adapter.directory,
        authorization: {
          adapterCommit: adapter.commit,
          adapterTag: adapter.tag,
          harnessCommit: harness.commit,
          harnessTag: harness.tag,
        },
        child: { args: [], command: "node" },
        environment: {},
        harnessDirectory: harness.directory,
        loadGitHubToken: async () => "",
        loadOpenAIKey: async () => "openai-key",
        parent: async () => {
          enteredParent = true;
        },
        spawnChild: async () => ({ exitCode: 0, stderr: "", stdout: "" }),
      })
    ).rejects.toThrow("GitHub token is invalid");
    expect(enteredParent).toBe(false);
  });
});
