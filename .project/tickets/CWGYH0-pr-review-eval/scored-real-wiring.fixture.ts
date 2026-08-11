import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { loadPinnedAdapter } from "./scored-adapter";
import { freezeFixtureArtifacts } from "./scored-manifest.fixture";
import {
	beginProvisionalCase,
	executeCaseWork,
} from "./scored-case-store";
import { classifyTrialOutput } from "./scored-run-policy";

function git(root: string, ...arguments_: string[]): string {
	return execFileSync("git", arguments_, { cwd: root, encoding: "utf8" }).trim();
}

const safewordRoot = resolve(import.meta.dirname, "../../..");
const adapterRoot = process.env.CWGYH0_ADAPTER_ROOT ??
	join(dirname(safewordRoot), "arcade-pr-review");
const { createRunnerExecutor } = await loadPinnedAdapter({
	adapterRoot,
	expectedCommit: "d7baf0333001dcd462a12111351dc68757af605c",
});

const root = mkdtempSync(join(tmpdir(), "cwgyh0-real-wiring-"));
try {
	git(root, "init");
	git(root, "config", "user.email", "benchmark@example.com");
	git(root, "config", "user.name", "Benchmark Test");
	mkdirSync(join(root, "src"));
	writeFileSync(join(root, "src", "example.ts"), "export const value = 1;\n");
	git(root, "add", ".");
	git(root, "commit", "-m", "base");
	const reviewBaseSha = git(root, "rev-parse", "HEAD");
	git(root, "update-ref", "refs/remotes/origin/eval-base", reviewBaseSha);
	writeFileSync(join(root, "src", "example.ts"), "export const value = 2;\n");
	git(root, "commit", "-am", "buggy change");
	const sourceSha = git(root, "rev-parse", "HEAD");

	const expertsDir = join(root, "experts");
	mkdirSync(expertsDir);
	const expert = (lane: string) =>
		`---\nlane: ${lane}\nprovider: anthropic\nmodel: claude-sonnet-5\neffort: low\nmaxOutputTokens: 100\n---\n\nReview the change.`;
	writeFileSync(join(expertsDir, "correctness.md"), expert("correctness"));
	writeFileSync(join(expertsDir, "verifier.md"), expert("verifier"));

	const raw = JSON.stringify({ error: { message: "overloaded" }, type: "error" });
	globalThis.fetch = Object.assign(
		() =>
			Promise.resolve(
				new Response(raw, {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		{ preconnect: () => undefined },
	) as typeof fetch;
	process.env.ANTHROPIC_API_KEY = "network-boundary-test";

	const reviewInput = {
		caseId: "SCORE-real-wiring",
		causalPaths: ["src/example.ts"],
		failureDescription: {
			consequenceAliases: ["wrong value"],
			mechanismAliases: ["changes the value"],
		},
		modelCutoff: "2026-01-31T00:00:00.000Z",
		reviewBaseSha,
		runnerRef: "codex/cwgyh0-dev-benchmark-adapter@d7baf0333",
		sourceSha,
		variant: "buggy" as const,
	};
	const execute = createRunnerExecutor({
		env: { ANTHROPIC_API_KEY: "network-boundary-test" },
		expertsDir,
		forceExpertLane: "correctness",
		policy: {
			maxVerifications: 2,
			toolCallsPerExpert: 3,
			wallClockMsPerExpert: 4_000,
		},
		targetFor: () => ({ baseRef: "eval-base", root }),
	});
	const output = await execute(reviewInput);
	const outcome = (output.report as {
		expertOutcomes: Array<{ failure: { raw?: string } | null }>;
	}).expertOutcomes[0];
	assert.equal(outcome?.failure?.raw, raw);

	const outputRoot = join(root, "output");
	const caseState = beginProvisionalCase({
		caseId: reviewInput.caseId,
		ordinal: 1,
		outputRoot,
	});
	const result = await executeCaseWork({
		caseState,
		classify: (value) =>
			classifyTrialOutput(value, {
				expert: "correctness",
				model: "claude-sonnet-5",
				provider: "anthropic",
			}, {
				caseId: reviewInput.caseId,
				reviewBaseSha: reviewInput.reviewBaseSha,
				runnerRef: reviewInput.runnerRef,
				sourceSha: reviewInput.sourceSha,
				variant: reviewInput.variant,
			}),
		execute: async () => output,
		outputRoot,
		reserveIds: ["RESERVE-A"],
		state: {
			candidateQueueIds: [],
			currentCaseId: reviewInput.caseId,
			nextWorkIndex: 0,
			reserveIndex: 0,
			version: 3,
		},
		workId: "full--buggy--t1",
	});
	assert.equal(result.status, "excluded");
	if (result.status !== "excluded") throw new Error("expected exclusion");
	assert.equal(result.result.disposition?.reason, "provider-failure");
	assert.equal(existsSync(caseState.activePath), false);
	const quarantined = readdirSync(caseState.quarantinePath).sort();
	assert.deepEqual(quarantined, [
		"EXCLUSION.json",
		"full--buggy--t1--attempt-1.json",
	]);
	assert.match(
		readFileSync(join(caseState.quarantinePath, quarantined[1]!), "utf8"),
		/overloaded/,
	);
	const preflightPath = join(outputRoot, "preflight.json");
	const preflightId = "hidden-failure-wiring-preflight";
	const sourceRepositoryIdentity = "local-hidden-failure-wiring-repository";
	const preflightBytes = `${JSON.stringify({
		preflightId,
		preflightedRepositories: 4,
		primaryCases: [reviewInput.caseId],
		reserveCases: ["RESERVE-A"],
		sourceRepositoryIdentity,
		status: "passed",
	})}\n`;
	writeFileSync(preflightPath, preflightBytes);
	writeFileSync(join(outputRoot, "run-summary.json"), `${JSON.stringify({
		completedCaseIds: ["RESERVE-A"],
		exclusions: [{ caseId: reviewInput.caseId, replacementId: "RESERVE-A" }],
		preflightId,
		preflightSha256: createHash("sha256").update(preflightBytes).digest("hex"),
		primaryCases: [reviewInput.caseId],
		reserveCases: ["RESERVE-A"],
		sourceRepositoryIdentity,
		status: "completed",
	})}\n`);
	const resultsPath = join(outputRoot, "results.json");
	const manifestEnvironment = freezeFixtureArtifacts({
		gitRoot: join(root, "manifest-repository"),
		outputRoot,
		repositoryIdentity: "https://example.test/hidden-failure-manifest.git",
	});
	const scorer = spawnSync("bun", [
		"--preload",
		join(import.meta.dirname, "scored-live-fetch-preload.fixture.ts"),
		join(import.meta.dirname, "score-results.ts"),
		outputRoot,
		resultsPath,
		"",
		preflightPath,
	], { encoding: "utf8", env: { ...process.env, ...manifestEnvironment } });
	assert.notEqual(scorer.status, 0);
	assert.match(scorer.stderr, /one frozen case missing entirely/);
	assert.equal(existsSync(resultsPath), false);
} finally {
	rmSync(root, { force: true, recursive: true });
}
