import { createHash } from "node:crypto";

export type EvidenceFinding = {
	caseId: string;
	file: string;
	line: number;
	title: string;
	variant: "buggy" | "fixed";
};

export type Verification = EvidenceFinding & {
	classification: "proved" | "falsified" | "unverifiable";
	evidence: string;
};

export type PreflightBinding = {
	preflightId: string;
	preflightSha256: string;
	sourceRepositoryIdentity: string;
};

export type BoundPreflight = {
	preflightId: string;
	preflightedRepositories: number;
	primaryCases: string[];
	reserveCases: string[];
	sourceRepositoryIdentity: string;
	status: string;
	[key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function findingKey(input: EvidenceFinding): string {
	return `${input.caseId}\u0000${input.variant}\u0000${input.file}\u0000${input.line}\u0000${input.title}`;
}

function parseFinding(value: unknown, label: string): EvidenceFinding {
	if (
		!isObject(value) ||
		!isNonemptyString(value.caseId) ||
		!isNonemptyString(value.file) ||
		!Number.isSafeInteger(value.line) ||
		(value.line as number) <= 0 ||
		!isNonemptyString(value.title) ||
		(value.variant !== "buggy" && value.variant !== "fixed")
	) {
		throw new Error(`${label} has a malformed finding identity`);
	}
	return value as EvidenceFinding;
}

export function validateVerifications(
	value: unknown,
	scoreableFindings: readonly EvidenceFinding[],
): Verification[] {
	if (!isObject(value) || !Array.isArray(value.entries)) {
		throw new Error("verification evidence must contain an entries array");
	}
	const scoreableKeys = new Set(scoreableFindings.map(findingKey));
	const seen = new Set<string>();
	return value.entries.map((raw, index) => {
		const finding = parseFinding(raw, `verification entry ${index + 1}`);
		if (!isObject(raw)) throw new Error("verification entry must be an object");
		if (!['proved', 'falsified', 'unverifiable'].includes(String(raw.classification))) {
			throw new Error(`verification entry ${index + 1} has an unsupported classification`);
		}
		if (!isNonemptyString(raw.evidence)) {
			throw new Error(`verification entry ${index + 1} has empty evidence`);
		}
		const key = findingKey(finding);
		if (seen.has(key)) throw new Error(`duplicate verification: ${key}`);
		if (!scoreableKeys.has(key)) {
			throw new Error(`verification does not name a scoreable finding: ${key}`);
		}
		seen.add(key);
		return raw as Verification;
	});
}

export function bindContaminationPreflight(
	bytes: string,
	binding: PreflightBinding,
): BoundPreflight {
	const digest = createHash("sha256").update(bytes).digest("hex");
	if (digest !== binding.preflightSha256) {
		throw new Error("contamination preflight digest does not match the scored run");
	}
	const value = JSON.parse(bytes) as unknown;
	if (
		!isObject(value) ||
		!isNonemptyString(value.preflightId) ||
		!Number.isSafeInteger(value.preflightedRepositories) ||
		(value.preflightedRepositories as number) < 0 ||
		!Array.isArray(value.primaryCases) ||
		!value.primaryCases.every(isNonemptyString) ||
		!Array.isArray(value.reserveCases) ||
		!value.reserveCases.every(isNonemptyString) ||
		!isNonemptyString(value.sourceRepositoryIdentity) ||
		!isNonemptyString(value.status)
	) {
		throw new Error("contamination preflight has an invalid schema");
	}
	if (value.preflightId !== binding.preflightId) {
		throw new Error("contamination preflight run identity does not match the scored run");
	}
	if (value.sourceRepositoryIdentity !== binding.sourceRepositoryIdentity) {
		throw new Error("contamination preflight repository identity does not match the scored run");
	}
	return value as BoundPreflight;
}
