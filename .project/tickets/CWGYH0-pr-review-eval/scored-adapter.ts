import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type DevelopmentVariant = "buggy" | "fixed";
export type DevelopmentReviewInput = {
	caseId: string;
	causalPaths: string[];
	failureDescription: unknown;
	modelCutoff: string;
	reviewBaseSha: string;
	runnerRef: string;
	sourceSha: string;
	variant: DevelopmentVariant;
};

export type AdapterModule = {
	createRunnerExecutor: (options: {
		env?: Record<string, string | undefined>;
		expertsDir: string;
		forceExpertLane?: "correctness";
		policy: {
			maxVerifications: number;
			toolCallsPerExpert: number;
			wallClockMsPerExpert: number;
		};
		targetFor: (input: DevelopmentReviewInput) => { baseRef: string; root: string };
	}) => (input: DevelopmentReviewInput) => Promise<unknown>;
	loadDevelopmentManifest: (path: string) => unknown;
};

function runGit(cwd: string, args: string[]): string {
	const result = spawnSync("git", args, {
		cwd,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(
			`git ${args[0] ?? "command"} failed: ${result.stderr.trim()}`,
		);
	}
	return result.stdout.trim();
}

function requireAdapterModule(value: unknown): AdapterModule {
	if (
		typeof value !== "object" ||
		value === null ||
		!("createRunnerExecutor" in value) ||
		typeof value.createRunnerExecutor !== "function" ||
		!("loadDevelopmentManifest" in value) ||
		typeof value.loadDevelopmentManifest !== "function"
	) {
		throw new Error("pinned adapter does not expose the benchmark contract");
	}
	return value as AdapterModule;
}

export async function loadPinnedAdapter(input: {
	adapterRoot: string;
	expectedCommit: string;
}): Promise<AdapterModule> {
	if (runGit(input.adapterRoot, ["rev-parse", "HEAD"]) !== input.expectedCommit) {
		throw new Error("adapter commit does not match the frozen runner");
	}
	if (
		runGit(input.adapterRoot, ["status", "--porcelain"])
	) {
		throw new Error("adapter has tracked or untracked modifications");
	}
	return requireAdapterModule(
		await import(
			pathToFileURL(
				join(
					input.adapterRoot,
					"tools/pr-review/src/eval/development-benchmark.ts",
				),
			).href
		),
	);
}
