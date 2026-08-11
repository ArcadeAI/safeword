import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
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
	test("returns the exact verified bytes bound to a frozen manifest digest", () => {
		const fixture = frozenArtifacts();
		const verified = verifyRawArtifactManifest({
			expectedManifestDigest: fixture.digest,
			manifestBytes: fixture.bytes,
			reusedAt: "2026-08-02T00:00:00.000Z",
			root: fixture.root,
		});
		expect(new TextDecoder().decode(verified.artifacts[0]!.bytes)).toBe('{"ok":true}\n');
	});

	test.each([
		["mutated artifact", (fixture: ReturnType<typeof frozenArtifacts>) => writeFileSync(join(fixture.root, "case-a", "attempt.json"), "changed")],
		["extra artifact", (fixture: ReturnType<typeof frozenArtifacts>) => writeFileSync(join(fixture.root, "extra.json"), "extra")],
		["mutated manifest", (fixture: ReturnType<typeof frozenArtifacts>) => { fixture.bytes += " "; }],
		["manifest retained after reuse", (fixture: ReturnType<typeof frozenArtifacts>) => { fixture.bytes = fixture.bytes.replace("2026-08-01", "2026-08-03"); fixture.digest = sha256(fixture.bytes); }],
	] as const)("rejects %s", (_label, mutate) => {
		const fixture = frozenArtifacts();
		mutate(fixture);
		expect(() => verifyRawArtifactManifest({
			expectedManifestDigest: fixture.digest,
			manifestBytes: fixture.bytes,
			reusedAt: "2026-08-02T00:00:00.000Z",
			root: fixture.root,
		})).toThrow();
	});

	test("rejects traversal and symlink identities", () => {
		const fixture = frozenArtifacts();
		symlinkSync(join(fixture.root, "case-a", "attempt.json"), join(fixture.root, "alias.json"));
		const manifest = JSON.parse(fixture.bytes);
		manifest.artifacts = [{ identity: "../escape", digest: "0".repeat(64) }];
		const bytes = JSON.stringify(manifest);
		expect(() => verifyRawArtifactManifest({ expectedManifestDigest: sha256(bytes), manifestBytes: bytes, reusedAt: "2026-08-02T00:00:00.000Z", root: fixture.root })).toThrow();
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
		["void corpus", { voidForInstrumentFailure: true }],
		["development overlap", { caseIds: ["d1", "h2"] }],
		["late registration", { preregisteredAt: "2026-08-03T00:00:00.000Z" }],
		["unregistered reserve", { reserveIds: ["r2"] }],
		["underpowered holdout", { minimumPoweredCases: 3 }],
	] as const)("rejects %s", (_label, change) => {
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
		})).toThrow();
	});
});
