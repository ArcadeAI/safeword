import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
} from "node:fs";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";

type ManifestArtifact = { digest: string; identity: string };
type RawManifest = {
	algorithm: string;
	artifacts: ManifestArtifact[];
	createdAt: string;
	source: string;
};

const SHA256 = /^[0-9a-f]{64}$/;

function digest(bytes: string | Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function parseTime(value: string, label: string): number {
	const parsed = new Date(value).valueOf();
	if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid timestamp`);
	return parsed;
}

function canonicalIdentity(value: string): string {
	if (
		value.length === 0 ||
		isAbsolute(value) ||
		value.includes("\\") ||
		value.split("/").some((part) => part === "" || part === "." || part === "..") ||
		posix.normalize(value) !== value
	) {
		throw new Error(`unsafe artifact identity: ${value}`);
	}
	return value;
}

function enumerateFiles(root: string, directory = root): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`symlink is not reusable: ${path}`);
		if (entry.isDirectory()) files.push(...enumerateFiles(root, path));
		else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
		else throw new Error(`unsupported artifact type: ${path}`);
	}
	return files.sort();
}

function runGit(root: string, args: string[]): string {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
	if (result.status !== 0 || result.error !== undefined) {
		throw new Error(`git ${args[0]} failed: ${result.stderr || result.error?.message}`);
	}
	return result.stdout;
}

export function loadPinnedManifestFromGit(input: {
	commit: string;
	digestPath: string;
	expectedRepositoryIdentity: string;
	gitRoot: string;
	manifestPath: string;
}): { digest: string; manifestBytes: string } {
	if (!/^[0-9a-f]{40}$/.test(input.commit)) throw new Error("pinned commit must be a full SHA-1 object ID");
	const repositoryIdentity = runGit(input.gitRoot, ["remote", "get-url", "origin"]).trim();
	if (repositoryIdentity !== input.expectedRepositoryIdentity) {
		throw new Error("raw manifest repository identity mismatch");
	}
	const resolved = runGit(input.gitRoot, ["rev-parse", "--verify", `${input.commit}^{commit}`]).trim();
	if (resolved !== input.commit) throw new Error("raw manifest commit did not resolve exactly");
	const manifestBytes = runGit(input.gitRoot, ["show", `${input.commit}:${input.manifestPath}`]);
	const pinnedDigest = runGit(input.gitRoot, ["show", `${input.commit}:${input.digestPath}`]).trim();
	if (!SHA256.test(pinnedDigest) || digest(manifestBytes) !== pinnedDigest) {
		throw new Error("pinned raw manifest digest mismatch");
	}
	return { digest: pinnedDigest, manifestBytes };
}

export function verifyRawArtifactManifest(input: {
	expectedManifestDigest: string;
	manifestBytes: string | Uint8Array;
	retainedAt: string;
	reusedAt: string;
	root: string;
}): { artifacts: Array<{ bytes: Uint8Array; identity: string }>; manifestDigest: string } {
	if (!SHA256.test(input.expectedManifestDigest)) throw new Error("manifest digest must be canonical SHA-256");
	const manifestDigest = digest(input.manifestBytes);
	if (manifestDigest !== input.expectedManifestDigest) throw new Error("raw manifest bytes changed");
	let manifest: RawManifest;
	try {
		manifest = JSON.parse(
			typeof input.manifestBytes === "string"
				? input.manifestBytes
				: new TextDecoder().decode(input.manifestBytes),
		) as RawManifest;
	} catch {
		throw new Error("raw manifest is not valid JSON");
	}
	if (
		manifest.algorithm !== "sha256" ||
		manifest.source !== "raw-attempts" ||
		!Array.isArray(manifest.artifacts)
	) {
		throw new Error("raw manifest has an unsupported source or hash algorithm");
	}
	const manifestCreatedAt = parseTime(manifest.createdAt, "manifest creation");
	const retainedAt = parseTime(input.retainedAt, "independent retention");
	const reusedAt = parseTime(input.reusedAt, "reuse");
	if (manifestCreatedAt > retainedAt || retainedAt > reusedAt) {
		throw new Error("raw manifest was retained after artifact reuse");
	}

	const root = realpathSync(input.root);
	const identities = manifest.artifacts.map(({ identity }) => canonicalIdentity(identity));
	if (new Set(identities).size !== identities.length) throw new Error("duplicate artifact identity");
	const actualFiles = enumerateFiles(root);
	if (
		actualFiles.length !== identities.length ||
		actualFiles.some((identity) => !identities.includes(identity))
	) {
		throw new Error("raw artifact inventory differs from the frozen manifest");
	}

	const physicalFiles = new Set<string>();
	const artifacts = manifest.artifacts.map((artifact) => {
		if (!SHA256.test(artifact.digest)) throw new Error(`malformed SHA-256 for ${artifact.identity}`);
		const path = resolve(root, artifact.identity);
		const resolved = realpathSync(path);
		if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
			throw new Error(`artifact escapes root: ${artifact.identity}`);
		}
		const stat = lstatSync(path);
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`artifact is not a regular file: ${artifact.identity}`);
		const physicalIdentity = `${stat.dev}:${stat.ino}`;
		if (physicalFiles.has(physicalIdentity)) throw new Error("distinct identities resolve to one artifact");
		physicalFiles.add(physicalIdentity);
		const bytes = readFileSync(path);
		if (digest(bytes) !== artifact.digest) throw new Error(`raw artifact digest mismatch: ${artifact.identity}`);
		return { bytes: new Uint8Array(bytes), identity: artifact.identity };
	});
	return { artifacts, manifestDigest };
}

export function validateConfirmatoryCorpus(input: {
	caseIds: readonly string[];
	developmentCaseIds: readonly string[];
	minimumPoweredCases: number;
	preregisteredAt: string;
	preregisteredReserveIds: readonly string[];
	reserveIds: readonly string[];
	reviewStartedAt: string;
	voidForInstrumentFailure: boolean;
}): void {
	if (input.voidForInstrumentFailure) throw new Error("void corpus is diagnostic-only");
	if (!Number.isInteger(input.minimumPoweredCases) || input.minimumPoweredCases < 1) {
		throw new Error("minimum powered case count is invalid");
	}
	if (input.caseIds.length < input.minimumPoweredCases) throw new Error("confirmatory holdout is underpowered");
	if (new Set(input.caseIds).size !== input.caseIds.length) throw new Error("duplicate holdout case");
	const development = new Set(input.developmentCaseIds);
	if (input.caseIds.some((id) => development.has(id))) throw new Error("holdout overlaps scorer development cases");
	if (parseTime(input.preregisteredAt, "preregistration") >= parseTime(input.reviewStartedAt, "review start")) {
		throw new Error("confirmatory corpus was not preregistered before review");
	}
	if (
		input.reserveIds.length !== input.preregisteredReserveIds.length ||
		new Set(input.reserveIds).size !== input.reserveIds.length ||
		input.reserveIds.some((id, index) => id !== input.preregisteredReserveIds[index])
	) {
		throw new Error("confirmatory reserves differ from preregistration");
	}
}
