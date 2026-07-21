// The real headless vendor child (ticket 36EEMY, slice 3).
//
// Everything above this file treats the vendor as an injected function. This is
// where that function finally becomes a process. It is deliberately the only
// place in the runner that knows a binary name.
//
// The heavy lifting — argv shape, the recursion sentinel, schema/output files,
// fail-open parsing — belongs to the generalized runners in
// `hooks/lib/retro-extract.ts` (slice 0). What is here is the review job's
// divergence from retro's: a real MCP broker instead of `mcp_servers={}`, a
// sandbox tiered by execution trust instead of always read-only, and a bounded
// timeout so a hung model cannot hold a CI runner for its whole job budget.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  runCodexHeadlessExtractionChecked,
  runHeadlessExtraction,
} from '../../templates/hooks/lib/retro-extract.js';
import type { ExecutionTier } from './execution.js';
import type { ReviewJob, VendorRunner, VendorRunResult } from './invoke.js';
import type { Vendor } from './vendor.js';
import type { Review } from './verdict.js';

/** The raw process boundary. Injected so the adapter itself is testable. */
export type RawSpawn = (
  binary: string,
  argv: string[],
  options: { cwd: string; env: Record<string, string | undefined>; timeout: number },
) => { status: number | null; stdout: string };

/**
 * A review can legitimately take minutes — it reads a diff and a tree. But an
 * unbounded child holds the runner's whole 20-minute job budget and then fails
 * anyway, so the cap is well inside it.
 */
const VENDOR_TIMEOUT_MS = 15 * 60 * 1000;

export interface VendorRunnerOptions {
  vendor: Vendor;
  /** Working directory for the child. */
  cwd: string;
  /** Base env. CREDENTIALS TRAVEL HERE — never in argv. */
  env: Record<string, string | undefined>;
  /** Whether this pull request's code may be executed (SM1.R3). */
  executionTier: ExecutionTier;
  /** `-c mcp_servers=<value>` for the tracker broker (Codex). Omitted means no MCP. */
  mcpServers?: string;
  /**
   * Path to the MCP config file for the Claude path's `--mcp-config` (a path,
   * never inline — the config carries a bearer token). Omitted means no MCP.
   */
  mcpConfigPath?: string;
  /**
   * The allow-list entry for the gateway's tools, e.g. `mcp__arcade`. Injected,
   * not hardcoded: arcade.dev is a GATEWAY, so the server name is whatever the
   * config file assigns. Without it, an attached config is inert.
   */
  mcpToolGrant?: string;
  model?: string;
  /** Seams — real implementations by default. */
  spawn?: RawSpawn;
  writeFile?: (path: string, content: string) => void;
  readFile?: (path: string) => string;
}

const realSpawn: RawSpawn = (binary, argv, options) => {
  const result = spawnSync(binary, argv, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
    encoding: 'utf8',
    // stdin closed: a headless child must never block waiting for input.
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout ?? '' };
};

/**
 * Build the `VendorRunner` the command injects into `createVendorReview`.
 *
 * Returns a FAILURE rather than throwing on a bad exit: the caller
 * (`createVendorReview`) is what turns that into a thrown fault, so the
 * distinction between "no usable review" and "the process itself blew up" stays
 * in one place.
 */
export function createVendorRunner(options: VendorRunnerOptions): VendorRunner {
  const spawn = options.spawn ?? realSpawn;

  // Not `async`: it returns the runner's promise directly, and marking it async
  // would only add a wrapper tick.
  return (job: ReviewJob, input: string): Promise<VendorRunResult> =>
    options.vendor === 'codex'
      ? runCodex(job, input, options, spawn)
      : runClaude(job, input, options, spawn);
}

/** Adapt the raw boundary to the runners' `(argv, options) => SpawnResult` shape. */
function spawnAdapter(binary: string, spawn: RawSpawn) {
  // Not async: the underlying boundary is `spawnSync`, so there is genuinely
  // nothing to await — the runners just want a promise back.
  return (
    argv: string[],
    spawnOptions: { cwd: string; env: Record<string, string | undefined> },
  ): Promise<{ code: number | null; stdout: string }> => {
    const result = spawn(binary, argv, {
      cwd: spawnOptions.cwd,
      env: spawnOptions.env,
      timeout: VENDOR_TIMEOUT_MS,
    });
    return Promise.resolve({ code: result.status, stdout: result.stdout });
  };
}

async function runCodex(
  job: ReviewJob,
  input: string,
  options: VendorRunnerOptions,
  spawn: RawSpawn,
): Promise<VendorRunResult> {
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
  const writeFile =
    options.writeFile ??
    ((path: string, body: string) => {
      writeFileSync(path, body);
    });
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf8'));

  return runCodexHeadlessExtractionChecked<Review | undefined>(
    input,
    {
      spawn: spawnAdapter('codex', spawn),
      writeFile,
      readFile,
      env: options.env,
      cwd: options.cwd,
      model: options.model,
      schemaPath: nodePath.join(workspace, 'review-schema.json'),
      outputPath: nodePath.join(workspace, 'review.json'),
      // The review job's three divergences from retro's, all deliberate:
      mcpServers: options.mcpServers,
      sandbox: options.executionTier === 'execute' ? 'workspace-write' : 'read-only',
      // We run INSIDE the checkout, unlike retro's neutral temp cwd.
      skipGitRepoCheck: false,
    },
    job,
  );
}

async function runClaude(
  job: ReviewJob,
  input: string,
  options: VendorRunnerOptions,
  spawn: RawSpawn,
): Promise<VendorRunResult> {
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));

  // The Claude path is fail-OPEN by construction (it returns the job's
  // fallback), so `undefined` back is what "no usable review" looks like here.
  const output = await runHeadlessExtraction<Review | undefined>(
    input,
    {
      spawn: spawnAdapter('claude', spawn),
      writeDigest: (digest: string) => {
        const path = nodePath.join(workspace, 'review-input.md');
        writeFileSync(path, digest);
        return path;
      },
      env: options.env,
      cwd: options.cwd,
      model: options.model,
      allowedTools: claudeToolsFor(options.executionTier, options.mcpToolGrant),
      mcpConfigPath: options.mcpConfigPath,
    },
    job,
  );

  return output === undefined
    ? { ok: false, failureReason: 'invalid_output', findings: [] }
    : { ok: true, output, findings: output.findings };
}

/**
 * The `--allowed-tools` grant for the Claude reviewer, tiered by execution
 * trust — the codex path does the same through its `--sandbox` value.
 *
 * `execute` (a trusted, same-repo change) gets the full set, because the review
 * that matters runs the project's own suite (R13's fix gate, R17) and researches
 * a new dependency's freshness. `degrade` (a fork) is read-only: reading the tree
 * is always safe, but executing it while a credential is present is the exact
 * pwn-request act SM1.R3 forbids. Grep/Glob are reads and stay; Bash does not.
 */
function claudeToolsFor(tier: ExecutionTier, mcpToolGrant?: string): string {
  const readOnly = ['Read', 'Grep', 'Glob'];
  const base = tier === 'execute' ? [...readOnly, 'Bash', 'WebSearch', 'WebFetch'] : readOnly;
  // The tracker read (R6) is safe in BOTH tiers — reading an issue as the PR
  // author is identity, not execution — so the MCP grant is not gated by trust.
  return (mcpToolGrant === undefined ? base : [...base, mcpToolGrant]).join(',');
}
