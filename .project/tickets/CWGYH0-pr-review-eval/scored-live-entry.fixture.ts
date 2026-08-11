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

import {
	freezeFixtureArtifacts,
	freezeFixtureBlob,
} from "./scored-manifest.fixture";

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
const expectedAdapterCommit = "d7baf0333001dcd462a12111351dc68757af605c";
assert.equal(git(adapterRoot, "rev-parse", "HEAD"), expectedAdapterCommit);

const primaryPath = join(ticketRoot, "scored-cases-frozen-2026-08-01.json");
const reservePath = join(ticketRoot, "reserve-cases-frozen-2026-08-01.json");
type FixtureCase = {
	baseSha: string;
	fixedSha: string;
	id: string;
	reviewBaseSha: string;
	testPatchSha: string;
};
const primary = JSON.parse(readFileSync(primaryPath, "utf8")) as {
	cases: FixtureCase[];
	modelCutoff: string;
	runnerRef: string;
};
const reserve = JSON.parse(readFileSync(reservePath, "utf8")) as {
	cases: FixtureCase[];
	modelCutoff: string;
	runnerRef: string;
};
const sourceRepositoryIdentity = git(adapterRoot, "remote", "get-url", "origin");
const preflightId = "live-entry-no-cost-preflight";
const preflight = {
	aggregateCostStopUsd: 1_000,
	expectedAdapterCommit,
	expectedRunnerRef: "codex/cwgyh0-dev-benchmark-adapter@d7baf0333",
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
	const fixturePrimaryPath = join(root, "primary.json");
	const fixtureReservePath = join(root, "reserve.json");
	const fixturePrimary = {
		...primary,
		cases: [primary.cases[0]],
	};
	const fixtureReserve = {
		...reserve,
		cases: [reserve.cases[0]],
	};
	writeFileSync(fixturePrimaryPath, `${JSON.stringify(fixturePrimary, null, 2)}\n`);
	writeFileSync(fixtureReservePath, `${JSON.stringify(fixtureReserve, null, 2)}\n`);
	const corpusRolePath = join(root, "corpus-role.json");
	const corpusRoleBytes = `${JSON.stringify({
		developmentCaseIds: ["development-only"],
		minimumPoweredCases: 1,
		preregisteredAt: "2026-07-01T00:00:00.000Z",
		primaryCaseIds: fixturePrimary.cases.map(({ id }) => id),
		reserveCaseIds: fixtureReserve.cases.map(({ id }) => id),
		role: "confirmatory",
		voidForInstrumentFailure: false,
	}, null, 2)}\n`;
	writeFileSync(corpusRolePath, corpusRoleBytes);
	const preflightPath = join(root, "preflight.json");
	const fetchLog = join(root, "fetch.log");
	const fixturePreflight = {
		...preflight,
		expectedHashes: {
			...preflight.expectedHashes,
			primaryManifest: sha256(fixturePrimaryPath),
			reserveManifest: sha256(fixtureReservePath),
		},
		expectedPrimaryCaseCount: 1,
		expectedReserveCaseCount: 1,
		preflightedRepositories: 4,
		primaryCases: [primary.cases[0]!.id],
		reserveCases: [reserve.cases[0]!.id],
	};
	const preflightBytes = `${JSON.stringify(fixturePreflight, null, 2)}\n`;
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
	const gateByOutput = new Map<string, {
		anchorResponses: string;
		anchorUrl: string;
		gitRoot: string;
		labelAnchorUrl: string;
		labelGitRoot: string;
	}>();
	const run = (input: {
		fetchLog: string;
		mode?: string;
		outputRoot: string;
		scratchName: string;
	}) => {
		const checkpointId = "no-cost-fixture";
		const runId = `fixture-${sha256Text(input.outputRoot)}`;
		const gateGitRoot = join(root, `${sha256Text(input.outputRoot)}-gate-repository`);
		const labelGitRoot = join(root, `${sha256Text(input.outputRoot)}-label-repository`);
		const labelCreatedAt = new Date(Date.now() - 5_000).toISOString();
		const labelAnchorCreatedAt = new Date(Date.now() - 4_000).toISOString();
		const recordedAt = new Date(Date.now() - 3_000).toISOString();
		const gateAnchorCreatedAt = new Date(Date.now() - 2_000).toISOString();
		const fixtures = rejectionReasons.map((reason) => ({ expectedReason: reason, fixtureId: `fixture-${reason}`, observedReason: reason, recordedAt }));
		const operational = operationalClasses.map((failureClass) => ({ failureClass, passed: true, recordedAt, scenarioId: `scenario-${failureClass}` }));
		const paidOutcomes = Array.from({ length: 10 }, (_, index) => ({
			attemptIds: [`fixture-attempt-${index + 1}`],
			callId: `fixture-call-${index + 1}`,
			costComplete: true,
			costUsd: 0,
			provenanceComplete: true,
			recordedAt,
			system: index % 2 === 0 ? "full" : "narrow",
			usageCostUsd: 0,
			usable: true,
			variant: index % 4 < 2 ? "buggy" : "fixed",
		}));
		const preregisteredLabels = paidOutcomes.map((outcome, index) => ({
			callId: outcome.callId,
			expectedAdmission: "usable",
			expectedOutputClass: index === 0 ? "finding" : "empty",
			expectedReason: "completed",
			genuineEmpty: index === 1,
			system: outcome.system,
			variant: outcome.variant,
		}));
		const canaryAttempts = paidOutcomes.map((outcome, index) => {
			const findings = index === 0
				? [{ file: "src/example.ts", line: 1, title: "finding" }]
				: [];
			const expectedProvenance = {
				caseId: `canary-${index + 1}`,
				reviewBaseSha: `base-${index + 1}`,
				runnerRef: "codex/cwgyh0-dev-benchmark-adapter@d7baf0333",
				sourceSha: `source-${index + 1}`,
				variant: outcome.variant,
			};
			const expectedRoute = {
				expert: "correctness",
				model: "claude-sonnet-5",
				provider: "anthropic",
			};
			const toolCall = {
				args: { path: "src/example.ts" },
				name: "read_file",
				ok: true,
				path: "src/example.ts",
				summary: "10 line(s)",
			};
			return {
				attempt: 1,
				attemptId: `fixture-attempt-${index + 1}`,
				callId: outcome.callId,
				costComplete: true,
				costUsd: 0,
				expectedProvenance,
				expectedRoute,
				output: {
					models: [expectedRoute],
					provenance: expectedProvenance,
					report: {
						consolidated: { findings },
						expertOutcomes: [{
							...expectedRoute,
							cappedBy: null,
							couldNotVerify: [],
							error: null,
							failure: null,
							findings,
							providerResponses: [{
								raw: JSON.stringify({
									content: [{
										input: { couldNotVerify: [], findings, summary: "Complete." },
										name: "report_findings",
										type: "tool_use",
									}],
									stop_reason: "tool_use",
									usage: { input_tokens: 10, output_tokens: 5 },
								}),
								stopReason: "tool_use",
							}],
							summary: "Complete.",
							toolCalls: [toolCall],
							turns: 1,
							usage: { inputTokens: 10, outputTokens: 5 },
						}],
						usage: { inputTokens: 10, outputTokens: 5 },
					},
					score: {
						matchingFindings: findings,
						namedFailure: findings.length > 0,
						reviewValid: true,
					},
					terminalState: "completed",
					trace: [toolCall],
				},
				system: outcome.system,
				usable: true,
			};
		});
		const labelBytes = `${JSON.stringify({
			createdAt: labelCreatedAt,
			labels: preregisteredLabels,
		}, null, 2)}\n`;
		const expectedBindings = {
			adapter: sha256Text(expectedAdapterCommit),
			classifier: sha256(join(ticketRoot, "scored-run-policy.ts")),
			corpusRole: sha256Text(corpusRoleBytes),
			costPolicy: sha256Text(JSON.stringify({
				aggregateCostStopUsd: 1_000,
				cumulativeCostTargetUsd: 1_000,
				inputPricePerMillionUsd: 3,
				outputPricePerMillionUsd: 15,
			})),
			effectiveMatrixDeriver: sha256(join(ticketRoot, "scored-matrix.ts")),
			fixtures: sha256Text(JSON.stringify({ fixtures, operational })),
			labels: sha256Text(labelBytes),
			preflight: sha256Text(preflightBytes),
			preregisteredMatrix: sha256Text(JSON.stringify({
				primaryCaseIds: fixturePrimary.cases.map(({ id }) => id),
				reserveCaseIds: fixtureReserve.cases.map(({ id }) => id),
				seed: 5_453_573,
				systems: ["full", "narrow"],
				trials: 3,
				variants: ["buggy", "fixed"],
			})),
			primaryManifest: sha256(fixturePrimaryPath),
			providerConfiguration: sha256Text(JSON.stringify({
				expectedRoute: { expert: "correctness", model: "claude-sonnet-5", provider: "anthropic" },
				model: "claude-sonnet-5",
				policy: preflight.policy,
			})),
			reserveManifest: sha256(fixtureReservePath),
			runner: sha256(join(ticketRoot, "scored-live-run.ts")),
			runIdentity: sha256Text(JSON.stringify({
				checkpointId,
				cumulativeCaseTarget: 1,
				cumulativeCostTargetUsd: 1_000,
				outputRoot: resolve(input.outputRoot),
				preflightId,
				runId,
			})),
			scorer: sha256(join(ticketRoot, "score-results.ts")),
			sourceCommits: sha256Text(JSON.stringify(
				[...fixturePrimary.cases, ...fixtureReserve.cases].map((item) => ({
					baseSha: item.baseSha,
					fixedSha: item.fixedSha,
					id: item.id,
					reviewBaseSha: item.reviewBaseSha,
					testPatchSha: item.testPatchSha,
				})),
			)),
			writer: sha256(join(ticketRoot, "scored-case-store.ts")),
		};
		let gateEnvironment = gateByOutput.get(input.outputRoot);
		if (gateEnvironment === undefined) {
			const frozenLabels = freezeFixtureBlob({
				anchorCreatedAt: labelAnchorCreatedAt,
				blobPath: "labels.json",
				bytes: labelBytes,
				digestPath: "labels.sha256",
				gitRoot: labelGitRoot,
				marker: "canary-labels",
				repositoryIdentity: "https://example.test/canary-labels.git",
			});
			const gateBytes = `${JSON.stringify({
				anchorCreatedAt: recordedAt,
				attempts: canaryAttempts,
				expectedBindings,
				fixtures,
				hiddenFailureRejected: true,
				nextCheckpoint: checkpointId,
				observedBindings: expectedBindings,
				operational,
				paidOutcomes,
				runId,
			}, null, 2)}\n`;
			const frozen = freezeFixtureBlob({
				anchorCreatedAt: gateAnchorCreatedAt,
				blobPath: "gate.json",
				bytes: gateBytes,
				digestPath: "gate.sha256",
				gitRoot: gateGitRoot,
				marker: "canary",
				repositoryIdentity: "https://example.test/canary-gate.git",
			});
			gateEnvironment = {
				anchorResponses: JSON.stringify({
					[frozen.CWGYH0_RAW_MANIFEST_ANCHOR_URL]: frozen.CWGYH0_ANCHOR_RESPONSE,
					[frozenLabels.CWGYH0_RAW_MANIFEST_ANCHOR_URL]: frozenLabels.CWGYH0_ANCHOR_RESPONSE,
				}),
				anchorUrl: frozen.CWGYH0_RAW_MANIFEST_ANCHOR_URL,
				gitRoot: gateGitRoot,
				labelAnchorUrl: frozenLabels.CWGYH0_RAW_MANIFEST_ANCHOR_URL,
				labelGitRoot,
			};
			gateByOutput.set(input.outputRoot, gateEnvironment);
		}
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
					CWGYH0_ANCHOR_RESPONSES: gateEnvironment.anchorResponses,
					CWGYH0_CANARY_GATE_ANCHOR_URL: gateEnvironment.anchorUrl,
					CWGYH0_CANARY_GATE_GIT_ROOT: gateEnvironment.gitRoot,
					CWGYH0_CANARY_LABEL_ANCHOR_URL: gateEnvironment.labelAnchorUrl,
					CWGYH0_CANARY_LABEL_GIT_ROOT: gateEnvironment.labelGitRoot,
					CWGYH0_CASE_TARGET: "1",
					CWGYH0_CHECKPOINT_ID: checkpointId,
					CWGYH0_CORPUS_ROLE_PATH: corpusRolePath,
					CWGYH0_FETCH_LOG: input.fetchLog,
					CWGYH0_FETCH_MODE: input.mode,
					CWGYH0_EXPECTED_PRIMARY_CASES: "1",
					CWGYH0_EXPECTED_RESERVE_CASES: "1",
					CWGYH0_OUTPUT_ROOT: input.outputRoot,
					CWGYH0_PRIMARY_MANIFEST_PATH: fixturePrimaryPath,
					CWGYH0_PRIMARY_MANIFEST_SHA256: sha256(fixturePrimaryPath),
					CWGYH0_PREFLIGHT_PATH: preflightPath,
					CWGYH0_RESERVE_MANIFEST_PATH: fixtureReservePath,
					CWGYH0_RESERVE_MANIFEST_SHA256: sha256(fixtureReservePath),
					CWGYH0_SCRATCH_ROOT: join(root, input.scratchName),
					CWGYH0_SOURCE_REPOSITORY: adapterRoot,
				},
				stdio: "pipe",
			},
		);
	};

	assert.match(
		run({ fetchLog, outputRoot, scratchName: "scratch-first" }),
		/completed: 1\/30 cases/,
	);
	const summary = JSON.parse(
		readFileSync(join(outputRoot, "run-summary.json"), "utf8"),
	) as { completedCases: number; status: string };
	assert.equal(summary.completedCases, 1);
	assert.equal(summary.status, "completed");
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
		/completed: 1\/30 cases/,
	);
	assert.equal(readFileSync(fetchLog, "utf8").trim().split("\n").length, 24);

	const exhaustedOutputRoot = join(root, "exhausted-output");
	const exhaustedFetchLog = join(root, "exhausted-fetch.log");
	assert.match(
		run({
			fetchLog: exhaustedFetchLog,
			mode: "all-schema-failure",
			outputRoot: exhaustedOutputRoot,
			scratchName: "scratch-exhausted",
		}),
		/failed-reserve-exhausted: 0\/30 cases with 2 exclusion\(s\)/,
	);
	const exhaustedSummary = JSON.parse(
		readFileSync(join(exhaustedOutputRoot, "run-summary.json"), "utf8"),
	) as {
		status: string;
		terminalFailure: { caseId: string; reason: string };
	};
	assert.equal(exhaustedSummary.status, "failed-reserve-exhausted");
	assert.equal(exhaustedSummary.terminalFailure.reason, "reserve-exhausted");
	assert.equal(readdirSync(join(exhaustedOutputRoot, "provisional")).length, 0);
	assert.equal(readdirSync(join(exhaustedOutputRoot, "quarantine")).length, 2);
	assert.equal(readFileSync(exhaustedFetchLog, "utf8").trim().split("\n").length, 2);

	const failureOutputRoot = join(root, "failure-output");
	const failureFetchLog = join(root, "failure-fetch.log");
	assert.match(
		run({
			fetchLog: failureFetchLog,
			mode: "first-provider-error",
			outputRoot: failureOutputRoot,
			scratchName: "scratch-failure",
		}),
		/completed: 1\/30 cases with 1 exclusion/,
	);
	const failureSummary = JSON.parse(
		readFileSync(join(failureOutputRoot, "run-summary.json"), "utf8"),
	) as {
		completedCases: number;
		exclusions: Array<{ caseId: string; replacementId: string }>;
	};
	assert.equal(failureSummary.completedCases, 1);
	assert.equal(failureSummary.exclusions.length, 1);
	assert.equal(readdirSync(join(failureOutputRoot, "quarantine")).length, 1);
	const failedAttemptPath = join(
		failureOutputRoot,
		"quarantine",
		readdirSync(join(failureOutputRoot, "quarantine"))[0]!,
		readdirSync(join(
			failureOutputRoot,
			"quarantine",
			readdirSync(join(failureOutputRoot, "quarantine"))[0]!,
		)).find((name) => name.endsWith("--attempt-1.json"))!,
	);
	const failedAttempt = JSON.parse(readFileSync(failedAttemptPath, "utf8")) as {
		disposition: { reason: string };
	};
	assert.equal(failedAttempt.disposition.reason, "provider-failure");
	assert.match(readFileSync(failedAttemptPath, "utf8"), /overloaded/);
	assert.equal(
		readFileSync(failureFetchLog, "utf8").trim().split("\n").length,
		25,
		"one failed fetch plus one replacement case; no pending sibling from the failed case ran",
	);
	const exclusion = failureSummary.exclusions[0]!;
	const scorerResultsPath = join(root, "failure-scorer-results.json");
	const manifestEnvironment = freezeFixtureArtifacts({
		gitRoot: join(root, "failure-manifest-repository"),
		outputRoot: failureOutputRoot,
		repositoryIdentity: "https://example.test/live-entry-manifest.git",
	});
	execFileSync("bun", [
		"--preload",
		join(ticketRoot, "scored-live-fetch-preload.fixture.ts"),
		join(ticketRoot, "score-results.ts"),
		failureOutputRoot,
		scorerResultsPath,
		"",
		preflightPath,
	], {
		encoding: "utf8",
		env: { ...process.env, ...manifestEnvironment },
		stdio: "pipe",
	});
	const scorerResults = JSON.parse(readFileSync(scorerResultsPath, "utf8")) as {
		caseRows: Array<{ caseId: string }>;
		exclusions: Array<{ caseId: string; replacementId: string }>;
	};
	assert.deepEqual(scorerResults.exclusions, [exclusion]);
	assert.deepEqual(scorerResults.caseRows.map(({ caseId }) => caseId), [
		exclusion.replacementId,
	]);

	const retainedRolePath = join(failureOutputRoot, "corpus-role.json");
	const voidRole = JSON.parse(readFileSync(retainedRolePath, "utf8")) as {
		voidForInstrumentFailure: boolean;
	};
	voidRole.voidForInstrumentFailure = true;
	const voidRoleBytes = `${JSON.stringify(voidRole, null, 2)}\n`;
	writeFileSync(retainedRolePath, voidRoleBytes);
	const failureSummaryPath = join(failureOutputRoot, "run-summary.json");
	const voidSummary = JSON.parse(readFileSync(failureSummaryPath, "utf8")) as {
		corpusRoleSha256: string;
	};
	voidSummary.corpusRoleSha256 = sha256Text(voidRoleBytes);
	writeFileSync(failureSummaryPath, `${JSON.stringify(voidSummary, null, 2)}\n`);
	const voidManifestEnvironment = freezeFixtureArtifacts({
		gitRoot: join(root, "void-manifest-repository"),
		outputRoot: failureOutputRoot,
		repositoryIdentity: "https://example.test/void-manifest.git",
	});
	assert.throws(
		() => execFileSync("bun", [
			"--preload",
			join(ticketRoot, "scored-live-fetch-preload.fixture.ts"),
			join(ticketRoot, "score-results.ts"),
			failureOutputRoot,
			join(root, "void-scorer-results.json"),
		], {
			encoding: "utf8",
			env: { ...process.env, ...voidManifestEnvironment },
			stdio: "pipe",
		}),
		/diagnostic-only/,
	);
} finally {
	rmSync(root, { force: true, recursive: true });
}
