import { describe, expect, test } from "bun:test";

import {
	executeWithInfrastructureRetry,
	isInfrastructureError,
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
