import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("real provider-to-scorer wiring", () => {
	test("preserves an HTTP-200 provider error and admits no score record", () => {
		expect(() =>
			execFileSync("bun", [join(import.meta.dirname, "scored-real-wiring.fixture.ts")], {
				encoding: "utf8",
				stdio: "pipe",
			}),
		).not.toThrow();
	});
});
