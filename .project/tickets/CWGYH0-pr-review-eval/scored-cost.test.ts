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

	test("marks a null-output attempt as unknown rather than free", () => {
		expect(
			estimateAttemptUsage([
				{ output: { report: { usage: { inputTokens: 10, outputTokens: 5 } } } },
				{ output: null },
			]),
		).toMatchObject({ complete: false, inputTokens: 10, outputTokens: 5 });
	});

	test.each([
		["fractional", 1.5, 2],
		["unsafe", Number.MAX_SAFE_INTEGER + 1, 2],
	])("marks %s token counts as incomplete", (_label, inputTokens, outputTokens) => {
		expect(
			estimateAttemptUsage([{ output: { report: { usage: { inputTokens, outputTokens } } } }]),
		).toEqual({
			complete: false,
			costUsd: 0,
			inputTokens: 0,
			outputTokens: 0,
		});
	});

	test("marks a token aggregate beyond the safe integer range as incomplete", () => {
		const output = { output: { report: { usage: { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 0 } } } };
		expect(
			estimateAttemptUsage([output, { output: { report: { usage: { inputTokens: 1, outputTokens: 0 } } } }]),
		).toMatchObject({ complete: false, inputTokens: Number.MAX_SAFE_INTEGER });
	});
});
