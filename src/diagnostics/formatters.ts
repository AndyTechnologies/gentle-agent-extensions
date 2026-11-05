import type { ResourceGraphValidationResult } from "./types.js";

export function generateGraphVizDot(graph: ResourceGraphValidationResult): string {
	let dot = "digraph ResourceGraph {\n";
	dot += "  rankdir=LR;\n";
	dot += "  node [fontname=\"Arial\", fontsize=10];\n";
	dot += "  edge [fontname=\"Arial\", fontsize=8];\n\n";

	const typeColors: Record<string, string> = {
		agent: "#e8a838",
		skill: "#38b8e8",
		routing: "#e838a8",
		overlay: "#38e8a8",
		mcp: "#a838e8",
		manifest: "#e8e838",
	};

	for (const node of graph.nodes) {
		const color = typeColors[node.type] || "#cccccc";
		dot += `  "${node.id}" [label="${node.label}", shape=box, style=filled, fillcolor="${color}", fontcolor="#000000"];\n`;
	}

	for (const edge of graph.edges) {
		dot += `  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];\n`;
	}

	dot += "}\n";
	return dot;
}

export function generateGraphSummary(graph: ResourceGraphValidationResult): string {
	let summary = "Resource Graph Summary\n";
	summary += "========================\n\n";

	const typeCounts = new Map<string, number>();
	for (const node of graph.nodes) {
		typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
	}

	summary += "Nodes:\n";
	for (const [type, count] of typeCounts) {
		summary += `  ${type}: ${count}\n`;
	}
	summary += `  Total: ${graph.nodes.length}\n\n`;

	summary += "Edges:\n";
	const edgeTypeCounts = new Map<string, number>();
	for (const edge of graph.edges) {
		edgeTypeCounts.set(edge.type, (edgeTypeCounts.get(edge.type) || 0) + 1);
	}
	for (const [type, count] of edgeTypeCounts) {
		summary += `  ${type}: ${count}\n`;
	}
	summary += `  Total: ${graph.edges.length}\n\n`;

	if (graph.errors.length > 0) {
		summary += "Errors:\n";
		for (const err of graph.errors) summary += `  ❌ ${err}\n`;
		summary += "\n";
	}

	if (graph.warnings.length > 0) {
		summary += "Warnings:\n";
		for (const warn of graph.warnings) summary += `  ⚠️ ${warn}\n`;
		summary += "\n";
	}

	if (graph.errors.length === 0 && graph.warnings.length === 0) {
		summary += "✅ No issues detected\n";
	}

	return summary;
}

export function formatDoctorOutput(
	issues: string[],
	warnings: string[],
	sections: Record<string, string> = {}
): string {
	let output = "gentle-agent-extensions doctor:\n\n";
	let hasIssues = false;

	if (issues.length > 0) {
		output += "❌ Issues:\n";
		for (const i of issues) output += `  - ${i}\n`;
		output += "\n";
		hasIssues = true;
	}

	if (warnings.length > 0) {
		output += "⚠️  Warnings:\n";
		for (const w of warnings) output += `  - ${w}\n`;
		output += "\n";
	}

	for (const [title, content] of Object.entries(sections)) {
		output += `${title}:\n${content}\n\n`;
	}

	if (!hasIssues && warnings.length === 0 && Object.keys(sections).length === 0) {
		output += "✅ All checks passed\n";
	}

	return output;
}

export function formatMcpHealthOutput(
	results: Array<{ name: string; transport: string; ok: boolean; error?: string; latencyMs?: number }>
): string {
	let output = "MCP Health Check:\n\n";
	let hasErrors = false;

	for (const result of results) {
		const status = result.ok ? "✅" : "❌";
		const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : "";
		output += `  ${status} ${result.name} (${result.transport}): ${result.ok ? "healthy" : result.error || "failed"}${latency}\n`;
		if (!result.ok) hasErrors = true;
	}

	if (!hasErrors && results.length > 0) output += "\n✅ All MCP servers healthy\n";
	if (results.length === 0) output += "No MCP servers configured\n";

	return output;
}