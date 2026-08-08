import { describe, expect, test } from "bun:test";

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
});

describe("summary primitives", () => {
	test("computes arithmetic means", () => {
		expect(mean([0, 0.5, 1])).toBe(0.5);
	});

	test("uses linear interpolation for percentiles", () => {
		expect(percentile([0, 10, 20, 30], 0.25)).toBe(7.5);
		expect(percentile([0, 10, 20, 30], 0.975)).toBe(29.25);
	});
});
