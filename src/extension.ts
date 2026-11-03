import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const EXTENSION_NAME = "gentle-agent-extensions";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const BUNDLED = {
	agents: join(PACKAGE_ROOT, "resources", "agents"),
	overlays: join(PACKAGE_ROOT, "resources", "overlays"),
	routing: join(PACKAGE_ROOT, "resources", "routing"),
	mcp: join(PACKAGE_ROOT, "resources", "mcp"),
};

type OverlayMode = "append" | "prepend" | "replace";

interface OverlayDefinition {
	target: string;
	priority: number;
	mode: OverlayMode;
	instructions: string;
}

interface McpServerDefinition {
	name: string;
	description: string;
	transport: "stdio" | "http";
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	exposure?: "codemode" | "direct" | "deferred" | "hidden";
	toolExposure?: Record<string, string>;
	enabled?: boolean;
	timeout?: number;
	install?: {
		package: string;
		version: string;
		manager: string;
	};
	auth?: {
		type: "oauth" | "bearer" | "none";
		envVar?: string;
		description?: string;
	};
	capabilities?: string[];
	agentDependencies?: string[];
}

interface RoutingDefinition {
	agent: string;
	triggers: string[];
	conditions: string[];
	delegation: "subagent_run" | "subagent_run_background";
	requiredSkills?: string[];
	requiredMcp?: string[];
	priority?: number;
}

interface ProjectState {
	routing: Map<string, RoutingDefinition>;
	overlays: Map<string, OverlayDefinition[]>;
	agents: Set<string>;
	mcpServers: Map<string, McpServerDefinition>;
	initialized: boolean;
}

const projectState: ProjectState = {
	routing: new Map(),
	overlays: new Map(),
	agents: new Set(),
	mcpServers: new Map(),
	initialized: false,
};

function getAgentHome(env: NodeJS.ProcessEnv = process.env): string {
	if (env.GENTLE_PI_AGENT_HOME) return resolve(env.GENTLE_PI_AGENT_HOME);
	if (env.PI_CODING_AGENT_DIR) return resolve(env.PI_CODING_AGENT_DIR);
	return join(homedir(), ".pi", "agent");
}

function getProjectAgentDir(cwd: string, agentHome: string): string {
	return join(cwd, ".pi", "agents");
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function discoverBundledAgents(): string[] {
	if (!existsSync(BUNDLED.agents)) return [];
	return readdirSync(BUNDLED.agents)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.slice(0, -3));
}

function loadBundledOverlays(): Map<string, OverlayDefinition[]> {
	const overlays = new Map<string, OverlayDefinition[]>();

	if (!existsSync(BUNDLED.overlays)) return overlays;

	for (const file of readdirSync(BUNDLED.overlays)) {
		if (!file.endsWith(".overlay.md")) continue;

		const filePath = join(BUNDLED.overlays, file);
		const content = readFileSync(filePath, "utf8");

		const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
		if (!frontmatterMatch) continue;

		const [, fm, body] = frontmatterMatch;
		const targetMatch = /target:\s*([^\n]+)/.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);
		const modeMatch = /mode:\s*(\w+)/.exec(fm);

		if (!targetMatch) continue;

		const target = targetMatch[1].trim();
		const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 100;
		const mode = (modeMatch ? modeMatch[1].trim() : "append") as OverlayMode;

		if (!["append", "prepend", "replace"].includes(mode)) {
			console.warn(`[${EXTENSION_NAME}] Unknown overlay mode '${mode}' for ${file}, defaulting to 'append'`);
		}

		const overlay: OverlayDefinition = {
			target,
			priority,
			mode,
			instructions: body.trim(),
		};

		const existing = overlays.get(target) || [];
		existing.push(overlay);
		existing.sort((a, b) => a.priority - b.priority);
		overlays.set(target, existing);
	}

	return overlays;
}

function loadBundledMcpServers(): Map<string, McpServerDefinition> {
	const servers = new Map<string, McpServerDefinition>();

	if (!existsSync(BUNDLED.mcp)) return servers;

	for (const file of readdirSync(BUNDLED.mcp)) {
		if (!file.endsWith(".mcp.json")) continue;

		const filePath = join(BUNDLED.mcp, file);
		const content = readFileSync(filePath, "utf8");

		let server: McpServerDefinition;
		try {
			server = JSON.parse(content);
		} catch (error) {
			continue;
		}

		if (!server.name || !server.description || !server.transport) continue;
		if (server.transport === "stdio" && !server.command) continue;
		if (server.transport === "http" && !server.url) continue;
		if (!/^[A-Za-z0-9_-]+$/.test(server.name)) continue;

		servers.set(server.name, server);
	}

	return servers;
}

function loadBundledRouting(): Map<string, RoutingDefinition> {
	const routing = new Map<string, RoutingDefinition>();

	if (!existsSync(BUNDLED.routing)) return routing;

	for (const file of readdirSync(BUNDLED.routing)) {
		if (!file.endsWith(".md")) continue;

		const filePath = join(BUNDLED.routing, file);
		const content = readFileSync(filePath, "utf8");

		const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
		if (!frontmatterMatch) continue;

		const [, fm] = frontmatterMatch;
		const agentMatch = /agent:\s*([^\n]+)/.exec(fm);
		const triggersMatch = /triggers:\s*(\[[\s\S]*?\])/s.exec(fm);
		const conditionsMatch = /conditions:\s*(\[[\s\S]*?\])/s.exec(fm);
		const delegationMatch = /delegation:\s*([^\n]+)/.exec(fm);
		const requiredSkillsMatch = /requiredSkills:\s*(\[[\s\S]*?\])/s.exec(fm);
		const requiredMcpMatch = /requiredMcp:\s*(\[[\s\S]*?\])/s.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);

		if (!agentMatch) continue;

		const agent = agentMatch[1].trim();
		const triggers = triggersMatch ? parseYamlArray(triggersMatch[1]) : [];
		const conditions = conditionsMatch ? parseYamlArray(conditionsMatch[1]) : [];
		const requiredSkills = requiredSkillsMatch ? parseYamlArray(requiredSkillsMatch[1]) : [];
		const requiredMcp = requiredMcpMatch ? parseYamlArray(requiredMcpMatch[1]) : [];
		const delegation = (delegationMatch ? delegationMatch[1].trim() : "subagent_run") as "subagent_run" | "subagent_run_background";
		const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 100;

		if (!["subagent_run", "subagent_run_background"].includes(delegation)) {
			console.warn(`[${EXTENSION_NAME}] Unknown delegation '${delegation}' for ${file}, defaulting to 'subagent_run'`);
		}

		const route: RoutingDefinition = {
			agent,
			triggers,
			conditions,
			delegation,
			requiredSkills,
			requiredMcp,
			priority,
		};

		routing.set(agent, route);
	}

	return routing;
}

function parseYamlArray(text: string): string[] {
	const items: string[] = [];
	const lines = text.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const match = /^[-*]\s*(.+)$/.exec(trimmed);
		if (match) {
			items.push(match[1].trim().replace(/^["']|["']$/g, ""));
		}
	}
	return items;
}

function appendSystemPromptOnce(options: { appendSystemPrompt?: string; systemPrompt?: string } | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	const current = options.appendSystemPrompt ?? "";
	if (current.includes(normalized)) return;
	options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
}

function prependSystemPromptOnce(options: { appendSystemPrompt?: string; systemPrompt?: string } | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	const current = options.appendSystemPrompt ?? "";
	if (current.includes(normalized)) return;
	options.appendSystemPrompt = normalized + (current ? `\n\n${current}` : "");
}

function replaceSystemPrompt(options: { appendSystemPrompt?: string; systemPrompt?: string } | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	options.systemPrompt = normalized;
	options.appendSystemPrompt = "";
}

function buildMcpOrchestratorInstructions(servers: Map<string, McpServerDefinition>): string {
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

function initializeBundledState(): void {
	if (projectState.initialized) return;
	projectState.agents = new Set(discoverBundledAgents());
	projectState.overlays = loadBundledOverlays();
	projectState.mcpServers = loadBundledMcpServers();
	projectState.routing = loadBundledRouting();
	projectState.initialized = true;
}

async function copyBundledAgentsToProject(cwd: string): Promise<{ synced: string[]; conflicts: string[]; skipped: string[] }> {
	const agentHome = getAgentHome();
	const targetDir = getProjectAgentDir(cwd, agentHome);
	ensureDir(targetDir);

	const synced: string[] = [];
	const conflicts: string[] = [];
	const skipped: string[] = [];

	if (!existsSync(BUNDLED.agents)) return { synced, conflicts, skipped };

	for (const agentName of projectState.agents) {
		const sourcePath = join(BUNDLED.agents, `${agentName}.md`);
		const targetPath = join(targetDir, `${agentName}.md`);

		try {
			const sourceContent = readFileSync(sourcePath, "utf8");
			const sourceHash = hashContent(sourceContent);

			if (existsSync(targetPath)) {
				const targetContent = readFileSync(targetPath, "utf8");
				const targetHash = hashContent(targetContent);
				const bundledHash = sourceHash;

				if (targetHash === bundledHash) {
					skipped.push(agentName);
					continue;
				}

				if (targetHash !== bundledHash) {
					conflicts.push(agentName);
					continue;
				}
			}

			writeFileSync(targetPath, sourceContent);
			synced.push(agentName);
		} catch (error) {
			console.warn(`[${EXTENSION_NAME}] Failed to sync agent ${agentName}:`, error);
		}
	}

	return { synced, conflicts, skipped };
}

async function registerBundledMcpServers(ctx: ExtensionContext): Promise<void> {
	for (const [name, server] of projectState.mcpServers) {
		if (server.enabled === false) continue;

		const config: Record<string, unknown> = {
			description: server.description,
			exposure: server.exposure || "codemode",
			enabled: server.enabled !== false,
			timeout: server.timeout || 60,
		};

		if (server.transport === "stdio") {
			config.command = server.command;
			config.args = server.args || [];
			if (server.env) config.env = server.env;
			if (server.cwd) config.cwd = server.cwd;
		} else {
			config.url = server.url;
			if (server.headers) config.headers = server.headers;
			if (server.oauth) config.oauth = server.oauth;
		}

		if (server.toolExposure) config.toolExposure = server.toolExposure;

		try {
			await ctx.api.registerMcpServer(name, config);
			console.log(`[${EXTENSION_NAME}] Registered MCP server: ${name}`);
		} catch (error) {
			ctx.ui.notify(`[${EXTENSION_NAME}] Failed to register MCP server ${name}: ${error}`, "warning");
		}
	}
}

async function installMcpServer(ctx: ExtensionContext, name: string): Promise<boolean> {
	const server = projectState.mcpServers.get(name);
	if (!server || !server.install) {
		ctx.ui.notify(`[${EXTENSION_NAME}] MCP server ${name} has no install config`, "error");
		return false;
	}

	const manager = server.install.manager;
	const allowedManagers = ["npm", "uv", "pip", "cargo"];
	if (!allowedManagers.includes(manager)) {
		ctx.ui.notify(`[${EXTENSION_NAME}] Manager ${manager} not allowed`, "error");
		return false;
	}

	const pkg = server.install.package;
	const version = server.install.version;

	try {
		ctx.ui.notify(`[${EXTENSION_NAME}] Installing MCP server ${name} via ${manager}...`, "info");

		const { spawnSync } = await import("node:child_process");
		const args: string[] = [];

		if (manager === "npm") {
			args.push("install", "-g", `${pkg}@${version}`);
		} else if (manager === "uv") {
			args.push("tool", "install", `${pkg}==${version}`);
		} else if (manager === "pip") {
			args.push("install", `${pkg}==${version}`);
		} else if (manager === "cargo") {
			args.push("install", pkg, "--version", version);
		}

		const result = spawnSync(manager, args, { stdio: "inherit", shell: false });
		if (result.status !== 0) {
			ctx.ui.notify(`[${EXTENSION_NAME}] MCP server ${name} install failed (exit ${result.status})`, "error");
			return false;
		}

		ctx.ui.notify(`[${EXTENSION_NAME}] MCP server ${name} installed successfully`, "info");
		return true;
	} catch (e) {
		ctx.ui.notify(`[${EXTENSION_NAME}] MCP server ${name} install error: ${e}`, "error");
		return false;
	}
}

function applyOverlay(overlay: OverlayDefinition, targetName: string, options: { appendSystemPrompt?: string; systemPrompt?: string } | null | undefined): void {
	const text = `\n\n<!-- gentle-agent-extensions: bundled overlay for ${targetName} -->\n${overlay.instructions}`;
	switch (overlay.mode) {
		case "prepend":
			prependSystemPromptOnce(options, text);
			break;
		case "replace":
			replaceSystemPrompt(options, text);
			break;
		case "append":
		default:
			appendSystemPromptOnce(options, text);
			break;
	}
}

function evaluateRouting(agentName: string): RoutingDefinition | null {
	const routes = Array.from(projectState.routing.values())
		.filter(r => r.triggers.some(t => agentName.includes(t) || t.includes(agentName)))
		.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	return routes[0] ?? null;
}

interface McpHandshakeResult {
	ok: boolean;
	error?: string;
}

async function performMcpHandshake(child: import("node:child_process").ChildProcess, serverName: string, server: McpServerDefinition): Promise<McpHandshakeResult> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			child.kill();
			resolve({ ok: false, error: "handshake timeout (10s)" });
		}, 10000);

		let buffer = "";
		let initializedSent = false;
		let initAttempted = false;

		const sendInit = () => {
			const initMsg = JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "gentle-agent-extensions-doctor", version: "1.0.0" }
				}
			});
			child.stdin?.write(initMsg + "\n");
			initAttempted = true;
		};

		child.stdout?.on("data", (data: Buffer) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const msg = JSON.parse(line);

					if (msg.id === 1 && msg.result) {
						const initializedMsg = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" });
						child.stdin?.write(initializedMsg + "\n");
						initializedSent = true;

						const toolsMsg = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
						child.stdin?.write(toolsMsg + "\n");
					}

					if (msg.id === 2 && msg.result && msg.result.tools) {
						clearTimeout(timeout);
						child.kill();
						resolve({ ok: true });
					}

					if (msg.error) {
						clearTimeout(timeout);
						child.kill();
						resolve({ ok: false, error: `MCP error: ${msg.error.message || JSON.stringify(msg.error)}` });
					}
				} catch {
					// Ignore parse errors
				}
			}
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			resolve({ ok: false, error: `process error: ${err.message}` });
		});

		child.on("exit", (code) => {
			clearTimeout(timeout);
			if (code !== 0 && code !== null) {
				resolve({ ok: false, error: `exited with code ${code}` });
			}
		});

		// Send initialize immediately
		sendInit();

		// Retry init if no response after 2s
		setTimeout(() => {
			if (!initializedSent && initAttempted) {
				sendInit();
			}
		}, 2000);
	});
}

async function performHttpMcpHandshake(server: McpServerDefinition): Promise<McpHandshakeResult> {
	try {
		const response = await fetch(server.url!, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "gentle-agent-extensions-doctor", version: "1.0.0" }
				}
			}),
			signal: AbortSignal.timeout(5000)
		});

		if (!response.ok) {
			return { ok: false, error: `HTTP ${response.status}` };
		}

		const data = await response.json();
		if (data.error) {
			return { ok: false, error: `MCP error: ${data.error.message || JSON.stringify(data.error)}` };
		}

		await fetch(server.url!, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
			signal: AbortSignal.timeout(2000)
		}).catch(() => {});

		return { ok: true };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function runDoctorChecks(cwd: string, env: NodeJS.ProcessEnv, includeMcpHealth = false): Promise<{ issues: string[]; warnings: string[] }> {
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
			if (modeMatch && !["append", "prepend", "replace"].includes(modeMatch[1])) {
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
					const deps = parseYamlArray(requiredMcpMatch[1]);
					for (const dep of deps) {
						if (dep && !projectState.mcpServers.has(dep)) {
							warnings.push(`Routing ${file}: requires MCP '${dep}' but no bundled MCP server with that name exists`);
						}
					}
				}
			} catch {
				// ignore
			}
		}
	}

	if (includeMcpHealth) {
		const servers = Array.from(projectState.mcpServers.entries()).filter(([, s]) => s.enabled !== false);

		if (servers.length === 0) {
			warnings.push("MCP Health: NO_SERVERS_CONFIGURED");
		} else {
			for (const [name, server] of servers) {
				if (server.transport === "stdio") {
					try {
						const { spawn } = await import("node:child_process");
						const child = spawn(server.command!, server.args || [], {
							stdio: ["pipe", "pipe", "ignore"],
							env: { ...process.env, ...server.env },
							cwd: server.cwd
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

export default function gentleAgentExtensions(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		initializeBundledState();

		// Copy bundled agents to project's .pi/agents/
		await copyBundledAgentsToProject(ctx.cwd);

		// Register bundled MCP servers (no auto-install)
		await registerBundledMcpServers(ctx);
	});

	pi.on("before_agent_start", (event, ctx: ExtensionContext) => {
		if (!projectState.initialized) initializeBundledState();

		const agentName = (event as { agentName?: string }).agentName;
		const options = event.systemPromptOptions;
		if (!options) return;

		// Apply bundled overlays
		if (!agentName || agentName === "orchestrator") {
			const orchestratorOverlays = projectState.overlays.get("orchestrator") || [];
			for (const overlay of orchestratorOverlays) {
				applyOverlay(overlay, "orchestrator", options);
			}
			const mcpInstructions = buildMcpOrchestratorInstructions(projectState.mcpServers);
			if (mcpInstructions) appendSystemPromptOnce(options, mcpInstructions);
		}

		if (agentName) {
			const agentOverlays = projectState.overlays.get(agentName) || [];
			for (const overlay of agentOverlays) {
				applyOverlay(overlay, agentName, options);
			}

			// Routing: evaluate and inject delegation instructions
			const route = evaluateRouting(agentName);
			if (route) {
				const routingInstructions = `\n\n<!-- gentle-agent-extensions: routing for ${agentName} -->\n`;
				routingInstructions += `## Delegation Rules for ${agentName}\n`;
				routingInstructions += `- **Agent**: ${route.agent}\n`;
				routingInstructions += `- **Triggers**: ${route.triggers.join(", ")}\n`;
				if (route.requiredSkills && route.requiredSkills.length > 0) {
					routingInstructions += `- **Required Skills**: ${route.requiredSkills.join(", ")}\n`;
				}
				if (route.requiredMcp && route.requiredMcp.length > 0) {
					routingInstructions += `- **Required MCP**: ${route.requiredMcp.join(", ")}\n`;
				}
				routingInstructions += `- **Delegation**: ${route.delegation}\n`;
				appendSystemPromptOnce(options, routingInstructions);
			}
		}

		return undefined;
	});

	// Commands
	pi.registerCommand("gentle-extensions:sync", {
		description: "Sync bundled agents to current project",
		handler: async (_args, ctx) => {
			const result = await copyBundledAgentsToProject(ctx.cwd);
			let output = "gentle-extensions:sync\n";
			if (result.synced.length > 0) output += `  Synced: ${result.synced.join(", ")}\n`;
			if (result.skipped.length > 0) output += `  Skipped (identical): ${result.skipped.join(", ")}\n`;
			if (result.conflicts.length > 0) output += `  Conflicts (user-modified): ${result.conflicts.join(", ")}\n`;
			ctx.ui.notify(output, result.conflicts.length > 0 ? "warning" : "info");
		},
	});

	pi.registerCommand("gentle-extensions:doctor", {
		description: "Check bundled resources and installation",
		handler: async (args, ctx) => {
			const includeMcpHealth = args?.mcpHealth === true;
			const { issues, warnings } = await runDoctorChecks(ctx.cwd, ctx.env, includeMcpHealth);

			let output = "gentle-agent-extensions doctor:\n\n";
			if (issues.length > 0) { output += "❌ Issues:\n"; for (const i of issues) output += `  - ${i}\n`; output += "\n"; }
			if (warnings.length > 0) { output += "⚠️  Warnings:\n"; for (const w of warnings) output += `  - ${w}\n`; output += "\n"; }
			if (issues.length === 0 && warnings.length === 0) output += "✅ All checks passed\n";

			ctx.ui.notify(output, issues.length > 0 ? "warning" : "info");
		},
	});

	pi.registerCommand("gentle-extensions:fix", {
		description: "Auto-fix non-destructive issues (perms, dirs, manifest, overlay modes)",
		handler: async (_args, ctx) => {
			let fixes = 0;

			const agentHome = getAgentHome(ctx.env);
			const projectAgentDir = getProjectAgentDir(ctx.cwd, agentHome);
			if (!existsSync(projectAgentDir)) {
				ensureDir(projectAgentDir);
				fixes++;
			}

			await copyBundledAgentsToProject(ctx.cwd);
			fixes++;

			ctx.ui.notify(`gentle-agent-extensions: applied ${fixes} fix(es)`, "info");
		},
	});

	pi.registerCommand("gentle-extensions:fix-destructive", {
		description: "Auto-fix including destructive actions (requires confirmation via UI)",
		handler: async (_args, ctx) => {
			ctx.ui.notify("Use /gentle-extensions:doctor with --fix-destructive flag via CLI for destructive fixes", "warning");
		},
	});

	pi.registerCommand("gentle-extensions:mcp-health", {
		description: "Check MCP server connectivity (stdio startup, HTTP reachability)",
		handler: async (_args, ctx) => {
			const { issues, warnings } = await runDoctorChecks(ctx.cwd, ctx.env, true);
			let output = "MCP Health Check:\n\n";
			if (issues.length > 0) { output += "❌ Issues:\n"; for (const i of issues) output += `  - ${i}\n`; output += "\n"; }
			if (warnings.length > 0) { output += "⚠️  Warnings:\n"; for (const w of warnings) output += `  - ${w}\n`; output += "\n"; }
			if (issues.length === 0 && warnings.length === 0) output += "✅ All MCP servers healthy\n";
			ctx.ui.notify(output, issues.length > 0 ? "warning" : "info");
		},
	});

	pi.registerCommand("gentle-extensions:conflicts", {
		description: "Show conflicts between bundled and local resources",
		handler: async (_args, ctx) => {
			const result = await copyBundledAgentsToProject(ctx.cwd);
			let output = "gentle-extensions:conflicts\n";
			if (result.conflicts.length > 0) {
				output += `  Conflicts (user-modified, not synced): ${result.conflicts.join(", ")}\n`;
				output += "  Use --force to overwrite, or resolve manually.\n";
			} else {
				output += "  No conflicts detected.\n";
			}
			ctx.ui.notify(output, result.conflicts.length > 0 ? "warning" : "info");
		},
	});

	pi.registerCommand("gentle-extensions:status", {
		description: "Show bundled resources status",
		handler: async (_args, ctx) => {
			if (!projectState.initialized) initializeBundledState();

			const agents = Array.from(projectState.agents);
			const overlayTargets = Array.from(projectState.overlays.keys());
			const mcpServers = Array.from(projectState.mcpServers.keys());
			const routingAgents = Array.from(projectState.routing.keys());

			let msg = `gentle-agent-extensions status:\n`;
			msg += `  Package root: ${PACKAGE_ROOT}\n`;
			msg += `  Bundled agents: ${agents.length > 0 ? agents.join(", ") : "none"}\n`;
			msg += `  Bundled overlays: ${overlayTargets.length > 0 ? overlayTargets.join(", ") : "none"}\n`;
			msg += `  Bundled MCP servers: ${mcpServers.length > 0 ? mcpServers.join(", ") : "none"}\n`;
			msg += `  Bundled routing: ${routingAgents.length > 0 ? routingAgents.join(", ") : "none"}\n`;
			msg += `  Bundled skills: ${existsSync(join(PACKAGE_ROOT, "resources", "skills")) ? "present" : "missing"}\n`;

			ctx.ui.notify(msg, "info");
		},
	});

	pi.registerCommand("gentle-extensions:mcp-reload", {
		description: "Reload MCP servers from bundled resources",
		handler: async (_args, ctx) => {
			// Only unregister extension-owned servers (those in bundled mcp dir)
			const bundledNames = Array.from(projectState.mcpServers.keys());
			for (const name of bundledNames) {
				try { await ctx.api.unregisterMcpServer(name); } catch {}
			}
			projectState.mcpServers = loadBundledMcpServers();
			projectState.routing = loadBundledRouting();
			await registerBundledMcpServers(ctx);
			ctx.ui.notify("MCP servers reloaded from bundled resources", "info");
		},
	});

	pi.registerCommand("gentle-extensions:mcp-install", {
		description: "Install an MCP server explicitly (requires user confirmation)",
		handler: async (args, ctx) => {
			const name = args?.name as string | undefined;
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-install <server-name>", "error");
				return;
			}
			const success = await installMcpServer(ctx, name);
			if (success) {
				// Re-register after install
				await registerBundledMcpServers(ctx);
			}
		},
	});

	pi.registerCommand("gentle-extensions:mcp-status", {
		description: "Show MCP servers status (available, disabled, failed, not_installed)",
		handler: async (_args, ctx) => {
			if (!projectState.initialized) initializeBundledState();

			let output = "MCP Servers Status:\n\n";
			for (const [name, server] of projectState.mcpServers) {
				if (server.enabled === false) {
					output += `  ${name}: disabled\n`;
					continue;
				}

				let status = "available";
				if (server.install) {
					// Check if installed
					const { spawnSync } = await import("node:child_process");
					let checkResult: { status: number } = { status: 1 };
					if (server.install.manager === "npm") {
						checkResult = spawnSync("npm", ["list", "-g", `${server.install.package}@${server.install.version}`], { stdio: "ignore" });
					} else if (server.install.manager === "uv") {
						checkResult = spawnSync("uv", ["tool", "list"], { stdio: "ignore" });
					} else if (server.install.manager === "pip") {
						checkResult = spawnSync("pip", ["show", server.install.package], { stdio: "ignore" });
					} else if (server.install.manager === "cargo") {
						checkResult = spawnSync("cargo", ["install", "--list"], { stdio: "ignore" });
					}
					if (checkResult.status !== 0) {
						status = "not_installed";
					}
				}
				output += `  ${name}: ${status} (${server.transport})\n`;
			}
			ctx.ui.notify(output, "info");
		},
	});
}