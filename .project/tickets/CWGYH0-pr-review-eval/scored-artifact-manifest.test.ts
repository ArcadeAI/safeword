import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
	loadPinnedManifestFromGit,
	validateConfirmatoryCorpus,
	verifyRawArtifactManifest,
} from "./scored-artifact-manifest";

const sha256 = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");

function frozenArtifacts() {
	const root = mkdtempSync(join(tmpdir(), "cwgyh0-artifacts-"));
	mkdirSync(join(root, "case-a"));
	writeFileSync(join(root, "case-a", "attempt.json"), '{"ok":true}\n');
	const manifest = {
		algorithm: "sha256",
		artifacts: [{
			digest: sha256(readFileSync(join(root, "case-a", "attempt.json"))),
			identity: "case-a/attempt.json",
		}],
		createdAt: "2026-08-01T00:00:00.000Z",
		source: "raw-attempts",
	};
	const bytes = `${JSON.stringify(manifest)}\n`;
	return { bytes, digest: sha256(bytes), root };
}

describe("immutable raw artifact reuse", () => {
	test("loads manifest bytes only from an exact commit in the trusted repository", () => {
		const gitRoot = mkdtempSync(join(tmpdir(), "cwgyh0-manifest-git-"));
		execFileSync("git", ["init", "-q"], { cwd: gitRoot });
		execFileSync("git", ["remote", "add", "origin", "https://example.test/trusted.git"], { cwd: gitRoot });
		const manifestBytes = '{"algorithm":"sha256","artifacts":[],"createdAt":"2026-08-01T00:00:00.000Z","source":"raw-attempts"}\n';
		writeFileSync(join(gitRoot, "manifest.json"), manifestBytes);
		writeFileSync(join(gitRoot, "manifest.sha256"), `${sha256(manifestBytes)}\n`);
		execFileSync("git", ["add", "manifest.json", "manifest.sha256"], { cwd: gitRoot });
		execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-qm", "freeze"], { cwd: gitRoot });
		const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: gitRoot, encoding: "utf8" }).trim();

		expect(loadPinnedManifestFromGit({
			commit,
			digestPath: "manifest.sha256",
			expectedRepositoryIdentity: "https://example.test/trusted.git",
			gitRoot,
			manifestPath: "manifest.json",
		})).toEqual({ digest: sha256(manifestBytes), manifestBytes });
		expect(() => loadPinnedManifestFromGit({
			commit,
			digestPath: "manifest.sha256",
			expectedRepositoryIdentity: "https://example.test/attacker.git",
			gitRoot,
			manifestPath: "manifest.json",
		})).toThrow("repository identity mismatch");
	});

	test("returns the exact verified bytes bound to a frozen manifest digest", () => {
		const fixture = frozenArtifacts();
		const verified = verifyRawArtifactManifest({
			expectedManifestDigest: fixture.digest,
			manifestBytes: fixture.bytes,
			retainedAt: "2026-08-01T12:00:00.000Z",
			reusedAt: "2026-08-02T00:00:00.000Z",
			root: fixture.root,
		});
		expect(new TextDecoder().decode(verified.artifacts[0]!.bytes)).toBe('{"ok":true}\n');
	});

	test.each([
		["mutated artifact", (fixture: ReturnType<typeof frozenArtifacts>) => writeFileSync(join(fixture.root, "case-a", "attempt.json"), "changed"), "raw artifact digest mismatch"],
		["extra artifact", (fixture: ReturnType<typeof frozenArtifacts>) => writeFileSync(join(fixture.root, "extra.json"), "extra"), "raw artifact inventory differs"],
		["mutated manifest", (fixture: ReturnType<typeof frozenArtifacts>) => { fixture.bytes += " "; }, "raw manifest bytes changed"],
		["manifest retained after reuse", (fixture: ReturnType<typeof frozenArtifacts>) => { fixture.bytes = fixture.bytes.replace("2026-08-01", "2026-08-03"); fixture.digest = sha256(fixture.bytes); }, "raw manifest was retained after artifact reuse"],
	] as const)("rejects %s", (_label, mutate, expectedError) => {
		const fixture = frozenArtifacts();
		mutate(fixture);
		expect(() => verifyRawArtifactManifest({
			expectedManifestDigest: fixture.digest,
			manifestBytes: fixture.bytes,
			retainedAt: "2026-08-01T12:00:00.000Z",
			reusedAt: "2026-08-02T00:00:00.000Z",
			root: fixture.root,
		})).toThrow(expectedError);
	});

	test("rejects traversal identities", () => {
		const fixture = frozenArtifacts();
		const manifest = JSON.parse(fixture.bytes);
		manifest.artifacts = [{ identity: "../escape", digest: "0".repeat(64) }];
		const bytes = JSON.stringify(manifest);
		expect(() => verifyRawArtifactManifest({ expectedManifestDigest: sha256(bytes), manifestBytes: bytes, retainedAt: "2026-08-01T12:00:00.000Z", reusedAt: "2026-08-02T00:00:00.000Z", root: fixture.root })).toThrow("unsafe artifact identity");
	});

	test("rejects symlink artifacts", () => {
		const fixture = frozenArtifacts();
		symlinkSync(join(fixture.root, "case-a", "attempt.json"), join(fixture.root, "alias.json"));
		expect(() => verifyRawArtifactManifest({ expectedManifestDigest: fixture.digest, manifestBytes: fixture.bytes, retainedAt: "2026-08-01T12:00:00.000Z", reusedAt: "2026-08-02T00:00:00.000Z", root: fixture.root })).toThrow("symlink is not reusable");
	});
});

describe("corpus role separation", () => {
	test("accepts a fresh powered preregistered holdout", () => {
		expect(() => validateConfirmatoryCorpus({
			caseIds: ["h1", "h2"],
			developmentCaseIds: ["d1"],
			minimumPoweredCases: 2,
			preregisteredAt: "2026-08-01T00:00:00.000Z",
			preregisteredReserveIds: ["r1"],
			reserveIds: ["r1"],
			reviewStartedAt: "2026-08-02T00:00:00.000Z",
			voidForInstrumentFailure: false,
		})).not.toThrow();
	});

	test.each([
		["void corpus", { voidForInstrumentFailure: true }, "void corpus is diagnostic-only"],
		["development overlap", { caseIds: ["d1", "h2"] }, "overlaps scorer development cases"],
		["development reserve overlap", { developmentCaseIds: ["r1"] }, "overlaps scorer development cases"],
		["primary reserve overlap", { reserveIds: ["h1"], preregisteredReserveIds: ["h1"] }, "reserves overlap the primary holdout"],
		["late registration", { preregisteredAt: "2026-08-03T00:00:00.000Z" }, "was not preregistered before review"],
		["unregistered reserve", { reserveIds: ["r2"] }, "reserves differ from preregistration"],
		["underpowered holdout", { minimumPoweredCases: 3 }, "confirmatory holdout is underpowered"],
	] as const)("rejects %s", (_label, change, expectedError) => {
		expect(() => validateConfirmatoryCorpus({
			caseIds: ["h1", "h2"],
			developmentCaseIds: ["d1"],
			minimumPoweredCases: 2,
			preregisteredAt: "2026-08-01T00:00:00.000Z",
			preregisteredReserveIds: ["r1"],
			reserveIds: ["r1"],
			reviewStartedAt: "2026-08-02T00:00:00.000Z",
			voidForInstrumentFailure: false,
			...change,
		})).toThrow(expectedError);
	});
});
