import { appendFileSync } from "node:fs";

let providerTurn = 0;
globalThis.fetch = Object.assign(
	(input: string | URL | Request) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (url.startsWith("https://api.github.com/repos/ArcadeAI/safeword/issues/comments/")) {
			const response = process.env.CWGYH0_ANCHOR_RESPONSE;
			if (!response) throw new Error("missing fixture anchor response");
			return Promise.resolve(new Response(response, {
				headers: { "content-type": "application/json" },
				status: 200,
			}));
		}
		providerTurn += 1;
		const logPath = process.env.CWGYH0_FETCH_LOG;
		if (logPath) appendFileSync(logPath, `${providerTurn}\n`);
		if (
			process.env.CWGYH0_FETCH_MODE === "all-schema-failure" ||
			(process.env.CWGYH0_FETCH_MODE === "first-schema-failure" &&
				providerTurn === 1)
		) {
			return Promise.resolve(
				new Response('{"type":"unexpected"}', {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		}
		const successfulTurn =
			process.env.CWGYH0_FETCH_MODE === "first-schema-failure"
				? providerTurn - 1
				: providerTurn;
		const content = successfulTurn % 2 === 1
			? [{
				id: `read-${providerTurn}`,
				input: { path: "package.json" },
				name: "read_file",
				type: "tool_use",
			}]
			: [{
				id: `report-${providerTurn}`,
				input: { couldNotVerify: [], findings: [], summary: "No findings." },
				name: "report_findings",
				type: "tool_use",
			}];
		return Promise.resolve(
			new Response(
				JSON.stringify({
					content,
					stop_reason: "tool_use",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
	},
	{ preconnect: () => undefined },
) as typeof fetch;
