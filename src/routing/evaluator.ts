import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { RoutingDefinition, RoutingEvaluationContext, RoutingEvaluationResult } from "./types.js";

export function evaluateRouting(
	agentName: string,
	routingRules: Map<string, RoutingDefinition>,
	ctx?: RoutingEvaluationContext
): RoutingEvaluationResult {
	const routes = Array.from(routingRules.values())
		.filter((r) => {
			// Check triggers
			const triggerMatch = r.triggers.some(
				(t) => agentName.includes(t) || t.includes(agentName)
			);
			if (!triggerMatch) return false;

			// Check conditions
			if (r.conditions && r.conditions.length > 0 && ctx) {
				return r.conditions.every((c) => evaluateCondition(c, ctx));
			}
			return true;
		})
		.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

	const primaryRoute = routes.length > 0 ? routes[0] : null;
	const fallbackRoutes = routes.slice(1);

	return { routes, primaryRoute, fallbackRoutes };
}

export function evaluateCondition(
	condition: string,
	ctx: RoutingEvaluationContext
): boolean {
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
			const currentBranch = spawnSync("git", ["branch", "--show-current"], {
				cwd: ctx.cwd,
				encoding: "utf8",
			}).stdout.trim();
			return currentBranch === expectedBranch;
		} catch {
			return false;
		}
	}

	// Custom function: func:functionName (for future extensibility)
	return false;
}