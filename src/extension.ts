import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, statSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
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
	// Lifecycle state (populated from persistent state)
	lifecycleState?: "available" | "disabled" | "failed" | "not_installed" | "installing" | "updating";
	installedVersion?: string;
	lastHealthCheck?: number;
	lastError?: string;
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

let mcpLifecycleManager: McpLifecycleManager | null = null;

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

function evaluateRouting(agentName: string, ctx?: { cwd?: string; env?: NodeJS.ProcessEnv }): RoutingDefinition[] {
	const routes = Array.from(projectState.routing.values())
		.filter(r => {
			// Check triggers
			const triggerMatch = r.triggers.some(t => agentName.includes(t) || t.includes(agentName));
			if (!triggerMatch) return false;
			
			// Check conditions
			if (r.conditions && r.conditions.length > 0 && ctx) {
				return r.conditions.every(c => evaluateCondition(c, ctx));
			}
			return true;
		})
		.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	return routes;
}

function evaluateCondition(condition: string, ctx: { cwd?: string; env?: NodeJS.ProcessEnv }): boolean {
	// File existence: file:path/to/file
	if (condition.startsWith("file:")) {
		const filePath = condition.slice(5);
		const fullPath = ctx.cwd ? join(ctx.cwd, filePath) : filePath;
		return existsSync(fullPath);
	}
	// Environment variable: env:VAR_NAME or env:VAR_NAME=value
	if (condition.startsWith("env:")) {
		const envPart = condition.slice(4);
		const eqIdx = envPart.indexOf("=");
		if (eqIdx === -1) {
			return !!ctx.env?.[envPart];
		}
		const varName = envPart.slice(0, eqIdx);
		const expectedValue = envPart.slice(eqIdx + 1);
		return ctx.env?.[varName] === expectedValue;
	}
	// Branch name: branch:branch-name
	if (condition.startsWith("branch:")) {
		const expectedBranch = condition.slice(7);
		try {
			const currentBranch = require("node:child_process")
				.execSync("git branch --show-current", { cwd: ctx.cwd, encoding: "utf8" })
				.trim();
			return currentBranch === expectedBranch;
		} catch {
			return false;
		}
	}
	// Custom function: func:functionName (for future extensibility)
	return false;
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


// ============================================================================
// Resource Graph Validator
// ============================================================================

interface GraphNode {
	id: string;
	type: "agent" | "skill" | "routing" | "overlay" | "mcp" | "manifest";
	label: string;
	path: string;
}

interface GraphEdge {
	from: string;
	to: string;
	type: "references" | "requires" | "triggers" | "overlays" | "depends" | "installs";
}

interface GraphValidationResult {
	nodes: GraphNode[];
	edges: GraphEdge[];
	errors: string[];
	warnings: string[];
}

function buildResourceGraph(cwd: string): GraphValidationResult {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];
	const nodeIds = new Set<string>();

	function addNode(node: GraphNode): void {
		if (nodeIds.has(node.id)) {
			errors.push(`Duplicate node ID: ${node.id}`);
			return;
		}
		nodeIds.add(node.id);
		nodes.push(node);
	}

	function addEdge(edge: GraphEdge): void {
		if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
			warnings.push(`Edge references missing node: ${edge.from} -> ${edge.to}`);
		}
		edges.push(edge);
	}

	// 1. Agents
	if (existsSync(BUNDLED.agents)) {
		for (const file of readdirSync(BUNDLED.agents)) {
			if (!file.endsWith(".md")) continue;
			const agentName = file.slice(0, -3);
			const path = join(BUNDLED.agents, file);
			addNode({ id: `agent:${agentName}`, type: "agent", label: agentName, path });
		}
	}

	// 2. Skills
	const skillsDir = join(PACKAGE_ROOT, "resources", "skills");
	if (existsSync(skillsDir)) {
		for (const skillDir of readdirSync(skillsDir, { withFileTypes: true })) {
			if (!skillDir.isDirectory()) continue;
			const skillName = skillDir.name;
			const skillPath = join(skillsDir, skillName, "SKILL.md");
			addNode({ id: `skill:${skillName}`, type: "skill", label: skillName, path: skillPath });
		}
	}

	// 3. Routing
	if (existsSync(BUNDLED.routing)) {
		for (const file of readdirSync(BUNDLED.routing)) {
			if (!file.endsWith(".md")) continue;
			const routingName = file.slice(0, -3);
			const path = join(BUNDLED.routing, file);
			addNode({ id: `routing:${routingName}`, type: "routing", label: routingName, path });
		}
	}

	// 4. Overlays
	if (existsSync(BUNDLED.overlays)) {
		for (const file of readdirSync(BUNDLED.overlays)) {
			if (!file.endsWith(".overlay.md")) continue;
			const overlayName = file.replace(".overlay.md", "");
			const path = join(BUNDLED.overlays, file);
			addNode({ id: `overlay:${overlayName}`, type: "overlay", label: overlayName, path });
		}
	}

	// 5. MCP Servers
	if (existsSync(BUNDLED.mcp)) {
		for (const file of readdirSync(BUNDLED.mcp)) {
			if (!file.endsWith(".mcp.json")) continue;
			const mcpName = file.replace(".mcp.json", "");
			const path = join(BUNDLED.mcp, file);
			addNode({ id: `mcp:${mcpName}`, type: "mcp", label: mcpName, path });
		}
	}

	// 6. Manifest files
	const manifestPath = join(PACKAGE_ROOT, ".manifest.json");
	addNode({ id: "manifest:root", type: "manifest", label: ".manifest.json", path: manifestPath });
	if (!existsSync(manifestPath)) {
		errors.push("Manifest file .manifest.json not found");
	}

	// Check for circular references (simple DFS)
	const visited = new Set<string>();
	const recStack = new Set<string>();
	const adj = new Map<string, string[]>();

	return { nodes, edges, errors, warnings };
}

function generateGraphVizDot(graph: GraphValidationResult): string {
	let dot = "digraph ResourceGraph {\n";
	dot += "  rankdir=LR;\n";
	dot += "  node [fontname=\"Arial\", fontsize=10];\n";
	dot += "  edge [fontname=\"Arial\", fontsize=8];\n\n";

	const typeColors: Record<string, string> = {
		agent: "#e8a838",
		skill: "#38b8e8",
		routing: "#e838a8",
		overlay: "#38e8a8",
		mcp: "#a838e8",
		manifest: "#e8e838",
	};

	for (const node of graph.nodes) {
		const color = typeColors[node.type] || "#cccccc";
		dot += `  "${node.id}" [label="${node.label}", shape=box, style=filled, fillcolor="${color}", fontcolor="#000000"];\n`;
	}

	dot += "}\n";
	return dot;
}

function generateGraphSummary(graph: GraphValidationResult): string {
	let summary = "Resource Graph Summary\n";
	summary += "========================\n\n";

	const typeCounts = new Map<string, number>();
	for (const node of graph.nodes) {
		typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
	}

	summary += "Nodes:\n";
	for (const [type, count] of typeCounts) {
		summary += `  ${type}: ${count}\n`;
	}
	summary += `  Total: ${graph.nodes.length}\n\n`;

	if (graph.errors.length > 0) {
		summary += "Errors:\n";
		for (const err of graph.errors) summary += `  ❌ ${err}\n`;
		summary += "\n";
	}

	if (graph.warnings.length > 0) {
		summary += "Warnings:\n";
		for (const warn of graph.warnings) summary += `  ⚠️ ${warn}\n`;
		summary += "\n";
	}

	if (graph.errors.length === 0 && graph.warnings.length === 0) {
		summary += "✅ No issues detected\n";
	}

	return summary;
}





// ============================================================================
// MCP Lifecycle Manager
// ============================================================================

interface McpStateEntry {
	name: string;
	lifecycleState: "available" | "disabled" | "failed" | "not_installed" | "installing" | "updating";
	installedVersion?: string;
	lastHealthCheck?: number;
	lastError?: string;
	installConfig?: {
		package: string;
		version: string;
		manager: string;
	};
}

interface McpLifecycleConfig {
	autoInstall: boolean;
	allowList: {
		managers: string[];
		packages: Record<string, string[]>;
	};
	stateFile: string;
}

const DEFAULT_LIFECYCLE_CONFIG: McpLifecycleConfig = {
	autoInstall: false,
	allowList: {
		managers: ["npm", "uv", "pip", "cargo"],
		packages: {
			npm: ["*"],
			uv: ["*"],
			pip: ["*"],
			cargo: ["*"],
		},
	},
	stateFile: ".gentle-agent-extensions/mcp-state.json",
};

class McpLifecycleManager {
	private config: McpLifecycleConfig;
	private state: Map<string, McpStateEntry> = new Map();
	private extensionName: string;

	constructor(extensionName: string, config?: Partial<McpLifecycleConfig>) {
		this.extensionName = extensionName;
		this.config = { ...DEFAULT_LIFECYCLE_CONFIG, ...config };
	}

	private getStateFilePath(cwd: string): string {
		return join(cwd, this.config.stateFile);
	}

	async loadProjectState(cwd: string): Promise<void> {
		const statePath = this.getStateFilePath(cwd);
		if (!existsSync(statePath)) {
			this.state.clear();
			return;
		}
		try {
			const content = readFileSync(statePath, "utf8");
			const data = JSON.parse(content);
			this.state.clear();
			for (const [name, entry] of Object.entries(data)) {
				this.state.set(name, entry as McpStateEntry);
			}
		} catch (e) {
			console.warn(`[${this.extensionName}] Failed to load MCP state: ${e}`);
			this.state.clear();
		}
	}

	async saveProjectState(cwd: string): Promise<void> {
		const statePath = this.getStateFilePath(cwd);
		ensureDir(dirname(statePath));
		const data = Object.fromEntries(this.state);
		writeFileSync(statePath, JSON.stringify(data, null, 2));
	}

	getState(name: string): McpStateEntry | undefined {
		return this.state.get(name);
	}

	getAllStates(): McpStateEntry[] {
		return Array.from(this.state.values());
	}

	async setState(name: string, entry: Partial<McpStateEntry>): Promise<void> {
		const existing = this.state.get(name) || { name };
		this.state.set(name, { ...existing, ...entry });
		await this.saveProjectState(process.cwd());
	}

	isAllowed(manager: string, pkg: string): boolean {
		if (!this.config.allowList.managers.includes(manager)) return false;
		const allowedPackages = this.config.allowList.packages[manager] || [];
		if (allowedPackages.includes("*")) return true;
		return allowedPackages.includes(pkg);
	}

	async detectInstalledVersion(manager: string, pkg: string, version?: string): Promise<string | null> {
				let result;
		switch (manager) {
			case "npm":
				result = spawnSync("npm", ["list", "-g", `${pkg}@${version || ""}`], { stdio: "ignore" });
				break;
			case "uv":
				result = spawnSync("uv", ["tool", "list"], { encoding: "utf8" });
				if (result.status === 0) {
					const lines = result.stdout.split("\n");
					for (const line of lines) {
						if (line.includes(pkg)) {
							const parts = line.split(/\s+/);
							if (parts.length >= 2) return parts[1];
						}
					}
				}
				return null;
			case "pip":
				result = spawnSync("pip", ["show", pkg], { encoding: "utf8" });
				if (result.status === 0) {
					const match = result.stdout.match(/Version: (\S+)/);
					if (match) return match[1];
				}
				return null;
			case "cargo":
				result = spawnSync("cargo", ["install", "--list"], { encoding: "utf8" });
				if (result.status === 0) {
					const lines = result.stdout.split("\n");
					for (const line of lines) {
						if (line.startsWith(pkg + " ")) {
							const parts = line.split(/\s+/);
							if (parts.length >= 2) return parts[1];
						}
					}
				}
				return null;
			default:
				return null;
		}
		if (result.status === 0 && result.stdout) {
			const match = result.stdout.match(new RegExp(`${pkg}@([^\\s]+)`));
			if (match) return match[1];
		}
		return null;
	}

	async install(server: McpServerDefinition, cwd: string): Promise<boolean> {
		if (!server.install) return false;
		const { manager, package: pkg, version } = server.install;
		if (!this.isAllowed(manager, pkg)) {
			throw new Error(`Manager ${manager} or package ${pkg} not in allowList`);
		}
		await this.setState(pkg, { lifecycleState: "installing" });
				const args: string[] = [];
		switch (manager) {
			case "npm":
				args.push("install", "-g", `${pkg}@${version}`);
				break;
			case "uv":
				args.push("tool", "install", `${pkg}==${version}`);
				break;
			case "pip":
				args.push("install", `${pkg}==${version}`);
				break;
			case "cargo":
				args.push("install", pkg, "--version", version);
				break;
			default:
				return false;
		}
		const result = spawnSync(manager, args, { stdio: "inherit", shell: false });
		if (result.status !== 0) {
			await this.setState(pkg, { lifecycleState: "failed", lastError: `Exit code ${result.status}` });
			return false;
		}
		const installedVersion = await this.detectInstalledVersion(manager, pkg, version);
		await this.setState(pkg, {
			lifecycleState: "available",
			installedVersion,
			installConfig: { package: pkg, version, manager },
		});
		return true;
	}

	async uninstall(pkg: string): Promise<boolean> {
		const entry = this.state.get(pkg);
		if (!entry || !entry.installConfig) return false;
		const { manager, package: pkgName, version } = entry.installConfig;
				let args: string[] = [];
		switch (manager) {
			case "npm":
				args.push("uninstall", "-g", pkg);
				break;
			case "uv":
				args.push("tool", "uninstall", pkg);
				break;
			case "pip":
				args.push("uninstall", pkg);
				break;
			case "cargo":
				args.push("uninstall", pkg);
				break;
			default:
				return false;
		}
				const result = spawnSync(manager, args, { stdio: "inherit", shell: false });
		if (result.status !== 0) return false;
		await this.setState(pkg, { lifecycleState: "not_installed", installedVersion: undefined });
		return true;
	}

	async healthCheck(server: McpServerDefinition): Promise<{ ok: boolean; error?: string }> {
		const pkg = server.install?.package || server.name;
		const start = Date.now();
		let result: { ok: boolean; error?: string };
		if (server.transport === "stdio") {
						const child = spawn(server.command!, server.args || [], {
				stdio: ["pipe", "pipe", "ignore"],
				env: { ...process.env, ...server.env },
				cwd: server.cwd
			});
			const result = await performMcpHandshake(child, server.name, server);
			await this.setState(server.name, {
				lifecycleState: result.ok ? "available" : "failed",
				lastHealthCheck: Date.now(),
				lastError: result.error,
			});
			return result;
		} else if (server.transport === "http") {
			const result = await performHttpMcpHandshake(server);
			await this.setState(server.name, {
				lifecycleState: result.ok ? "available" : "failed",
				lastHealthCheck: Date.now(),
				lastError: result.error,
			});
			return result;
		}
		return { ok: false, error: "Unknown transport" };
	}

	async getStatusReport(): Promise<string> {
		const entries = this.getAllStates();
		if (entries.length === 0) return "No MCP servers configured.";
		let report = "MCP Servers Status:\n\n";
		for (const entry of entries) {
			const state = entry.lifecycleState || "unknown";
			const version = entry.installedVersion ? ` v${entry.installedVersion}` : "";
			const health = entry.lastHealthCheck ? ` (last check: ${Math.round((Date.now() - entry.lastHealthCheck) / 1000)}s ago)` : "";
			const error = entry.lastError ? ` - ${entry.lastError}` : "";
			report += `  ${entry.name}${version}: ${state}${health}${error}\n`;
		}
		return report;
	}
}


export default function gentleAgentExtensions(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		initializeBundledState();

		// Copy bundled agents to project's .pi/agents/
		await copyBundledAgentsToProject(ctx.cwd);

		// Initialize MCP Lifecycle Manager
		const mcpLifecycleManager = new McpLifecycleManager(EXTENSION_NAME);
		await mcpLifecycleManager.loadProjectState(ctx.cwd);

		// Register bundled MCP servers (no auto-install)
		await registerBundledMcpServers(ctx);
		
		// Sync lifecycle state with registered servers
		for (const [name, server] of projectState.mcpServers) {
			const state = mcpLifecycleManager.getState(name);
			if (state) {
				server.lifecycleState = state.lifecycleState;
				server.installedVersion = state.installedVersion;
				server.lastHealthCheck = state.lastHealthCheck;
				server.lastError = state.lastError;
			}
		}
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
			const routes = evaluateRouting(agentName, { cwd: ctx.cwd, env: ctx.env });
			if (routes.length > 0) {
				const primaryRoute = routes[0];
				const routingInstructions = `

<!-- gentle-agent-extensions: routing for ${agentName} -->
`;
				routingInstructions += `## Delegation Rules for ${agentName}
`;
				routingInstructions += `- **Primary Agent**: ${primaryRoute.agent}
`;
				routingInstructions += `- **Triggers**: ${primaryRoute.triggers.join(", ")}
`;
				if (primaryRoute.requiredSkills && primaryRoute.requiredSkills.length > 0) {
					routingInstructions += `- **Required Skills**: ${primaryRoute.requiredSkills.join(", ")}
`;
				}
				if (primaryRoute.requiredMcp && primaryRoute.requiredMcp.length > 0) {
					routingInstructions += `- **Required MCP**: ${primaryRoute.requiredMcp.join(", ")}
`;
				}
				routingInstructions += `- **Delegation**: ${primaryRoute.delegation}
`;
				routingInstructions += `- **Priority**: ${primaryRoute.priority ?? 100}
`;
				if (routes.length > 1) {
					routingInstructions += `
**Fallback Routes** (lower priority):
`;
					for (let i = 1; i < routes.length; i++) {
						const r = routes[i];
						routingInstructions += `- ${r.agent} (priority ${r.priority ?? 100}): triggers=${r.triggers.join(",")}
`;
					}
				}
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
			const includeGraph = args?.graph === true;

			if (includeGraph) {
				const graph = buildResourceGraph(ctx.cwd);
				const summary = generateGraphSummary(graph);
				const dot = generateGraphVizDot(graph);
				let output = "Resource Graph:\n\n" + summary;
				if (args?.dot) {
					output += "\n\nGraphViz DOT:\n" + dot;
				}
				ctx.ui.notify(output, graph.errors.length > 0 ? "error" : "info");
				return;
			}

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
			if (!mcpLifecycleManager) {
				ctx.ui.notify("MCP Lifecycle Manager not initialized", "error");
				return;
			}
			if (!projectState.initialized) initializeBundledState();

			let output = "MCP Health Check:\n\n";
			let hasErrors = false;
			for (const [name, server] of projectState.mcpServers) {
				if (server.enabled === false) continue;
				const result = await mcpLifecycleManager.healthCheck(server);
				const status = result.ok ? "✅" : "❌";
				output += `  ${status} ${name} (${server.transport}): ${result.ok ? "healthy" : result.error || "failed"}\n`;
				if (!result.ok) hasErrors = true;
			}
			if (!hasErrors) output += "✅ All MCP servers healthy\n";
			ctx.ui.notify(output, hasErrors ? "error" : "info");
		},
	});pi.registerCommand("gentle-extensions:conflicts", {
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
			if (!mcpLifecycleManager) {
				ctx.ui.notify("MCP Lifecycle Manager not initialized", "error");
				return;
			}
			const server = projectState.mcpServers.get(name);
			if (!server) {
				ctx.ui.notify(`MCP server ${name} not found`, "error");
				return;
			}
			try {
				const success = await mcpLifecycleManager.install(server, ctx.cwd);
				if (success) {
					ctx.ui.notify(`MCP server ${name} installed successfully`, "info");
					await registerBundledMcpServers(ctx);
				} else {
					ctx.ui.notify(`Failed to install MCP server ${name}`, "error");
				}
			} catch (e) {
				ctx.ui.notify(`Install error: ${e}`, "error");
			}
		},
	});

		pi.registerCommand("gentle-extensions:mcp-status", {
		description: "Show MCP servers status (available, disabled, failed, not_installed)",
		handler: async (_args, ctx) => {
			if (!mcpLifecycleManager) {
				ctx.ui.notify("MCP Lifecycle Manager not initialized", "error");
				return;
			}
			const report = await mcpLifecycleManager.getStatusReport();
			ctx.ui.notify(report, "info");
		},
	pi.registerCommand("gentle-extensions:mcp-uninstall", {
		description: "Uninstall an MCP server explicitly",
		handler: async (args, ctx) => {
			const name = args?.name as string | undefined;
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-uninstall <server-name>", "error");
				return;
			}
			if (!mcpLifecycleManager) {
				ctx.ui.notify("MCP Lifecycle Manager not initialized", "error");
				return;
			}
			try {
				const success = await mcpLifecycleManager.uninstall(name);
				if (success) {
					ctx.ui.notify("MCP server " + name + " uninstalled successfully", "info");
					await registerBundledMcpServers(ctx);
				} else {
					ctx.ui.notify("Failed to uninstall MCP server " + name, "error");
				}
			} catch (e) {
				ctx.ui.notify("Uninstall error: " + e, "error");
			}
		},
	});

	pi.registerCommand("gentle-extensions:mcp-logs", {
		description: "Show MCP server logs (stdio stderr/stdout)",
		handler: async (args, ctx) => {
			if (!mcpLifecycleManager) {
				ctx.ui.notify("MCP Lifecycle Manager not initialized", "error");
				return;
			}
			const name = args?.name as string | undefined;
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-logs <server-name>", "error");
				return;
			}
			ctx.ui.notify("MCP logs retrieval not yet implemented for this server", "warning");
		},
	});
});