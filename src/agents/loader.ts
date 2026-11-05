import { BUNDLED, readFileSync, existsSync, readdirSync, join } from "../core/paths.js";
import { logger } from "../core/logger.js";
import type { AgentDefinition } from "./types.js";
import { parseYamlArray } from "../core/utils.js";

function getMatchGroup(match: RegExpExecArray | null, index: number): string {
	if (!match || match.length <= index) return "";
	return match[index] ?? "";
}

export function discoverBundledAgents(): string[] {
	if (!existsSync(BUNDLED.agents)) return [];
	return readdirSync(BUNDLED.agents)
		.filter((f: string) => f.endsWith(".md"))
		.map((f: string) => f.slice(0, -3));
}

export function loadBundledAgent(agentName: string): AgentDefinition | null {
	const filePath = join(BUNDLED.agents, `${agentName}.md`);
	if (!existsSync(filePath)) return null;

	try {
		const content = readFileSync(filePath, "utf8");
		const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
		if (!frontmatterMatch) return null;

		const [, fm] = frontmatterMatch;
		const nameMatch = /name:\s*([^\n]+)/.exec(fm);
		const descriptionMatch = /description:\s*([^\n]+)/.exec(fm);
		const toolsMatch = /tools:\s*(\[[\s\S]*?\])/s.exec(fm);

		const name = getMatchGroup(nameMatch, 1).trim();
		if (!name) return null;

		const tools = toolsMatch ? parseYamlArray(getMatchGroup(toolsMatch, 1)) : [];

		return {
			name,
			description: getMatchGroup(descriptionMatch, 1).trim(),
			tools,
		};
	} catch (error) {
		logger.warn(`Failed to load agent ${agentName}: ${error}`);
		return null;
	}
}

export function loadAllBundledAgents(): Map<string, AgentDefinition> {
	const agents = new Map<string, AgentDefinition>();
	const agentNames = discoverBundledAgents();
	
	for (const name of agentNames) {
		const agent = loadBundledAgent(name);
		if (agent) {
			agents.set(name, agent);
		}
	}
	
	return agents;
}