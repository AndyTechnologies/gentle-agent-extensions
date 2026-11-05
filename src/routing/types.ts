import type { DelegationType } from "../core/constants.js";

export interface RoutingDefinition {
	agent: string;
	triggers: string[];
	conditions: string[];
	delegation: DelegationType;
	requiredSkills?: string[];
	requiredMcp?: string[];
	priority?: number;
}

export interface RoutingEvaluationContext {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
}

export interface RoutingEvaluationResult {
	routes: RoutingDefinition[];
	primaryRoute: RoutingDefinition | null;
	fallbackRoutes: RoutingDefinition[];
}