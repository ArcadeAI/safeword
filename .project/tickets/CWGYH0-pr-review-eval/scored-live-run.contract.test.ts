import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const ticketRoot = import.meta.dirname;

describe("live scored-run portability", () => {
	test("does not embed a developer-specific checkout path", () => {
		for (const filename of [
			"scored-live-run.ts",
			"scored-real-wiring.fixture.ts",
			"scored-success-wiring.fixture.ts",
		]) {
			const source = readFileSync(join(ticketRoot, filename), "utf8");
			expect(source).not.toContain("/Users/alex/");
		}
	});
});
