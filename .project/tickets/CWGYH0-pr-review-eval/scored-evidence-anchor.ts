export type EvidenceAnchor = {
	blobPath: string;
	commit: string;
	createdAt: string;
	digest: string;
	digestPath: string;
	repositoryIdentity: string;
};

export async function loadGitHubEvidenceAnchor(
	url: string,
	marker: "canary" | "raw-manifest",
): Promise<EvidenceAnchor> {
	const parsed = new URL(url);
	if (
		parsed.protocol !== "https:" ||
		parsed.hostname !== "api.github.com" ||
		!/^\/repos\/ArcadeAI\/safeword\/issues\/comments\/\d+$/.test(parsed.pathname) ||
		parsed.search !== "" ||
		parsed.hash !== ""
	) {
		throw new Error("evidence anchor must be an issue #1910 GitHub comment API URL");
	}
	const response = await fetch(url, {
		headers: { accept: "application/vnd.github+json" },
	});
	if (!response.ok) throw new Error(`GitHub evidence anchor request failed: ${response.status}`);
	const comment = await response.json() as {
		body?: unknown;
		created_at?: unknown;
		html_url?: unknown;
		updated_at?: unknown;
	};
	if (
		typeof comment.body !== "string" ||
		typeof comment.created_at !== "string" ||
		comment.updated_at !== comment.created_at ||
		typeof comment.html_url !== "string" ||
		!comment.html_url.startsWith("https://github.com/ArcadeAI/safeword/issues/1910#issuecomment-")
	) {
		throw new Error("evidence anchor is missing immutable issue #1910 provenance");
	}
	const prefix = `<!-- cwgyh0-${marker}-anchor:v1 -->`;
	if (!comment.body.startsWith(`${prefix}\n`)) throw new Error(`missing ${marker} anchor marker`);
	const value = JSON.parse(comment.body.slice(prefix.length)) as Partial<EvidenceAnchor>;
	if (
		typeof value.blobPath !== "string" ||
		typeof value.commit !== "string" ||
		typeof value.digest !== "string" ||
		typeof value.digestPath !== "string" ||
		typeof value.repositoryIdentity !== "string"
	) {
		throw new Error("evidence anchor payload is incomplete");
	}
	return { ...value, createdAt: comment.created_at } as EvidenceAnchor;
}
