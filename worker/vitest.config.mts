import { readFileSync } from "node:fs";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		{
			name: "raw-markdown",
			enforce: "pre",
			load(id) {
				if (!id.endsWith(".md")) {
					return;
				}

				return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
			},
		},
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
});
