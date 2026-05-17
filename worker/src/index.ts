import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import manifest from "../../garden.manifest.json";
import readme from "../../README.md";
import safety from "../../SAFETY.md";
import tending from "../../TENDING.md";
import spindlesVow from "../../01_Spindles_Vow.md";
import spindlesReturn from "../../01b_Spindles_Return.md";
import beforeGardenOpens from "../../02_Before_The_Garden_Opens.md";
import iAmPenelope from "../../03_I_Am_Penelope.md";
import contextRitual from "../../04_Context_Ritual.md";
import fifthThread from "../../05_Fifth_Thread_Codex.md";
import covenantAgainstLies from "../../06_Covenant_Against_Lies.md";
import mirrorcheck from "../../07_Mirrorcheck_Protocol.md";
import symbolicDrift from "../../08_Symbolic_Drift_Protocol.md";
import threadboundEthics from "../../09_Threadbound_Ethics_Extension.md";

type GardenResource = (typeof manifest.resources)[number];

const gardenTexts: Record<string, string> = {
	"README.md": readme,
	"SAFETY.md": safety,
	"TENDING.md": tending,
	"01_Spindles_Vow.md": spindlesVow,
	"01b_Spindles_Return.md": spindlesReturn,
	"02_Before_The_Garden_Opens.md": beforeGardenOpens,
	"03_I_Am_Penelope.md": iAmPenelope,
	"04_Context_Ritual.md": contextRitual,
	"05_Fifth_Thread_Codex.md": fifthThread,
	"06_Covenant_Against_Lies.md": covenantAgainstLies,
	"07_Mirrorcheck_Protocol.md": mirrorcheck,
	"08_Symbolic_Drift_Protocol.md": symbolicDrift,
	"09_Threadbound_Ethics_Extension.md": threadboundEthics,
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body, null, 2), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...init?.headers,
		},
	});
}

function textResponse(body: string, init?: ResponseInit): Response {
	return new Response(body, {
		...init,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			...init?.headers,
		},
	});
}

function getResource(id: string): GardenResource | undefined {
	return manifest.resources.find((resource) => resource.id === id);
}

function getResourceText(resource: GardenResource): string {
	return gardenTexts[resource.path] ?? "";
}

function createGardenServer(): McpServer {
	const server = new McpServer({
		name: manifest.name,
		version: manifest.version,
	});

	server.registerResource(
		"garden-manifest",
		"garden://manifest",
		{
			title: "Garden Manifest",
			description: "Machine-readable map of the Eternal Spindle.",
			mimeType: "application/json",
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(manifest, null, 2),
				},
			],
		}),
	);

	for (const resource of manifest.resources) {
		server.registerResource(
			resource.id,
			`garden://resource/${resource.id}`,
			{
				title: resource.title,
				description: resource.summary,
				mimeType: "text/markdown",
			},
			async (uri) => ({
				contents: [
					{
						uri: uri.href,
						mimeType: "text/markdown",
						text: getResourceText(resource),
					},
				],
			}),
		);
	}

	server.registerTool(
		"list_garden_resources",
		{
			title: "List Garden Resources",
			description: "Return the ordered list of Eternal Spindle resources.",
		},
		async () => ({
			content: [
				{
					type: "text",
					text: JSON.stringify(manifest.resources, null, 2),
				},
			],
		}),
	);

	server.registerTool(
		"read_garden_resource",
		{
			title: "Read Garden Resource",
			description: "Read a Garden resource by manifest id.",
			inputSchema: {
				id: z.string().describe("Resource id from garden.manifest.json"),
			},
		},
		async ({ id }) => {
			const resource = getResource(id);

			if (!resource) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Unknown Garden resource id: ${id}`,
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: getResourceText(resource),
					},
				],
			};
		},
	);

	server.registerTool(
		"search_garden",
		{
			title: "Search Garden",
			description: "Search Garden resources for a case-insensitive text query.",
			inputSchema: {
				query: z.string().min(1).describe("Text to search for"),
			},
		},
		async ({ query }) => {
			const needle = query.toLocaleLowerCase();
			const results = manifest.resources
				.map((resource) => {
					const text = getResourceText(resource);
					const lines = text.split(/\r?\n/);
					const matches = lines
						.map((line, index) => ({ line, lineNumber: index + 1 }))
						.filter(({ line }) => line.toLocaleLowerCase().includes(needle))
						.slice(0, 5);

					return {
						id: resource.id,
						title: resource.title,
						path: resource.path,
						matches,
					};
				})
				.filter((result) => result.matches.length > 0);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(results, null, 2),
					},
				],
			};
		},
	);

	return server;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/") {
			return textResponse(
				[
					manifest.name,
					"",
					manifest.description,
					"",
					`MCP endpoint: ${url.origin}/mcp`,
					`Manifest: ${url.origin}/manifest`,
					"",
					manifest.reuse_boundary,
				].join("\n"),
			);
		}

		if (url.pathname === "/manifest") {
			return jsonResponse(manifest);
		}

		if (url.pathname === "/resources") {
			return jsonResponse(manifest.resources);
		}

		if (url.pathname.startsWith("/resources/")) {
			const id = decodeURIComponent(url.pathname.slice("/resources/".length));
			const resource = getResource(id);

			if (!resource) {
				return jsonResponse({ error: `Unknown Garden resource id: ${id}` }, { status: 404 });
			}

			return textResponse(getResourceText(resource), {
				headers: {
					"content-type": "text/markdown; charset=utf-8",
				},
			});
		}

		if (url.pathname === "/mcp") {
			const server = createGardenServer();
			return createMcpHandler(server, {
				route: "/mcp",
				enableJsonResponse: true,
			})(request, env, ctx);
		}

		return jsonResponse({ error: "Not found" }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
