import type { McpServerDefinition } from "./types.js";

export function buildMcpOrchestratorInstructions(servers: Map<string, McpServerDefinition>): string {
	const enabled = Array.from(servers.values()).filter((s) => s.enabled !== false);
	if (enabled.length === 0) return "";

	let instructions = "\n\n<!-- gentle-agent-extensions: bundled MCP servers -->\n";
	instructions += "## Available MCP Servers (bundled)\n\n";
	instructions += "The following MCP servers are registered and available for use:\n\n";

	for (const server of enabled) {
		instructions += `### ${server.name}\n`;
		instructions += `- **Description**: ${server.description}\n`;
		instructions += `- **Transport**: ${server.transport}\n`;
		if (server.transport === "stdio") {
			instructions += `- **Command**: ${server.command} ${server.args?.join(" ") || ""}\n`;
		} else {
			instructions += `- **URL**: ${server.url}\n`;
		}
		if (server.exposure) instructions += `- **Exposure**: ${server.exposure}\n`;
		if (server.capabilities && server.capabilities.length > 0) instructions += `- **Capabilities**: ${server.capabilities.join(", ")}\n`;
		if (server.agentDependencies && server.agentDependencies.length > 0) instructions += `- **Recommended for agents**: ${server.agentDependencies.join(", ")}\n`;
		instructions += "\n";
	}

	instructions += "When a task requires capabilities from these servers, consider delegating to agents that declare those MCP dependencies, or use the MCP tools directly via `codemode` or `tool_search`.\n";
	return instructions;
}