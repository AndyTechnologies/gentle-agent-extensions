import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { logger } from "../core/logger.js";
import type { McpServerDefinition } from "./types.js";
import { loadBundledMcpServers, validateMcpServerConfig } from "./config-loader.js";
import { registerMcpServer, unregisterMcpServer, registerBundledMcpServers, unregisterBundledMcpServers } from "./registry.js";
import { McpLifecycleManager } from "./lifecycle-manager.js";

export interface McpService {
	loadBundled(): Map<string, McpServerDefinition>;
	registerAll(api: ExtensionAPI, servers: Map<string, McpServerDefinition>): Promise<void>;
	unregisterAll(api: ExtensionAPI, servers: Map<string, McpServerDefinition>): Promise<void>;
	registerOne(api: ExtensionAPI, name: string, server: McpServerDefinition): Promise<boolean>;
	unregisterOne(api: ExtensionAPI, name: string): Promise<boolean>;
	createLifecycleManager(projectCwd: string): McpLifecycleManager;
	validateConfig(config: unknown): config is McpServerDefinition;
}

export function createMcpService(): McpService {
	const validateConfig = validateMcpServerConfig;
	return {
		loadBundled: () => {
			const servers = loadBundledMcpServers();
			logger.info(`Loaded ${servers.size} bundled MCP servers`);
			return servers;
		},
		async registerAll(api, servers) {
			await registerBundledMcpServers(api, servers);
		},
		async unregisterAll(api, servers) {
			await unregisterBundledMcpServers(api, servers);
		},
		async registerOne(api, name, server) {
			return registerMcpServer(api, name, server);
		},
		async unregisterOne(api, name) {
			return unregisterMcpServer(api, name);
		},
		createLifecycleManager(projectCwd) {
			return new McpLifecycleManager("gentle-agent-extensions", projectCwd);
		},
		validateConfig,
	};
}