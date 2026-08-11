import { describe, expect, test } from "vitest";

import { estimateAttemptUsage } from "./scored-cost";

describe("attempt cost evidence", () => {
	test("retains malformed output as incomplete cost evidence without throwing", () => {
		expect(
			estimateAttemptUsage([
				{ output: {} },
				{ output: { report: { usage: { inputTokens: 10, outputTokens: 5 } } } },
			]),
		).toEqual({
			complete: false,
			costUsd: 0.000_105,
			inputTokens: 10,
			outputTokens: 5,
		});
	});

	test("totals complete usage for every returned attempt", () => {
		expect(
			estimateAttemptUsage([
				{ output: { report: { usage: { inputTokens: 10, outputTokens: 5 } } } },
				{ output: null },
			]),
		).toMatchObject({ complete: true, inputTokens: 10, outputTokens: 5 });
	});
});
