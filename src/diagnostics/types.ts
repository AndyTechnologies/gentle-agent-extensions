export interface DoctorCheckResult {
	issues: string[];
	warnings: string[];
}

export interface ResourceGraphNode {
	id: string;
	type: "agent" | "skill" | "routing" | "overlay" | "mcp" | "manifest";
	label: string;
	path: string;
}

export interface ResourceGraphEdge {
	from: string;
	to: string;
	type: "references" | "requires" | "triggers" | "overlays" | "depends" | "installs";
}

export interface ResourceGraphValidationResult {
	nodes: ResourceGraphNode[];
	edges: ResourceGraphEdge[];
	errors: string[];
	warnings: string[];
}

export interface DiagnosticReport {
	hasIssues: boolean;
	issues: string[];
	warnings: string[];
	sections: Record<string, string>;
}