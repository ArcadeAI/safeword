import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execute = promisify(execFile);

describe("run lock contention", () => {
	test("allows only one contender to replace the same stale lock", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-lock-contention-"));
		writeFileSync(join(outputRoot, ".run.lock"), "2147483647\n");
		const fixture = join(import.meta.dirname, "scored-lock-contender.fixture.ts");

		const outcomes = await Promise.allSettled([
			execute("bun", [fixture, outputRoot, "a"]),
			execute("bun", [fixture, outputRoot, "b"]),
		]);

		expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
		expect(
			readdirSync(outputRoot).filter((name) => name.startsWith("acquired-")),
		).toHaveLength(1);
	});
});
