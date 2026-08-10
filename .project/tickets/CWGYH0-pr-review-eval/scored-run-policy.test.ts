import { describe, expect, test } from "vitest";

import {
	executeWithInfrastructureRetry,
	isInfrastructureError,
	parseCumulativeCaseTarget,
	parseCumulativeCostTarget,
	shuffleFrozen,
} from "./scored-run-policy";

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

		expect(result).toEqual({
			attempts: 2,
			infrastructureErrors: ["ProviderRequestError: request failed with HTTP 503"],
			status: "completed",
			value: "ok",
		});
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
