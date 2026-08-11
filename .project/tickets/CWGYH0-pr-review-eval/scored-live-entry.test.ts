import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("actual live-run entry point", () => {
	test("completes one no-cost case and resumes without repeating provider calls", () => {
		expect(() =>
			execFileSync(
				"bun",
				[join(import.meta.dirname, "scored-live-entry.fixture.ts")],
				{ encoding: "utf8", stdio: "pipe", timeout: 120_000 },
			),
		).not.toThrow();
	}, 120_000);
});
