import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunnerExecutor } from "/Users/alex/.codex/worktrees/ec04/arcade-pr-review/tools/pr-review/src/eval/development-benchmark.ts";
import {
	beginProvisionalCase,
	commitAdmittedCaseWork,
	sealActiveCase,
} from "./scored-case-store";
import {
	classifyTrialOutput,
	executeWithInfrastructureRetry,
} from "./scored-run-policy";

function git(root: string, ...arguments_: string[]): string {
	return execFileSync("git", arguments_, { cwd: root, encoding: "utf8" }).trim();
}

const root = mkdtempSync(join(tmpdir(), "cwgyh0-success-wiring-"));
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
	const buggySha = git(root, "rev-parse", "HEAD");
	writeFileSync(join(root, "src", "example.ts"), "export const value = 3;\n");
	git(root, "commit", "-am", "fixed change");
	const fixedSha = git(root, "rev-parse", "HEAD");

	const expertsDir = join(root, "experts");
	mkdirSync(expertsDir);
	const expert = (lane: string) =>
		`---\nlane: ${lane}\nprovider: anthropic\nmodel: claude-sonnet-5\neffort: low\nmaxOutputTokens: 100\n---\n\nReview the change.`;
	writeFileSync(join(expertsDir, "correctness.md"), expert("correctness"));
	writeFileSync(join(expertsDir, "verifier.md"), expert("verifier"));

	let providerTurn = 0;
	globalThis.fetch = Object.assign(
		() => {
			providerTurn += 1;
			const content = providerTurn % 2 === 1
				? [{
					id: `read-${providerTurn}`,
					input: { path: "src/example.ts" },
					name: "read_file",
					type: "tool_use",
				}]
				: [{
					id: `report-${providerTurn}`,
					input: {
						couldNotVerify: [],
						findings: [],
						summary: "No findings.",
					},
					name: "report_findings",
					type: "tool_use",
				}];
			return Promise.resolve(
				new Response(
					JSON.stringify({
						content,
						stop_reason: "tool_use",
						usage: { input_tokens: 10, output_tokens: 5 },
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		},
		{ preconnect: () => undefined },
	) as typeof fetch;
	process.env.ANTHROPIC_API_KEY = "network-boundary-test";

	const caseId = "SCORE-success-wiring";
	const runnerRef = "codex/cwgyh0-dev-benchmark-adapter@3eb865232";
	const execute = createRunnerExecutor({
		env: { ANTHROPIC_API_KEY: "network-boundary-test" },
		expertsDir,
		forceExpertLane: "correctness",
		policy: {
			maxVerifications: 2,
			toolCallsPerExpert: 3,
			wallClockMsPerExpert: 4_000,
		},
		targetFor: (input) => {
			git(root, "checkout", "--detach", input.sourceSha);
			return { baseRef: "eval-base", root };
		},
	});
	const outputRoot = join(root, "output");
	const caseState = beginProvisionalCase({ caseId, ordinal: 1, outputRoot });
	const statePath = join(outputRoot, "run-state.json");
	let nextWorkIndex = 0;
	for (const system of ["full", "narrow"] as const) {
		for (const variant of ["buggy", "fixed"] as const) {
			for (const trial of [1, 2, 3]) {
				const reviewInput = {
					caseId,
					causalPaths: ["src/example.ts"],
					failureDescription: {
						consequenceAliases: ["wrong value"],
						mechanismAliases: ["changes the value"],
					},
					modelCutoff: "2026-01-31T00:00:00.000Z",
					reviewBaseSha,
					runnerRef,
					sourceSha: variant === "buggy" ? buggySha : fixedSha,
					variant,
				};
				const result = await executeWithInfrastructureRetry(
					() => execute(reviewInput),
					(output) => classifyTrialOutput(output, {
						expert: "correctness",
						model: "claude-sonnet-5",
						provider: "anthropic",
					}, {
						caseId,
						reviewBaseSha,
						runnerRef,
						sourceSha: reviewInput.sourceSha,
						variant,
					}),
				);
				assert.equal(result.status, "completed");
				if (result.status !== "completed") throw new Error("expected completion");
				const output = result.value;
				assert.equal(
					classifyTrialOutput(output, {
						expert: "correctness",
						model: "claude-sonnet-5",
						provider: "anthropic",
					}, {
						caseId,
						reviewBaseSha,
						runnerRef,
						sourceSha: reviewInput.sourceSha,
						variant,
					}).status,
					"usable",
				);
				nextWorkIndex += 1;
				commitAdmittedCaseWork({
					caseState,
					state: { nextWorkIndex },
					statePath,
					workId: `${system}--${variant}--t${trial}`,
					record: {
					...reviewInput,
					attemptRecords: result.attemptRecords,
					attempts: result.attempts,
					output,
					system,
					trial,
					},
				});
			}
		}
	}
	sealActiveCase(caseState);
	assert.equal(
		(JSON.parse(readFileSync(statePath, "utf8")) as { nextWorkIndex: number }).nextWorkIndex,
		12,
	);

	const preflightPath = join(outputRoot, "preflight.json");
	const preflightId = "success-wiring-preflight";
	const sourceRepositoryIdentity = "local-success-wiring-repository";
	const preflightBytes = `${JSON.stringify({
			preflightId,
			preflightedRepositories: 2,
			primaryCases: [caseId],
			reserveCases: [],
			sourceRepositoryIdentity,
			status: "passed",
		})}\n`;
	writeFileSync(preflightPath, preflightBytes);
	writeFileSync(
		join(outputRoot, "run-summary.json"),
		`${JSON.stringify({
			completedCaseIds: [caseId],
			exclusions: [],
			preflightId,
			preflightSha256: createHash("sha256").update(preflightBytes).digest("hex"),
			primaryCases: [caseId],
			reserveCases: [],
			sourceRepositoryIdentity,
			status: "completed",
		})}\n`,
	);
	const resultsPath = join(outputRoot, "results.json");
	execFileSync(
		"bun",
		[
			join(import.meta.dirname, "score-results.ts"),
			outputRoot,
			resultsPath,
			"",
			preflightPath,
		],
		{ encoding: "utf8" },
	);
	const results = JSON.parse(readFileSync(resultsPath, "utf8")) as {
		caseRows: unknown[];
		gates: { allCasesComplete: boolean; contaminationPreflightPassed: boolean };
		silence: { full: { buggy: { total: number } } };
	};
	assert.equal(results.gates.allCasesComplete, true);
	assert.equal(results.gates.contaminationPreflightPassed, true);
	assert.equal(results.caseRows.length, 1);
	assert.equal(results.silence.full.buggy.total, 3);
} finally {
	rmSync(root, { force: true, recursive: true });
}
