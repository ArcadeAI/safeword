import { describe, expect, test } from "vitest";

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
	runnerRef: "codex/cwgyh0-dev-benchmark-adapter@b9b8d1f26",
	sourceSha: "source-sha",
	variant: "buggy",
};

function completedOutput(findings: unknown[] = []) {
	return {
		models: [{ expert: "correctness", model: "claude-sonnet-5", provider: "anthropic" }],
		provenance: expectedProvenance,
		report: {
			consolidated: { findings },
			expertOutcomes: [{
				cappedBy: null,
				error: null,
				expert: "correctness",
				failure: null as unknown,
				findings,
				turns: 2,
				usage: { inputTokens: 10, outputTokens: 2 },
			}],
			usage: { inputTokens: 10, outputTokens: 2 },
		},
		score: { reviewValid: true },
		trace: [],
	};
}

function classifyWithFrozenProvenance(output: unknown) {
	const classify = classifyTrialOutput as unknown as (
		value: unknown,
		expert: string,
		provenance: typeof expectedProvenance,
	) => ReturnType<typeof classifyTrialOutput>;
	return classify(output, "correctness", expectedProvenance);
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
		expect(classifyTrialOutput(output, "correctness")).toEqual({
			reason: "completed",
			retry: "never",
			status: "usable",
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
	] as const)("rejects %s", (_name, output, reason) => {
		expect(classifyTrialOutput(output, "correctness")).toEqual({
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
		expect(classifyTrialOutput(output, "correctness")).toEqual({
			reason: "reviewer-failed",
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
		expect(classifyTrialOutput(output, "correctness").retry).toBe("never");
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
	test.each([408, 429, 500, 503, 599])("accepts retryable HTTP %d", (status) => {
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
	test("retries one infrastructure failure and preserves the successful result", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(async () => {
			calls += 1;
			if (calls === 1) throw new RequestError(503);
			return "ok";
		});

		expect(result).toMatchObject({
			attempts: 2,
			infrastructureErrors: ["ProviderRequestError: request failed with HTTP 503"],
			status: "completed",
			value: "ok",
		});
		expect(result.attemptRecords).toHaveLength(2);
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
			(value) => classifyTrialOutput(value, "correctness"),
		);

		expect(result.status).toBe("completed");
		expect(result.attemptRecords).toHaveLength(2);
		expect(result.attemptRecords[0]).toMatchObject({ output: failed });
		expect(result.attemptRecords[1]).toMatchObject({ output: successful });
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
			(value) => classifyTrialOutput(value, "correctness"),
		);

		expect(calls).toBe(1);
		expect(result).toMatchObject({ attempts: 1, status: "exclude-case" });
		expect(result.attemptRecords).toHaveLength(1);
	});

	test("excludes after the second infrastructure failure", async () => {
		let calls = 0;
		const result = await executeWithInfrastructureRetry(async () => {
			calls += 1;
			throw new RequestError(429);
		});

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

	test("does not retry a model/content failure", async () => {
		let calls = 0;
		await expect(
			executeWithInfrastructureRetry(async () => {
				calls += 1;
				throw Object.assign(new Error("unusable response"), {
					name: "SchemaViolationError",
				});
			}),
		).rejects.toThrow("unusable response");
		expect(calls).toBe(1);
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
