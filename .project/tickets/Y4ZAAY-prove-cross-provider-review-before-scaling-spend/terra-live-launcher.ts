import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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
