import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

export function fixtureFrozenRun(input: {
	corpusRegisteredAt: string;
	corpusRoleSha256: string;
	preflightId: string;
	preflightSha256: string;
	primaryCases: string[];
	reserveCases: string[];
	reviewStartedAt: string;
	runnerRef: string;
	sourceRepositoryIdentity: string;
}): Record<string, unknown> {
	return {
		aggregateCostStopUsd: 500,
		expectedAdapterCommit: "d7baf0333001dcd462a12111351dc68757af605c",
		expectedPrimaryCaseCount: input.primaryCases.length,
		expectedReserveCaseCount: input.reserveCases.length,
		expectedRunnerRef: input.runnerRef,
		expectedHashes: {
			primaryManifest: "1".repeat(64),
			reserveManifest: "2".repeat(64),
			reviewerPrompt: "3".repeat(64),
			verifierPrompt: "4".repeat(64),
		},
		corpusRegistrationDigest: "5".repeat(64),
		corpusRegisteredAt: input.corpusRegisteredAt,
		inputPricePerMillionUsd: 3,
		model: "claude-sonnet-5",
		outputPricePerMillionUsd: 15,
		policy: {
			maxVerifications: 2,
			toolCallsPerExpert: 3,
			wallClockMsPerExpert: 4_000,
		},
		preregisteredRunnerRef: input.runnerRef,
		primaryCases: input.primaryCases,
		reserveCases: input.reserveCases,
		seed: 5_453_573,
		sourceRepositoryIdentity: input.sourceRepositoryIdentity,
		trials: 3,
		preflightId: input.preflightId,
		preflightSha256: input.preflightSha256,
		corpusRoleSha256: input.corpusRoleSha256,
		reviewStartedAt: input.reviewStartedAt,
	};
}

function files(root: string, directory = root): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return files(root, path);
		if (!entry.isFile()) throw new Error(`fixture artifact is not a regular file: ${path}`);
		return [relative(root, path).split(sep).join("/")];
	}).sort();
}

export function freezeFixtureArtifacts(input: {
	gitRoot: string;
	outputRoot: string;
	repositoryIdentity: string;
}): Record<string, string> {
	const createdAt = new Date(Date.now() - 1_000).toISOString();
	const manifest = {
		algorithm: "sha256",
		artifacts: files(input.outputRoot).map((identity) => ({
			digest: sha256(readFileSync(join(input.outputRoot, identity))),
			identity,
		})),
		createdAt,
		source: "raw-attempts",
	};
	return freezeFixtureBlob({
		blobPath: "manifest.json",
		bytes: `${JSON.stringify(manifest, null, 2)}\n`,
		digestPath: "manifest.sha256",
		gitRoot: input.gitRoot,
		marker: "raw-manifest",
		repositoryIdentity: input.repositoryIdentity,
	});
}

export function freezeFixtureBlob(input: {
	blobPath: string;
	bytes: string;
	digestPath: string;
	gitRoot: string;
	marker: "canary" | "canary-labels" | "corpus-registration" | "raw-manifest";
	repositoryIdentity: string;
	anchorCreatedAt?: string;
}): Record<string, string> {
	mkdirSync(input.gitRoot, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: input.gitRoot });
	execFileSync("git", ["remote", "add", "origin", input.repositoryIdentity], {
		cwd: input.gitRoot,
	});
	writeFileSync(join(input.gitRoot, input.blobPath), input.bytes);
	writeFileSync(join(input.gitRoot, input.digestPath), `${sha256(input.bytes)}\n`);
	execFileSync("git", ["add", input.blobPath, input.digestPath], {
		cwd: input.gitRoot,
	});
	execFileSync(
		"git",
		[
			"-c",
			"commit.gpgsign=false",
			"-c",
			"user.name=Fixture",
			"-c",
			"user.email=fixture@example.test",
			"commit",
			"-qm",
			"freeze raw artifacts",
		],
		{ cwd: input.gitRoot },
	);
	const commit = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: input.gitRoot,
		encoding: "utf8",
	}).trim();
	const anchor = {
		blobPath: input.blobPath,
		commit,
		digest: sha256(input.bytes),
		digestPath: input.digestPath,
		repositoryIdentity: input.repositoryIdentity,
	};
	const commentId = input.marker === "canary"
		? "1001"
		: input.marker === "raw-manifest"
		? "1002"
		: input.marker === "canary-labels"
		? "1003"
		: "1004";
	const anchorUrl = `https://api.github.com/repos/ArcadeAI/safeword/issues/comments/${commentId}`;
	const createdAt = input.anchorCreatedAt ?? new Date().toISOString();
	return {
		CWGYH0_ANCHOR_RESPONSE: JSON.stringify({
			body: `<!-- cwgyh0-${input.marker}-anchor:v1 -->\n${JSON.stringify(anchor)}`,
			created_at: createdAt,
			html_url: `https://github.com/ArcadeAI/safeword/issues/1910#issuecomment-${commentId}`,
			updated_at: createdAt,
			user: { login: "fixture-anchor-author" },
		}),
		CWGYH0_RAW_MANIFEST_ANCHOR_URL: anchorUrl,
		CWGYH0_RAW_MANIFEST_GIT_ROOT: input.gitRoot,
		CWGYH0_TRUSTED_ANCHOR_AUTHOR: "fixture-anchor-author",
	};
}
