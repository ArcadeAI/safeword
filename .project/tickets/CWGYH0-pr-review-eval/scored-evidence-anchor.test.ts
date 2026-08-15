import { afterEach, describe, expect, test } from "vitest";

import { loadGitHubEvidenceAnchor } from "./scored-evidence-anchor";

const originalFetch = globalThis.fetch;
const url = "https://api.github.com/repos/ArcadeAI/safeword/issues/comments/123";
const createdAt = "2026-08-01T00:00:00.000Z";
const anchor = {
	blobPath: "manifest.json",
	commit: "a".repeat(40),
	digest: "b".repeat(64),
	digestPath: "manifest.sha256",
	repositoryIdentity: "https://github.com/ArcadeAI/evidence.git",
};

function respondAs(login: string): void {
	globalThis.fetch = Object.assign(
		() => Promise.resolve(new Response(JSON.stringify({
			body: `<!-- cwgyh0-raw-manifest-anchor:v1 -->\n${JSON.stringify(anchor)}`,
			created_at: createdAt,
			html_url: "https://github.com/ArcadeAI/safeword/issues/1910#issuecomment-123",
			updated_at: createdAt,
			user: { login },
		}), { status: 200 })),
		{ preconnect: () => undefined },
	) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("trusted evidence anchors", () => {
	test("accepts an immutable comment from the configured author", async () => {
		respondAs("trusted-maintainer");
		await expect(
			loadGitHubEvidenceAnchor(url, "raw-manifest", "trusted-maintainer"),
		).resolves.toEqual({ ...anchor, createdAt });
	});

	test("rejects an otherwise valid comment from another author", async () => {
		respondAs("untrusted-contributor");
		await expect(
			loadGitHubEvidenceAnchor(url, "raw-manifest", "trusted-maintainer"),
		).rejects.toThrow("immutable issue #1910 provenance");
	});
});
