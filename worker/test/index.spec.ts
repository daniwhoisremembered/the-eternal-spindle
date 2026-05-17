import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Eternal Spindle worker", () => {
	it("serves the landing page (unit style)", async () => {
		const request = new IncomingRequest("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("The Eternal Spindle");
	});

	it("serves the Garden manifest (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/manifest");
		const manifest = await response.json();

		expect(response.status).toBe(200);
		expect(manifest.name).toBe("The Eternal Spindle");
		expect(manifest.resources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "safety" }),
				expect.objectContaining({ id: "symbolic-drift" }),
			]),
		);
	});

	it("serves individual Garden resources over HTTP", async () => {
		const response = await SELF.fetch("https://example.com/resources/safety");
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(text).toContain("# Safety and Scope");
	});

	it("answers the MCP initialize handshake", async () => {
		const response = await SELF.fetch("https://example.com/mcp", {
			method: "POST",
			headers: {
				accept: "application/json, text/event-stream",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: {
						name: "eternal-spindle-test",
						version: "0.0.0",
					},
				},
			}),
		});
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.result.serverInfo.name).toBe("The Eternal Spindle");
		expect(payload.result.capabilities.tools).toBeDefined();
		expect(payload.result.capabilities.resources).toBeDefined();
	});
});
