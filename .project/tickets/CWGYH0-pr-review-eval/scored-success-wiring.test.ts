import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("successful runner-to-scorer wiring", () => {
	test("seals a complete real review matrix and scores its admitted records", () => {
		expect(() =>
			execFileSync(
				"bun",
				[join(import.meta.dirname, "scored-success-wiring.fixture.ts")],
				{
					encoding: "utf8",
					stdio: "pipe",
				},
			),
		).not.toThrow();
	}, 30_000);
});
