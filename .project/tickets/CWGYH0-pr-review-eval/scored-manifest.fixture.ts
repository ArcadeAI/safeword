import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
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
	mkdirSync(input.gitRoot, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: input.gitRoot });
	execFileSync("git", ["remote", "add", "origin", input.repositoryIdentity], {
		cwd: input.gitRoot,
	});
	const manifest = {
		algorithm: "sha256",
		artifacts: files(input.outputRoot).map((identity) => ({
			digest: sha256(readFileSync(join(input.outputRoot, identity))),
			identity,
		})),
		createdAt: new Date(Date.now() - 1_000).toISOString(),
		source: "raw-attempts",
	};
	const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
	writeFileSync(join(input.gitRoot, "manifest.json"), manifestBytes);
	writeFileSync(join(input.gitRoot, "manifest.sha256"), `${sha256(manifestBytes)}\n`);
	execFileSync("git", ["add", "manifest.json", "manifest.sha256"], {
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
	return {
		CWGYH0_RAW_MANIFEST_COMMIT: commit,
		CWGYH0_RAW_MANIFEST_DIGEST_PATH: "manifest.sha256",
		CWGYH0_RAW_MANIFEST_GIT_ROOT: input.gitRoot,
		CWGYH0_RAW_MANIFEST_PATH: "manifest.json",
		CWGYH0_RAW_MANIFEST_REPOSITORY: input.repositoryIdentity,
	};
}
