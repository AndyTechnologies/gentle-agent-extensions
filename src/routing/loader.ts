import { BUNDLED, readFileSync, existsSync, readdirSync, join } from "../core/paths.js";
import { logger } from "../core/logger.js";
import { DELEGATION_TYPES, type DelegationType } from "../core/constants.js";
import { parseYamlArray } from "../core/utils.js";
import type { RoutingDefinition } from "./types.js";

export function loadBundledRouting(): Map<string, RoutingDefinition> {
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

		if (!agentMatch?.[1]) continue;

		const agent = agentMatch[1].trim();
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