import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const EXTENSION_NAME = "gentle-agent-extensions";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_DIR = join(PROJECT_ROOT, "agents");
const OVERLAYS_DIR = join(PROJECT_ROOT, "overlays");
const ROUTING_DIR = join(PROJECT_ROOT, "routing");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const MCP_DIR = join(PROJECT_ROOT, "mcp");
const MANIFEST_PATH = join(PROJECT_ROOT, ".manifest.json");

interface OverlayDefinition {
	target: string;
	priority: number;
	mode: "append";
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

function loadManifest(): any {
	if (!existsSync(MANIFEST_PATH)) return { managedPaths: {} };
	try {
		return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
	} catch {
		return { managedPaths: {} };
	}
}

function saveManifest(manifest: any): void {
	writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function discoverProjectAgents(): string[] {
	if (!existsSync(AGENTS_DIR)) return [];
	return readdirSync(AGENTS_DIR)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.slice(0, -3));
}

function loadOverlays(): Map<string, OverlayDefinition[]> {
	const overlays = new Map<string, OverlayDefinition[]>();

	if (!existsSync(OVERLAYS_DIR)) return overlays;

	for (const file of readdirSync(OVERLAYS_DIR)) {
		if (!file.endsWith(".overlay.md")) continue;

		const filePath = join(OVERLAYS_DIR, file);
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
		const mode = (modeMatch ? modeMatch[1].trim() : "append") as "append";

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

function loadMcpServers(): Map<string, McpServerDefinition> {
	const servers = new Map<string, McpServerDefinition>();

	if (!existsSync(MCP_DIR)) return servers;

	for (const file of readdirSync(MCP_DIR)) {
		if (!file.endsWith(".mcp.json")) continue;

		const filePath = join(MCP_DIR, file);
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

function getAgentHome(env: NodeJS.ProcessEnv = process.env): string {
	if (env.GENTLE_PI_AGENT_HOME) return resolve(env.GENTLE_PI_AGENT_HOME);
	if (env.PI_CODING_AGENT_DIR) return resolve(env.PI_CODING_AGENT_DIR);
	return join(homedir(), ".pi", "agent");
}

function getProjectAgentDirs(cwd: string, agentHome: string): Array<{ dir: string; scope: string }> {
	return [
		{ dir: join(agentHome, "agents"), scope: "global" },
		{ dir: join(agentHome, "subagents"), scope: "global" },
		{ dir: join(cwd, ".pi", "agents"), scope: "project" },
		{ dir: join(cwd, ".pi", "subagents"), scope: "project" },
	];
}

function resolveProjectAgentDir(cwd: string, agentHome: string): string {
	const dirs = getProjectAgentDirs(cwd, agentHome);
	for (const { dir, scope } of dirs) {
		if (scope === "project") return dir;
	}
	return join(cwd, ".pi", "agents");
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function appendSystemPromptOnce(options: { appendSystemPrompt?: string } | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	const current = options.appendSystemPrompt ?? "";
	if (current.includes(normalized)) return;
	options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
}

function buildMcpOrchestratorInstructions(): string {
	const servers = Array.from(projectState.mcpServers.values());
	if (servers.length === 0) return "";

	let instructions = "\n\n<!-- gentle-agent-extensions: MCP servers available -->\n";
	instructions += "## Available MCP Servers\n\n";
	instructions += "The following MCP servers are registered and available for use:\n\n";

	for (const server of servers) {
		if (server.enabled === false) continue;
		
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

function initializeProjectState(cwd: string): void {
	if (projectState.initialized) return;
	projectState.agents = new Set(discoverProjectAgents());
	projectState.overlays = loadOverlays();
	projectState.mcpServers = loadMcpServers();
	projectState.initialized = true;
}

export default function gentleAgentExtensions(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		initializeProjectState(ctx.cwd);

		if (existsSync(SKILLS_DIR)) {
			// Skill registry auto-discovers project skills
		}

		for (const [name, server] of projectState.mcpServers) {
			if (server.enabled === false) continue;

			const config: any = {
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
				pi.registerMcpServer(name, config);
			} catch (error) {
				ctx.ui.notify(`[${EXTENSION_NAME}] Failed to register MCP server ${name}: ${error}`, "warning");
			}
		}

		const agentHome = getAgentHome(ctx.env);
		const projectAgentDir = resolveProjectAgentDir(ctx.cwd, agentHome);
		ensureDir(projectAgentDir);
		await syncAgents(ctx.cwd, agentHome);
	});

	pi.on("before_agent_start", (event, ctx: ExtensionContext) => {
		if (!projectState.initialized) initializeProjectState(ctx.cwd);

		const agentName = (event as { agentName?: string }).agentName;
		const options = event.systemPromptOptions;

		if (!agentName || agentName === "orchestrator") {
			const orchestratorOverlays = projectState.overlays.get("orchestrator") || [];
			for (const overlay of orchestratorOverlays) {
				appendSystemPromptOnce(options, `\n\n<!-- gentle-agent-extensions: overlay for orchestrator -->\n${overlay.instructions}`);
			}
			const mcpInstructions = buildMcpOrchestratorInstructions();
			if (mcpInstructions) appendSystemPromptOnce(options, mcpInstructions);
		}

		if (agentName) {
			const agentOverlays = projectState.overlays.get(agentName) || [];
			for (const overlay of agentOverlays) {
				appendSystemPromptOnce(options, `\n\n<!-- gentle-agent-extensions: overlay for ${agentName} -->\n${overlay.instructions}`);
			}
		}

		return undefined;
	});

	pi.registerCommand("gentle-extensions:sync", {
		description: "Synchronize custom agents, overlays, skills, and MCP servers with the active Pi profile",
		handler: async (_args, ctx) => {
			const agentHome = getAgentHome(ctx.env);
			await syncAgents(ctx.cwd, agentHome);
			ctx.ui.notify("gentle-agent-extensions: sync completed", "info");
		},
	});

	pi.registerCommand("gentle-extensions:doctor", {
		description: "Check gentle-agent-extensions installation and configuration",
		handler: async (_args, ctx) => {
			await runDoctor(ctx.cwd, ctx.env, ctx);
		},
	});

	pi.registerCommand("gentle-extensions:status", {
		description: "Show current gentle-agent-extensions status",
		handler: async (_args, ctx) => {
			if (!projectState.initialized) initializeProjectState(ctx.cwd);

			const agents = Array.from(projectState.agents);
			const overlayTargets = Array.from(projectState.overlays.keys());
			const mcpServers = Array.from(projectState.mcpServers.keys());

			let msg = `gentle-agent-extensions status:\n`;
			msg += `  Project root: ${PROJECT_ROOT}\n`;
			msg += `  Custom agents: ${agents.length > 0 ? agents.join(", ") : "none"}\n`;
			msg += `  Overlays: ${overlayTargets.length > 0 ? overlayTargets.join(", ") : "none"}\n`;
			msg += `  MCP servers: ${mcpServers.length > 0 ? mcpServers.join(", ") : "none"}\n`;
			msg += `  Skills dir: ${existsSync(SKILLS_DIR) ? "present" : "missing"}\n`;

			ctx.ui.notify(msg, "info");
		},
	});
}

async function syncAgents(cwd: string, agentHome: string): Promise<void> {
	if (!existsSync(AGENTS_DIR)) return;

	const projectAgentDir = resolveProjectAgentDir(cwd, agentHome);
	ensureDir(projectAgentDir);

	const manifest = loadManifest();
	const managedAgents: string[] = manifest.managedPaths?.agents || [];

	for (const agentName of projectState.agents) {
		const sourcePath = join(AGENTS_DIR, `${agentName}.md`);
		const targetPath = join(projectAgentDir, `${agentName}.md`);

		try {
			const sourceContent = readFileSync(sourcePath, "utf8");
			let shouldWrite = true;

			if (existsSync(targetPath)) {
				const targetContent = readFileSync(targetPath, "utf8");
				if (targetContent === sourceContent) shouldWrite = false;
			}

			if (shouldWrite) {
				writeFileSync(targetPath, sourceContent);
				if (!managedAgents.includes(targetPath)) managedAgents.push(targetPath);
			}
		} catch (error) {
			ctx.ui?.notify?.(`[${EXTENSION_NAME}] Failed to sync agent ${agentName}: ${error}`, "warning");
		}
	}

	manifest.managedPaths = manifest.managedPaths || {};
	manifest.managedPaths.agents = managedAgents;
	saveManifest(manifest);
}

async function runDoctor(cwd: string, env: NodeJS.ProcessEnv, ctx?: ExtensionContext): Promise<void> {
	const issues: string[] = [];
	const warnings: string[] = [];

	if (!existsSync(AGENTS_DIR)) warnings.push("agents/ directory missing");
	if (!existsSync(OVERLAYS_DIR)) warnings.push("overlays/ directory missing");
	if (!existsSync(ROUTING_DIR)) warnings.push("routing/ directory missing");
	if (!existsSync(SKILLS_DIR)) warnings.push("skills/ directory missing");
	if (!existsSync(MCP_DIR)) warnings.push("mcp/ directory missing");

	const agentHome = getAgentHome(env);
	if (!existsSync(agentHome)) issues.push(`Agent home not found: ${agentHome}`);

	const projectAgentDir = resolveProjectAgentDir(cwd, agentHome);
	if (!existsSync(projectAgentDir)) warnings.push(`Project agent directory does not exist yet: ${projectAgentDir} (will be created on sync)`);

	if (!existsSync(MANIFEST_PATH)) warnings.push("Manifest file missing (.manifest.json)");

	const globalAgentDirs = [join(agentHome, "agents"), join(agentHome, "subagents")];
	const globalAgents = new Map<string, string>();
	for (const dir of globalAgentDirs) {
		if (!existsSync(dir)) continue;
		for (const file of readdirSync(dir)) {
			if (!file.endsWith(".md")) continue;
			const name = file.slice(0, -3);
			if (globalAgents.has(name)) warnings.push(`Duplicate agent name in global scope: ${name} (in ${globalAgents.get(name)} and ${dir})`);
			else globalAgents.set(name, dir);
		}
	}

	for (const agentName of projectState.agents) {
		if (globalAgents.has(agentName)) warnings.push(`Project agent "${agentName}" shadows global agent in ${globalAgents.get(agentName)}`);
	}

	for (const [target] of projectState.overlays) {
		if (target !== "orchestrator") {
			const targetExists = globalAgents.has(target) || projectState.agents.has(target);
			if (!targetExists) warnings.push(`Overlay targets unknown agent: ${target}`);
		}
	}

	if (existsSync(MCP_DIR)) {
		for (const [name, server] of projectState.mcpServers) {
			if (server.transport === "stdio" && !server.command) warnings.push(`MCP server ${name}: stdio transport missing 'command'`);
			if (server.transport === "http" && !server.url) warnings.push(`MCP server ${name}: http transport missing 'url'`);
			if (server.env) {
				for (const [key, value] of Object.entries(server.env)) {
					if (value && !value.startsWith("${") && (key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") || key.toLowerCase().includes("key"))) {
						warnings.push(`MCP server ${name}: env ${key} may contain hardcoded secret (use \${VAR} syntax)`);
					}
				}
			}
		}
	}

	let output = "gentle-agent-extensions doctor:\n\n";
	if (issues.length > 0) { output += "❌ Issues:\n"; for (const issue of issues) output += `  - ${issue}\n`; output += "\n"; }
	if (warnings.length > 0) { output += "⚠️  Warnings:\n"; for (const warning of warnings) output += `  - ${warning}\n`; output += "\n"; }
	if (issues.length === 0 && warnings.length === 0) output += "✅ All checks passed\n";

	if (ctx) ctx.ui.notify(output, issues.length > 0 ? "warning" : "info");
	else console.log(output);
}