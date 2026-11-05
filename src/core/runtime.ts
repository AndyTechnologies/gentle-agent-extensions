import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BUNDLED, existsSync, readFileSync, writeFileSync, readdirSync, join, resolve, ensureDir, getAgentHome, getProjectAgentDir, hashContent } from "./paths.js";
import { DELEGATION_TYPES, OVERLAY_MODES, type OverlayMode, type DelegationType } from "./constants.js";
import { logger } from "./logger.js";
import type { AgentSyncResult } from "../agents/types.js";
import type { OverlayDefinition } from "../overlays/types.js";
import type { RoutingDefinition } from "../routing/types.js";
import type { McpServerDefinition } from "../mcp/types.js";
import { McpLifecycleManager } from "../mcp/lifecycle-manager.js";
import { parseYamlArray } from "./utils.js";

/**
 * Project-specific runtime state.
 * Each project gets its own instance, ensuring isolation.
 */
export interface ProjectRuntime {
	cwd: string;
	initialized: boolean;
	agents: Set<string>;
	overlays: Map<string, OverlayDefinition[]>;
	routing: Map<string, RoutingDefinition>;
	mcpServers: Map<string, McpServerDefinition>;
	mcpLifecycle: McpLifecycleManager;
	agentHome: string;
	projectAgentDir: string;
}

/**
 * Shared resources loaded once from bundled package.
 */
export interface BundledResources {
	agents: Set<string>;
	overlays: Map<string, OverlayDefinition[]>;
	routing: Map<string, RoutingDefinition>;
	mcpServers: Map<string, McpServerDefinition>;
}

/**
 * Extension runtime managing all projects and shared resources.
 */
export interface ExtensionRuntime {
	bundled: BundledResources;
	projects: Map<string, ProjectRuntime>;
	api: ExtensionAPI;
}

const bundledResources = loadBundledResources();

function loadBundledResources(): BundledResources {
	return {
		agents: new Set(discoverBundledAgents()),
		overlays: loadBundledOverlays(),
		routing: loadBundledRouting(),
		mcpServers: loadBundledMcpServers(),
	};
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

		const target = targetMatch?.[1]?.trim();
		if (!target) continue;

		const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 100;
		const mode = (modeMatch?.[1]?.trim() ?? "append") as OverlayMode;

		if (!OVERLAY_MODES.includes(mode)) {
			logger.warn(`Unknown overlay mode '${mode}' for ${file}, defaulting to 'append'`);
		}

		const overlay: OverlayDefinition = {
			target,
			priority,
			mode,
			instructions: body?.trim() ?? "",
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
		} catch {
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

		const agent = agentMatch?.[1]?.trim();
		if (!agent) continue;

		const triggers = triggersMatch ? parseYamlArray(triggersMatch[1]) : [];
		const conditions = conditionsMatch ? parseYamlArray(conditionsMatch[1]) : [];
		const requiredSkills = requiredSkillsMatch ? parseYamlArray(requiredSkillsMatch[1]) : [];
		const requiredMcp = requiredMcpMatch ? parseYamlArray(requiredMcpMatch[1]) : [];
		const delegation = (delegationMatch?.[1]?.trim() ?? "subagent_run") as DelegationType;
		const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 100;

		if (!DELEGATION_TYPES.includes(delegation)) {
			logger.warn(`Unknown delegation '${delegation}' for ${file}, defaulting to 'subagent_run'`);
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

/**
 * Creates and initializes the extension runtime.
 */
export function createRuntime(api: ExtensionAPI): ExtensionRuntime {
	return {
		bundled: bundledResources,
		projects: new Map(),
		api,
	};
}

/**
 * Gets or creates a project runtime for the given working directory.
 */
export function getProjectRuntime(runtime: ExtensionRuntime, cwd: string): ProjectRuntime {
	const normalizedCwd = resolve(cwd);
	let project = runtime.projects.get(normalizedCwd);
	
	if (!project) {
		const agentHome = getAgentHome();
		const projectAgentDir = getProjectAgentDir(normalizedCwd);
		ensureDir(projectAgentDir);
		
		const mcpLifecycle = new McpLifecycleManager(
			"gentle-agent-extensions",
			normalizedCwd
		);
		
		project = {
			cwd: normalizedCwd,
			initialized: false,
			agents: new Set(runtime.bundled.agents),
			overlays: new Map(runtime.bundled.overlays),
			routing: new Map(runtime.bundled.routing),
			mcpServers: new Map(runtime.bundled.mcpServers),
			mcpLifecycle,
			agentHome,
			projectAgentDir,
		};
		
		runtime.projects.set(normalizedCwd, project);
	}
	
	return project;
}

/**
 * Initializes a project runtime (idempotent).
 */
export async function initializeProjectRuntime(project: ProjectRuntime, api: ExtensionAPI): Promise<void> {
	if (project.initialized) return;
	
	// Sync bundled agents to project
	await syncBundledAgentsToProject(project);
	
	// Load MCP lifecycle state
	await project.mcpLifecycle.loadState();
	
	// Register bundled MCP servers
	await registerBundledMcpServers(project, api);
	
	// Sync lifecycle state with registered servers
	for (const [name, server] of project.mcpServers) {
		const state = project.mcpLifecycle.getState(name);
		if (state) {
			server.lifecycleState = state.lifecycleState;
			server.installedVersion = state.installedVersion;
			server.lastHealthCheck = state.lastHealthCheck;
			server.lastError = state.lastError;
		}
	}
	
	project.initialized = true;
	logger.info(`Project runtime initialized for ${project.cwd}`);
}

async function syncBundledAgentsToProject(project: ProjectRuntime): Promise<AgentSyncResult> {
	const synced: string[] = [];
	const conflicts: string[] = [];
	const skipped: string[] = [];

	if (!existsSync(BUNDLED.agents)) return { synced, conflicts, skipped };

	for (const agentName of project.agents) {
		const sourcePath = join(BUNDLED.agents, `${agentName}.md`);
		const targetPath = join(project.projectAgentDir, `${agentName}.md`);

		try {
			const sourceContent = readFileSync(sourcePath, "utf8");
			const sourceHash = hashContent(sourceContent);

			if (existsSync(targetPath)) {
				const targetContent = readFileSync(targetPath, "utf8");
				const targetHash = hashContent(targetContent);

				if (targetHash === sourceHash) {
					skipped.push(agentName);
					continue;
				}

				conflicts.push(agentName);
				continue;
			}

			writeFileSync(targetPath, sourceContent);
			synced.push(agentName);
		} catch (error) {
			logger.warn(`Failed to sync agent ${agentName}: ${error}`);
		}
	}

	return { synced, conflicts, skipped };
}

async function registerBundledMcpServers(project: ProjectRuntime, api: ExtensionAPI): Promise<void> {
	for (const [name, server] of project.mcpServers) {
		const isEnabled = server.enabled !== false;
		if (!isEnabled) continue;

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
		} catch (error) {
			logger.error(`Failed to register MCP server ${name}: ${error}`);
		}
	}
}