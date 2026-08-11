import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

function git(root: string, ...args: string[]): string {
	return execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" }).trim();
}

function sha256(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

const ticketRoot = import.meta.dirname;
const safewordRoot = resolve(ticketRoot, "../../..");
const adapterRoot = join(dirname(safewordRoot), "arcade-pr-review");
const expectedAdapterCommit = "3eb8652324c755ce2fc806b6ab5d3d41c1f1a39f";
assert.equal(git(adapterRoot, "rev-parse", "HEAD"), expectedAdapterCommit);

const primaryPath = join(ticketRoot, "scored-cases-frozen-2026-08-01.json");
const reservePath = join(ticketRoot, "reserve-cases-frozen-2026-08-01.json");
const primary = JSON.parse(readFileSync(primaryPath, "utf8")) as {
	cases: Array<{ id: string }>;
};
const reserve = JSON.parse(readFileSync(reservePath, "utf8")) as {
	cases: Array<{ id: string }>;
};
const sourceRepositoryIdentity = git(adapterRoot, "remote", "get-url", "origin");
const preflightId = "live-entry-no-cost-preflight";
const preflight = {
	aggregateCostStopUsd: 1_000,
	expectedAdapterCommit,
	expectedRunnerRef: "codex/cwgyh0-dev-benchmark-adapter@3eb865232",
	expectedHashes: {
		primaryManifest: sha256(primaryPath),
		reserveManifest: sha256(reservePath),
		fullCorrectness: sha256(join(ticketRoot, "scored-prompts/full/correctness.md")),
		fullVerifier: sha256(join(ticketRoot, "scored-prompts/full/verifier.md")),
		narrowCorrectness: sha256(join(ticketRoot, "scored-prompts/narrow/correctness.md")),
		narrowVerifier: sha256(join(ticketRoot, "scored-prompts/narrow/verifier.md")),
	},
	inputPricePerMillionUsd: 3,
	model: "claude-sonnet-5",
	outputPricePerMillionUsd: 15,
	policy: {
		maxVerifications: 25,
		toolCallsPerExpert: 40,
		wallClockMsPerExpert: 360_000,
	},
	preflightId,
	preflightedRepositories: 80,
	preregisteredRunnerRef: "codex/cwgyh0-dev-benchmark-adapter@8d86720c0",
	primaryCases: primary.cases.map(({ id }) => id),
	reserveCases: reserve.cases.map(({ id }) => id),
	seed: 5_453_573,
	sourceRepositoryIdentity,
	status: "passed",
	trials: 3,
};

const root = mkdtempSync(join(tmpdir(), "cwgyh0-live-entry-"));
try {
	const outputRoot = join(root, "output");
	const preflightPath = join(root, "preflight.json");
	const fetchLog = join(root, "fetch.log");
	const preflightBytes = `${JSON.stringify(preflight, null, 2)}\n`;
	writeFileSync(preflightPath, preflightBytes);
	const rejectionReasons = [
		"provider-failure",
		"incomplete-provider-output",
		"unexpected-finish",
		"schema-invalid",
		"routing-invalid",
		"reviewer-failed",
		"provenance-incomplete",
		"provenance-mismatch",
		"unknown-state",
	];
	const operationalClasses = [
		"retry-success",
		"retry-exhaustion",
		"semantic-after-retry",
		"early-failure",
		"atomic-quarantine",
		"crash-recovery",
		"reserve-order",
		"reserve-exhaustion",
	];
	const run = (input: {
		fetchLog: string;
		mode?: string;
		outputRoot: string;
		scratchName: string;
	}) => {
		const checkpointId = "no-cost-fixture";
		const runId = `fixture-${sha256Text(input.outputRoot)}`;
		const gatePath = join(root, `${sha256Text(input.outputRoot)}.gate.json`);
		const expectedBindings = {
			adapter: sha256Text(expectedAdapterCommit),
			classifier: sha256(join(ticketRoot, "scored-run-policy.ts")),
			preflight: sha256Text(preflightBytes),
			primaryManifest: sha256(primaryPath),
			reserveManifest: sha256(reservePath),
			runner: sha256(join(ticketRoot, "scored-live-run.ts")),
			runIdentity: sha256Text(JSON.stringify({ checkpointId, outputRoot: resolve(input.outputRoot), preflightId, runId })),
			scorer: sha256(join(ticketRoot, "score-results.ts")),
			writer: sha256(join(ticketRoot, "scored-case-store.ts")),
		};
		writeFileSync(gatePath, `${JSON.stringify({
			attempts: [{ attemptId: "fixture-attempt", costComplete: true, costUsd: 0, usable: true }],
			expectedBindings,
			fixtures: rejectionReasons.map((reason) => ({ expectedReason: reason, fixtureId: `fixture-${reason}`, observedReason: reason })),
			hiddenFailureRejected: true,
			nextCheckpoint: checkpointId,
			observedBindings: expectedBindings,
			operational: operationalClasses.map((failureClass) => ({ failureClass, passed: true, scenarioId: `scenario-${failureClass}` })),
			paidOutcomes: Array.from({ length: 10 }, (_, index) => ({
				callId: `fixture-call-${index + 1}`,
				costComplete: true,
				costUsd: 0,
				expectedLabel: index === 0 ? "finding" : index === 1 ? "genuine-empty" : "clean",
				observedLabel: index === 0 ? "finding" : index === 1 ? "genuine-empty" : "clean",
				provenanceComplete: true,
				system: index % 2 === 0 ? "full" : "narrow",
				usageCostUsd: 0,
				usable: true,
				variant: index % 4 < 2 ? "buggy" : "fixed",
			})),
			runId,
		}, null, 2)}\n`);
		return execFileSync(
			process.execPath,
			[
				"--preload",
				join(ticketRoot, "scored-live-fetch-preload.fixture.ts"),
				join(ticketRoot, "scored-live-run.ts"),
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					ANTHROPIC_API_KEY: "network-boundary-test",
					CWGYH0_ADAPTER_ROOT: adapterRoot,
					CWGYH0_CANARY_GATE_PATH: gatePath,
					CWGYH0_CASE_TARGET: "1",
					CWGYH0_CHECKPOINT_ID: checkpointId,
					CWGYH0_FETCH_LOG: input.fetchLog,
					CWGYH0_FETCH_MODE: input.mode,
					CWGYH0_OUTPUT_ROOT: input.outputRoot,
					CWGYH0_PREFLIGHT_PATH: preflightPath,
					CWGYH0_SCRATCH_ROOT: join(root, input.scratchName),
					CWGYH0_SOURCE_REPOSITORY: adapterRoot,
				},
				stdio: "pipe",
			},
		);
	};

	assert.match(
		run({ fetchLog, outputRoot, scratchName: "scratch-first" }),
		/checkpoint: 1\/30 cases/,
	);
	const summary = JSON.parse(
		readFileSync(join(outputRoot, "run-summary.json"), "utf8"),
	) as { completedCases: number; status: string };
	assert.equal(summary.completedCases, 1);
	assert.equal(summary.status, "checkpoint");
	const activeCases = readdirSync(join(outputRoot, "active"));
	assert.equal(activeCases.length, 1);
	assert.equal(
		readdirSync(join(outputRoot, "active", activeCases[0]!)).filter((name) =>
			name.endsWith("--record.json"),
		).length,
		12,
	);
	assert.equal(readFileSync(fetchLog, "utf8").trim().split("\n").length, 24);

	assert.match(
		run({ fetchLog, outputRoot, scratchName: "scratch-resume" }),
		/checkpoint: 1\/30 cases/,
	);
	assert.equal(readFileSync(fetchLog, "utf8").trim().split("\n").length, 24);

	const failureOutputRoot = join(root, "failure-output");
	const failureFetchLog = join(root, "failure-fetch.log");
	assert.match(
		run({
			fetchLog: failureFetchLog,
			mode: "first-schema-failure",
			outputRoot: failureOutputRoot,
			scratchName: "scratch-failure",
		}),
		/checkpoint: 1\/30 cases with 1 exclusion/,
	);
	const failureSummary = JSON.parse(
		readFileSync(join(failureOutputRoot, "run-summary.json"), "utf8"),
	) as { completedCases: number; exclusions: unknown[] };
	assert.equal(failureSummary.completedCases, 1);
	assert.equal(failureSummary.exclusions.length, 1);
	assert.equal(readdirSync(join(failureOutputRoot, "quarantine")).length, 1);
	assert.equal(
		readFileSync(failureFetchLog, "utf8").trim().split("\n").length,
		25,
		"one failed fetch plus one replacement case; no pending sibling from the failed case ran",
	);
} finally {
	rmSync(root, { force: true, recursive: true });
}
