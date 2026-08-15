import { describe, expect, test } from "vitest";

import { estimateAttemptUsage } from "./scored-cost";
import {
	classifyTrialOutput,
	executeWithInfrastructureRetry,
	isInfrastructureError,
	parseCumulativeCaseTarget,
	parseCumulativeCostTarget,
	shuffleFrozen,
} from "./scored-run-policy";

const expectedProvenance = {
	caseId: "SCORE-example",
	reviewBaseSha: "base-sha",
	runnerRef: "codex/cwgyh0-dev-benchmark-adapter@d7baf0333",
	sourceSha: "source-sha",
	variant: "buggy",
};
const expectedRoute = {
	expert: "correctness",
	model: "claude-sonnet-5",
	provider: "anthropic",
};

function completedOutput(findings: unknown[] = []) {
	const toolCall = {
		args: { path: "src/example.ts" },
		name: "read_file",
		ok: true,
		path: "src/example.ts",
		summary: "10 line(s)",
	};
	return {
		models: [{ expert: "correctness", model: "claude-sonnet-5", provider: "anthropic" }],
		provenance: expectedProvenance,
		report: {
			consolidated: { findings },
			expertOutcomes: [{
				cappedBy: null,
				couldNotVerify: [],
				error: null,
				expert: "correctness",
				model: "claude-sonnet-5",
				provider: "anthropic",
				providerResponses: [
					{ raw: '{"content":[{"type":"tool_use","name":"read_file","input":{"path":"src/example.ts"}}],"stop_reason":"tool_use","usage":{"input_tokens":6,"output_tokens":1}}', stopReason: "tool_use" },
					{
						raw: JSON.stringify({
							content: [{
								input: { couldNotVerify: [], findings, summary: "Complete." },
								name: "report_findings",
								type: "tool_use",
							}],
							stop_reason: "tool_use",
							usage: { input_tokens: 4, output_tokens: 1 },
						}),
						stopReason: "tool_use",
					},
				],
				summary: "Complete.",
				toolCalls: [toolCall],
				failure: null as unknown,
				findings,
				turns: 2,
				usage: { inputTokens: 10, outputTokens: 2 },
			}],
			usage: { inputTokens: 10, outputTokens: 2 },
		},
		score: { matchingFindings: [], namedFailure: false, reviewValid: true },
		terminalState: "completed",
		trace: [toolCall],
	};
}

function classifyWithFrozenProvenance(output: unknown) {
	const classify = classifyTrialOutput as unknown as (
		value: unknown,
		route: typeof expectedRoute,
		provenance: typeof expectedProvenance,
	) => ReturnType<typeof classifyTrialOutput>;
	return classify(output, expectedRoute, expectedProvenance);
}

describe("positive trial admission", () => {
	test.each([
		["explicit empty findings", completedOutput()],
		["one finding", completedOutput([{ file: "a.ts", line: 1, title: "bug" }])],
		["multiple findings", completedOutput([
			{ file: "a.ts", line: 1, title: "bug" },
			{ file: "b.ts", line: 2, title: "other" },
		])],
	])("admits %s", (_name, output) => {
		expect(classifyWithFrozenProvenance(output)).toEqual({
			reason: "completed",
			retry: "never",
			status: "usable",
		});
	});

	test.each([
		["a malformed trace entry", (output: ReturnType<typeof completedOutput>) => {
			output.trace = [{ ...output.trace[0]!, ok: "true" as never }];
		}],
		["trace that differs from the retained expert calls", (output: ReturnType<typeof completedOutput>) => {
			output.trace = [{ ...output.trace[0]!, summary: "fabricated" }];
		}],
		["matching fabricated trace and expert calls", (output: ReturnType<typeof completedOutput>) => {
			const fabricated = { ...output.trace[0]!, args: { path: "src/other.ts" }, path: "src/other.ts" };
			output.trace = [fabricated];
			output.report.expertOutcomes[0]!.toolCalls = [fabricated];
		}],
		["missing raw per-turn usage", (output: ReturnType<typeof completedOutput>) => {
			const evidence = output.report.expertOutcomes[0]!.providerResponses[0]!;
			evidence.raw = evidence.raw.replace(',"usage":{"input_tokens":6,"output_tokens":1}', "");
		}],
		["fractional raw token usage", (output: ReturnType<typeof completedOutput>) => {
			const first = output.report.expertOutcomes[0]!.providerResponses[0]!;
			const raw = JSON.parse(first.raw) as { usage: { input_tokens: number } };
			raw.usage.input_tokens = 5.5;
			first.raw = JSON.stringify(raw);
		}],
		["an early terminal response followed by more provider output", (output: ReturnType<typeof completedOutput>) => {
			const first = output.report.expertOutcomes[0]!.providerResponses[0]!;
			const raw = JSON.parse(first.raw) as { stop_reason: string };
			raw.stop_reason = "end_turn";
			first.raw = JSON.stringify(raw);
			first.stopReason = "end_turn";
		}],
		["an early report followed by another provider response", (output: ReturnType<typeof completedOutput>) => {
			const first = output.report.expertOutcomes[0]!.providerResponses[0]!;
			const raw = JSON.parse(first.raw) as { content: unknown[] };
			raw.content.push({
				input: { couldNotVerify: [], findings: [], summary: "premature" },
				name: "report_findings",
				type: "tool_use",
			});
			first.raw = JSON.stringify(raw);
		}],
		["an error-marked envelope with fabricated success fields", (output: ReturnType<typeof completedOutput>) => {
			const first = output.report.expertOutcomes[0]!.providerResponses[0]!;
			const raw = JSON.parse(first.raw) as Record<string, unknown>;
			raw.error = { message: "overloaded", type: "overloaded_error" };
			first.raw = JSON.stringify(raw);
		}],
		["raw token usage whose aggregate exceeds the safe integer range", (output: ReturnType<typeof completedOutput>) => {
			const first = output.report.expertOutcomes[0]!.providerResponses[0]!;
			const second = output.report.expertOutcomes[0]!.providerResponses[1]!;
			const firstRaw = JSON.parse(first.raw) as { usage: { input_tokens: number; output_tokens: number } };
			const secondRaw = JSON.parse(second.raw) as { usage: { input_tokens: number; output_tokens: number } };
			firstRaw.usage.input_tokens = Number.MAX_SAFE_INTEGER;
			firstRaw.usage.output_tokens = 0;
			secondRaw.usage.input_tokens = 1;
			secondRaw.usage.output_tokens = 0;
			first.raw = JSON.stringify(firstRaw);
			second.raw = JSON.stringify(secondRaw);
			output.report.expertOutcomes[0]!.usage = {
				inputTokens: Number.MAX_SAFE_INTEGER + 1,
				outputTokens: 0,
			};
			output.report.usage = { ...output.report.expertOutcomes[0]!.usage };
		}],
		["aggregate usage that differs from retained turns", (output: ReturnType<typeof completedOutput>) => {
			output.report.expertOutcomes[0]!.usage.inputTokens += 1;
		}],
		["report usage that differs from the expert aggregate", (output: ReturnType<typeof completedOutput>) => {
			output.report.usage.outputTokens += 1;
		}],
	] as const)("rejects %s", (_name, mutate) => {
		const output = completedOutput();
		mutate(output);
		expect(classifyWithFrozenProvenance(output)).toMatchObject({ status: "invalid" });
	});

	test("rejects a successful frozen route when any extra outcome failed", () => {
		const output = completedOutput();
		output.models.push({ expert: "security", model: "claude-sonnet-5", provider: "anthropic" });
		output.report.expertOutcomes.push({
			...output.report.expertOutcomes[0],
			error: "secondary expert failed",
			expert: "security",
		});
		expect(classifyWithFrozenProvenance(output)).toMatchObject({
			reason: "routing-invalid",
			status: "invalid",
		});
	});

	test.each(["outcome", "matching", "consolidated"] as const)(
		"rejects duplicate %s finding identities",
		(collection) => {
			const finding = { file: "a.ts", line: 1, title: "duplicate" };
			const output = completedOutput([finding]);
			if (collection === "outcome") {
				output.report.expertOutcomes[0]!.findings = [finding, finding];
			}
			if (collection === "matching") {
				output.score.matchingFindings = [finding, finding];
				output.score.namedFailure = true;
			}
			if (collection === "consolidated") {
				output.report.consolidated.findings = [finding, finding];
			}
			expect(classifyWithFrozenProvenance(output)).toMatchObject({
				reason: "schema-invalid",
				status: "invalid",
			});
		},
	);

	test.each([
		["routed finding absent from the consolidated report", (() => {
			const finding = { file: "a.ts", line: 1, title: "bug" };
			const output = completedOutput([finding]);
			output.report.consolidated.findings = [];
			return output;
		})()],
		["matching finding absent from the routed outcome", (() => {
			const output = completedOutput();
			output.score = {
				matchingFindings: [{ file: "a.ts", line: 1, title: "bug" }],
				namedFailure: true,
				reviewValid: true,
			};
			return output;
		})()],
		["consolidated finding absent from the routed outcome", (() => {
			const output = completedOutput();
			output.report.consolidated.findings = [{ file: "a.ts", line: 1, title: "bug" }];
			return output;
		})()],
		["named-failure flag inconsistent with matching findings", (() => {
			const finding = { file: "a.ts", line: 1, title: "bug" };
			const output = completedOutput([finding]);
			output.score = { matchingFindings: [finding], namedFailure: false, reviewValid: true };
			return output;
		})()],
	])("rejects %s", (_label, output) => {
		expect(classifyWithFrozenProvenance(output)).toMatchObject({
			reason: "schema-invalid",
			status: "invalid",
		});
	});

	test.each([
		["wrong provider", { provider: "openai" }],
		["wrong model", { model: "another-model" }],
	])("rejects a routed outcome with the %s", (_label, replacement) => {
		const output = completedOutput();
		output.models[0] = { ...output.models[0]!, ...replacement };
		output.report.expertOutcomes[0] = {
			...output.report.expertOutcomes[0],
			...replacement,
		};
		expect(classifyWithFrozenProvenance(output)).toMatchObject({
			reason: "routing-invalid",
			status: "invalid",
		});
	});

	test.each([
		["missing output", undefined, "incomplete-provider-output"],
		["missing report", {}, "schema-invalid"],
		["no routed expert", { ...completedOutput(), models: [], report: { ...completedOutput().report, expertOutcomes: [] } }, "routing-invalid"],
		["wrong expert", { ...completedOutput(), models: [{ expert: "security" }], report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], expert: "security" }] } }, "routing-invalid"],
		["expert error", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], error: "Unable to connect" }] }, score: { reviewValid: false } }, "reviewer-failed"],
		["zero turns", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], turns: 0 }] } }, "reviewer-failed"],
		["missing findings", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], findings: undefined }] } }, "schema-invalid"],
		["missing usage", { ...completedOutput(), report: { ...completedOutput().report, usage: undefined } }, "provenance-incomplete"],
		["invalid score", { ...completedOutput(), score: { reviewValid: false } }, "reviewer-failed"],
		["missing raw provider evidence", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], providerResponses: [] }] } }, "incomplete-provider-output"],
		["mismatched raw stop reason", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], providerResponses: [{ raw: '{"stop_reason":"end_turn"}', stopReason: "tool_use" }, { raw: '{"stop_reason":"tool_use"}', stopReason: "tool_use" }] }] } }, "incomplete-provider-output"],
		["unexpected provider finish", { ...completedOutput(), report: { ...completedOutput().report, expertOutcomes: [{ ...completedOutput().report.expertOutcomes[0], providerResponses: [{ raw: '{"stop_reason":"tool_use"}', stopReason: "tool_use" }, { raw: '{"stop_reason":"end_turn"}', stopReason: "end_turn" }] }] } }, "incomplete-provider-output"],
	] as const)("rejects %s", (_name, output, reason) => {
		expect(classifyWithFrozenProvenance(output)).toEqual({
			reason,
			retry: "never",
			status: "invalid",
		});
	});

	test.each([
		["provider 503", { kind: "provider-request", status: 503 }],
		["network reset", { code: "ECONNRESET", kind: "network" }],
	] as const)("marks %s for one infrastructure retry", (_name, failure) => {
		const output = completedOutput();
		output.report.expertOutcomes[0] = {
			...output.report.expertOutcomes[0],
			error: "temporary provider failure",
			failure,
		};
		output.score.reviewValid = false;
		expect(classifyWithFrozenProvenance(output)).toEqual({
			reason: "provider-failure",
			retry: "infrastructure-once",
			status: "invalid",
		});
	});

	test.each([
		["schema violation", { kind: "schema-violation" }],
		["ordinary review failure", { kind: "review" }],
		["unknown failure", { kind: "unknown" }],
	] as const)("does not retry %s", (_name, failure) => {
		const output = completedOutput();
		output.report.expertOutcomes[0] = {
			...output.report.expertOutcomes[0],
			error: "review failed",
			failure,
		};
		output.score.reviewValid = false;
		expect(classifyWithFrozenProvenance(output).retry).toBe("never");
	});

	test.each([
		["a provider connection failure", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				error: "anthropic request failed with HTTP 503",
				failure: { kind: "provider-request", status: 503 },
			};
			output.score.reviewValid = false;
			return output;
		})(), "provider-failure"],
		["an HTTP-200 provider error envelope", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				error: "anthropic returned an unusable response",
				failure: {
					kind: "schema-violation",
					raw: '{"type":"error"}',
					source: "provider-response",
				},
			};
			output.score.reviewValid = false;
			return output;
		})(), "provider-failure"],
		["an empty provider response", undefined, "incomplete-provider-output"],
		["a truncated provider response", '{"content":', "incomplete-provider-output"],
		["an unexpected terminal finish", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				cappedBy: "no-report",
			};
			return output;
		})(), "unexpected-finish"],
		["a schema-invalid report", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				findings: undefined,
			};
			return output;
		})(), "schema-invalid"],
		["no expected reviewer route", {
			...completedOutput(),
			models: [],
			report: { ...completedOutput().report, expertOutcomes: [] },
		}, "routing-invalid"],
		["a reviewer error outcome", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				error: "invalid report after 2 attempts",
				failure: { kind: "review" },
			};
			output.score.reviewValid = false;
			return output;
		})(), "reviewer-failed"],
		["incomplete trace or usage", {
			...completedOutput(),
			trace: undefined,
		}, "provenance-incomplete"],
		["mismatched frozen provenance", {
			...completedOutput(),
			provenance: { ...expectedProvenance, sourceSha: "other-sha" },
		}, "provenance-mismatch"],
		["an unrecognized completion state", (() => {
			const output = completedOutput();
			output.report.expertOutcomes[0] = {
				...output.report.expertOutcomes[0],
				error: "new provider state",
				failure: { kind: "future-state" },
			};
			return output;
		})(), "unknown-state"],
	] as const)("rejects %s with canonical reason %s", (_name, output, reason) => {
		expect(classifyWithFrozenProvenance(output)).toMatchObject({
			reason,
			status: "invalid",
		});
	});

	test.each([
		["missing review-valid evidence", { ...completedOutput(), score: {} }, "schema-invalid"],
		["non-boolean review-valid evidence", { ...completedOutput(), score: { reviewValid: "true" } }, "schema-invalid"],
		["non-boolean named-failure evidence", { ...completedOutput(), score: { ...completedOutput().score, namedFailure: "false" } }, "schema-invalid"],
		["missing matching findings", { ...completedOutput(), score: { ...completedOutput().score, matchingFindings: undefined } }, "schema-invalid"],
		["a malformed matching finding", { ...completedOutput(), score: { ...completedOutput().score, matchingFindings: [{ file: "a.ts", line: "1", title: "bug" }] } }, "schema-invalid"],
		["a malformed consolidated finding", completedOutput([{ file: "a.ts", line: 0, title: "bug" }]), "schema-invalid"],
		["an empty execution trace", { ...completedOutput(), trace: [] }, "provenance-incomplete"],
		["no explicit terminal state", { ...completedOutput(), terminalState: undefined }, "unexpected-finish"],
		["a non-completed terminal state", { ...completedOutput(), terminalState: "failed" }, "unexpected-finish"],
	] as const)("rejects %s rather than inferring completion", (_name, output, reason) => {
		expect(classifyWithFrozenProvenance(output)).toEqual({
			reason,
			retry: "never",
			status: "invalid",
		});
	});
});

class RequestError extends Error {
	readonly status: number;

	constructor(status: number) {
		super(`request failed with HTTP ${status}`);
		this.name = "ProviderRequestError";
		this.status = status;
	}
}

describe("infrastructure classification", () => {
	test.each([408, 429, 500, 502, 503, 504, 599])("accepts retryable HTTP %d", (status) => {
		expect(isInfrastructureError(new RequestError(status))).toBe(true);
	});

	test.each([400, 401, 403, 404, 422])("rejects content/config HTTP %d", (status) => {
		expect(isInfrastructureError(new RequestError(status))).toBe(false);
	});

	test("accepts a predeclared network cause", () => {
		const cause = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
		expect(isInfrastructureError(new Error("fetch failed", { cause }))).toBe(true);
	});

	test("rejects schema and wall-clock failures", () => {
		expect(isInfrastructureError(Object.assign(new Error("bad shape"), {
			name: "SchemaViolationError",
		}))).toBe(false);
		expect(isInfrastructureError(new Error("expert exceeded wall-clock budget"))).toBe(false);
	});
});

describe("one-retry policy", () => {
	test("turns an unclassified thrown attempt into a terminal unknown failure", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(async () => {
			calls += 1;
			throw new Error("unexpected adapter failure");
		});

		expect(calls).toBe(1);
		expect(result).toMatchObject({
			attemptRecords: [
				{
					attempt: 1,
					disposition: { reason: "unknown-state", retry: "never", status: "invalid" },
					output: null,
				},
			],
			status: "exclude-case",
		});
	});

	test("retries one infrastructure failure and preserves the successful result", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				if (calls === 1) throw new RequestError(503);
				return "ok";
			},
			undefined,
			{ canRetryAttempt: () => true },
		);

		expect(result).toMatchObject({
			attempts: 2,
			infrastructureErrors: ["ProviderRequestError: request failed with HTTP 503"],
			status: "completed",
			value: "ok",
		});
		expect(result.attemptRecords).toHaveLength(2);
	});

	test("fails closed when retry cost authorization is omitted", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(async () => {
			calls += 1;
			throw new RequestError(503);
		});

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
	});

	test("does not retry a thrown provider failure whose cost is unknown", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				throw new RequestError(503);
			},
			undefined,
			{
				canRetryAttempt: (attempt) =>
					estimateAttemptUsage([attempt]).complete,
			},
		);

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
	});

	test("does not retry a provider output with missing usage", async () => {
		let calls = 0;
		const failed = completedOutput();
		failed.report.expertOutcomes[0] = {
			...failed.report.expertOutcomes[0],
			error: "anthropic request failed with HTTP 503",
			failure: { kind: "provider-request", status: 503 },
		};
		failed.report.usage = undefined as never;
		failed.score.reviewValid = false;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				return failed;
			},
			(value) => classifyTrialOutput(value, expectedRoute, expectedProvenance),
			{
				canRetryAttempt: (attempt) =>
					estimateAttemptUsage([attempt]).complete,
			},
		);

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
	});

	test("retries one embedded provider failure and preserves both paid outputs", async () => {
		let calls = 0;
		const failed = completedOutput();
		failed.report.expertOutcomes[0] = {
			...failed.report.expertOutcomes[0],
			error: "anthropic request failed with HTTP 503",
			failure: { kind: "provider-request", status: 503 },
		};
		failed.score.reviewValid = false;
		const successful = completedOutput();
		const result = await executeWithInfrastructureRetry(
			async () => (++calls === 1 ? failed : successful),
			(value) => classifyTrialOutput(value, expectedRoute, expectedProvenance),
			{ canRetryAttempt: () => true },
		);

		expect(result.status).toBe("completed");
		expect(result.attemptRecords).toHaveLength(2);
		expect(result.attemptRecords[0]).toMatchObject({ output: failed });
		expect(result.attemptRecords[1]).toMatchObject({ output: successful });
	});

	test("stops after infrastructure then semantic failure", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				if (calls === 1) throw new RequestError(503);
				return { kind: "schema-invalid" };
			},
			() => ({ reason: "schema-invalid", retry: "never", status: "invalid" }),
			{ canRetryAttempt: () => true },
		);

		expect(calls).toBe(2);
		expect(result).toMatchObject({
			attemptRecords: [
				{
					attempt: 1,
					disposition: {
						reason: "provider-failure",
						retry: "infrastructure-once",
						status: "invalid",
					},
					output: null,
				},
				{
					attempt: 2,
					disposition: { reason: "schema-invalid", retry: "never", status: "invalid" },
					output: { kind: "schema-invalid" },
				},
			],
			attempts: 2,
			status: "exclude-case",
		});
	});

	test("resumes a durably recorded retryable provider exception", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				return "ok";
			},
			undefined,
			{
				canRetryAttempt: () => true,
				priorAttemptRecords: [{
					attempt: 1,
					disposition: {
						reason: "provider-failure",
						retry: "infrastructure-once",
						status: "invalid",
					},
					error: "ProviderRequestError: request failed with HTTP 503",
					output: null,
				}],
			},
		);

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 2, status: "completed", value: "ok" });
	});

	test("does not resume a retryable provider exception without cost authorization", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				return "ok";
			},
			undefined,
			{
				priorAttemptRecords: [{
					attempt: 1,
					disposition: {
						reason: "provider-failure",
						retry: "infrastructure-once",
						status: "invalid",
					},
					error: "ProviderRequestError: request failed with HTTP 503",
					output: null,
				}],
			},
		);

		expect(calls).toBe(0);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
	});

	test("does not retry an embedded schema failure", async () => {
		let calls = 0;
		const failed = completedOutput();
		failed.report.expertOutcomes[0] = {
			...failed.report.expertOutcomes[0],
			error: "unusable response",
			failure: { kind: "schema-violation" },
		};
		failed.score.reviewValid = false;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				return failed;
			},
			(value) => classifyTrialOutput(value, expectedRoute, expectedProvenance),
		);

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
		expect(result.attemptRecords).toHaveLength(1);
	});

	test("excludes after the second infrastructure failure", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				throw new RequestError(429);
			},
			undefined,
			{ canRetryAttempt: () => true },
		);

		expect(calls).toBe(2);
		expect(result).toMatchObject({
			attempts: 2,
			infrastructureErrors: [
				"ProviderRequestError: request failed with HTTP 429",
				"ProviderRequestError: request failed with HTTP 429",
			],
			status: "exclude-case",
		});
	});

		test("quarantines a thrown model/content failure without retry", async () => {
			let calls = 0;
			const result = await executeWithInfrastructureRetry(async () => {
					calls += 1;
					throw Object.assign(new Error("unusable response"), {
						name: "SchemaViolationError",
					});
				});
			expect(calls).toBe(1);
			expect(result).toMatchObject({
				attempts: 1,
				disposition: { reason: "schema-invalid", retry: "never", status: "invalid" },
				status: "exclude-case",
			});
		});
});

test("frozen shuffle is deterministic without mutating its input", () => {
	const input = ["a", "b", "c", "d", "e"];
	const first = shuffleFrozen(input, 5_453_573);
	const second = shuffleFrozen(input, 5_453_573);

	expect(first).toEqual(second);
	expect(first).not.toEqual(input);
	expect(input).toEqual(["a", "b", "c", "d", "e"]);
});

describe("cumulative case checkpoints", () => {
	test("defaults to the complete corpus", () => {
		expect(parseCumulativeCaseTarget(undefined, 30)).toBe(30);
		expect(parseCumulativeCaseTarget("", 30)).toBe(30);
	});

	test.each([1, 2, 5, 10, 20, 30])("accepts cumulative target %d", (target) => {
		expect(parseCumulativeCaseTarget(String(target), 30)).toBe(target);
	});

	test.each(["0", "1.5", "31", "nope"])('rejects target "%s"', (target) => {
		expect(() => parseCumulativeCaseTarget(target, 30)).toThrow(
			"CWGYH0_CASE_TARGET",
		);
	});
});

describe("cumulative cost checkpoints", () => {
	test("defaults to the frozen aggregate ceiling", () => {
		expect(parseCumulativeCostTarget(undefined, 1_000)).toBe(1_000);
	});

	test.each([10, 20, 50, 100, 1_000])("accepts cumulative target %d", (target) => {
		expect(parseCumulativeCostTarget(String(target), 1_000)).toBe(target);
	});

	test.each(["0", "-1", "1001", "nope"])('rejects target "%s"', (target) => {
		expect(() => parseCumulativeCostTarget(target, 1_000)).toThrow(
			"CWGYH0_COST_TARGET_USD",
		);
	});
});
