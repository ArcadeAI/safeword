import { describe, expect, test } from "vitest";

import { mean, pairedBootstrapInterval, percentile } from "./scored-analysis";

describe("paired case bootstrap", () => {
	test("returns a strictly positive interval when every case favors full", () => {
		const result = pairedBootstrapInterval(Array(30).fill(1), 1_000, 5_453_573);

		expect(result).toEqual({ lower95: 1, mean: 1, upper95: 1 });
	});

	test("is deterministic for the frozen seed", () => {
		const differences = [1, 1, 0, -1, 0.5, 0, 1, -0.5];

		expect(pairedBootstrapInterval(differences, 1_000, 5_453_573)).toEqual(
			pairedBootstrapInterval(differences, 1_000, 5_453_573),
		);
	});

	test("rejects empty case sets", () => {
		expect(() => pairedBootstrapInterval([], 1_000, 5_453_573)).toThrow(
			"at least one independent case",
		);
	});

	test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		"rejects non-finite case differences (%s)",
		(value) => {
			expect(() => pairedBootstrapInterval([0, value], 100, 5_453_573)).toThrow(
				"finite case differences",
			);
		},
	);

	test.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
		"rejects an invalid deterministic seed (%s)",
		(seed) => {
			expect(() => pairedBootstrapInterval([0, 1], 100, seed)).toThrow(
				"safe-integer seed",
			);
		},
	);
});

describe("summary primitives", () => {
	test("computes arithmetic means", () => {
		expect(mean([0, 0.5, 1])).toBe(0.5);
	});

	test("uses linear interpolation for percentiles", () => {
		expect(percentile([0, 10, 20, 30], 0.25)).toBe(7.5);
		expect(percentile([0, 10, 20, 30], 0.975)).toBe(29.25);
	});

	test("rejects non-finite summary inputs", () => {
		expect(() => mean([1, Number.NaN])).toThrow("finite values");
		expect(() => percentile([0, Number.POSITIVE_INFINITY], 0.5)).toThrow(
			"finite values",
		);
		expect(() => percentile([0, 1], Number.NaN)).toThrow(
			"finite probability",
		);
	});
});
