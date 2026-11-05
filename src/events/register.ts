import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { logger } from "../core/logger.js";
import { getProjectRuntime, initializeProjectRuntime } from "../core/runtime.js";
import { applyOverlays } from "../overlays/applier.js";
import { evaluateRouting } from "../routing/evaluator.js";
import { buildMcpOrchestratorInstructions } from "../mcp/utils.js";
import type { ExtensionRuntime } from "../core/runtime.js";

export function registerEvents(pi: ExtensionAPI, runtime: ExtensionRuntime): void {
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		logger.debug(`session_start for ${ctx.cwd}`);
		
		const project = getProjectRuntime(runtime, ctx.cwd);
		await initializeProjectRuntime(project, runtime.api);
	});

	pi.on("before_agent_start", (event, ctx: ExtensionContext) => {
		logger.debug(`before_agent_start for ${ctx.cwd}`);
		
		const project = getProjectRuntime(runtime, ctx.cwd);
		if (!project.initialized) {
			// This shouldn't happen if session_start ran, but handle gracefully
			logger.warn("Project not initialized, initializing now");
			// Note: we can't await here since this is a synchronous event handler
			// The initialization should have happened in session_start
		}

		const agentName = (event as { agentName?: string }).agentName;
		const options = event.systemPromptOptions;
		if (!options) return;

		// Apply bundled overlays for orchestrator
		if (!agentName || agentName === "orchestrator") {
			const orchestratorOverlays = project.overlays.get("orchestrator") || [];
			applyOverlays(orchestratorOverlays, "orchestrator", options);
			
			const mcpInstructions = buildMcpOrchestratorInstructions(project.mcpServers);
			if (mcpInstructions) {
				options.appendSystemPrompt = (options.appendSystemPrompt ?? "") 
					? `${options.appendSystemPrompt}\n\n${mcpInstructions}`
					: mcpInstructions;
			}
		}

		// Apply agent-specific overlays
		if (agentName) {
			const agentOverlays = project.overlays.get(agentName) || [];
			applyOverlays(agentOverlays, agentName, options);

			// Routing: evaluate and inject delegation instructions
			const routingResult = evaluateRouting(agentName, project.routing, { cwd: ctx.cwd, env: process.env });
			if (routingResult.routes.length > 0) {
				const primaryRoute = routingResult.primaryRoute!;
				let routingInstructions = `\n\n<!-- gentle-agent-extensions: routing for ${agentName} -->\n`;
				routingInstructions += `## Delegation Rules for ${agentName}\n`;
				routingInstructions += `- **Primary Agent**: ${primaryRoute.agent}\n`;
				routingInstructions += `- **Triggers**: ${primaryRoute.triggers.join(", ")}\n`;
				if (primaryRoute.requiredSkills && primaryRoute.requiredSkills.length > 0) {
					routingInstructions += `- **Required Skills**: ${primaryRoute.requiredSkills.join(", ")}\n`;
				}
				if (primaryRoute.requiredMcp && primaryRoute.requiredMcp.length > 0) {
					routingInstructions += `- **Required MCP**: ${primaryRoute.requiredMcp.join(", ")}\n`;
				}
				routingInstructions += `- **Delegation**: ${primaryRoute.delegation}\n`;
				routingInstructions += `- **Priority**: ${primaryRoute.priority ?? 100}\n`;
				
				if (routingResult.fallbackRoutes.length > 0) {
					routingInstructions += `\n**Fallback Routes** (lower priority):\n`;
					for (const r of routingResult.fallbackRoutes) {
						routingInstructions += `- ${r.agent} (priority ${r.priority ?? 100}): triggers=${r.triggers.join(",")}\n`;
					}
				}
				
				options.appendSystemPrompt = (options.appendSystemPrompt ?? "")
					? `${options.appendSystemPrompt}\n\n${routingInstructions}`
					: routingInstructions;
			}
		}
	});
}