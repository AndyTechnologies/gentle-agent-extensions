import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { logger } from "../core/logger.js";
import type { McpServerDefinition } from "./types.js";

export async function registerMcpServer(
	api: ExtensionAPI,
	name: string,
	server: McpServerDefinition
): Promise<boolean> {
	const isEnabled = server.enabled !== false;
	if (!isEnabled) return true;

	const config: Record<string, unknown> = {
		description: server.description,
		exposure: server.exposure || "codemode",
		enabled: true,
		timeout: server.timeout || 60,
	};

	if (server.transport === "stdio") {
		config["command"] = server.command;
		config["args"] = server.args || [];
		if (server.env) config["env"] = server.env;
		if (server.cwd) config["cwd"] = server.cwd;
	} else {
		config["url"] = server.url;
		if (server.headers) config["headers"] = server.headers;
		if (server.oauth) config["oauth"] = server.oauth;
	}

	if (server.toolExposure) config["toolExposure"] = server.toolExposure;

	try {
		await api.registerMcpServer(name, config as unknown as Parameters<typeof api.registerMcpServer>[1]);
		logger.info(`Registered MCP server: ${name}`);
		return true;
	} catch (error) {
		logger.error(`Failed to register MCP server ${name}: ${error}`);
		return false;
	}
}

export async function unregisterMcpServer(api: ExtensionAPI, name: string): Promise<boolean> {
	try {
		await api.unregisterMcpServer(name);
		logger.info(`Unregistered MCP server: ${name}`);
		return true;
	} catch (error) {
		logger.error(`Failed to unregister MCP server ${name}: ${error}`);
		return false;
	}
}

export async function registerBundledMcpServers(
	api: ExtensionAPI,
	servers: Map<string, McpServerDefinition>
): Promise<void> {
	for (const [name, server] of servers) {
		await registerMcpServer(api, name, server);
	}
}

export async function unregisterBundledMcpServers(
	api: ExtensionAPI,
	servers: Map<string, McpServerDefinition>
): Promise<void> {
	for (const name of servers.keys()) {
		await unregisterMcpServer(api, name);
	}
}