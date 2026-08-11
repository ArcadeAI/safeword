import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { loadPinnedAdapter } from "./scored-adapter";

function git(root: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

describe("pinned adapter loading", () => {
	test("rejects untracked files before importing executable code", async () => {
		const root = mkdtempSync(join(tmpdir(), "cwgyh0-adapter-"));
		try {
			git(root, "init");
			git(root, "config", "user.email", "benchmark@example.com");
			git(root, "config", "user.name", "Benchmark Test");
			const moduleRoot = join(root, "tools/pr-review/src/eval");
			mkdirSync(moduleRoot, { recursive: true });
			writeFileSync(
				join(moduleRoot, "development-benchmark.ts"),
				"export const createRunnerExecutor = () => {}; export const loadDevelopmentManifest = () => {};\n",
			);
			git(root, "add", ".");
			git(root, "commit", "-m", "adapter");
			const commit = git(root, "rev-parse", "HEAD");
			writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
			await expect(
				loadPinnedAdapter({ adapterRoot: root, expectedCommit: commit }),
			).rejects.toThrow("untracked");
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
