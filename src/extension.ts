import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

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

interface ProjectState {
	overlays: Map<string, OverlayDefinition[]>;
	agents: Set<string>;
	mcpServers: Map<string, McpServerDefinition>;
	initialized: boolean;
}

const projectState: ProjectState = {
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
	projectState.initialized = true;
}

async function copyBundledAgentsToProject(cwd: string): Promise<void> {
	const agentHome = getAgentHome();
	const targetDir = getProjectAgentDir(cwd, agentHome);
	ensureDir(targetDir);

	if (!existsSync(BUNDLED.agents)) return;

	for (const agentName of projectState.agents) {
		const sourcePath = join(BUNDLED.agents, `${agentName}.md`);
		const targetPath = join(targetDir, `${agentName}.md`);

		try {
			const sourceContent = readFileSync(sourcePath, "utf8");
			let shouldWrite = true;

			if (existsSync(targetPath)) {
				const targetContent = readFileSync(targetPath, "utf8");
				if (targetContent === sourceContent) shouldWrite = false;
			}

			if (shouldWrite) {
				writeFileSync(targetPath, sourceContent);
			}
		} catch (error) {
			console.warn(`[${EXTENSION_NAME}] Failed to sync agent ${agentName}:`, error);
		}
	}
}

function registerBundledMcpServers(ctx: ExtensionContext): void {
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
			ctx.api.registerMcpServer(name, config);
		} catch (error) {
			ctx.ui.notify(`[${EXTENSION_NAME}] Failed to register MCP server ${name}: ${error}`, "warning");
		}
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

	// Check bundled MCPs
	if (existsSync(BUNDLED.mcp)) {
		for (const file of readdirSync(BUNDLED.mcp)) {
			if (!file.endsWith(".mcp.json")) continue;
			try {
				const config = JSON.parse(readFileSync(join(BUNDLED.mcp, file), "utf8"));
				if (!config.name || !config.description || !config.transport) {
					issues.push(`Bundled MCP ${file}: missing required fields`);
				}
				if (config.transport === "stdio" && !config.command) issues.push(`Bundled MCP ${file}: stdio missing command`);
				if (config.transport === "http" && !config.url) issues.push(`Bundled MCP ${file}: http missing url`);
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

	// MCP Health Check
	if (includeMcpHealth) {
		for (const [name, server] of projectState.mcpServers) {
			if (server.enabled === false) continue;
			if (server.transport === "stdio") {
				try {
					const { spawn } = await import("node:child_process");
					const child = spawn(server.command!, server.args || [], { stdio: "ignore" });
					await new Promise<void>((resolve, reject) => {
						const timer = setTimeout(() => {
							child.kill();
							resolve();
						}, 2000);
						child.on("error", () => {
							clearTimeout(timer);
							reject(new Error("failed to start"));
						});
						child.on("exit", (code) => {
							clearTimeout(timer);
							if (code !== 0 && code !== null) reject(new Error(`exited with ${code}`));
							else resolve();
						});
					});
				} catch {
					warnings.push(`MCP ${name}: stdio server failed to start`);
				}
			} else if (server.transport === "http") {
				try {
					const response = await fetch(server.url!, { method: "HEAD", signal: AbortSignal.timeout(5000) });
					if (!response.ok) warnings.push(`MCP ${name}: HTTP ${response.status} at ${server.url}`);
				} catch {
					warnings.push(`MCP ${name}: HTTP server not reachable at ${server.url}`);
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

		// Register bundled MCP servers
		registerBundledMcpServers(ctx);
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
		}

		return undefined;
	});

	// Commands
	pi.registerCommand("gentle-extensions:sync", {
		description: "Sync bundled agents to current project",
		handler: async (_args, ctx) => {
			await copyBundledAgentsToProject(ctx.cwd);
			ctx.ui.notify("gentle-agent-extensions: bundled agents synced to project", "info");
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

			// Ensure project agent dir exists
			const agentHome = getAgentHome(ctx.env);
			const projectAgentDir = getProjectAgentDir(ctx.cwd, agentHome);
			if (!existsSync(projectAgentDir)) {
				ensureDir(projectAgentDir);
				fixes++;
			}

			// Fix overlay mode defaults (in bundled resources - read only, so we fix at runtime)
			// Actually bundled resources are read-only, we apply defaults in applyOverlay

			// Re-sync agents
			await copyBundledAgentsToProject(ctx.cwd);
			fixes++;

			ctx.ui.notify(`gentle-agent-extensions: applied ${fixes} fix(es)`, "info");
		},
	});

	pi.registerCommand("gentle-extensions:fix-destructive", {
		description: "Auto-fix including destructive actions (requires confirmation via UI)",
		handler: async (_args, ctx) => {
			// This would need UI confirmation - for now delegate to doctor with flag
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
		description: "Interactive conflict resolution for shadowing agents and unknown overlay targets",
		handler: async (_args, ctx) => {
			ctx.ui.notify("Interactive conflict resolution not yet implemented in extension. Use CLI doctor --interactive.", "warning");
		},
	});

	pi.registerCommand("gentle-extensions:status", {
		description: "Show bundled resources status",
		handler: async (_args, ctx) => {
			if (!projectState.initialized) initializeBundledState();

			const agents = Array.from(projectState.agents);
			const overlayTargets = Array.from(projectState.overlays.keys());
			const mcpServers = Array.from(projectState.mcpServers.keys());

			let msg = `gentle-agent-extensions status:\n`;
			msg += `  Package root: ${PACKAGE_ROOT}\n`;
			msg += `  Bundled agents: ${agents.length > 0 ? agents.join(", ") : "none"}\n`;
			msg += `  Bundled overlays: ${overlayTargets.length > 0 ? overlayTargets.join(", ") : "none"}\n`;
			msg += `  Bundled MCP servers: ${mcpServers.length > 0 ? mcpServers.join(", ") : "none"}\n`;
			msg += `  Bundled skills: ${existsSync(join(PACKAGE_ROOT, "resources", "skills")) ? "present" : "missing"}\n`;

			ctx.ui.notify(msg, "info");
		},
	});

	pi.registerCommand("gentle-extensions:mcp-reload", {
		description: "Reload MCP servers from bundled resources",
		handler: async (_args, ctx) => {
			for (const [name] of projectState.mcpServers) {
				try { ctx.api.unregisterMcpServer(name); } catch {}
			}
			projectState.mcpServers = loadBundledMcpServers();
			registerBundledMcpServers(ctx);
			ctx.ui.notify("MCP servers reloaded from bundled resources", "info");
		},
	});
}