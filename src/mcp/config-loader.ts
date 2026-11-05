import { BUNDLED, readFileSync, existsSync, readdirSync, join } from "../core/paths.js";
import type { McpServerDefinition } from "./types.js";

export function loadBundledMcpServers(): Map<string, McpServerDefinition> {
	const servers = new Map<string, McpServerDefinition>();

	if (!existsSync(BUNDLED.mcp)) return servers;

	for (const file of readdirSync(BUNDLED.mcp)) {
		if (!file.endsWith(".mcp.json")) continue;

		const filePath = join(BUNDLED.mcp, file);
		const content = readFileSync(filePath, "utf8");

		let server: McpServerDefinition;
		try {
			server = JSON.parse(content);
		} catch {
			continue;
		}

		if (!server["name"] || !server["description"] || !server["transport"]) continue;
		if (server["transport"] === "stdio" && !server["command"]) continue;
		if (server["transport"] === "http" && !server["url"]) continue;
		if (!/^[A-Za-z0-9_-]+$/.test(server["name"])) continue;

		servers.set(server["name"], server);
	}

	return servers;
}

export function validateMcpServerConfig(config: unknown): config is McpServerDefinition {
	if (!config || typeof config !== "object") return false;
	
	const server = config as Record<string, unknown>;
	
	if (!server["name"] || typeof server["name"] !== "string") return false;
	if (!server["description"] || typeof server["description"] !== "string") return false;
	if (!server["transport"] || !["stdio", "http"].includes(server["transport"] as string)) return false;
	
	if (server["transport"] === "stdio") {
		if (!server["command"] || typeof server["command"] !== "string") return false;
	}
	
	if (server["transport"] === "http") {
		if (!server["url"] || typeof server["url"] !== "string") return false;
	}
	
	if (server["name"] && !/^[A-Za-z0-9_-]+$/.test(server["name"])) return false;
	
	if (server["exposure"] && !["codemode", "direct", "deferred", "hidden"].includes(server["exposure"] as string)) {
		return false;
	}
	
	if (server["auth"] && typeof server["auth"] === "object" && server["auth"] !== null) {
		const auth = server["auth"] as Record<string, unknown>;
		if (auth["type"] && !["oauth", "bearer", "none"].includes(auth["type"] as string)) {
			return false;
		}
	}
	
	return true;
}