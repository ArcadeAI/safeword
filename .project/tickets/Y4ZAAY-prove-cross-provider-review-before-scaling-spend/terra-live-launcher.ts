import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PAID_CHILD_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const CHILD_ENVIRONMENT_ALLOWLIST = [
  "NODE_EXTRA_CA_CERTS",
  "PATH",
  "SSL_CERT_FILE",
  "TMPDIR",
] as const;

export type PinnedCheckout = {
  commit: string;
  directory: string;
  tag: string;
};

export type PaidChildRequest = {
  args: string[];
  command: string;
  cwd: string;
  env: Record<string, string>;
};

export type PaidChildResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function createTerraPaidChildCommand(input: {
  harnessDirectory: string;
  inputPath: string;
}): { args: string[]; command: string } {
  if (!isAbsolute(input.harnessDirectory) || !isAbsolute(input.inputPath)) {
    throw new Error("paid child paths must be absolute");
  }
  return {
    args: [
      join(
        input.harnessDirectory,
        ".project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/terra-paid-child.ts"
      ),
      input.inputPath,
    ],
    command: "bun",
  };
}

export function parseTerraPaidChildResult(result: PaidChildResult): {
  attemptCostPicodollars: bigint;
  nativeUsageBytes: string;
  rawResponseBytes: string;
} {
  if (result.exitCode !== 0) {
    throw new Error(`paid child exited ${result.exitCode}: ${result.stderr}`);
  }
  const lines = result.stdout.split("\n");
  if (lines.length !== 2 || lines[0] === "" || lines[1] !== "") {
    throw new Error("paid child must emit exactly one JSON line");
  }
  let value: unknown;
  try {
    value = JSON.parse(lines[0]);
  } catch {
    throw new Error("paid child output is invalid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("paid child output must be an object");
  }
  const output = value as Record<string, unknown>;
  if (
    Object.keys(output).sort().join(",") !==
      "attemptCostPicodollars,nativeUsageBytes,rawResponseBytes" ||
    typeof output.attemptCostPicodollars !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(output.attemptCostPicodollars) ||
    typeof output.nativeUsageBytes !== "string" ||
    output.nativeUsageBytes.length === 0 ||
    typeof output.rawResponseBytes !== "string" ||
    output.rawResponseBytes.length === 0
  ) {
    throw new Error("paid child output has an invalid evidence contract");
  }
  return {
    attemptCostPicodollars: BigInt(output.attemptCostPicodollars),
    nativeUsageBytes: output.nativeUsageBytes,
    rawResponseBytes: output.rawResponseBytes,
  };
}

export async function spawnPaidChild(
  request: PaidChildRequest
): Promise<PaidChildResult> {
  try {
    const { stderr, stdout } = await execFileAsync(
      request.command,
      request.args,
      {
        cwd: request.cwd,
        encoding: "utf8",
        env: request.env,
        maxBuffer: PAID_CHILD_MAX_BUFFER_BYTES,
        shell: false,
      }
    );
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    const failed = error as {
      code?: unknown;
      stderr?: unknown;
      stdout?: unknown;
    };
    if (typeof failed.code !== "number") {
      throw error;
    }
    return {
      exitCode: failed.code,
      stderr: typeof failed.stderr === "string" ? failed.stderr : "",
      stdout: typeof failed.stdout === "string" ? failed.stdout : "",
    };
  }
}

async function git(directory: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: directory,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`checkout preflight failed: ${detail}`);
  }
}

export async function preflightPinnedCheckout(
  checkout: PinnedCheckout
): Promise<void> {
  if (!isAbsolute(checkout.directory)) {
    throw new Error("checkout directory must be absolute");
  }
  if (!/^[0-9a-f]{40}$/.test(checkout.commit)) {
    throw new Error("pinned commit must be a full lowercase SHA-1");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(checkout.tag)) {
    throw new Error("pinned tag is invalid");
  }

  const [head, status, tagType, taggedCommit] = await Promise.all([
    git(checkout.directory, ["rev-parse", "--verify", "HEAD"]),
    git(checkout.directory, ["status", "--porcelain=v1", "--untracked-files=all"]),
    git(checkout.directory, ["cat-file", "-t", `refs/tags/${checkout.tag}`]),
    git(checkout.directory, [
      "rev-parse",
      "--verify",
      `refs/tags/${checkout.tag}^{commit}`,
    ]),
  ]);
  if (status !== "") {
    throw new Error("authorized checkout must be clean");
  }
  if (head !== checkout.commit) {
    throw new Error("checkout HEAD does not match its pinned commit");
  }
  if (tagType !== "tag") {
    throw new Error("pinned tag must be annotated");
  }
  if (taggedCommit !== checkout.commit) {
    throw new Error("pinned tag does not resolve to its authorized commit");
  }
}

function requireSecret(value: string, label: string): string {
  if (value.length === 0 || value.trim() !== value) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function paidChildEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  openAIKey: string
): Record<string, string> {
  const child: Record<string, string> = {};
  for (const key of CHILD_ENVIRONMENT_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) {
      child[key] = value;
    }
  }
  child.OPENAI_API_KEY = openAIKey;
  child.SAFEWORD_PAID_CANARY_RETRIES = "0";
  return child;
}

export async function runCredentialSeparatedCanary<T>(input: {
  adapterDirectory: string;
  authorization: {
    adapterCommit: string;
    adapterTag: string;
    harnessCommit: string;
    harnessTag: string;
  };
  child: { args: string[]; command: string };
  environment: Readonly<Record<string, string | undefined>>;
  harnessDirectory: string;
  loadGitHubToken(): Promise<string>;
  loadOpenAIKey(): Promise<string>;
  parent(context: {
    dispatch(): Promise<PaidChildResult>;
    githubToken: string;
  }): Promise<T>;
  spawnChild(request: PaidChildRequest): Promise<PaidChildResult>;
}): Promise<T> {
  await Promise.all([
    preflightPinnedCheckout({
      commit: input.authorization.adapterCommit,
      directory: input.adapterDirectory,
      tag: input.authorization.adapterTag,
    }),
    preflightPinnedCheckout({
      commit: input.authorization.harnessCommit,
      directory: input.harnessDirectory,
      tag: input.authorization.harnessTag,
    }),
  ]);

  const githubToken = requireSecret(await input.loadGitHubToken(), "GitHub token");
  const openAIKey = requireSecret(await input.loadOpenAIKey(), "OpenAI API key");
  const dispatch = (): Promise<PaidChildResult> =>
    input.spawnChild({
      args: [...input.child.args],
      command: input.child.command,
      cwd: input.adapterDirectory,
      env: paidChildEnvironment(input.environment, openAIKey),
    });
  return input.parent({ dispatch, githubToken });
}
