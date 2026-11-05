import { BUNDLED, PACKAGE_ROOT, existsSync, readFileSync, readdirSync, join } from "../core/paths.js";
import { parseYamlArray } from "../core/utils.js";
import type { ResourceGraphValidationResult, ResourceGraphNode, ResourceGraphEdge } from "./types.js";

function addEdge(edges: ResourceGraphEdge[], edge: ResourceGraphEdge, _nodeIds: Set<string>): void {
	edges.push(edge);
}

export function buildResourceGraph(_cwd: string): ResourceGraphValidationResult {
	const nodes: ResourceGraphNode[] = [];
	const edges: ResourceGraphEdge[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];
	const nodeIds = new Set<string>();

	function addNode(node: ResourceGraphNode): void {
		if (nodeIds.has(node.id)) {
			errors.push(`Duplicate node ID: ${node.id}`);
			return;
		}
		nodeIds.add(node.id);
		nodes.push(node);
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

	// Build edges by parsing resource files for relationships
	buildEdgesFromResources(nodes, edges, nodeIds);

	return { nodes, edges, errors, warnings };
}

function buildEdgesFromResources(
	nodes: ResourceGraphNode[],
	edges: ResourceGraphEdge[],
	nodeIds: Set<string>
): void {
	const nodeMap = new Map(nodes.map(n => [n.id, n]));

	// Parse routing files to find references to agents, skills, MCP
	if (existsSync(BUNDLED.routing)) {
		for (const file of readdirSync(BUNDLED.routing)) {
			if (!file.endsWith(".md")) continue;
			const routingName = file.slice(0, -3);
			const content = readFileSync(join(BUNDLED.routing, file), "utf8");
			
			const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
			if (!frontmatterMatch) continue;
			
			const [, fm] = frontmatterMatch;
			const agentMatch = /agent:\s*([^\n]+)/.exec(fm);
			if (agentMatch?.[1]) {
				const agentName = agentMatch[1].trim();
				const routingId = `routing:${routingName}`;
				const agentId = `agent:${agentName}`;
				if (nodeMap.has(agentId)) {
					addEdge(edges, { from: routingId, to: agentId, type: "references" }, nodeIds);
				}
			}
			
			const requiredSkillsMatch = /requiredSkills:\s*(\[[\s\S]*?\])/s.exec(fm);
			if (requiredSkillsMatch) {
				const skills = parseYamlArray(requiredSkillsMatch[1]);
				for (const skill of skills) {
					const skillId = `skill:${skill}`;
					if (nodeMap.has(skillId)) {
						addEdge(edges, { from: `routing:${routingName}`, to: skillId, type: "requires" }, nodeIds);
					}
				}
			}
			
			const requiredMcpMatch = /requiredMcp:\s*(\[[\s\S]*?\])/s.exec(fm);
			if (requiredMcpMatch) {
				const mcps = parseYamlArray(requiredMcpMatch[1]);
				for (const mcp of mcps) {
					const mcpId = `mcp:${mcp}`;
					if (nodeMap.has(mcpId)) {
						addEdge(edges, { from: `routing:${routingName}`, to: mcpId, type: "requires" }, nodeIds);
					}
				}
			}
		}
	}

	// Parse overlay files to find target agents
	if (existsSync(BUNDLED.overlays)) {
		for (const file of readdirSync(BUNDLED.overlays)) {
			if (!file.endsWith(".overlay.md")) continue;
			const overlayName = file.replace(".overlay.md", "");
			const content = readFileSync(join(BUNDLED.overlays, file), "utf8");
			
			const targetMatch = /target:\s*([^\n]+)/.exec(content);
			if (targetMatch?.[1]) {
				const target = targetMatch[1].trim();
				const overlayId = `overlay:${overlayName}`;
				const targetId = `agent:${target}`;
				if (nodeMap.has(targetId)) {
					addEdge(edges, { from: overlayId, to: targetId, type: "overlays" }, nodeIds);
				}
			}
		}
	}
}