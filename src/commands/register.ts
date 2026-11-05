import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getProjectRuntime } from "../core/runtime.js";
import { syncBundledAgentsToProject } from "../agents/sync.js";
import { runDoctorChecks } from "../diagnostics/doctor.js";
import { buildResourceGraph } from "../diagnostics/resource-graph.js";
import { generateGraphVizDot, generateGraphSummary, formatDoctorOutput, formatMcpHealthOutput } from "../diagnostics/formatters.js";
import { registerBundledMcpServers } from "../mcp/registry.js";
import type { ExtensionRuntime } from "../core/runtime.js";
import { BUNDLED, existsSync, readFileSync, readdirSync, join, PACKAGE_ROOT, hashContent, ensureDir } from "../core/paths.js";

interface CommandArgs {
	graph?: boolean;
	mcpHealth?: boolean;
	dot?: boolean;
	name?: string;
	resources?: boolean;
	routing?: boolean;
}

export function registerCommands(pi: ExtensionAPI, runtime: ExtensionRuntime): void {
	// Sync command
	pi.registerCommand("gentle-extensions:sync", {
		description: "Sync bundled agents to current project",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const result = await syncBundledAgentsToProject(project.projectAgentDir, project.agents);
			
			let output = "gentle-extensions:sync\n";
			if (result.synced.length > 0) output += `  Synced: ${result.synced.join(", ")}\n`;
			if (result.skipped.length > 0) output += `  Skipped (identical): ${result.skipped.join(", ")}\n`;
			if (result.conflicts.length > 0) output += `  Conflicts (user-modified): ${result.conflicts.join(", ")}\n`;
			
			ctx.ui.notify(output, result.conflicts.length > 0 ? "warning" : "info");
		},
	});

	// Doctor command
	pi.registerCommand("gentle-extensions:doctor", {
		description: "Check bundled resources and installation",
		handler: async (args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const typedArgs = args as CommandArgs | undefined;
			const includeGraph = typedArgs?.graph === true;
			const includeMcpHealth = typedArgs?.mcpHealth === true;
			const includeDot = typedArgs?.dot === true;

			if (includeGraph) {
				const graph = buildResourceGraph(ctx.cwd);
				const summary = generateGraphSummary(graph);
				const dot = generateGraphVizDot(graph);
				let output = "Resource Graph:\n\n" + summary;
				if (includeDot) {
					output += "\n\nGraphViz DOT:\n" + dot;
				}
				ctx.ui.notify(output, graph.errors.length > 0 ? "error" : "info");
				return;
			}

			const { issues, warnings } = await runDoctorChecks(
				ctx.cwd,
				process.env,
				includeMcpHealth,
				project.mcpServers
			);

			const output = formatDoctorOutput(issues, warnings);
			ctx.ui.notify(output, issues.length > 0 ? "warning" : "info");
		},
	});

	// Fix command
	pi.registerCommand("gentle-extensions:fix", {
		description: "Auto-fix non-destructive issues (perms, dirs, manifest, overlay modes)",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			let fixes = 0;

			if (!existsSync(project.projectAgentDir)) {
				ensureDir(project.projectAgentDir);
				fixes++;
			}

			await syncBundledAgentsToProject(project.projectAgentDir, project.agents);
			fixes++;

			ctx.ui.notify(`gentle-agent-extensions: applied ${fixes} fix(es)`, "info");
		},
	});

	// Fix destructive command
	pi.registerCommand("gentle-extensions:fix-destructive", {
		description: "Auto-fix including destructive actions (requires confirmation via UI)",
		handler: async (_args, ctx: ExtensionContext) => {
			ctx.ui.notify("Use /gentle-extensions:doctor with --fix-destructive flag via CLI for destructive fixes", "warning");
		},
	});

	// MCP Health command
	pi.registerCommand("gentle-extensions:mcp-health", {
		description: "Check MCP server connectivity (stdio startup, HTTP reachability)",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			
			if (!project.initialized) {
				ctx.ui.notify("Project not initialized. Run session_start first.", "error");
				return;
			}

			const results: Array<{ name: string; transport: string; ok: boolean; error?: string; latencyMs?: number }> = [];
			
			for (const [name, server] of project.mcpServers) {
				if (server.enabled === false) continue;
				const result = await project.mcpLifecycle.healthCheck(server);
				results.push({ name, transport: server.transport, ok: result.ok, error: result.error, latencyMs: result.latencyMs });
			}

			const output = formatMcpHealthOutput(results);
			ctx.ui.notify(output, results.some(r => !r.ok) ? "error" : "info");
		},
	});

	// Status command
	pi.registerCommand("gentle-extensions:status", {
		description: "Show bundled resources status with real-time state",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);

			const agents = Array.from(project.agents);
			const overlayTargets = Array.from(project.overlays.keys());
			const mcpServers = Array.from(project.mcpServers.entries());
			const routingAgents = Array.from(project.routing.entries());
			const skillsDir = join(PACKAGE_ROOT, "resources", "skills");
			const skillDirs = existsSync(skillsDir) 
				? readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
				: [];

			// MCP real-time status
			const mcpStatus = mcpServers.map(([name, server]) => {
				const state = project.mcpLifecycle.getState(name);
				const lifecycleState = state?.lifecycleState || server.lifecycleState || "unknown";
				const version = state?.installedVersion || server.installedVersion || "unknown";
				const health = state?.lastHealthCheck ? ` (checked ${Math.round((Date.now() - state.lastHealthCheck)/1000)}s ago)` : "";
				const error = state?.lastError ? ` - ${state.lastError}` : "";
				return `  ${name}: ${lifecycleState} v${version}${health}${error}`;
			}).join("\n");

			// Routing with details
			const routingDetails = routingAgents.map(([name, route]) => {
				return `  ${name}: agent=${route.agent}, triggers=${route.triggers.join(",")}, priority=${route.priority??100}, skills=${(route.requiredSkills||[]).join(",")}, mcp=${(route.requiredMcp||[]).join(",")}`;
			}).join("\n");

			let msg = `gentle-agent-extensions status:\n`;
			msg += `  Package root: ${PACKAGE_ROOT}\n`;
			msg += `  Extension initialized: ${project.initialized ? "yes" : "no"}\n`;
			msg += `  Bundled agents: ${agents.length > 0 ? agents.join(", ") : "none"}\n`;
			msg += `  Bundled overlays: ${overlayTargets.length > 0 ? overlayTargets.join(", ") : "none"}\n`;
			msg += `  Bundled skills: ${skillDirs.length > 0 ? skillDirs.join(", ") : "none"}\n`;
			msg += `\nMCP Servers (real-time):\n${mcpStatus.length > 0 ? mcpStatus : "  none"}\n`;
			msg += `\nRouting rules (with conditions/skills/MCP):\n${routingDetails.length > 0 ? routingDetails : "  none"}\n`;
			msg += `\nBundled routing agents: ${routingAgents.length > 0 ? routingAgents.map(([n]) => n).join(", ") : "none"}\n`;

			ctx.ui.notify(msg, "info");
		},
	});

	// MCP Reload command
	pi.registerCommand("gentle-extensions:mcp-reload", {
		description: "Reload MCP servers from bundled resources",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			
			// Only unregister extension-owned servers (those in bundled mcp dir)
			const bundledNames = Array.from(project.mcpServers.keys());
			for (const name of bundledNames) {
				try { await runtime.api.unregisterMcpServer(name); } catch {}
			}
			
			// Reload from bundled resources
			const { loadBundledMcpServers } = await import("../mcp/config-loader.js");
			project.mcpServers = loadBundledMcpServers();
			
			// Reload routing
			const { loadBundledRouting } = await import("../routing/loader.js");
			project.routing = loadBundledRouting();
			
			await registerBundledMcpServers(runtime.api, project.mcpServers);
			ctx.ui.notify("MCP servers reloaded from bundled resources", "info");
		},
	});

	// MCP Install command
	pi.registerCommand("gentle-extensions:mcp-install", {
		description: "Install an MCP server explicitly (requires user confirmation)",
		handler: async (args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const typedArgs = args as CommandArgs | undefined;
			const name = typedArgs?.name;
			
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-install <server-name>", "error");
				return;
			}
			
			const server = project.mcpServers.get(name);
			if (!server) {
				ctx.ui.notify(`MCP server ${name} not found`, "error");
				return;
			}
			
			try {
				const success = await project.mcpLifecycle.install(server);
				if (success) {
					ctx.ui.notify(`MCP server ${name} installed successfully`, "info");
					await registerBundledMcpServers(runtime.api, project.mcpServers);
				} else {
					ctx.ui.notify(`Failed to install MCP server ${name}`, "error");
				}
			} catch (e) {
				ctx.ui.notify(`Install error: ${e}`, "error");
			}
		},
	});

	// MCP Uninstall command
	pi.registerCommand("gentle-extensions:mcp-uninstall", {
		description: "Uninstall an MCP server explicitly",
		handler: async (args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const typedArgs = args as CommandArgs | undefined;
			const name = typedArgs?.name;
			
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-uninstall <server-name>", "error");
				return;
			}
			
			try {
				const success = await project.mcpLifecycle.uninstall(name);
				if (success) {
					ctx.ui.notify(`MCP server ${name} uninstalled successfully`, "info");
					await registerBundledMcpServers(runtime.api, project.mcpServers);
				} else {
					ctx.ui.notify(`Failed to uninstall MCP server ${name}`, "error");
				}
			} catch (e) {
				ctx.ui.notify(`Uninstall error: ${e}`, "error");
			}
		},
	});

	// MCP Status command
	pi.registerCommand("gentle-extensions:mcp-status", {
		description: "Show MCP servers status (available, disabled, failed, not_installed)",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const report = await project.mcpLifecycle.getStatusReport();
			ctx.ui.notify(report, "info");
		},
	});

	// MCP Logs command
	pi.registerCommand("gentle-extensions:mcp-logs", {
		description: "Show MCP server logs (stdio stderr/stdout)",
		handler: async (args, ctx: ExtensionContext) => {
			const typedArgs = args as CommandArgs | undefined;
			const name = typedArgs?.name;
			if (!name) {
				ctx.ui.notify("Usage: /gentle-extensions:mcp-logs <server-name>", "error");
				return;
			}
			ctx.ui.notify("MCP logs retrieval not yet implemented for this server", "warning");
		},
	});

	// Resources command
	pi.registerCommand("gentle-extensions:resources", {
		description: "Show bundled vs local vs outdated vs conflicted resources",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const result = await syncBundledAgentsToProject(project.projectAgentDir, project.agents);
			const skillsDir = join(PACKAGE_ROOT, "resources", "skills");
			const skillDirs = existsSync(skillsDir) 
				? readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
				: [];

			let output = "Resources Status:\n\n";
			output += "Agents:\n";
			if (result.synced.length > 0) output += `  Synced: ${result.synced.join(", ")}\n`;
			if (result.skipped.length > 0) output += `  Skipped (identical): ${result.skipped.join(", ")}\n`;
			if (result.conflicts.length > 0) output += `  Conflicts (user-modified): ${result.conflicts.join(", ")}\n`;
			if (result.synced.length === 0 && result.skipped.length === 0 && result.conflicts.length === 0) {
				output += "  No agents found\n";
			}

			output += "\nSkills:\n";
			if (existsSync(join(PACKAGE_ROOT, "resources", "skills"))) {
				output += `  Bundled: ${skillDirs.join(", ")}\n`;
			} else {
				output += "  No skills directory\n";
			}

			output += "\nOverlays:\n";
			const overlayTargets = Array.from(project.overlays.keys());
			output += `  Bundled: ${overlayTargets.length > 0 ? overlayTargets.join(", ") : "none"}\n`;

			output += "\nMCP Servers:\n";
			const mcpServers = Array.from(project.mcpServers.entries());
			if (mcpServers.length > 0) {
				for (const [name, server] of mcpServers) {
					const state = project.mcpLifecycle.getState(name);
					const lifecycleState = state?.lifecycleState || server.lifecycleState || "unknown";
					const version = state?.installedVersion || server.installedVersion || "unknown";
					output += `  ${name}: ${lifecycleState} v${version} (${server.transport})\n`;
				}
			} else {
				output += "  none\n";
			}

			output += "\nRouting:\n";
			const routingAgents = Array.from(project.routing.entries());
			if (routingAgents.length > 0) {
				for (const [name, route] of routingAgents) {
					output += `  ${name}: agent=${route.agent}, triggers=${route.triggers.join(",")}, priority=${route.priority ?? 100}\n`;
				}
			} else {
				output += "  none\n";
			}

			ctx.ui.notify(output, "info");
		},
	});

	// Routing command
	pi.registerCommand("gentle-extensions:routing", {
		description: "Show routing rules loaded and their agents/skills/MCP requirements",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const routingAgents = Array.from(project.routing.entries());
			
			if (routingAgents.length === 0) {
				ctx.ui.notify("No routing rules loaded", "info");
				return;
			}

			let output = "Routing Rules:\n\n";
			for (const [name, route] of routingAgents) {
				output += `## ${name}\n`;
				output += `  Agent: ${route.agent}\n`;
				output += `  Triggers: ${route.triggers.join(", ")}\n`;
				if (route.conditions && route.conditions.length > 0) {
					output += `  Conditions: ${route.conditions.join(", ")}\n`;
				}
				if (route.requiredSkills && route.requiredSkills.length > 0) {
					output += `  Required Skills: ${route.requiredSkills.join(", ")}\n`;
				}
				if (route.requiredMcp && route.requiredMcp.length > 0) {
					output += `  Required MCP: ${route.requiredMcp.join(", ")}\n`;
				}
				output += `  Delegation: ${route.delegation}\n`;
				output += `  Priority: ${route.priority ?? 100}\n\n`;
			}

			ctx.ui.notify(output, "info");
		},
	});

	// Conflicts command
	pi.registerCommand("gentle-extensions:conflicts", {
		description: "Show 3-way diff: bundled vs local vs user-modified resources",
		handler: async (_args, ctx: ExtensionContext) => {
			const project = getProjectRuntime(runtime, ctx.cwd);
			const result = await syncBundledAgentsToProject(project.projectAgentDir, project.agents);
			
			let output = "Resource Conflicts (3-way diff):\n\n";

			if (result.conflicts.length > 0) {
				output += "Conflicts (user-modified, differs from bundled):\n";
				for (const name of result.conflicts) {
					const sourcePath = join(BUNDLED.agents, name + ".md");
					const targetPath = join(project.projectAgentDir, name + ".md");
					const sourceContent = readFileSync(sourcePath, "utf8");
					const targetContent = readFileSync(targetPath, "utf8");
					const sourceHash = hashContent(sourceContent).slice(0, 8);
					const targetHash = hashContent(targetContent).slice(0, 8);
					output += `  ${name}: bundled=${sourceHash} vs local=${targetHash} (DIFFER)\n`;
				}
			} else {
				output += "No conflicts detected\n";
			}

			ctx.ui.notify(output, result.conflicts.length > 0 ? "warning" : "info");
		},
	});
}