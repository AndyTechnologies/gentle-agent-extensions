import { BUNDLED, existsSync, readFileSync, readdirSync, join, getAgentHome } from "../core/paths.js";
import type { DoctorCheckResult } from "./types.js";
import type { McpServerDefinition } from "../mcp/types.js";
import { performMcpHandshake, performHttpMcpHandshake } from "../mcp/handshake.js";
import { spawn } from "node:child_process";
import { parseYamlArray } from "../core/utils.js";

function getMatchGroup(match: RegExpExecArray | null, index: number): string {
	if (!match || match.length <= index) return "";
	return match[index] ?? "";
}

export async function runDoctorChecks(
	_cwd: string,
	env: NodeJS.ProcessEnv,
	includeMcpHealth = false,
	mcpServers?: Map<string, McpServerDefinition>
): Promise<DoctorCheckResult> {
	const issues: string[] = [];
	const warnings: string[] = [];

	// Check bundled agents
	if (!existsSync(BUNDLED.agents)) {
		warnings.push("Bundled agents directory missing");
	} else {
		for (const file of readdirSync(BUNDLED.agents)) {
			if (!file.endsWith(".md")) continue;
			const content = readFileSync(join(BUNDLED.agents, file), "utf8");
			if (!content.startsWith("---")) issues.push(`Bundled agent ${file}: missing frontmatter`);
			if (!/^name:/m.test(content)) issues.push(`Bundled agent ${file}: missing 'name'`);
		}
	}

	// Check bundled overlays
	if (!existsSync(BUNDLED.overlays)) {
		warnings.push("Bundled overlays directory missing");
	} else {
		for (const file of readdirSync(BUNDLED.overlays)) {
			if (!file.endsWith(".overlay.md")) continue;
			const content = readFileSync(join(BUNDLED.overlays, file), "utf8");
			if (!/^target:/m.test(content)) issues.push(`Bundled overlay ${file}: missing 'target'`);
			const modeMatch = /^mode:\s*(\w+)/m.exec(content);
			if (modeMatch && modeMatch[1] && !["append", "prepend", "replace"].includes(modeMatch[1])) {
				issues.push(`Bundled overlay ${file}: invalid mode '${modeMatch[1]}'`);
			}
		}
	}

	// Check bundled MCPs - enhanced validation
	if (existsSync(BUNDLED.mcp)) {
		const seenNames = new Set<string>();
		for (const file of readdirSync(BUNDLED.mcp)) {
			if (!file.endsWith(".mcp.json")) continue;
			try {
				const config = JSON.parse(readFileSync(join(BUNDLED.mcp, file), "utf8"));
				if (!config.name || !config.description || !config.transport) {
					issues.push(`Bundled MCP ${file}: missing required fields (name, description, transport)`);
				}
				if (config.name) {
					if (seenNames.has(config.name)) {
						issues.push(`Bundled MCP ${file}: duplicate name '${config.name}'`);
					}
					seenNames.add(config.name);
				}
				if (config.transport !== "stdio" && config.transport !== "http") {
					issues.push(`Bundled MCP ${file}: invalid transport '${config.transport}' (must be stdio or http)`);
				}
				if (config.transport === "stdio" && !config.command) issues.push(`Bundled MCP ${file}: stdio missing command`);
				if (config.transport === "http" && !config.url) issues.push(`Bundled MCP ${file}: http missing url`);
				if (config.exposure && !["codemode", "direct", "deferred", "hidden"].includes(config.exposure)) {
					issues.push(`Bundled MCP ${file}: invalid exposure '${config.exposure}'`);
				}
				if (config.auth && !["oauth", "bearer", "none"].includes(config.auth.type)) {
					issues.push(`Bundled MCP ${file}: invalid auth type '${config.auth.type}'`);
				}
			} catch {
				issues.push(`Bundled MCP ${file}: invalid JSON`);
			}
		}
	}

	// Check extension installation
	const agentHome = getAgentHome(env);
	const extensionTarget = join(agentHome, "extensions", "gentle-agent-extensions.ts");
	let extensionInstalled = false;
	if (existsSync(extensionTarget)) {
		extensionInstalled = true;
	} else {
		const settingsJson = join(agentHome, "settings.json");
		if (existsSync(settingsJson) && readFileSync(settingsJson, "utf8").includes("gentle-agent-extensions")) {
			extensionInstalled = true;
		}
	}
	if (!extensionInstalled) {
		issues.push("Extension not installed (run: pi install npm:gentle-agent-extensions or pi install git:...)");
	}

	// Check agent MCP dependencies (from routing, not agent frontmatter)
	if (existsSync(BUNDLED.routing)) {
		for (const file of readdirSync(BUNDLED.routing)) {
			if (!file.endsWith(".md")) continue;
			try {
				const content = readFileSync(join(BUNDLED.routing, file), "utf8");
				const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
				if (!frontmatterMatch) continue;
				const [, fm] = frontmatterMatch;
				const requiredMcpMatch = /requiredMcp:\s*(\[[\s\S]*?\])/s.exec(fm);
				if (requiredMcpMatch) {
					const deps = parseYamlArray(getMatchGroup(requiredMcpMatch, 1));
					for (const dep of deps) {
						if (dep && mcpServers && !mcpServers.has(dep)) {
							warnings.push(`Routing ${file}: requires MCP '${dep}' but no bundled MCP server with that name exists`);
						}
					}
				}
			} catch {
				// ignore
			}
		}
	}

	if (includeMcpHealth && mcpServers) {
		const servers = Array.from(mcpServers.entries()).filter(([, s]) => s.enabled !== false);

		if (servers.length === 0) {
			warnings.push("MCP Health: NO_SERVERS_CONFIGURED");
		} else {
			for (const [name, server] of servers) {
				if (server.transport === "stdio") {
					try {
						const child = spawn(server.command ?? "", server.args || [], {
							stdio: ["pipe", "pipe", "ignore"],
							env: { ...process.env, ...server.env },
							cwd: server.cwd,
						});

						const result = await performMcpHandshake(child, name, server);
						if (!result.ok) {
							warnings.push(`MCP ${name}: ${result.error}`);
						}
					} catch (e) {
						warnings.push(`MCP ${name}: stdio server error - ${e instanceof Error ? e.message : String(e)}`);
					}
				} else if (server.transport === "http") {
					try {
						const result = await performHttpMcpHandshake(server);
						if (!result.ok) {
							warnings.push(`MCP ${name}: ${result.error}`);
						}
					} catch (e) {
						warnings.push(`MCP ${name}: HTTP server error - ${e instanceof Error ? e.message : String(e)}`);
					}
				}
			}
		}
	}

	return { issues, warnings };
}